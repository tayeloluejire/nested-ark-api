'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Activity, Users, Briefcase, DollarSign, Database, TrendingUp, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';

// ── Safe number helpers ───────────────────────────────────────────────────────
const safeNum = (v: unknown): number => { const n = Number(v); return isFinite(n) ? n : 0; };
const safeMil = (v: unknown): string  => (safeNum(v) / 1_000_000).toFixed(2);
const safeInt = (v: unknown): number  => Math.floor(safeNum(v));

export default function AdminCommandCenter() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api.get('/api/admin/summary')
      .then(r => setSummary(r.data?.summary ?? null))
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    const iv = setInterval(() => {
      api.get('/api/admin/summary')
        .then(r => setSummary(r.data?.summary ?? null))
        .catch(() => {});
    }, 15000);
    return () => clearInterval(iv);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Activity className="animate-spin text-teal-500 mx-auto" size={28} />
    </div>
  );

  const s = summary;
  if (!s) return (
    <div className="text-center py-20 text-zinc-500 text-sm">
      No summary data available. Is the backend running?
    </div>
  );

  // ── Safe derived values ───────────────────────────────────────────────────
  const readyForRelease  = safeInt(s.ready_for_release);
  const pendingApprovals = safeInt(s.pending_approvals);
  const totalUsers       = safeInt(s.users?.total);
  const govCount         = safeInt(s.users?.govts);
  const contractorCount  = safeInt(s.users?.contractors);
  const investorCount    = safeInt(s.users?.investors);
  const activeProjects   = safeInt(s.projects?.active);
  const verifiedProjects = safeInt(s.projects?.verified);
  const totalProjects    = safeInt(s.projects?.total);
  const investTotal      = safeNum(s.investments?.total);
  const investCount      = safeInt(s.investments?.count);
  const ledgerEvents     = safeInt(s.ledger_events);
  const milestonesTotal  = safeInt(s.milestones?.total);
  const milestonesPaid   = safeInt(s.milestones?.paid);
  const milestonesValue  = safeNum(s.milestones?.total_value);
  const recentActivity   = Array.isArray(s.recent_activity) ? s.recent_activity : [];

  return (
    <div className="space-y-8">
      <header className="border-l-2 border-red-500 pl-6">
        <p className="text-[10px] text-red-400 uppercase font-bold tracking-[0.2em] mb-1">Admin Command Center</p>
        <h1 className="text-3xl font-black tracking-tighter uppercase italic">System Overview</h1>
        <p className="text-zinc-500 text-sm mt-1">Live infrastructure OS status</p>
      </header>

      {/* Urgent action banners */}
      {(readyForRelease > 0 || pendingApprovals > 0) && (
        <div className="space-y-3">
          {readyForRelease > 0 && (
            <Link href="/admin/approval" className="flex items-center justify-between p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-500 flex-shrink-0" size={18} />
                <div>
                  <p className="text-emerald-400 text-sm font-bold">
                    {readyForRelease} milestone{readyForRelease !== 1 ? 's' : ''} ready for release
                  </p>
                  <p className="text-zinc-500 text-[10px]">All 3 verification layers complete — awaiting your authorization</p>
                </div>
              </div>
              <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Review →</span>
            </Link>
          )}
          {pendingApprovals > 0 && (
            <Link href="/admin/approval" className="flex items-center justify-between p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-all">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-amber-400 flex-shrink-0" size={18} />
                <div>
                  <p className="text-amber-400 text-sm font-bold">
                    {pendingApprovals} milestone{pendingApprovals !== 1 ? 's' : ''} awaiting verification
                  </p>
                  <p className="text-zinc-500 text-[10px]">Evidence submitted — human audit or drone sync needed</p>
                </div>
              </div>
              <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">Review →</span>
            </Link>
          )}
        </div>
      )}

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users',     value: totalUsers,                           sub: `${govCount}G · ${contractorCount}C · ${investorCount}I`,    icon: Users,     color: 'text-teal-500',   href: '/admin/users' },
          { label: 'Active Projects', value: activeProjects,                        sub: `${verifiedProjects} verified · ${totalProjects} total`,    icon: Briefcase, color: 'text-emerald-500', href: '/admin/projects' },
          { label: 'Total Invested',  value: `$${safeMil(investTotal)}M`,           sub: `${investCount} commitments`,                               icon: TrendingUp,color: 'text-amber-400',   href: '/admin/projects' },
          { label: 'Ledger Events',   value: ledgerEvents,                          sub: 'Immutable records',                                         icon: Database,  color: 'text-teal-500',   href: '/admin/ledger' },
        ].map(card => { const Icon = card.icon; return (
          <Link key={card.label} href={card.href}
            className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{card.label}</p>
              <Icon size={14} className={card.color} />
            </div>
            <p className="text-2xl font-black font-mono">{card.value}</p>
            <p className="text-zinc-600 text-[9px] mt-1 font-mono">{card.sub}</p>
          </Link>
        ); })}
      </div>

      {/* Milestone stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Milestones',      value: milestonesTotal,                icon: Clock,        color: 'text-zinc-400' },
          { label: 'Paid Out',        value: milestonesPaid,                  icon: CheckCircle2, color: 'text-teal-500' },
          { label: 'Milestone Value', value: `$${safeMil(milestonesValue)}M`, icon: DollarSign,   color: 'text-amber-400' },
        ].map(card => { const Icon = card.icon; return (
          <div key={card.label} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{card.label}</p>
              <Icon size={13} className={card.color} />
            </div>
            <p className="text-xl font-black font-mono">{card.value}</p>
          </div>
        ); })}
      </div>

      {/* Recent ledger activity */}
      {recentActivity.length > 0 && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-3">Recent Ledger Activity</h2>
          <div className="space-y-2">
            {recentActivity.slice(0, 5).map((ev: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-900/20">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse flex-shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-widest text-teal-400">
                    {(ev.transaction_type ?? '').replace(/_/g, ' ')}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-600 font-mono">
                  {ev.created_at ? new Date(ev.created_at).toLocaleString() : '—'}
                </span>
              </div>
            ))}
          </div>
          <Link href="/admin/ledger" className="mt-3 block text-center text-teal-500 text-xs uppercase font-bold tracking-widest hover:underline">
            View Full Ledger →
          </Link>
        </div>
      )}
    </div>
  );
}
