'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useLiveOverview } from '@/hooks/useLiveOverview';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  TrendingUp, DollarSign, Users, ShieldCheck, Globe,
  ArrowRight, RefreshCw, Activity, Loader2
} from 'lucide-react';

const TX_BADGE: Record<string, string> = {
  INVESTMENT: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
  RENTAL:     'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  BID:        'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  ESCROW:     'bg-green-500/10 text-green-400 border border-green-500/20',
};

const FLAGS: Record<string, string> = {
  Nigeria: '🇳🇬', 'United Kingdom': '🇬🇧', USA: '🇺🇸',
  'United Arab Emirates': '🇦🇪', Kenya: '🇰🇪', Singapore: '🇸🇬',
  Germany: '🇩🇪', Australia: '🇦🇺', Canada: '🇨🇦', India: '🇮🇳',
  Brazil: '🇧🇷', 'South Africa': '🇿🇦',
};

const LIFECYCLE = [
  { key: 'PENDING',      label: 'Initialize', num: '01', sub: 'Nodes submitted' },
  { key: 'ACTIVE',       label: 'Fund',       num: '02', sub: 'Crowdfunding' },
  { key: 'CONSTRUCTION', label: 'Build',      num: '03', sub: 'Under construction' },
  { key: 'VERIFICATION', label: 'Verify',     num: '04', sub: 'Awaiting audit' },
  { key: 'OPERATIONAL',  label: 'Yield',      num: '05', sub: 'Paying rent' },
];

export default function AdminOverviewPage() {
  const { data, isLoading, error, mutate } = useLiveOverview();

  const kpis = data ? [
    {
      label: 'Assets Under Management',
      value: `$${Number(data.aum_usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      sub: 'All operational nodes', delta: '↑ Growing', color: 'teal',
      icon: Globe,
    },
    {
      label: 'Platform Revenue (MTD)',
      value: `$${Number(data.revenue_mtd_usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      sub: 'Your 2% toll gate', delta: 'All fee verticals', color: 'amber',
      icon: DollarSign,
    },
    {
      label: 'Active Stakeholders',
      value: Number(data.active_stakeholders).toLocaleString(),
      sub: 'Investors · Contractors · Tenants', delta: 'All roles', color: 'blue',
      icon: Users,
    },
    {
      label: 'Pending Escrow',
      value: `$${Number(data.pending_escrow_usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      sub: 'Awaiting milestone release', delta: 'Tri-layer protected', color: 'rose',
      icon: ShieldCheck,
    },
  ] : [];

  const colorMap: Record<string, { border: string; text: string }> = {
    teal:  { border: 'border-teal-500/30',  text: 'text-teal-400' },
    amber: { border: 'border-amber-500/30', text: 'text-amber-400' },
    blue:  { border: 'border-blue-500/30',  text: 'text-blue-400' },
    rose:  { border: 'border-rose-500/30',  text: 'text-rose-400' },
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="border-l-2 border-teal-500 pl-5">
            <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">
              Admin · Control Center
            </p>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Global Overview</h1>
            <p className="text-zinc-500 text-xs mt-1">
              Real-time health of the Nested Ark infrastructure OS
            </p>
          </div>
          <button onClick={() => mutate()} disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 border border-zinc-800 rounded-xl text-zinc-500 hover:text-teal-500 hover:border-teal-500/40 text-xs font-bold uppercase tracking-widest transition-all">
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {isLoading && !data && (
          <div className="py-24 flex items-center justify-center">
            <Loader2 className="animate-spin text-teal-500" size={28} />
          </div>
        )}

        {error && (
          <div className="p-5 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* KPI grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {kpis.map(k => {
                const Icon = k.icon;
                const c = colorMap[k.color];
                return (
                  <div key={k.label}
                    className={`p-5 rounded-2xl border ${c.border} bg-zinc-900/20 space-y-2`}>
                    <Icon size={14} className="text-zinc-600" />
                    <p className={`text-2xl font-black font-mono tabular-nums ${c.text}`}>{k.value}</p>
                    <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{k.label}</p>
                    <p className="text-[9px] text-zinc-700">{k.sub}</p>
                    <p className={`text-[9px] font-bold ${c.text}`}>{k.delta}</p>
                  </div>
                );
              })}
            </div>

            {/* All-time revenue badge */}
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 w-fit">
              <TrendingUp size={14} className="text-amber-400" />
              <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">All-time revenue</span>
              <span className="font-mono font-bold text-amber-400">
                ${Number(data.revenue_all_time_usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* Lifecycle pipeline */}
            <div>
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-3">
                Asset Lifecycle Pipeline
              </p>
              <div className="flex overflow-x-auto">
                {LIFECYCLE.map((stage, idx) => (
                  <div key={stage.key}
                    className={`
                      flex-1 min-w-[110px] p-4 border border-zinc-800 bg-zinc-900/20
                      hover:bg-zinc-900/40 transition-all
                      ${idx === 0 ? 'rounded-l-2xl' : ''}
                      ${idx === LIFECYCLE.length - 1 ? 'rounded-r-2xl border-l-0' : 'border-r-0'}
                    `}>
                    <p className="text-[9px] text-teal-500 font-mono font-black mb-1">{stage.num}</p>
                    <p className="text-xs font-black uppercase tracking-tight">{stage.label}</p>
                    <p className="text-2xl font-black font-mono text-teal-400 mt-1">
                      {data.projects_by_status[stage.key as keyof typeof data.projects_by_status] ?? 0}
                    </p>
                    <p className="text-[9px] text-zinc-600 mt-1">{stage.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Live transaction feed */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
                  Live Transaction Feed
                </p>
                <span className="flex items-center gap-1.5 text-[9px] text-teal-500 font-bold">
                  <Activity size={9} className="animate-pulse" /> Live
                </span>
              </div>

              {data.recent_transactions.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-zinc-800 rounded-2xl">
                  <p className="text-zinc-600 text-sm">No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.recent_transactions.map(tx => (
                    <div key={tx.id}
                      className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex items-center gap-4 flex-wrap">
                      <span className="text-xl flex-shrink-0">{FLAGS[tx.country] ?? '🌍'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{tx.project_title}</p>
                        <p className="text-[9px] text-zinc-500 font-mono">
                          {tx.project_number} · {tx.user_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 text-right">
                        <span className={`text-[8px] px-2 py-1 rounded font-black uppercase ${TX_BADGE[tx.type]}`}>
                          {tx.type}
                        </span>
                        <span className="font-mono font-bold text-sm text-teal-400">
                          {tx.currency} {Number(tx.amount).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick nav */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {[
                { href: '/admin/projects',  label: 'Manage Projects' },
                { href: '/admin/revenue',   label: 'Revenue Engine' },
                { href: '/explore',         label: 'Project Explorer' },
                { href: '/projects/submit', label: 'Submit Node' },
              ].map(l => (
                <Link key={l.href} href={l.href}
                  className="flex items-center justify-between gap-2 p-4 rounded-2xl border border-zinc-800 hover:border-teal-500/40 hover:bg-teal-500/5 transition-all text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-teal-400">
                  {l.label} <ArrowRight size={10} />
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
