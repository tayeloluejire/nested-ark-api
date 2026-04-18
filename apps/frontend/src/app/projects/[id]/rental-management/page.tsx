'use client';
export const dynamic = 'force-dynamic';

/**
 * src/app/projects/[id]/rental-management/page.tsx
 *
 * Landlord Rental Command Centre for a single project.
 * Tabs: Overview · Tenants · Litigation · Receipts
 *
 * APIs consumed (all on your existing backend):
 *   GET  /api/rental/project/:id/units          → { units: Unit[] }
 *   GET  /api/rental/project/:id/tenancies       → { tenancies: Tenancy[] }
 *   GET  /api/rental/invite-link/:unitId         → { url, whatsapp_link }
 *   POST /api/rental/notice                      → { notice }
 *   GET  /api/rental/project/:id/receipts        → { receipts: Receipt[] }
 *   GET  /api/rental/project/:id/summary         → { summary }
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  Building2, Users, Gavel, FileText, MessageCircle,
  Copy, CheckCircle2, Loader2, AlertCircle, ArrowRight,
  Phone, Mail, Calendar, ChevronRight, Bell, X,
  Receipt, Share2, Home, Shield, Clock, TrendingUp,
  Download, RefreshCw,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();
const fmtDate = (s: any) => s ? new Date(s).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Unit {
  id: string; name: string; floor?: string; bedrooms?: number;
  monthly_rent: number; status: 'VACANT' | 'OCCUPIED' | 'PENDING';
  tenancy_id?: string;
}
interface Tenancy {
  id: string; unit_id: string; unit_name: string;
  tenant_name: string; tenant_email: string; tenant_phone?: string;
  rent_amount: number; start_date: string; end_date?: string;
  vault_balance: number; vault_funded_pct: number;
  status: 'ACTIVE' | 'OVERDUE' | 'NOTICE_ISSUED' | 'TERMINATED';
  days_overdue?: number; last_payment_date?: string;
}
interface RentalReceipt {
  id: string; tenant_name: string; unit_name: string;
  amount_ngn: number; paid_at: string; receipt_url?: string;
  period_month: string; ledger_hash?: string;
}
interface Summary {
  total_units: number; occupied: number; vacant: number;
  monthly_rent_roll: number; vault_total: number;
  overdue_count: number; collected_this_month: number;
}

// ── Notice types ──────────────────────────────────────────────────────────────
const NOTICE_TYPES = [
  { key: 'NOTICE_TO_PAY',   label: 'Notice to Pay',    desc: '7-day formal demand for overdue rent',     color: 'border-amber-500/40 bg-amber-500/5',  badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',  icon: Bell  },
  { key: 'NOTICE_TO_QUIT',  label: 'Notice to Quit',   desc: 'Formal quit notice — vacate in 30 days',   color: 'border-red-500/40 bg-red-500/5',      badge: 'bg-red-500/10 text-red-400 border-red-500/20',        icon: Home  },
  { key: 'FINAL_WARNING',   label: 'Final Warning',    desc: '48h final warning before legal action',    color: 'border-orange-500/40 bg-orange-500/5', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: Clock },
  { key: 'EVICTION_WARNING',label: 'Eviction Warning', desc: 'Formal eviction notice — legal proceedings', color: 'border-rose-600/40 bg-rose-600/5',   badge: 'bg-rose-600/10 text-rose-400 border-rose-600/20',     icon: Shield},
];

// ── Sub-components ────────────────────────────────────────────────────────────

/** Inline WhatsApp/Copy invite button for a unit */
function InviteButton({ unitId, unitName }: { unitId: string; unitName: string }) {
  const [loading, setLoading] = useState(false);
  const [link, setLink]       = useState('');
  const [copied, setCopied]   = useState(false);
  const [error, setError]     = useState('');

  const generate = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get(`/api/rental/invite-link/${unitId}`);
      setLink(res.data.url);
      window.open(res.data.whatsapp_link, '_blank');
    } catch (e: any) { setError(e?.response?.data?.error ?? 'Failed'); }
    finally { setLoading(false); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); } catch { prompt('Copy:', link); }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };

  const email = () => {
    window.open(
      `mailto:?subject=${encodeURIComponent(`Your Nested Ark Tenant Invite — ${unitName}`)}&body=${encodeURIComponent(
        `You have been invited to set up your tenancy for ${unitName}.\n\nClick the link below to register, sign your digital lease, and activate your Flex-Pay vault:\n\n${link}`
      )}`, '_blank'
    );
  };

  if (!link) return (
    <div className="space-y-1">
      <button onClick={generate} disabled={loading}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] text-[9px] font-black uppercase tracking-wide hover:bg-[#25D366]/20 transition-all disabled:opacity-50">
        {loading ? <Loader2 size={11} className="animate-spin" /> : <MessageCircle size={11} />}
        {loading ? 'Generating…' : 'Invite via WhatsApp'}
      </button>
      {error && <p className="text-[9px] text-red-400">{error}</p>}
    </div>
  );

  return (
    <div className="space-y-1.5">
      <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">Invite link generated</p>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={generate}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] rounded-lg text-[8px] font-black uppercase hover:bg-[#25D366]/20 transition-all">
          <MessageCircle size={10} /> WhatsApp
        </button>
        <button onClick={email}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg text-[8px] font-black uppercase hover:bg-blue-500/20 transition-all">
          <Mail size={10} /> Email
        </button>
        <button onClick={copy}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all border ${copied ? 'bg-teal-500/10 border-teal-500/30 text-teal-400' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'}`}>
          {copied ? <CheckCircle2 size={10} /> : <Copy size={10} />} {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>
    </div>
  );
}

/** Notice modal */
function NoticeModal({
  tenancies, onClose, onSuccess,
}: {
  tenancies: Tenancy[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [noticeType, setNoticeType]     = useState('NOTICE_TO_PAY');
  const [tenancyId, setTenancyId]       = useState(tenancies[0]?.id ?? '');
  const [notes, setNotes]               = useState('');
  const [sending, setSending]           = useState(false);
  const [result, setResult]             = useState('');

  const send = async () => {
    if (!tenancyId) return;
    setSending(true); setResult('');
    try {
      await api.post('/api/rental/notice', { tenancy_id: tenancyId, notice_type: noticeType, notes });
      setResult('✓ Notice issued and emailed to tenant as a signed PDF.');
      setTimeout(() => { onSuccess(); onClose(); }, 2000);
    } catch (e: any) {
      setResult('Error: ' + (e?.response?.data?.error ?? 'Failed to issue notice'));
    } finally { setSending(false); }
  };

  const selected = NOTICE_TYPES.find(n => n.key === noticeType)!;

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-900">
          <div>
            <p className="text-[8px] text-red-400 uppercase font-black tracking-[0.25em]">Litigation Command</p>
            <p className="text-sm font-black uppercase tracking-tight text-white mt-0.5">Issue Legal Notice</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-zinc-600 hover:text-white hover:bg-zinc-800 transition-all"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Tenant selector */}
          <div className="space-y-2">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Select Tenant</label>
            <div className="space-y-1.5">
              {tenancies.map(t => (
                <button key={t.id} onClick={() => setTenancyId(t.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${tenancyId === t.id ? 'border-teal-500/40 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'}`}>
                  <div>
                    <p className="text-xs font-bold text-white">{t.tenant_name}</p>
                    <p className="text-[9px] text-zinc-500">{t.unit_name} · ₦{safeF(t.rent_amount)}/mo</p>
                  </div>
                  <div className="text-right">
                    {(t.days_overdue ?? 0) > 0
                      ? <span className="text-[8px] text-red-400 font-bold uppercase">{t.days_overdue}d overdue</span>
                      : <span className="text-[8px] text-teal-400 font-bold uppercase">In good standing</span>
                    }
                    {tenancyId === t.id && <CheckCircle2 size={12} className="text-teal-400 ml-auto mt-1" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Notice type 2×2 grid */}
          <div className="space-y-2">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Notice Type</label>
            <div className="grid grid-cols-2 gap-2">
              {NOTICE_TYPES.map(n => {
                const Icon = n.icon;
                return (
                  <button key={n.key} onClick={() => setNoticeType(n.key)}
                    className={`p-3 rounded-xl border text-left transition-all ${noticeType === n.key ? n.color : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={12} className={noticeType === n.key ? '' : 'text-zinc-500'} />
                      <p className="text-[10px] font-black uppercase tracking-tight">{n.label}</p>
                    </div>
                    <p className="text-[8px] text-zinc-500 leading-relaxed">{n.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected notice badge */}
          <div className={`px-3 py-2 rounded-xl border text-[9px] font-bold ${selected.badge}`}>
            ⚖️ {selected.label} — SHA-256 hashed, auto-emailed as signed PDF, logged immutably.
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Additional Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="E.g. Rent overdue since 1st March — this is your formal notice…"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-xs text-white placeholder:text-zinc-700 focus:border-teal-500 outline-none resize-none" />
          </div>

          {result && (
            <div className={`p-3 rounded-xl text-xs font-bold border ${result.startsWith('✓') ? 'bg-teal-500/10 border-teal-500/30 text-teal-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
              {result}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-zinc-900 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-800 text-zinc-500 font-bold text-[10px] uppercase tracking-widest hover:border-zinc-600 hover:text-zinc-300 transition-all">
            Cancel
          </button>
          <button onClick={send} disabled={sending || !tenancyId}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-black text-[10px] uppercase tracking-widest hover:bg-red-400 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Gavel size={13} />}
            {sending ? 'Issuing…' : 'Issue Notice'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RentalManagementPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const [tab,         setTab]         = useState<'overview'|'tenants'|'litigation'|'receipts'>('overview');
  const [units,       setUnits]       = useState<Unit[]>([]);
  const [tenancies,   setTenancies]   = useState<Tenancy[]>([]);
  const [receipts,    setReceipts]    = useState<RentalReceipt[]>([]);
  const [summary,     setSummary]     = useState<Summary | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [noticeModal, setNoticeModal] = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true); setError('');
    try {
      const [uRes, tRes, rRes, sRes] = await Promise.all([
        api.get(`/api/rental/project/${projectId}/units`).catch(() => ({ data: { units: [] } })),
        api.get(`/api/rental/project/${projectId}/tenancies`).catch(() => ({ data: { tenancies: [] } })),
        api.get(`/api/rental/project/${projectId}/receipts`).catch(() => ({ data: { receipts: [] } })),
        api.get(`/api/rental/project/${projectId}/summary`).catch(() => ({ data: { summary: null } })),
      ]);
      setUnits(uRes.data.units ?? []);
      setTenancies(tRes.data.tenancies ?? []);
      setReceipts(rRes.data.receipts ?? []);
      setSummary(sRes.data.summary ?? null);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Could not load rental data.');
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const overdueCount = tenancies.filter(t => (t.days_overdue ?? 0) > 0).length;
  const overdueTenancies = tenancies.filter(t => (t.days_overdue ?? 0) > 0);

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="flex items-center justify-center py-40">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
      <Footer />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />

      {noticeModal && (
        <NoticeModal
          tenancies={tenancies}
          onClose={() => setNoticeModal(false)}
          onSuccess={load}
        />
      )}

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="border-l-2 border-teal-500 pl-5">
            <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Property Management Suite</p>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Rental Command Centre</h1>
            <p className="text-zinc-500 text-xs mt-1">Manage units, tenants, notices, and income for this property</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={refresh} disabled={refreshing}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-zinc-800 text-zinc-500 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:border-zinc-600 hover:text-zinc-300 transition-all disabled:opacity-50">
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={() => setNoticeModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all">
              <Gavel size={12} /> Issue Notice
            </button>
            <Link href={`/projects/${projectId}`}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-500 text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-teal-400 transition-all">
              <Building2 size={12} /> Project Overview
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 flex items-center gap-2 text-sm font-bold">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* ── KPI strip ── */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Units',          value: summary.total_units,                        color: 'text-white',     sub: `${summary.occupied} occupied · ${summary.vacant} vacant` },
              { label: 'Monthly Rent Roll',    value: `₦${safeF(summary.monthly_rent_roll)}`,     color: 'text-teal-400',  sub: 'expected per month' },
              { label: 'Collected This Month', value: `₦${safeF(summary.collected_this_month)}`,  color: 'text-amber-400', sub: 'received in vaults' },
              { label: 'Overdue Tenants',      value: summary.overdue_count,                      color: summary.overdue_count > 0 ? 'text-red-400' : 'text-teal-400', sub: summary.overdue_count > 0 ? 'action required' : 'all current' },
            ].map(s => (
              <div key={s.label} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-1.5">
                <p className={`text-2xl font-black font-mono tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s.label}</p>
                <p className="text-[9px] text-zinc-700">{s.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Overdue alert banner ── */}
        {overdueCount > 0 && (
          <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-black text-red-300">{overdueCount} tenant{overdueCount > 1 ? 's' : ''} overdue on rent</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {overdueTenancies.map(t => t.tenant_name).join(', ')} — issue a formal notice now
                </p>
              </div>
            </div>
            <button onClick={() => { setNoticeModal(true); setTab('litigation'); }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-400 transition-all flex-shrink-0">
              <Gavel size={12} /> Issue Notice Now
            </button>
          </div>
        )}

        {/* ── Tab bar ── */}
        <div className="flex items-center gap-1 p-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl w-fit flex-wrap">
          {([
            { key: 'overview',    label: 'Overview',    icon: Building2 },
            { key: 'tenants',     label: 'Tenants',     icon: Users,    badge: tenancies.length },
            { key: 'litigation',  label: 'Litigation',  icon: Gavel,    badge: overdueCount, badgeRed: true },
            { key: 'receipts',    label: 'Receipts',    icon: Receipt,  badge: receipts.length },
          ] as const).map(t => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${isActive ? 'bg-teal-500 text-black shadow' : 'text-zinc-500 hover:text-white'}`}>
                <Icon size={12} /> {t.label}
                {(t as any).badge > 0 && (
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black ${(t as any).badgeRed ? 'bg-red-500 text-white' : isActive ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                    {(t as any).badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: OVERVIEW — Unit grid
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'overview' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Property Units ({units.length})</p>
              <p className="text-[9px] text-zinc-700">Click a vacant unit to invite a tenant</p>
            </div>

            {units.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
                <Building2 className="text-zinc-700 mx-auto" size={40} />
                <p className="text-zinc-400 font-bold">No units configured yet</p>
                <p className="text-zinc-600 text-sm">Add units to this project from the Project settings to start onboarding tenants.</p>
                <Link href={`/projects/${projectId}`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all">
                  Go to Project Settings <ArrowRight size={11} />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {units.map(unit => {
                  const statusCfg = {
                    OCCUPIED: { bar: 'bg-teal-500',   border: 'border-teal-500/20',   badge: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
                    VACANT:   { bar: 'bg-amber-500',  border: 'border-amber-500/20',  badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                    PENDING:  { bar: 'bg-blue-500',   border: 'border-blue-500/20',   badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                  }[unit.status];
                  const tenancy = tenancies.find(t => t.unit_id === unit.id);

                  return (
                    <div key={unit.id} className={`rounded-3xl border bg-zinc-950 overflow-hidden ${statusCfg.border}`}>
                      <div className={`h-1 w-full ${statusCfg.bar}`} />
                      <div className="p-5 space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-black text-base uppercase tracking-tight">{unit.name}</p>
                            {unit.floor && <p className="text-[9px] text-zinc-600">{unit.floor}</p>}
                          </div>
                          <span className={`text-[7px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${statusCfg.badge}`}>
                            {unit.status}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-zinc-500">Monthly rent</span>
                          <span className="font-mono font-bold text-white">₦{safeF(unit.monthly_rent)}</span>
                        </div>

                        {tenancy && (
                          <div className="space-y-2 pt-2 border-t border-zinc-900">
                            <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">Current Tenant</p>
                            <p className="font-bold text-sm">{tenancy.tenant_name}</p>
                            <p className="text-[9px] text-zinc-500">{tenancy.tenant_email}</p>
                            {/* Vault bar */}
                            <div>
                              <div className="flex justify-between text-[8px] text-zinc-600 mb-1">
                                <span>Vault funded</span>
                                <span className={tenancy.vault_funded_pct >= 80 ? 'text-teal-400' : tenancy.vault_funded_pct >= 50 ? 'text-amber-400' : 'text-red-400'}>
                                  {tenancy.vault_funded_pct}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${tenancy.vault_funded_pct >= 80 ? 'bg-teal-500' : tenancy.vault_funded_pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${tenancy.vault_funded_pct}%` }} />
                              </div>
                            </div>
                            {(tenancy.days_overdue ?? 0) > 0 && (
                              <div className="flex items-center gap-1.5 text-[9px] text-red-400 font-bold">
                                <AlertCircle size={10} /> {tenancy.days_overdue} days overdue
                              </div>
                            )}
                          </div>
                        )}

                        {unit.status === 'VACANT' && (
                          <div className="pt-2 border-t border-zinc-900">
                            <InviteButton unitId={unit.id} unitName={unit.name} />
                          </div>
                        )}
                        {unit.status === 'OCCUPIED' && tenancy && (
                          <button onClick={() => { setTab('tenants'); }}
                            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-zinc-800 text-zinc-500 text-[9px] font-bold uppercase tracking-widest hover:border-zinc-600 hover:text-white transition-all">
                            Manage Tenant <ChevronRight size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: TENANTS — Full tenancy list
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'tenants' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Active Tenancies ({tenancies.length})</p>
              <button onClick={() => setTab('overview')}
                className="text-[9px] text-teal-500 font-bold uppercase tracking-widest hover:text-white transition-all">
                + Invite New Tenant
              </button>
            </div>

            {tenancies.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
                <Users className="text-zinc-700 mx-auto" size={40} />
                <p className="text-zinc-400 font-bold">No tenants yet</p>
                <p className="text-zinc-600 text-sm">Go to the Overview tab and click a vacant unit to invite your first tenant via WhatsApp or email.</p>
                <button onClick={() => setTab('overview')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all">
                  View Units <ArrowRight size={11} />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {tenancies.map(t => {
                  const statusCfg = {
                    ACTIVE:         'border-teal-500/20 bg-teal-500/5',
                    OVERDUE:        'border-red-500/20 bg-red-500/5',
                    NOTICE_ISSUED:  'border-orange-500/20 bg-orange-500/5',
                    TERMINATED:     'border-zinc-700 bg-zinc-900/10',
                  }[t.status] ?? 'border-zinc-800 bg-zinc-900/10';

                  return (
                    <div key={t.id} className={`p-5 rounded-2xl border ${statusCfg} space-y-4`}>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-black text-base">{t.tenant_name}</p>
                            <span className={`text-[7px] px-2 py-0.5 rounded-full font-black uppercase border ${
                              t.status === 'ACTIVE' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                              t.status === 'OVERDUE' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                              'bg-zinc-800 text-zinc-500 border-zinc-700'
                            }`}>{t.status}</span>
                            {(t.days_overdue ?? 0) > 0 && (
                              <span className="text-[8px] text-red-400 font-bold">{t.days_overdue}d overdue</span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-500">{t.unit_name} · ₦{safeF(t.rent_amount)}/mo</p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="flex items-center gap-1 text-[9px] text-zinc-600"><Mail size={9} />{t.tenant_email}</span>
                            {t.tenant_phone && <span className="flex items-center gap-1 text-[9px] text-zinc-600"><Phone size={9} />{t.tenant_phone}</span>}
                            <span className="flex items-center gap-1 text-[9px] text-zinc-600"><Calendar size={9} />From {fmtDate(t.start_date)}</span>
                          </div>
                        </div>
                        <div className="text-right space-y-1 flex-shrink-0">
                          <p className="font-mono font-bold text-xl text-teal-400">₦{safeF(t.vault_balance)}</p>
                          <p className="text-[8px] text-zinc-600 uppercase font-bold">vault balance</p>
                          <p className="text-[9px] text-zinc-500">{t.vault_funded_pct}% funded</p>
                        </div>
                      </div>

                      {/* Vault bar */}
                      <div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${t.vault_funded_pct >= 80 ? 'bg-teal-500' : t.vault_funded_pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${t.vault_funded_pct}%` }} />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        {(t.days_overdue ?? 0) > 0 && (
                          <button onClick={() => setNoticeModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-[9px] font-black uppercase hover:bg-red-500/20 transition-all">
                            <Gavel size={11} /> Issue Notice
                          </button>
                        )}
                        <a href={`https://wa.me/${t.tenant_phone?.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] rounded-xl text-[9px] font-black uppercase hover:bg-[#25D366]/20 transition-all">
                          <MessageCircle size={11} /> WhatsApp
                        </a>
                        <a href={`mailto:${t.tenant_email}`}
                          className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl text-[9px] font-black uppercase hover:bg-blue-500/20 transition-all">
                          <Mail size={11} /> Email
                        </a>
                        <Link href={`/projects/${projectId}/flex-pay/${t.id}`}
                          className="flex items-center gap-1.5 px-3 py-2 border border-zinc-800 text-zinc-500 rounded-xl text-[9px] font-bold uppercase hover:border-zinc-600 hover:text-zinc-300 transition-all">
                          <TrendingUp size={11} /> View Vault
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: LITIGATION — Notice command centre
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'litigation' && (
          <div className="space-y-6">
            {/* Quick-action bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {NOTICE_TYPES.map(n => {
                const Icon = n.icon;
                return (
                  <button key={n.key} onClick={() => setNoticeModal(true)}
                    className={`p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-lg ${n.color}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon size={14} />
                      <p className="text-[10px] font-black uppercase tracking-tight">{n.label}</p>
                    </div>
                    <p className="text-[8px] text-zinc-500 leading-relaxed">{n.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Overdue tenants emergency panel */}
            {overdueTenancies.length > 0 && (
              <div className="space-y-3">
                <p className="text-[9px] text-red-400 uppercase font-black tracking-widest flex items-center gap-1.5">
                  <AlertCircle size={11} /> Overdue — Immediate Action Required
                </p>
                {overdueTenancies.map(t => (
                  <div key={t.id} className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-bold text-sm">{t.tenant_name}</p>
                      <p className="text-[9px] text-zinc-500">{t.unit_name} · {t.days_overdue} days overdue · ₦{safeF(t.rent_amount)} due</p>
                    </div>
                    <button onClick={() => setNoticeModal(true)}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase hover:bg-red-400 transition-all flex-shrink-0">
                      <Gavel size={11} /> Issue Notice Now
                    </button>
                  </div>
                ))}
              </div>
            )}

            {overdueCount === 0 && tenancies.length > 0 && (
              <div className="py-12 text-center border border-teal-500/20 bg-teal-500/5 rounded-2xl space-y-3">
                <CheckCircle2 className="text-teal-400 mx-auto" size={32} />
                <p className="text-teal-400 font-black uppercase text-sm">All Tenants Current</p>
                <p className="text-zinc-500 text-[10px]">No overdue rent. Use the buttons above to issue notices proactively if needed.</p>
              </div>
            )}

            {tenancies.length === 0 && (
              <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl space-y-3">
                <Gavel className="text-zinc-700 mx-auto" size={32} />
                <p className="text-zinc-500 font-bold">No active tenancies to issue notices for.</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: RECEIPTS — Payment history
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'receipts' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Payment Receipts ({receipts.length})</p>
              <p className="text-[9px] text-zinc-700">All receipts are SHA-256 hashed and court-admissible</p>
            </div>

            {receipts.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
                <Receipt className="text-zinc-700 mx-auto" size={40} />
                <p className="text-zinc-400 font-bold">No payments yet</p>
                <p className="text-zinc-600 text-sm">Receipts will appear here automatically when tenants make vault contributions.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {receipts.map(r => (
                  <div key={r.id}
                    className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex items-center justify-between gap-4 flex-wrap">
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="font-bold text-sm">{r.tenant_name}</p>
                      <div className="flex items-center gap-3 text-[9px] text-zinc-500 flex-wrap">
                        <span className="flex items-center gap-1"><Building2 size={9} />{r.unit_name}</span>
                        <span className="flex items-center gap-1"><Calendar size={9} />{r.period_month}</span>
                        <span>{fmtDate(r.paid_at)}</span>
                      </div>
                      {r.ledger_hash && (
                        <p className="text-[8px] text-zinc-700 font-mono truncate max-w-xs">
                          Hash: {r.ledger_hash.slice(0, 20)}…
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-mono font-bold text-xl text-teal-400">₦{safeF(r.amount_ngn)}</p>
                        <p className="text-[8px] text-zinc-600 uppercase font-bold">received</p>
                      </div>
                      {r.receipt_url && (
                        <a href={r.receipt_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 border border-zinc-700 text-zinc-400 rounded-xl text-[9px] font-bold uppercase hover:border-teal-500/40 hover:text-teal-400 transition-all">
                          <Download size={11} /> Receipt
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}
