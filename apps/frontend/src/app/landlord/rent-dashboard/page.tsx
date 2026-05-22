'use client';
export const dynamic = 'force-dynamic';
/**
 * apps/frontend/src/app/landlord/rent-dashboard/page.tsx
 *
 * Landlord Rent Payment Intelligence Dashboard
 * Shows: per-tenant payment status, vault progress, recent transactions,
 * overdue alerts, and portfolio-level KPIs in one view.
 *
 * Data source: GET /api/landlord/rent-dashboard
 */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  CheckCircle2, AlertCircle, Clock, Loader2, RefreshCw,
  ArrowLeft, TrendingUp, DollarSign, Users, Building2,
  ChevronRight, Hash, Banknote, BarChart3, ArrowUpRight,
  Calendar, Zap, XCircle, HelpCircle, Receipt,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtTime = (d: any) => d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';

// ── Payment status config ─────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  FULLY_FUNDED:         { label: 'Fully Paid',     color: 'text-teal-400',   bg: 'bg-teal-500/10',   border: 'border-teal-500/30',   icon: CheckCircle2 },
  PARTIAL:              { label: 'Partial',         color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   icon: TrendingUp   },
  PENDING_CONFIRMATION: { label: 'Confirming',      color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  icon: Clock        },
  OVERDUE:              { label: 'Overdue',         color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    icon: AlertCircle  },
  NOT_PAID:             { label: 'Not Paid',        color: 'text-zinc-500',   bg: 'bg-zinc-800/30',   border: 'border-zinc-700',      icon: XCircle      },
};

const TX_STATUS: Record<string, { color: string; label: string }> = {
  SUCCESS: { color: 'text-teal-400',  label: 'SUCCESS'  },
  PENDING: { color: 'text-amber-400', label: 'PENDING'  },
  FAILED:  { color: 'text-red-400',   label: 'FAILED'   },
};

interface Summary {
  total_tenancies:          number;
  fully_funded:             number;
  overdue:                  number;
  partial:                  number;
  pending_confirmation:     number;
  not_paid:                 number;
  due_this_week:            number;
  total_monthly_rent_ngn:   number;
  total_collected_alltime_ngn: number;
  total_vault_balance_ngn:  number;
  total_pending_ngn:        number;
}

interface Tenancy {
  tenancy_id:      string;
  tenant_name:     string;
  tenant_email:    string;
  rent_amount:     string;
  currency:        string;
  unit_name:       string;
  project_title:   string;
  project_number:  string;
  project_id:      string;
  vault_balance:   string;
  target_amount:   string;
  frequency:       string;
  next_due_date:   string | null;
  vault_status:    string;
  vault_pct:       number;
  payment_status:  string;
  days_until_due:  number | null;
  days_since_paid: number | null;
  last_payment_amount: string | null;
  last_payment_at: string | null;
  last_payment_ref: string | null;
  total_collected: string;
  payment_count:   string;
  pending_amount:  string;
  open_notices:    string;
}

interface Transaction {
  id:            string;
  amount_ngn:    string;
  paystack_ref:  string;
  status:        string;
  period_label:  string;
  paid_at:       string | null;
  ledger_hash:   string;
  tenant_name:   string;
  tenant_email:  string;
  unit_name:     string;
  project_title: string;
  project_number: string;
}

type TabKey = 'all' | 'overdue' | 'funded' | 'partial' | 'not_paid';

const TAB_FILTERS: { key: TabKey; label: string; statusMatch?: string[] }[] = [
  { key: 'all',      label: 'All Tenants' },
  { key: 'overdue',  label: 'Overdue',    statusMatch: ['OVERDUE'] },
  { key: 'funded',   label: 'Paid',       statusMatch: ['FULLY_FUNDED'] },
  { key: 'partial',  label: 'Partial',    statusMatch: ['PARTIAL', 'PENDING_CONFIRMATION'] },
  { key: 'not_paid', label: 'Not Paid',   statusMatch: ['NOT_PAID'] },
];

export default function LandlordRentDashboard() {
  const [summary,      setSummary]      = useState<Summary | null>(null);
  const [tenancies,    setTenancies]    = useState<Tenancy[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [activeTab,    setActiveTab]    = useState<TabKey>('all');
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [lastRefresh,  setLastRefresh]  = useState<Date | null>(null);
  const [txView,       setTxView]       = useState<'recent' | 'all'>('recent');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/api/landlord/rent-dashboard');
      setSummary(res.data.summary);
      setTenancies(res.data.tenancies ?? []);
      setTransactions(res.data.transactions ?? []);
      setLastRefresh(new Date());
    } catch (ex: any) {
      setError(ex?.response?.data?.error ?? 'Could not load payment data.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s so pending confirmations resolve live
  useEffect(() => {
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  const filteredTenancies = tenancies.filter(t => {
    const tab = TAB_FILTERS.find(x => x.key === activeTab);
    if (!tab?.statusMatch) return true;
    return tab.statusMatch.includes(t.payment_status);
  });

  const displayedTransactions = txView === 'recent'
    ? transactions.slice(0, 10)
    : transactions;

  if (loading && !summary) return (
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
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link href="/landlord/dashboard"
              className="inline-flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-4">
              <ArrowLeft size={12} /> Landlord Dashboard
            </Link>
            <div className="border-l-2 border-teal-500 pl-5">
              <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Yield Engine</p>
              <h1 className="text-3xl font-black uppercase tracking-tighter">Rent Dashboard</h1>
              <p className="text-zinc-500 text-xs mt-1">
                Live payment status across all tenants and properties
                {lastRefresh && <span className="ml-2 text-zinc-700">· refreshed {fmtTime(lastRefresh)}</span>}
              </p>
            </div>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 border border-zinc-800 text-zinc-500 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:text-white transition-all disabled:opacity-50 flex-shrink-0 mt-6">
            {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14} /> {error}
            <button onClick={load} className="ml-auto text-teal-500 text-xs font-black">Retry →</button>
          </div>
        )}

        {/* ── KPI Row ────────────────────────────────────────────────────── */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: 'Monthly Rent Roll',
                value: `₦${safeF(summary.total_monthly_rent_ngn)}`,
                sub: `${summary.total_tenancies} active tenants`,
                color: 'text-white',
                icon: DollarSign,
                bg: 'border-zinc-800',
              },
              {
                label: 'Vault Balance (Live)',
                value: `₦${safeF(summary.total_vault_balance_ngn)}`,
                sub: 'held in Flex-Pay vaults',
                color: 'text-teal-400',
                icon: Zap,
                bg: 'border-teal-500/20',
              },
              {
                label: 'Overdue',
                value: summary.overdue,
                sub: `${summary.not_paid} not started`,
                color: summary.overdue > 0 ? 'text-red-400' : 'text-zinc-500',
                icon: AlertCircle,
                bg: summary.overdue > 0 ? 'border-red-500/20' : 'border-zinc-800',
              },
              {
                label: 'Fully Paid',
                value: summary.fully_funded,
                sub: `of ${summary.total_tenancies} total`,
                color: 'text-teal-400',
                icon: CheckCircle2,
                bg: 'border-zinc-800',
              },
            ].map(kpi => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className={`p-5 rounded-2xl border bg-zinc-900/20 space-y-2 ${kpi.bg}`}>
                  <Icon size={13} className="text-zinc-600" />
                  <p className={`text-2xl font-black font-mono tabular-nums ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{kpi.label}</p>
                  <p className="text-[9px] text-zinc-700">{kpi.sub}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Status pills summary ────────────────────────────────────────── */}
        {summary && (
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Paid',        val: summary.fully_funded,         cfg: STATUS_CONFIG.FULLY_FUNDED         },
              { label: 'Partial',     val: summary.partial,              cfg: STATUS_CONFIG.PARTIAL              },
              { label: 'Confirming',  val: summary.pending_confirmation,  cfg: STATUS_CONFIG.PENDING_CONFIRMATION },
              { label: 'Overdue',     val: summary.overdue,               cfg: STATUS_CONFIG.OVERDUE              },
              { label: 'Not Started', val: summary.not_paid,              cfg: STATUS_CONFIG.NOT_PAID             },
              { label: 'Due ≤7 Days', val: summary.due_this_week,         cfg: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: '', icon: Calendar } },
            ].map(p => {
              const Icon = p.cfg.icon;
              return (
                <div key={p.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[9px] font-bold uppercase tracking-widest ${p.cfg.bg} ${p.cfg.border} ${p.cfg.color}`}>
                  <Icon size={9} />
                  <span>{p.val}</span>
                  <span className="opacity-70">{p.label}</span>
                </div>
              );
            })}
            <div className="ml-auto text-[9px] text-zinc-700 uppercase font-bold tracking-widest self-center">
              All-time collected: <span className="text-zinc-400">₦{safeF(summary?.total_collected_alltime_ngn)}</span>
            </div>
          </div>
        )}

        {/* ── Tenant Payment Grid ─────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Tab filter */}
          <div className="flex items-center gap-1 flex-wrap">
            {TAB_FILTERS.map(tab => {
              const count = tab.statusMatch
                ? tenancies.filter(t => tab.statusMatch!.includes(t.payment_status)).length
                : tenancies.length;
              return (
                <button key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${
                    activeTab === tab.key
                      ? 'bg-teal-500 text-black'
                      : 'border border-zinc-800 text-zinc-500 hover:text-white'
                  }`}>
                  {tab.label} <span className="opacity-60">({count})</span>
                </button>
              );
            })}
          </div>

          {filteredTenancies.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl">
              <Users className="text-zinc-700 mx-auto mb-3" size={32} />
              <p className="text-zinc-500 text-xs font-bold">No tenants in this category</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTenancies.map(t => {
                const cfg     = STATUS_CONFIG[t.payment_status] ?? STATUS_CONFIG.NOT_PAID;
                const Icon    = cfg.icon;
                const expanded = expandedId === t.tenancy_id;

                return (
                  <div key={t.tenancy_id}
                    className={`rounded-2xl border transition-all ${cfg.border} ${expanded ? cfg.bg : 'border-zinc-800 bg-zinc-900/10 hover:border-zinc-700'}`}>

                    {/* ── Row summary ─────────────────────────────────────── */}
                    <button
                      className="w-full p-4 flex items-center gap-4 text-left"
                      onClick={() => setExpandedId(expanded ? null : t.tenancy_id)}>

                      {/* Status icon */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg} border ${cfg.border}`}>
                        <Icon size={14} className={cfg.color} />
                      </div>

                      {/* Tenant info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm text-white">{t.tenant_name}</p>
                          <span className={`text-[7px] px-1.5 py-0.5 rounded border font-black uppercase ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          {safeN(t.open_notices) > 0 && (
                            <span className="text-[7px] px-1.5 py-0.5 rounded border font-black uppercase bg-red-500/10 border-red-500/30 text-red-400">
                              {t.open_notices} notice{safeN(t.open_notices) > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{t.unit_name} · {t.project_title}</p>
                      </div>

                      {/* Vault bar */}
                      <div className="w-24 flex-shrink-0 hidden md:block">
                        <div className="flex justify-between text-[8px] text-zinc-600 mb-1">
                          <span>Vault</span>
                          <span className={cfg.color}>{t.vault_pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${t.vault_pct >= 100 ? 'bg-teal-500' : t.vault_pct > 0 ? 'bg-amber-500' : 'bg-zinc-700'}`}
                            style={{ width: `${t.vault_pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="text-right flex-shrink-0">
                        <p className={`font-black font-mono text-sm ${cfg.color}`}>
                          ₦{safeF(t.vault_balance)}
                        </p>
                        <p className="text-[8px] text-zinc-600">of ₦{safeF(t.rent_amount)}</p>
                      </div>

                      {/* Expand chevron */}
                      <ChevronRight size={14} className={`text-zinc-600 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`} />
                    </button>

                    {/* ── Expanded detail ──────────────────────────────────── */}
                    {expanded && (
                      <div className="px-4 pb-5 space-y-4 border-t border-zinc-800/50 pt-4">

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { label: 'Rent Amount',    value: `₦${safeF(t.rent_amount)}`, sub: t.frequency || 'ANNUAL' },
                            { label: 'Vault Balance',  value: `₦${safeF(t.vault_balance)}`, sub: `${t.vault_pct}% funded` },
                            { label: 'Total Paid',     value: `₦${safeF(t.total_collected)}`, sub: `${t.payment_count} payments` },
                            { label: 'Next Due',       value: t.next_due_date ? fmtDate(t.next_due_date) : '—',
                              sub: t.days_until_due !== null
                                ? t.days_until_due < 0
                                  ? `${Math.abs(t.days_until_due)} days overdue`
                                  : t.days_until_due === 0 ? 'Due today' : `in ${t.days_until_due} days`
                                : '' },
                          ].map(d => (
                            <div key={d.label} className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800">
                              <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest mb-1">{d.label}</p>
                              <p className="text-sm font-black text-white font-mono">{d.value}</p>
                              <p className="text-[9px] text-zinc-600 mt-0.5">{d.sub}</p>
                            </div>
                          ))}
                        </div>

                        {/* Last payment */}
                        {t.last_payment_at && (
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-teal-500/5 border border-teal-500/20">
                            <CheckCircle2 size={13} className="text-teal-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-teal-400">
                                Last payment: ₦{safeF(t.last_payment_amount)} on {fmtDate(t.last_payment_at)}
                              </p>
                              {t.last_payment_ref && (
                                <p className="text-[9px] text-zinc-600 font-mono truncate mt-0.5">{t.last_payment_ref}</p>
                              )}
                            </div>
                            <Link
                              href={`/projects/${t.project_id}/rental-management/payments/${t.tenancy_id}`}
                              className="flex items-center gap-1 text-[8px] text-teal-400 font-bold uppercase tracking-widest hover:text-white transition-colors flex-shrink-0">
                              Ledger <ArrowUpRight size={9} />
                            </Link>
                          </div>
                        )}

                        {/* Pending amount */}
                        {safeN(t.pending_amount) > 0 && (
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                            <Clock size={13} className="text-amber-400 flex-shrink-0" />
                            <p className="text-xs font-bold text-amber-400">
                              ₦{safeF(t.pending_amount)} pending confirmation from Paystack
                            </p>
                          </div>
                        )}

                        {/* Action links */}
                        <div className="flex gap-2 flex-wrap">
                          <Link href={`/projects/${t.project_id}/rental-management/payments/${t.tenancy_id}`}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-800 text-zinc-500 hover:text-white text-[9px] font-bold uppercase tracking-widest transition-all">
                            <Receipt size={10} /> Payment Ledger
                          </Link>
                          <Link href={`/landlord/notices?tenant=${t.tenancy_id}`}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-800 text-zinc-500 hover:text-white text-[9px] font-bold uppercase tracking-widest transition-all">
                            <Hash size={10} /> Issue Notice
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Recent Transactions ──────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
              Transaction Feed ({transactions.length})
            </p>
            {transactions.length > 10 && (
              <button
                onClick={() => setTxView(v => v === 'recent' ? 'all' : 'recent')}
                className="text-[9px] text-teal-400 font-bold uppercase tracking-widest hover:text-white transition-colors">
                {txView === 'recent' ? `Show all ${transactions.length} →` : '← Show recent'}
              </button>
            )}
          </div>

          {displayedTransactions.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-zinc-800 rounded-2xl">
              <BarChart3 className="text-zinc-700 mx-auto mb-3" size={28} />
              <p className="text-zinc-500 text-xs font-bold">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayedTransactions.map(tx => {
                const txCfg = TX_STATUS[tx.status] ?? TX_STATUS.PENDING;
                return (
                  <div key={tx.id}
                    className="flex items-center gap-4 p-4 rounded-2xl border border-zinc-800 bg-zinc-900/10 hover:border-zinc-700 transition-all flex-wrap">
                    {/* Left: tenant + property */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm text-white">{tx.tenant_name}</p>
                        <span className={`text-[7px] px-1.5 py-0.5 rounded border font-black uppercase ${
                          tx.status === 'SUCCESS' ? 'bg-teal-500/10 border-teal-500/30 text-teal-400' :
                          tx.status === 'PENDING' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                          'bg-red-500/10 border-red-500/30 text-red-400'
                        }`}>
                          {txCfg.label}
                        </span>
                        {tx.period_label && (
                          <span className="text-[7px] text-zinc-600 font-mono">{tx.period_label}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500">{tx.unit_name} · {tx.project_title}</p>
                      <p className="text-[9px] text-zinc-700 font-mono truncate">{tx.paystack_ref}</p>
                    </div>
                    {/* Right: amount + date */}
                    <div className="text-right flex-shrink-0">
                      <p className={`font-black font-mono text-sm ${txCfg.color}`}>
                        ₦{safeF(tx.amount_ngn)}
                      </p>
                      {tx.paid_at ? (
                        <p className="text-[8px] text-zinc-600">{fmtDate(tx.paid_at)} · {fmtTime(tx.paid_at)}</p>
                      ) : (
                        <p className="text-[8px] text-zinc-600">—</p>
                      )}
                    </div>
                    {/* Ledger hash */}
                    {tx.ledger_hash && (
                      <div className="w-full flex items-center gap-1.5 pt-1 border-t border-zinc-800/50">
                        <Hash size={8} className="text-teal-500/50 flex-shrink-0" />
                        <p className="text-[8px] text-zinc-700 font-mono truncate">{tx.ledger_hash}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer links ────────────────────────────────────────────────── */}
        <div className="flex gap-4 flex-wrap pt-2 border-t border-zinc-900">
          <Link href="/landlord/bank"
            className="flex items-center gap-1.5 text-[9px] text-zinc-500 hover:text-white uppercase font-bold tracking-widest transition-colors">
            <Banknote size={10} /> Bank & Payouts
          </Link>
          <Link href="/landlord/tenants"
            className="flex items-center gap-1.5 text-[9px] text-zinc-500 hover:text-white uppercase font-bold tracking-widest transition-colors">
            <Users size={10} /> Tenant Directory
          </Link>
          <Link href="/landlord/notices"
            className="flex items-center gap-1.5 text-[9px] text-zinc-500 hover:text-white uppercase font-bold tracking-widest transition-colors">
            <AlertCircle size={10} /> Litigation Command
          </Link>
        </div>

      </main>
      <Footer />
    </div>
  );
}
