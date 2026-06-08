'use client';
export const dynamic = 'force-dynamic';
/**
 * /admin/founder/page.tsx
 * ADMIN ONLY — Founder Command Center
 * API: GET /api/admin/founder-dashboard
 *
 * Sections:
 *  1. Live KPI counters (users, vaults, revenue, payouts)
 *  2. Activity feed — last 25 platform events
 *  3. Signup growth — last 14 days
 *  4. Conversion funnel
 *  5. Recent signups
 *  6. Top landlords
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  Users, Wallet, TrendingUp, DollarSign, RefreshCw,
  Loader2, AlertCircle, Building2, ShieldCheck, Zap,
  ArrowRight, CheckCircle2, Clock, BarChart3, Home,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style:'currency', currency:'NGN', minimumFractionDigits:0 }).format(n || 0);
const fmtN  = (n: number) => Number(n || 0).toLocaleString();
const fmtTime = (t: string) => {
  try {
    return new Date(t).toLocaleTimeString('en-NG', { hour:'2-digit', minute:'2-digit' });
  } catch { return '—'; }
};
const fmtDate = (t: string) => {
  try {
    return new Date(t).toLocaleDateString('en-NG', { day:'2-digit', month:'short' });
  } catch { return '—'; }
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashboardData {
  generated_at:   string;
  users: {
    total: number; tenants: number; landlords: number; investors: number;
    signups_today: number; signups_7d: number; signups_30d: number;
  };
  vaults: {
    active_linked: number; active_standalone: number; total_active: number;
    balance_held: number; pending_releases: number;
  };
  finance: {
    total_contributions: number; contributions_30d: number; total_payments: number;
    total_payouts: number; platform_revenue: number;
  };
  funnel: {
    registered: number; created_vault: number;
    made_contribution: number; reached_100_pct: number;
  };
  activity_feed:  ActivityEvent[];
  signup_growth:  { day: string; total: number; tenants: number; landlords: number }[];
  top_landlords:  { full_name: string; email: string; tenant_count: number; unit_count: number }[];
  recent_signups: { full_name: string; email: string; role: string; account_type: string; created_at: string }[];
}

interface ActivityEvent {
  event_type: string; actor: string; role: string;
  amount: number | null; detail: string; time: string;
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon: Icon, accent = false }: {
  label: string; value: string | number; sub?: string;
  color: string; icon: React.ElementType; accent?: boolean;
}) {
  return (
    <div className={`p-5 rounded-2xl border space-y-2 ${
      accent ? 'border-teal-500/30 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/20'
    }`}>
      <div className="flex items-center justify-between">
        <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">{label}</p>
        <Icon size={14} className={color} />
      </div>
      <p className={`text-2xl font-black font-mono tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-[9px] text-zinc-600">{sub}</p>}
    </div>
  );
}

// ── Activity event row ─────────────────────────────────────────────────────────
function ActivityRow({ event }: { event: ActivityEvent }) {
  const config: Record<string, { icon: string; color: string; label: string }> = {
    signup:       { icon: '👤', color: 'text-teal-400',  label: 'New signup'      },
    vault_created:{ icon: '🏦', color: 'text-green-400', label: 'Vault created'   },
    contribution: { icon: '💰', color: 'text-amber-400', label: 'Contribution'    },
    payout:       { icon: '✅', color: 'text-blue-400',  label: 'Payout released' },
  };
  const c = config[event.event_type] || { icon: '⚡', color: 'text-zinc-400', label: event.event_type };
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-zinc-800/60 last:border-0">
      <span className="text-base shrink-0 mt-0.5">{c.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-[10px] font-black uppercase ${c.color}`}>{c.label}</p>
          <p className="text-xs text-white font-bold truncate">{event.actor || '—'}</p>
          {event.role && (
            <span className="text-[7px] px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-500 uppercase font-bold">
              {event.role}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {event.amount != null && (
            <p className="text-[10px] text-teal-400 font-mono font-bold">{fmt(event.amount)}</p>
          )}
          {event.detail && (
            <p className="text-[9px] text-zinc-600">{event.detail}</p>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[9px] text-zinc-600 font-mono">{fmtTime(event.time)}</p>
        <p className="text-[8px] text-zinc-700 font-mono">{fmtDate(event.time)}</p>
      </div>
    </div>
  );
}

// ── Mini bar chart ─────────────────────────────────────────────────────────────
function MiniBar({ value, max, color = 'bg-teal-500', label }: {
  value: number; max: number; color?: string; label?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%`, transition: 'width 0.8s ease' }} />
      </div>
      {label && <p className="text-[8px] text-zinc-600 font-mono">{label}</p>}
    </div>
  );
}

// ── Funnel step ───────────────────────────────────────────────────────────────
function FunnelStep({ label, value, total, icon: Icon, color }: {
  label: string; value: number; total: number; icon: React.ElementType; color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-4 py-3 border-b border-zinc-800/60 last:border-0">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-zinc-900 border border-zinc-800 shrink-0`}>
        <Icon size={14} className={color} />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-xs text-zinc-300 font-bold">{label}</p>
        <MiniBar value={value} max={total} color={color.replace('text-','bg-')} />
      </div>
      <div className="text-right shrink-0">
        <p className={`font-black font-mono text-sm ${color}`}>{fmtN(value)}</p>
        <p className="text-[9px] text-zinc-600">{pct}%</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FounderDashboardPage() {
  const [data,       setData]       = useState<DashboardData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [lastUpdated,setLastUpdated]= useState('');
  const [autoRefresh,setAutoRefresh]= useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/admin/founder-dashboard')
      .then(r => {
        setData(r.data);
        setLastUpdated(new Date().toLocaleTimeString('en-NG', { hour:'2-digit', minute:'2-digit', second:'2-digit' }));
        setError('');
      })
      .catch(e => setError(e?.response?.data?.error ?? 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto px-6 py-10 w-full space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 border-b border-zinc-800 pb-6">
          <div>
            <p className="text-[9px] text-teal-500 font-mono font-black tracking-[0.25em] uppercase mb-1">
              Admin · Private
            </p>
            <h1 className="text-3xl font-black uppercase tracking-tighter">
              Founder Dashboard
            </h1>
            <p className="text-zinc-500 text-xs mt-1">
              Real-time Nested Ark OS ecosystem health
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-[9px] text-zinc-600 font-mono">
                Updated {lastUpdated}
              </span>
            )}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                autoRefresh
                  ? 'border-teal-500/40 bg-teal-500/10 text-teal-400'
                  : 'border-zinc-700 text-zinc-500 hover:border-zinc-600'
              }`}>
              {autoRefresh ? '⏸ Auto' : '▶ Auto'}
            </button>
            <button onClick={load} disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors">
              <RefreshCw size={13} className={`text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="animate-spin text-teal-500" size={32} />
          </div>
        )}

        {data && (
          <>
            {/* ── Section 1: User KPIs ──────────────────────────────────── */}
            <section className="space-y-3">
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Platform Users</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Total Users"    value={fmtN(data.users.total)}     color="text-white"     icon={Users}     accent />
                <KpiCard label="Tenants"         value={fmtN(data.users.tenants)}   color="text-green-400" icon={Home}      />
                <KpiCard label="Landlords"       value={fmtN(data.users.landlords)} color="text-teal-400"  icon={Building2} />
                <KpiCard label="Investors"       value={fmtN(data.users.investors)} color="text-amber-400" icon={TrendingUp} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <KpiCard label="Signups Today"   value={fmtN(data.users.signups_today)} color="text-teal-400"  icon={Zap}
                  sub={`${fmtN(data.users.signups_7d)} this week`} />
                <KpiCard label="Signups 7 Days"  value={fmtN(data.users.signups_7d)}    color="text-white"    icon={Users}    />
                <KpiCard label="Signups 30 Days" value={fmtN(data.users.signups_30d)}   color="text-zinc-300" icon={BarChart3} />
              </div>
            </section>

            {/* ── Section 2: Vault & Finance KPIs ──────────────────────── */}
            <section className="space-y-3">
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Vaults & Finance</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Active Vaults"    value={fmtN(data.vaults.total_active)}     color="text-green-400" icon={Wallet}     accent />
                <KpiCard label="Escrow Held"      value={fmt(data.vaults.balance_held)}       color="text-teal-400"  icon={ShieldCheck}
                  sub={`${fmtN(data.vaults.pending_releases)} pending release`} />
                <KpiCard label="Total Contributions" value={fmt(data.finance.total_contributions)} color="text-white" icon={DollarSign}
                  sub={`${fmt(data.finance.contributions_30d)} this month`} />
                <KpiCard label="Platform Revenue" value={fmt(data.finance.platform_revenue)} color="text-amber-400" icon={TrendingUp}
                  sub={`${fmt(data.finance.total_payouts)} in payouts`} />
              </div>
            </section>

            {/* ── Section 3: Activity Feed + Funnel (2-col) ─────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Activity feed */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">
                    Live Activity Feed
                  </p>
                  <span className="flex items-center gap-1 text-[8px] text-teal-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                    Live
                  </span>
                </div>
                <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 max-h-96 overflow-y-auto">
                  {data.activity_feed.length === 0 ? (
                    <p className="text-zinc-600 text-sm text-center py-8">No activity yet.</p>
                  ) : (
                    data.activity_feed.map((e, i) => <ActivityRow key={i} event={e} />)
                  )}
                </div>
              </section>

              {/* Conversion funnel */}
              <section className="space-y-3">
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Conversion Funnel</p>
                <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20">
                  <FunnelStep label="Registered"         value={data.funnel.registered}         total={data.funnel.registered} icon={Users}      color="text-white" />
                  <FunnelStep label="Created Vault"      value={data.funnel.created_vault}      total={data.funnel.registered} icon={Wallet}     color="text-green-400" />
                  <FunnelStep label="Made Contribution"  value={data.funnel.made_contribution}  total={data.funnel.registered} icon={DollarSign} color="text-teal-400" />
                  <FunnelStep label="Reached 100% Funded" value={data.funnel.reached_100_pct}  total={data.funnel.registered} icon={CheckCircle2}color="text-amber-400" />
                </div>
              </section>
            </div>

            {/* ── Section 4: Signup growth chart (14 days) ──────────────── */}
            {data.signup_growth.length > 0 && (
              <section className="space-y-3">
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">
                  Signup Growth — Last 14 Days
                </p>
                <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20">
                  <div className="flex items-end gap-2 h-24">
                    {(() => {
                      const max = Math.max(...data.signup_growth.map(d => Number(d.total)), 1);
                      return data.signup_growth.map((d, i) => {
                        const pct = Math.max(4, (Number(d.total) / max) * 100);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-[7px] text-zinc-500 font-mono">{d.total}</span>
                            <div className="w-full flex flex-col gap-0.5 items-center">
                              <div
                                className="w-full rounded-t-sm bg-teal-500/60"
                                style={{ height: `${(Number(d.tenants || 0) / max) * 80}px`, minHeight: d.tenants ? '3px' : '0' }}
                              />
                              <div
                                className="w-full bg-amber-500/60"
                                style={{ height: `${(Number(d.landlords || 0) / max) * 80}px`, minHeight: d.landlords ? '3px' : '0' }}
                              />
                            </div>
                            <span className="text-[7px] text-zinc-700 font-mono">{d.day?.slice(5)}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="flex items-center gap-1.5 text-[8px] text-zinc-500">
                      <span className="w-2 h-2 rounded-sm bg-teal-500/60" /> Tenants
                    </span>
                    <span className="flex items-center gap-1.5 text-[8px] text-zinc-500">
                      <span className="w-2 h-2 rounded-sm bg-amber-500/60" /> Landlords
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* ── Section 5: Recent signups + Top landlords (2-col) ─────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Recent signups */}
              <section className="space-y-3">
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Recent Signups</p>
                <div className="rounded-2xl border border-zinc-800 overflow-hidden">
                  {data.recent_signups.map((u, i) => (
                    <div key={i} className={`flex items-center gap-3 px-4 py-3 ${
                      i < data.recent_signups.length - 1 ? 'border-b border-zinc-800/60' : ''
                    }`}>
                      <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-black text-zinc-400">
                          {u.full_name?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{u.full_name || u.email}</p>
                        <p className="text-[9px] text-zinc-600 truncate">{u.email}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-[8px] px-2 py-0.5 rounded border font-black uppercase ${
                          u.role === 'TENANT'
                            ? 'border-green-500/30 text-green-400'
                            : u.role === 'DEVELOPER' || u.account_type === 'LANDLORD'
                              ? 'border-teal-500/30 text-teal-400'
                              : 'border-zinc-700 text-zinc-500'
                        }`}>{u.account_type || u.role}</span>
                        <p className="text-[8px] text-zinc-700 font-mono mt-0.5">{fmtDate(u.created_at)}</p>
                      </div>
                    </div>
                  ))}
                  {data.recent_signups.length === 0 && (
                    <p className="text-zinc-600 text-sm text-center py-8">No signups yet.</p>
                  )}
                </div>
              </section>

              {/* Top landlords */}
              <section className="space-y-3">
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Top Landlords by Tenants</p>
                <div className="rounded-2xl border border-zinc-800 overflow-hidden">
                  {data.top_landlords.map((l, i) => (
                    <div key={i} className={`flex items-center gap-3 px-4 py-3 ${
                      i < data.top_landlords.length - 1 ? 'border-b border-zinc-800/60' : ''
                    }`}>
                      <div className="w-7 h-7 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-black text-teal-400">
                          {i + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{l.full_name}</p>
                        <p className="text-[9px] text-zinc-600 truncate">{l.email}</p>
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <p className="text-teal-400 font-black font-mono text-sm">{l.tenant_count}</p>
                        <p className="text-[8px] text-zinc-600">{l.unit_count} units</p>
                      </div>
                    </div>
                  ))}
                  {data.top_landlords.length === 0 && (
                    <p className="text-zinc-600 text-sm text-center py-8">No landlords yet.</p>
                  )}
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-center gap-2 pt-4 border-t border-zinc-900">
              <ShieldCheck size={10} className="text-teal-500" />
              <p className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest">
                Nested Ark OS · Founder Command Center · {data.generated_at ? new Date(data.generated_at).toLocaleString('en-NG') : ''}
              </p>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
