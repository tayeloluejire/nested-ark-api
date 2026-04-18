'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import {
  ShieldCheck, Bell, FileText, DollarSign, Building2, Users,
  Loader2, AlertCircle, ArrowLeft, CheckCircle2, Clock,
  Zap, RefreshCw, Download, Send, ChevronDown, ChevronUp,
  Home, AlertTriangle, Gavel, Receipt, UserX, Plus,
  TrendingUp, Lock, Scale,
} from 'lucide-react';

// ── Defensive numeric helpers ─────────────────────────────────────────────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();

interface ManagementData {
  summary: {
    total_units: number; occupied_units: number; vacant_units: number;
    occupancy_pct: number; monthly_rent_ngn: number;
    total_vault_balance_ngn: number; overdue_tenancies: number;
    active_vaults: number; funded_vaults: number; pending_notices: number;
  };
  units: any[]; tenancies: any[]; vaults: any[];
  reminders: any[]; notices: any[]; overdue: any[];
}

type Tab = 'overview' | 'litigation' | 'tenants' | 'vaults' | 'reminders';

// ── Notice type config ────────────────────────────────────────────────────────
const NOTICE_TYPES = [
  { value: 'NOTICE_TO_PAY',    label: 'Notice to Pay',    severity: 'amber', desc: 'Formal demand for outstanding rent payment' },
  { value: 'NOTICE_TO_QUIT',   label: 'Notice to Quit',   severity: 'red',   desc: 'Legal notice requiring tenant to vacate the property' },
  { value: 'FINAL_WARNING',    label: 'Final Warning',    severity: 'red',   desc: 'Final notice before formal eviction proceedings' },
  { value: 'EVICTION_WARNING', label: 'Eviction Warning', severity: 'rose',  desc: 'Official eviction warning — court proceedings may follow' },
];

const severityStyle = (s: string) =>
  s === 'amber' ? 'border-amber-500/30 bg-amber-500/5 text-amber-400'
  : s === 'red'  ? 'border-red-500/30 bg-red-500/5 text-red-400'
  : 'border-rose-500/30 bg-rose-500/5 text-rose-400';

export default function RentalManagementPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [data,    setData]    = useState<ManagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [tab,     setTab]     = useState<Tab>('overview');

  const [noticeModal,       setNoticeModal]       = useState<any>(null);
  const [bulkSending,       setBulkSending]       = useState(false);
  const [bulkResult,        setBulkResult]        = useState<any>(null);
  const [generatingNotice,  setGeneratingNotice]  = useState(false);
  const [noticeForm,        setNoticeForm]        = useState({ notice_type: 'NOTICE_TO_QUIT', notes: '' });
  const [expandedUnit,      setExpandedUnit]      = useState<string | null>(null);
  const [selectedNoticeType, setSelectedNoticeType] = useState('NOTICE_TO_QUIT');

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true); setError('');
    try {
      const res = await api.get(`/api/rental/management/${projectId}`);
      setData(res.data);
    } catch (ex: any) {
      setError(ex?.response?.data?.error ?? 'Could not load management data.');
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const sendBulkReminder = async () => {
    setBulkSending(true); setBulkResult(null);
    try {
      const res = await api.post('/api/reminders/send-bulk', { project_id: projectId });
      setBulkResult(res.data);
    } catch (ex: any) {
      setBulkResult({ error: ex?.response?.data?.error ?? 'Failed' });
    } finally { setBulkSending(false); }
  };

  const generateNotice = async (tenancyId: string, amountOverdue: number, daysOverdue: number) => {
    setGeneratingNotice(true);
    try {
      const res = await api.post('/api/notices/generate', {
        tenancy_id:     tenancyId,
        notice_type:    noticeForm.notice_type,
        amount_overdue: amountOverdue,
        days_overdue:   daysOverdue,
        notes:          noticeForm.notes,
      }, { responseType: 'blob' });
      if (res.headers['content-type']?.includes('pdf')) {
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url; a.download = `${res.headers['x-notice-number'] ?? 'ARK-NOTICE'}.pdf`; a.click();
        URL.revokeObjectURL(url);
      } else {
        const json = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        if (json.html_notice) { const w = window.open('', '_blank'); if (w) { w.document.write(json.html_notice); w.document.close(); } }
      }
      setNoticeModal(null); load();
    } catch (ex: any) { alert(ex?.response?.data?.error ?? 'Failed to generate notice'); }
    finally { setGeneratingNotice(false); }
  };

  const downloadNotice = async (noticeId: string, noticeNumber: string) => {
    try {
      const res = await api.get(`/api/notices/download/${noticeId}`, { responseType: 'blob' });
      const mime = res.headers['content-type'] || 'text/html';
      const url  = URL.createObjectURL(new Blob([res.data], { type: mime }));
      const a    = document.createElement('a');
      a.href = url; a.download = `${noticeNumber}.${mime.includes('pdf') ? 'pdf' : 'html'}`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Download failed'); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white"><Navbar />
      <div className="flex items-center justify-center py-40"><Loader2 className="animate-spin text-teal-500" size={28} /></div>
    <Footer /></div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#050505] text-white"><Navbar />
      <div className="max-w-xl mx-auto px-6 py-40 text-center space-y-4">
        <AlertCircle className="text-amber-400 mx-auto" size={32} />
        <p className="font-bold">{error}</p>
        <button onClick={load} className="text-teal-500 text-xs font-bold uppercase tracking-widest">Retry →</button>
      </div><Footer /></div>
  );

  const s = data!.summary;
  const overdueCount = data!.overdue.length;
  const noticesCount = data!.notices.length;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <button onClick={() => router.back()}
              className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-4">
              <ArrowLeft size={12} /> Back to Project
            </button>
            <div className="border-l-2 border-teal-500 pl-5">
              <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Property Management Command Centre</p>
              <h1 className="text-3xl font-black uppercase tracking-tighter">Property Control</h1>
              <p className="text-zinc-500 text-xs mt-1">Tenant Onboarding · Flex-Pay · Legal Notices · Litigation · Ejection</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setNoticeModal({ tenancy_id: '', tenant_name: '', unit_name: '', rent_amount: 0 }); setTab('litigation'); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-red-500/20 transition-all">
              <Gavel size={12} /> Issue Notice / Quit
            </button>
            <button onClick={load} className="p-2.5 border border-zinc-800 rounded-xl text-zinc-500 hover:text-teal-500 transition-all">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* ── OVERDUE URGENT ALERT ────────────────────────────────────────── */}
        {overdueCount > 0 && (
          <div className="p-5 rounded-2xl border border-red-500/30 bg-red-500/5 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500/15"><AlertTriangle size={18} className="text-red-400" /></div>
              <div>
                <p className="font-black text-sm text-red-400">{overdueCount} overdue tenancy{overdueCount !== 1 ? 'ies' : 'y'} require action</p>
                <p className="text-[10px] text-zinc-500">Issue a Notice to Quit or Notice to Pay to begin formal proceedings</p>
              </div>
            </div>
            <button onClick={() => setTab('litigation')}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-red-400 transition-all">
              <Gavel size={12} /> Open Litigation Centre
            </button>
          </div>
        )}

        {/* ── KPI ROW ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Occupancy',      value: `${safeN(s.occupancy_pct)}%`,    sub: `${s.occupied_units}/${s.total_units} units`,  color: 'text-teal-400',  border: 'border-teal-500/20' },
            { label: 'Monthly Rent',   value: `₦${safeF(s.monthly_rent_ngn)}`, sub: 'contracted',                                  color: 'text-amber-400', border: 'border-amber-500/20' },
            { label: 'Vault Balance',  value: `₦${safeF(s.total_vault_balance_ngn)}`, sub: `${s.active_vaults} vaults`,            color: 'text-blue-400',  border: 'border-blue-500/20' },
            { label: 'Overdue',        value: String(s.overdue_tenancies),      sub: 'tenancies',                                   color: overdueCount > 0 ? 'text-red-400' : 'text-zinc-500', border: overdueCount > 0 ? 'border-red-500/30' : 'border-zinc-800' },
            { label: 'Notices Issued', value: String(s.pending_notices),        sub: 'active notices',                              color: s.pending_notices > 0 ? 'text-rose-400' : 'text-zinc-500', border: s.pending_notices > 0 ? 'border-rose-500/20' : 'border-zinc-800' },
          ].map(k => (
            <div key={k.label} className={`p-4 rounded-2xl border ${k.border} bg-zinc-900/20 space-y-1`}>
              <p className={`text-2xl font-black font-mono tabular-nums ${k.color}`}>{k.value}</p>
              <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{k.label}</p>
              <p className="text-[9px] text-zinc-700">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* ── QUICK ACTIONS ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Notice to Quit', icon: UserX, color: 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20', action: () => { setNoticeForm(f => ({ ...f, notice_type: 'NOTICE_TO_QUIT' })); setNoticeModal({ tenancy_id: '', tenant_name: '', unit_name: '', rent_amount: 0 }); } },
            { label: 'Notice to Pay',  icon: Receipt, color: 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20', action: () => { setNoticeForm(f => ({ ...f, notice_type: 'NOTICE_TO_PAY' })); setNoticeModal({ tenancy_id: '', tenant_name: '', unit_name: '', rent_amount: 0 }); } },
            { label: 'Bulk Reminder',  icon: Bell, color: 'bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/20', action: sendBulkReminder },
            { label: 'Litigation Log', icon: Scale, color: 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500', action: () => setTab('litigation') },
          ].map(a => {
            const Icon = a.icon;
            return (
              <button key={a.label} onClick={a.action}
                className={`flex items-center justify-center gap-2 p-4 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all ${a.color}`}>
                {(a.label === 'Bulk Reminder' && bulkSending) ? <Loader2 className="animate-spin" size={14} /> : <Icon size={14} />}
                {a.label}
              </button>
            );
          })}
        </div>

        {bulkResult && (
          <div className={`p-3 rounded-xl text-xs font-bold ${bulkResult.error ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'}`}>
            {bulkResult.error ? bulkResult.error : `✓ Sent ${bulkResult.sent} reminders · ${bulkResult.failed} failed`}
          </div>
        )}

        {/* ── TABS ────────────────────────────────────────────────────────── */}
        <div className="border-b border-zinc-800 flex gap-0 overflow-x-auto">
          {([
            { key: 'overview',   label: 'Overview',            icon: Building2 },
            { key: 'litigation', label: 'Litigation & Notices', icon: Gavel,    badge: (overdueCount + noticesCount) || 0 },
            { key: 'tenants',    label: 'Tenants',              icon: Users,    badge: s.overdue_tenancies },
            { key: 'vaults',     label: 'Flex Vaults',          icon: DollarSign },
            { key: 'reminders',  label: 'Reminders',            icon: Bell },
          ] as const).map(({ key, label, icon: Icon, badge }: any) => (
            <button key={key} onClick={() => setTab(key as Tab)}
              className={`flex items-center gap-2 px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                tab === key ? 'text-teal-400 border-teal-500' : 'text-zinc-500 border-transparent hover:text-white'
              }`}>
              <Icon size={11} /> {label}
              {badge > 0 && (
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                  key === 'litigation' ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'
                }`}>{badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            OVERVIEW TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Unit Status</p>
              <Link href={`/projects/${projectId}/rental`}
                className="flex items-center gap-1.5 text-[9px] text-teal-500 hover:text-white font-bold uppercase tracking-widest transition-colors">
                Rental Dashboard <Home size={9} />
              </Link>
            </div>
            {data!.units.map((u: any) => (
              <div key={u.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
                <div className="p-4 flex items-center justify-between gap-4 flex-wrap cursor-pointer"
                  onClick={() => setExpandedUnit(expandedUnit === u.id ? null : u.id)}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${u.status === 'OCCUPIED' ? 'bg-teal-500' : u.status === 'VACANT' ? 'bg-zinc-600' : 'bg-amber-500'}`} />
                    <div>
                      <p className="font-bold text-sm">{u.unit_name}</p>
                      <p className="text-[9px] text-zinc-500">{u.unit_type} · {u.status}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-mono font-bold text-sm text-teal-400">₦{safeF(u.rent_amount)}</p>
                      <p className="text-[8px] text-zinc-600">per annum</p>
                    </div>
                    {u.vault_balance && (
                      <div className="text-right">
                        <p className="font-mono text-xs text-blue-400">₦{safeF(u.vault_balance)}</p>
                        <p className="text-[8px] text-zinc-600">vault</p>
                      </div>
                    )}
                    {expandedUnit === u.id ? <ChevronUp size={14} className="text-zinc-600" /> : <ChevronDown size={14} className="text-zinc-600" />}
                  </div>
                </div>
                {expandedUnit === u.id && u.tenancy_id && (
                  <div className="border-t border-zinc-800 p-4 bg-zinc-900/10 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[9px] text-zinc-500">
                      <div><p className="uppercase font-bold mb-1">Tenant</p><p className="text-white">{u.tenant_name}</p></div>
                      <div><p className="uppercase font-bold mb-1">Email</p><p className="text-zinc-400 truncate">{u.tenant_email}</p></div>
                      <div><p className="uppercase font-bold mb-1">Payments</p><p className="text-teal-400">{u.payment_count} made</p></div>
                      <div><p className="uppercase font-bold mb-1">Last Paid</p><p className="text-zinc-400">{u.last_paid_at ? new Date(u.last_paid_at).toLocaleDateString() : 'Never'}</p></div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => { setNoticeForm(f => ({ ...f, notice_type: 'NOTICE_TO_QUIT' })); setNoticeModal({ tenancy_id: u.tenancy_id, tenant_name: u.tenant_name, unit_name: u.unit_name, rent_amount: u.rent_amount }); }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-red-500/20 transition-all">
                        <UserX size={9} /> Notice to Quit
                      </button>
                      <button onClick={() => { setNoticeForm(f => ({ ...f, notice_type: 'NOTICE_TO_PAY' })); setNoticeModal({ tenancy_id: u.tenancy_id, tenant_name: u.tenant_name, unit_name: u.unit_name, rent_amount: u.rent_amount }); }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-amber-500/20 transition-all">
                        <Receipt size={9} /> Notice to Pay
                      </button>
                      <button onClick={sendBulkReminder} disabled={bulkSending}
                        className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 text-zinc-400 hover:text-white font-bold text-[9px] uppercase tracking-widest rounded-xl transition-all">
                        <Bell size={9} /> Reminder
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            LITIGATION & NOTICES TAB — MAIN COMMAND CENTRE
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'litigation' && (
          <div className="space-y-6">

            {/* Generator hero panel */}
            <div className="p-6 rounded-3xl border border-red-500/25 bg-gradient-to-br from-red-500/5 via-zinc-950 to-zinc-950 space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-red-500/15"><Gavel size={20} className="text-red-400" /></div>
                <div>
                  <p className="font-black text-lg uppercase tracking-tight">Litigation & Notice Generator</p>
                  <p className="text-[10px] text-zinc-500">Issue court-admissible legal notices · SHA-256 hashed · Auto-emailed as PDF</p>
                </div>
              </div>

              {/* Notice type selector — prominent */}
              <div>
                <p className="text-[9px] text-zinc-400 uppercase font-bold tracking-[0.2em] mb-3">Select Notice Type</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {NOTICE_TYPES.map(nt => (
                    <button key={nt.value} onClick={() => { setSelectedNoticeType(nt.value); setNoticeForm(f => ({ ...f, notice_type: nt.value })); }}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        selectedNoticeType === nt.value
                          ? nt.severity === 'amber' ? 'border-amber-500/60 bg-amber-500/10'
                          : nt.severity === 'rose' ? 'border-rose-500/60 bg-rose-500/10'
                          : 'border-red-500/60 bg-red-500/10'
                          : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-600'
                      }`}>
                      <p className={`font-black text-xs uppercase tracking-tight mb-1 ${
                        selectedNoticeType === nt.value
                          ? nt.severity === 'amber' ? 'text-amber-400' : nt.severity === 'rose' ? 'text-rose-400' : 'text-red-400'
                          : 'text-zinc-300'
                      }`}>{nt.label}</p>
                      <p className="text-[9px] text-zinc-600 leading-relaxed">{nt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tenant selector */}
              <div>
                <p className="text-[9px] text-zinc-400 uppercase font-bold tracking-[0.2em] mb-3">Select Tenant</p>
                <div className="space-y-2">
                  {data!.tenancies.length === 0 ? (
                    <p className="text-zinc-600 text-xs">No tenants currently on record.</p>
                  ) : (
                    data!.tenancies.map((t: any) => (
                      <button key={t.id} onClick={() => setNoticeModal({ tenancy_id: t.id, tenant_name: t.tenant_name, unit_name: t.unit_name, rent_amount: t.rent_amount })}
                        className="w-full flex items-center justify-between gap-4 p-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-red-500/30 hover:bg-red-500/5 transition-all text-left group">
                        <div>
                          <p className="font-bold text-sm">{t.tenant_name}</p>
                          <p className="text-[9px] text-zinc-500">{t.unit_name} · {t.tenant_email}</p>
                          {t.notice_count > 0 && <span className="text-[8px] text-amber-400">{t.notice_count} prior notice{t.notice_count !== 1 ? 's' : ''}</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm text-teal-400">₦{safeF(t.rent_amount)}</span>
                          <span className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-[8px] uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                            Issue Notice →
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Overdue — highlighted for immediate action */}
              {data!.overdue.length > 0 && (
                <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/5 space-y-3">
                  <p className="text-[9px] text-red-400 uppercase font-bold tracking-widest flex items-center gap-2">
                    <AlertTriangle size={10} /> Requires Immediate Action — {data!.overdue.length} Overdue
                  </p>
                  {data!.overdue.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <p className="font-bold text-sm">{t.tenant_name}</p>
                        <p className="text-[9px] text-zinc-500">{t.unit_name} · {Math.round(safeN(t.days_since_payment))} days overdue</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-red-400">₦{safeF(t.rent_amount)}</span>
                        <button onClick={() => setNoticeModal({ tenancy_id: t.id, tenant_name: t.tenant_name, unit_name: t.unit_name, rent_amount: t.rent_amount, days_overdue: Math.round(safeN(t.days_since_payment)) })}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white font-bold text-[8px] uppercase tracking-widest rounded-lg hover:bg-red-400 transition-all">
                          <Gavel size={9} /> Issue Notice Now
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notice history */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Notice History & Litigation Log</p>
                <div className="flex items-center gap-1.5 text-[8px] text-zinc-600">
                  <Lock size={8} className="text-teal-500/50" /> SHA-256 immutable log
                </div>
              </div>

              {data!.notices.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-zinc-800 rounded-2xl">
                  <Scale className="text-zinc-700 mx-auto mb-3" size={28} />
                  <p className="text-zinc-500 font-bold text-sm">No notices on record</p>
                  <p className="text-zinc-700 text-xs mt-1">Issued notices will appear here, permanently logged</p>
                </div>
              ) : (
                data!.notices.map((n: any) => (
                  <div key={n.id} className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl mt-0.5 ${n.notice_type === 'NOTICE_TO_QUIT' || n.notice_type === 'EVICTION_WARNING' ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                        <Gavel size={13} className={n.notice_type === 'NOTICE_TO_QUIT' || n.notice_type === 'EVICTION_WARNING' ? 'text-red-400' : 'text-amber-400'} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono text-[9px] text-teal-500">{n.notice_number}</span>
                          <span className={`text-[8px] px-2 py-0.5 rounded font-bold uppercase ${
                            n.status === 'RESOLVED' ? 'bg-teal-500/10 text-teal-400' :
                            n.status === 'SERVED'   ? 'bg-amber-500/10 text-amber-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>{n.status}</span>
                          <span className="text-[8px] text-zinc-600 uppercase font-bold">{n.notice_type.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="font-bold text-sm">{n.tenant_name} · {n.unit_name}</p>
                        <p className="text-[9px] text-zinc-500">
                          ₦{safeF(n.amount_overdue)} overdue · {new Date(n.issued_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => downloadNotice(n.id, n.notice_number)}
                      className="flex items-center gap-1.5 px-3 py-2 border border-zinc-700 text-zinc-400 hover:text-teal-400 font-bold text-[9px] uppercase tracking-widest rounded-xl transition-all">
                      <Download size={9} /> Download PDF
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TENANTS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'tenants' && (
          <div className="space-y-3">
            {data!.overdue.length > 0 && (
              <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 space-y-3">
                <p className="text-[9px] text-red-400 uppercase font-bold tracking-widest flex items-center gap-2">
                  <AlertCircle size={10} /> {data!.overdue.length} Overdue
                </p>
                {data!.overdue.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-bold text-sm">{t.tenant_name}</p>
                      <p className="text-[9px] text-zinc-500">{t.unit_name} · {Math.round(safeN(t.days_since_payment))}d overdue</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-red-400">₦{safeF(t.rent_amount)}</span>
                      <button onClick={() => setNoticeModal({ tenancy_id: t.id, tenant_name: t.tenant_name, unit_name: t.unit_name, rent_amount: t.rent_amount, days_overdue: Math.round(safeN(t.days_since_payment)) })}
                        className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-[8px] uppercase tracking-widest rounded-lg hover:bg-red-500/30 transition-all">
                        Issue Notice
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {data!.tenancies.map((t: any) => (
              <div key={t.id} className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-bold text-sm">{t.tenant_name}</p>
                  <p className="text-[9px] text-zinc-500">{t.unit_name} · {t.tenant_email}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[8px] text-zinc-600">{t.contribution_count} contributions</span>
                    {t.notice_count > 0 && <span className="text-[8px] text-amber-400">{t.notice_count} notices</span>}
                    {t.reminder_count > 0 && <span className="text-[8px] text-zinc-600">{t.reminder_count} reminders</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-teal-400">₦{safeF(t.rent_amount)}</span>
                  <button onClick={() => setNoticeModal({ tenancy_id: t.id, tenant_name: t.tenant_name, unit_name: t.unit_name, rent_amount: t.rent_amount })}
                    className="flex items-center gap-1.5 px-3 py-2 border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-500/30 font-bold text-[8px] uppercase tracking-widest rounded-lg transition-all">
                    <FileText size={9} /> Notice
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            FLEX VAULTS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'vaults' && (
          <div className="space-y-4">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Flex-Pay Vaults — Tenant Standing Orders</p>
            <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/10 text-[9px] text-zinc-500 leading-relaxed">
              Tenants pay weekly, monthly or quarterly into their vault. When the vault reaches the target rent amount, the landlord can take a <strong className="text-white">Lump Sum Cashout</strong> or enable <strong className="text-white">Drawdown Mode</strong> (monthly disbursements). Platform fee: 2%.
            </div>
            {data!.vaults.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-zinc-800 rounded-2xl">
                <DollarSign className="text-zinc-700 mx-auto mb-3" size={28} />
                <p className="text-zinc-500 font-bold text-sm">No flex-pay vaults yet</p>
              </div>
            ) : (
              data!.vaults.map((v: any) => {
                const pct = Math.min(Math.round((safeN(v.vault_balance) / (safeN(v.target_amount) || 1)) * 100), 100);
                return (
                  <div key={v.id} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className="font-bold text-sm">{v.tenant_name}</p>
                        <p className="text-[9px] text-zinc-500">{v.unit_name} · {v.frequency} · {v.cashout_mode} mode</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-lg text-blue-400">₦{safeF(v.vault_balance)}</p>
                        <p className="text-[8px] text-zinc-600 uppercase">of ₦{safeF(v.target_amount)} target</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[8px] text-zinc-600 mb-1"><span>Vault funded</span><span>{pct}%</span></div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] px-2 py-1 rounded font-bold uppercase ${
                        v.status === 'FUNDED_READY' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' :
                        v.status === 'ACTIVE'       ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        'bg-zinc-800 text-zinc-500 border border-zinc-700'
                      }`}>{v.status}</span>
                      {v.status === 'FUNDED_READY' && (
                        <button onClick={async () => {
                          try { const res = await api.post('/api/flex-pay/cashout', { vault_id: v.id, cashout_mode: v.cashout_mode }); alert(res.data.message); load(); }
                          catch (ex: any) { alert(ex?.response?.data?.error ?? 'Cashout failed'); }
                        }} className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 text-black font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-white transition-all">
                          <DollarSign size={10} /> Cash Out ₦{safeF(safeN(v.vault_balance) * 0.98)}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            REMINDERS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'reminders' && (
          <div className="space-y-3">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Automated Reminder Log</p>
            {data!.reminders.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-zinc-800 rounded-2xl">
                <Bell className="text-zinc-700 mx-auto mb-3" size={28} />
                <p className="text-zinc-500 font-bold text-sm">No reminders sent yet</p>
              </div>
            ) : (
              data!.reminders.map((r: any) => (
                <div key={r.id} className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/20 flex items-center gap-4 flex-wrap">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.was_delivered ? 'bg-teal-500' : 'bg-red-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs truncate">{r.tenant_name} · {r.unit_name}</p>
                    <p className="text-[9px] text-zinc-500 font-mono">{r.reminder_type} · {new Date(r.sent_at).toLocaleString()}</p>
                  </div>
                  <span className={`text-[8px] font-bold px-2 py-1 rounded ${r.was_delivered ? 'text-teal-400' : 'text-red-400'}`}>
                    {r.was_delivered ? '✓ Delivered' : '✗ Failed'}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

      </main>

      {/* ── NOTICE GENERATOR MODAL ──────────────────────────────────────── */}
      {noticeModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-950 border border-zinc-700 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-red-500/15"><Gavel size={18} className="text-red-400" /></div>
              <div className="flex-1">
                <p className="font-black text-sm uppercase tracking-tight">Issue Legal Notice</p>
                <p className="text-[9px] text-zinc-500">SHA-256 hashed · Ledger-recorded · PDF emailed</p>
              </div>
              <button onClick={() => setNoticeModal(null)} className="text-zinc-500 hover:text-white p-1">✕</button>
            </div>

            {noticeModal.tenant_name && (
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 text-xs text-zinc-400">
                <p className="font-bold text-white">{noticeModal.tenant_name}</p>
                <p>{noticeModal.unit_name} · ₦{safeF(noticeModal.rent_amount)}</p>
                {noticeModal.days_overdue > 0 && <p className="text-red-400 mt-1">{noticeModal.days_overdue} days overdue</p>}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block mb-2">Notice Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {NOTICE_TYPES.map(nt => (
                    <button key={nt.value} onClick={() => setNoticeForm(f => ({ ...f, notice_type: nt.value }))}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        noticeForm.notice_type === nt.value
                          ? nt.severity === 'amber' ? 'border-amber-500/60 bg-amber-500/10 text-amber-400'
                          : nt.severity === 'rose' ? 'border-rose-500/60 bg-rose-500/10 text-rose-400'
                          : 'border-red-500/60 bg-red-500/10 text-red-400'
                          : 'border-zinc-800 bg-zinc-900/20 text-zinc-500 hover:border-zinc-600'
                      }`}>
                      <p className="font-black text-[10px] uppercase tracking-tight">{nt.label}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block mb-2">Notes (optional)</label>
                <textarea value={noticeForm.notes} onChange={e => setNoticeForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Additional context for the notice…"
                  className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none resize-none" />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-[9px] text-zinc-500 leading-relaxed">
              This notice will be permanently recorded on the immutable ledger, SHA-256 hashed, and automatically emailed to the tenant as a PDF attachment.
            </div>

            <div className="flex gap-3">
              <button onClick={() => setNoticeModal(null)}
                className="flex-1 py-3 border border-zinc-700 text-zinc-400 font-bold text-[10px] uppercase tracking-widest rounded-xl hover:text-white transition-all">
                Cancel
              </button>
              <button onClick={() => generateNotice(noticeModal.tenancy_id, noticeModal.rent_amount, noticeModal.days_overdue || 2)}
                disabled={generatingNotice || !noticeModal.tenancy_id}
                className="flex-1 py-3 bg-red-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-red-400 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {generatingNotice ? <Loader2 className="animate-spin" size={12} /> : <Gavel size={12} />}
                Generate & Send
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
