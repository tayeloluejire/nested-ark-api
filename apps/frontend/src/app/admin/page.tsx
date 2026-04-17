'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Activity, Users, Briefcase, ShieldCheck, DollarSign, Database, TrendingUp, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';

// ── Defensive numeric helpers — never crash on undefined/null/NaN ──────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any, fallback = '0'): string => safeN(v).toLocaleString();
const safeD = (v: any, d = 2): string => safeN(v).toFixed(d);


export default function AdminCommandCenter() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/admin/summary').then(r => setSummary(r.data.summary)).catch(console.error).finally(() => setLoading(false));
    const iv = setInterval(() => api.get('/api/admin/summary').then(r => setSummary(r.data.summary)).catch(() => {}), 15000);
    return () => clearInterval(iv);
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Activity className="animate-spin text-teal-500 mx-auto" size={28} /></div>;
  const s = summary;

  return (
    <div className="space-y-8">
      <header className="border-l-2 border-red-500 pl-6">
        <p className="text-[10px] text-red-400 uppercase font-bold tracking-[0.2em] mb-1">Admin Command Center</p>
        <h1 className="text-3xl font-black tracking-tighter uppercase italic">System Overview</h1>
        <p className="text-zinc-500 text-sm mt-1">Live infrastructure OS status</p>
      </header>

      {s && (s.ready_for_release > 0 || s.pending_approvals > 0) && (
        <div className="space-y-3">
          {s.ready_for_release > 0 && (
            <Link href="/admin/approval" className="flex items-center justify-between p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-500 flex-shrink-0" size={18} />
                <div>
                  <p className="text-emerald-400 text-sm font-bold">{s.ready_for_release} milestone{s.ready_for_release !== 1 ? 's' : ''} ready for release</p>
                  <p className="text-zinc-500 text-[10px]">All 3 verification layers complete — awaiting your authorization</p>
                </div>
              </div>
              <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Review →</span>
            </Link>
          )}
          {s.pending_approvals > 0 && (
            <Link href="/admin/approval" className="flex items-center justify-between p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-all">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-amber-400 flex-shrink-0" size={18} />
                <div>
                  <p className="text-amber-400 text-sm font-bold">{s.pending_approvals} milestone{s.pending_approvals !== 1 ? 's' : ''} awaiting verification</p>
                  <p className="text-zinc-500 text-[10px]">Evidence submitted — human audit or drone sync needed</p>
                </div>
              </div>
              <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">Review →</span>
            </Link>
          )}
        </div>
      )}

      {s && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Users', value: s.users.total, sub: `${s.users.govts}G · ${s.users.contractors}C · ${s.users.investors}I`, icon: Users, color: 'text-teal-500', href: '/admin/users' },
              { label: 'Active Projects', value: s.projects.active, sub: `${s.projects.verified} verified · ${s.projects.total} total`, icon: Briefcase, color: 'text-emerald-500', href: '/admin/projects' },
              { label: 'Total Invested', value: `$${(safeN(s.investments?.total) / 1_000_000).toFixed(2)}M`, sub: `${s.investments.count} commitments`, icon: TrendingUp, color: 'text-amber-400', href: '/admin/projects' },
              { label: 'Ledger Events', value: s.ledger_events, sub: 'Immutable records', icon: Database, color: 'text-teal-500', href: '/admin/ledger' },
            ].map(card => { const Icon = card.icon; return (
              <Link key={card.label} href={card.href} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-all">
                <div className="flex items-center justify-between mb-3"><p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{card.label}</p><Icon size={14} className={card.color} /></div>
                <p className="text-2xl font-black font-mono">{card.value}</p>
                <p className="text-zinc-600 text-[9px] mt-1 font-mono">{card.sub}</p>
              </Link>
            ); })}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Milestones', value: s.milestones.total, icon: Clock, color: 'text-zinc-400' },
              { label: 'Paid Out', value: s.milestones.paid, icon: CheckCircle2, color: 'text-teal-500' },
              { label: 'Milestone Value', value: `$${(safeN(s.milestones?.total_value) / 1_000_000).toFixed(2)}M`, icon: DollarSign, color: 'text-amber-400' },
            ].map(card => { const Icon = card.icon; return (
              <div key={card.label} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/20">
                <div className="flex items-center justify-between mb-2"><p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{card.label}</p><Icon size={13} className={card.color} /></div>
                <p className="text-xl font-black font-mono">{card.value}</p>
              </div>
            ); })}
          </div>
          {s.recent_activity.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-3">Recent Ledger Activity</h2>
              <div className="space-y-2">
                {s.recent_activity.slice(0, 5).map((ev: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-900/20">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse flex-shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-widest text-teal-400">{ev.transaction_type.replace(/_/g, ' ')}</span>
                    </div>
                    <span className="text-[10px] text-zinc-600 font-mono">{new DatesafeF(ev.created_at)}</span>
                  </div>
                ))}
              </div>
              <Link href="/admin/ledger" className="mt-3 block text-center text-teal-500 text-xs uppercase font-bold tracking-widest hover:underline">View Full Ledger →</Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
