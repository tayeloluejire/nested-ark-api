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
  TrendingDown, Zap, RefreshCw, Download, Send, ToggleLeft,
  ToggleRight, ChevronDown, ChevronUp, Home
} from 'lucide-react';

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

type Tab = 'overview' | 'tenants' | 'vaults' | 'notices' | 'reminders';

const TAB_LABELS: Record<Tab, { label: string; icon: any }> = {
  overview:  { label: 'Overview',  icon: Building2 },
  tenants:   { label: 'Tenants',   icon: Users },
  vaults:    { label: 'Flex Vaults', icon: DollarSign },
  notices:   { label: 'Notices',   icon: FileText },
  reminders: { label: 'Reminders', icon: Bell },
};

const NOTICE_TYPES = [
  { value: 'NOTICE_TO_PAY',    label: 'Notice to Pay',     color: 'text-amber-400' },
  { value: 'NOTICE_TO_QUIT',   label: 'Notice to Quit',    color: 'text-red-400' },
  { value: 'FINAL_WARNING',    label: 'Final Warning',     color: 'text-red-500' },
  { value: 'EVICTION_WARNING', label: 'Eviction Warning',  color: 'text-red-600' },
];

export default function RentalManagementPage() {
  const { id: projectId }  = useParams<{ id: string }>();
  const router             = useRouter();
  const { user }           = useAuth();

  const [data,    setData]    = useState<ManagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [tab,     setTab]     = useState<Tab>('overview');

  // Modal states
  const [noticeModal,    setNoticeModal]    = useState<any>(null);
  const [bulkSending,    setBulkSending]    = useState(false);
  const [bulkResult,     setBulkResult]     = useState<any>(null);
  const [generatingNotice, setGeneratingNotice] = useState(false);
  const [noticeForm,     setNoticeForm]     = useState({ notice_type: 'NOTICE_TO_PAY', notes: '' });
  const [expandedUnit,   setExpandedUnit]   = useState<string | null>(null);

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
      setBulkResult({ error: ex?.response?.data?.error ?? 'Failed to send reminders' });
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

      // If PDF returned
      if (res.headers['content-type']?.includes('pdf')) {
        const url  = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        const noticeNum = res.headers['x-notice-number'] ?? 'ARK-NOTICE';
        const a = document.createElement('a');
        a.href = url; a.download = `${noticeNum}.pdf`; a.click();
        URL.revokeObjectURL(url);
      } else {
        // JSON response with html_notice
        const json = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        if (json.html_notice) {
          const w = window.open('', '_blank');
          if (w) { w.document.write(json.html_notice); w.document.close(); }
        }
      }
      setNoticeModal(null);
      load();
    } catch (ex: any) {
      alert(ex?.response?.data?.error ?? 'Failed to generate notice');
    } finally { setGeneratingNotice(false); }
  };

  const downloadNotice = async (noticeId: string, noticeNumber: string) => {
    try {
      const res = await api.get(`/api/notices/download/${noticeId}`, { responseType: 'blob' });
      const mime  = res.headers['content-type'] || 'text/html';
      const ext   = mime.includes('pdf') ? 'pdf' : 'html';
      const url   = URL.createObjectURL(new Blob([res.data], { type: mime }));
      const a = document.createElement('a'); a.href = url; a.download = `${noticeNumber}.${ext}`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Download failed'); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white"><Navbar />
      <div className="flex items-center justify-center py-40">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div><Footer /></div>
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

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <button onClick={() => router.back()}
              className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-4">
              <ArrowLeft size={12} /> Back to Project
            </button>
            <div className="border-l-2 border-teal-500 pl-5">
              <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Asset Management Powerhouse</p>
              <h1 className="text-3xl font-black uppercase tracking-tighter">Property Control</h1>
              <p className="text-zinc-500 text-xs mt-1">Automation · Flex-Pay · Legal Notices · Mobilization</p>
            </div>
          </div>
          <button onClick={load} className="p-2 border border-zinc-800 rounded-xl text-zinc-500 hover:text-teal-500 transition-all">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Occupancy',        value: `${s.occupancy_pct}%`,      sub: `${s.occupied_units}/${s.total_units} units`,  color: 'text-teal-400',  border: 'border-teal-500/30' },
            { label: 'Monthly Rent',     value: `₦${Number(s.monthly_rent_ngn).toLocaleString()}`, sub: 'Total contracted', color: 'text-amber-400', border: 'border-amber-500/30' },
            { label: 'Vault Balance',    value: `₦${Number(s.total_vault_balance_ngn).toLocaleString()}`, sub: `${s.active_vaults} active vaults`, color: 'text-blue-400', border: 'border-blue-500/30' },
            { label: 'Overdue',          value: s.overdue_tenancies,        sub: `${s.pending_notices} notices issued`, color: 'text-red-400',   border: 'border-red-500/30' },
          ].map(k => (
            <div key={k.label} className={`p-4 rounded-2xl border ${k.border} bg-zinc-900/20 space-y-1`}>
              <p className={`text-2xl font-black font-mono tabular-nums ${k.color}`}>{k.value}</p>
              <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{k.label}</p>
              <p className="text-[9px] text-zinc-700">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Automation Quick Actions */}
        <div className="p-5 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-4">
          <p className="text-[9px] text-teal-500 uppercase font-bold tracking-widest flex items-center gap-2">
            <Zap size={10} /> Management Automation
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={sendBulkReminder} disabled={bulkSending}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-black font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-white transition-all disabled:opacity-60">
              {bulkSending ? <Loader2 className="animate-spin" size={12} /> : <Send size={12} />}
              Bulk Payment Reminder
            </button>
            <Link href={`/projects/${projectId}/rental`}
              className="flex items-center gap-2 px-5 py-2.5 border border-zinc-700 text-zinc-400 hover:text-white font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all">
              <Home size={12} /> Rental Dashboard
            </Link>
          </div>
          {bulkResult && (
            <div className={`p-3 rounded-xl text-xs font-bold ${bulkResult.error ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'}`}>
              {bulkResult.error ? bulkResult.error : `✓ Sent ${bulkResult.sent} reminders · ${bulkResult.failed} failed`}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-zinc-800 flex gap-0 overflow-x-auto">
          {(Object.entries(TAB_LABELS) as [Tab, { label: string; icon: any }][]).map(([key, { label, icon: Icon }]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-5 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                tab === key ? 'text-teal-400 border-teal-500' : 'text-zinc-500 border-transparent hover:text-white'
              }`}>
              <Icon size={10} /> {label}
              {key === 'notices' && s.pending_notices > 0 && (
                <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded">{s.pending_notices}</span>
              )}
              {key === 'tenants' && s.overdue_tenancies > 0 && (
                <span className="bg-amber-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded">{s.overdue_tenancies}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Unit Status</p>
            {data!.units.map((u: any) => (
              <div key={u.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
                <div className="p-4 flex items-center justify-between gap-4 flex-wrap cursor-pointer"
                  onClick={() => setExpandedUnit(expandedUnit === u.id ? null : u.id)}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${u.status === 'OCCUPIED' ? 'bg-teal-500' : u.status === 'VACANT' ? 'bg-zinc-600' : 'bg-amber-500'}`} />
                    <div>
                      <p className="font-bold text-sm">{u.unit_name}</p>
                      <p className="text-[9px] text-zinc-500">{u.unit_type} · {u.status}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="font-mono font-bold text-sm text-teal-400">₦{Number(u.rent_amount).toLocaleString()}</p>
                      <p className="text-[8px] text-zinc-600 uppercase">per annum</p>
                    </div>
                    {u.vault_balance && (
                      <div>
                        <p className="font-mono text-xs text-blue-400">₦{Number(u.vault_balance).toLocaleString()}</p>
                        <p className="text-[8px] text-zinc-600 uppercase">vault</p>
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
                      <button onClick={() => setNoticeModal({ tenancy_id: u.tenancy_id, tenant_name: u.tenant_name, unit_name: u.unit_name, rent_amount: u.rent_amount })}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-red-500/20 transition-all">
                        <FileText size={9} /> Issue Notice
                      </button>
                      <button onClick={sendBulkReminder} disabled={bulkSending}
                        className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 text-zinc-400 hover:text-white font-bold text-[9px] uppercase tracking-widest rounded-xl transition-all">
                        <Bell size={9} /> Send Reminder
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── TENANTS TAB ── */}
        {tab === 'tenants' && (
          <div className="space-y-3">
            {/* Overdue alert */}
            {data!.overdue.length > 0 && (
              <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 space-y-3">
                <p className="text-[9px] text-red-400 uppercase font-bold tracking-widest flex items-center gap-2">
                  <AlertCircle size={10} /> {data!.overdue.length} Overdue Tenant{data!.overdue.length !== 1 ? 's' : ''}
                </p>
                {data!.overdue.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-bold text-sm">{t.tenant_name}</p>
                      <p className="text-[9px] text-zinc-500">{t.unit_name} · {Math.round(t.days_since_payment)}d overdue</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-red-400">₦{Number(t.rent_amount).toLocaleString()}</span>
                      <button onClick={() => setNoticeModal({ tenancy_id: t.id, tenant_name: t.tenant_name, unit_name: t.unit_name, rent_amount: t.rent_amount, days_overdue: Math.round(t.days_since_payment) })}
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
                    <span className="text-[8px] text-zinc-600">{t.contribution_count} flex-pay contributions</span>
                    {t.notice_count > 0 && <span className="text-[8px] text-amber-400">{t.notice_count} notices</span>}
                    {t.reminder_count > 0 && <span className="text-[8px] text-zinc-600">{t.reminder_count} reminders sent</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-teal-400">₦{Number(t.rent_amount).toLocaleString()}</span>
                  <button onClick={() => setNoticeModal({ tenancy_id: t.id, tenant_name: t.tenant_name, unit_name: t.unit_name, rent_amount: t.rent_amount })}
                    className="px-3 py-1.5 border border-zinc-700 text-zinc-400 hover:text-white font-bold text-[8px] uppercase tracking-widest rounded-lg transition-all">
                    <FileText size={9} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── FLEX VAULTS TAB ── */}
        {tab === 'vaults' && (
          <div className="space-y-4">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
              Flex-Pay Vaults — Tenant Standing Orders
            </p>
            <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/10 text-[9px] text-zinc-500 leading-relaxed">
              Tenants pay weekly, monthly or quarterly into their vault. When the vault reaches the target rent amount, the landlord can take a <strong className="text-white">Lump Sum Cashout</strong> (full year payment) or enable <strong className="text-white">Drawdown Mode</strong> (monthly disbursements). Platform fee: 2%.
            </div>
            {data!.vaults.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-zinc-800 rounded-2xl">
                <DollarSign className="text-zinc-700 mx-auto mb-3" size={28} />
                <p className="text-zinc-500 font-bold text-sm">No flex-pay vaults yet</p>
                <p className="text-zinc-700 text-xs mt-1">Tenants can set up standing orders via their portal</p>
              </div>
            ) : (
              data!.vaults.map((v: any) => {
                const pct = Math.min(Math.round((parseFloat(v.vault_balance) / parseFloat(v.target_amount)) * 100), 100);
                return (
                  <div key={v.id} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className="font-bold text-sm">{v.tenant_name}</p>
                        <p className="text-[9px] text-zinc-500">{v.unit_name} · {v.frequency} · {v.cashout_mode} mode</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-lg text-blue-400">₦{Number(v.vault_balance).toLocaleString()}</p>
                        <p className="text-[8px] text-zinc-600 uppercase">of ₦{Number(v.target_amount).toLocaleString()} target</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[8px] text-zinc-600 mb-1">
                        <span>Vault funded</span><span>{pct}%</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] px-2 py-1 rounded font-bold uppercase ${
                        v.status === 'FUNDED_READY' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' :
                        v.status === 'ACTIVE' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        'bg-zinc-800 text-zinc-500 border border-zinc-700'
                      }`}>{v.status}</span>
                      {v.status === 'FUNDED_READY' && (
                        <button onClick={async () => {
                          try {
                            const res = await api.post('/api/flex-pay/cashout', { vault_id: v.id, cashout_mode: v.cashout_mode });
                            alert(res.data.message); load();
                          } catch (ex: any) { alert(ex?.response?.data?.error ?? 'Cashout failed'); }
                        }} className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 text-black font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-white transition-all">
                          <DollarSign size={10} /> Cash Out ₦{Number(parseFloat(v.vault_balance) * 0.98).toLocaleString()}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── NOTICES TAB ── */}
        {tab === 'notices' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Legal Notices</p>
              <button onClick={() => setNoticeModal({ tenancy_id: '', tenant_name: 'Select tenant', unit_name: '', rent_amount: 0 })}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-red-500/20 transition-all">
                <FileText size={10} /> Issue New Notice
              </button>
            </div>
            <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/10 text-[9px] text-zinc-500 leading-relaxed">
              Notices are SHA-256 hashed onto the immutable ledger and automatically emailed to the tenant as a PDF attachment. Auto-notices are generated at 48h overdue.
            </div>
            {data!.notices.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-zinc-800 rounded-2xl">
                <ShieldCheck className="text-zinc-700 mx-auto mb-3" size={28} />
                <p className="text-zinc-500 font-bold text-sm">No legal notices issued</p>
              </div>
            ) : (
              data!.notices.map((n: any) => (
                <div key={n.id} className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-[9px] text-teal-500">{n.notice_number}</span>
                      <span className={`text-[8px] px-2 py-0.5 rounded font-bold uppercase ${
                        n.status === 'RESOLVED' ? 'bg-teal-500/10 text-teal-400' :
                        n.status === 'SERVED' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>{n.status}</span>
                    </div>
                    <p className="font-bold text-sm">{n.tenant_name} · {n.unit_name}</p>
                    <p className="text-[9px] text-zinc-500">
                      {n.notice_type.replace(/_/g,' ')} · ₦{Number(n.amount_overdue).toLocaleString()} · {new Date(n.issued_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button onClick={() => downloadNotice(n.id, n.notice_number)}
                    className="flex items-center gap-1.5 px-3 py-2 border border-zinc-700 text-zinc-400 hover:text-teal-400 font-bold text-[9px] uppercase tracking-widest rounded-xl transition-all">
                    <Download size={9} /> Download
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── REMINDERS TAB ── */}
        {tab === 'reminders' && (
          <div className="space-y-3">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Reminder History</p>
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

      {/* NOTICE MODAL */}
      {noticeModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md space-y-5">
            <div className="flex items-center justify-between">
              <p className="font-black text-sm uppercase tracking-tight">Issue Legal Notice</p>
              <button onClick={() => setNoticeModal(null)} className="text-zinc-500 hover:text-white">✕</button>
            </div>
            <div className="p-3 bg-zinc-800 rounded-xl text-xs text-zinc-400">
              <p className="font-bold text-white">{noticeModal.tenant_name}</p>
              <p>{noticeModal.unit_name} · ₦{Number(noticeModal.rent_amount).toLocaleString()}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block mb-2">Notice Type</label>
                <select value={noticeForm.notice_type}
                  onChange={e => setNoticeForm(f => ({ ...f, notice_type: e.target.value }))}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none">
                  {NOTICE_TYPES.map(nt => (
                    <option key={nt.value} value={nt.value}>{nt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block mb-2">Notes (optional)</label>
                <textarea value={noticeForm.notes}
                  onChange={e => setNoticeForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Additional context for the notice…"
                  className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none resize-none" />
              </div>
            </div>
            <div className="p-3 rounded-xl bg-zinc-800/50 text-[9px] text-zinc-500 leading-relaxed">
              Notice will be SHA-256 hashed, recorded on the immutable ledger, and automatically emailed to the tenant with a PDF attachment.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setNoticeModal(null)}
                className="flex-1 py-3 border border-zinc-700 text-zinc-400 font-bold text-[10px] uppercase tracking-widest rounded-xl hover:text-white transition-all">
                Cancel
              </button>
              <button onClick={() => generateNotice(noticeModal.tenancy_id, noticeModal.rent_amount, noticeModal.days_overdue || 2)}
                disabled={generatingNotice || !noticeModal.tenancy_id}
                className="flex-1 py-3 bg-red-500 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-white hover:text-black transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {generatingNotice ? <Loader2 className="animate-spin" size={12} /> : <FileText size={12} />}
                Generate &amp; Send
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
