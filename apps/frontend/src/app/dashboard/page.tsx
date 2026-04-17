'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, getRoleRoute, UserRole } from '@/lib/AuthContext';
import Navbar from '@/components/Navbar';
import { useLiveProjects, useLiveMilestones, useLiveInvestments } from '@/hooks/useLiveSystem';
import { Activity, Briefcase, TrendingUp, CheckCircle2, Clock, DollarSign, Database, ShieldCheck, Loader2, Crown } from 'lucide-react';
import Link from 'next/link';

// ── Safe number helpers ───────────────────────────────────────────────────────
const safeNum = (v: unknown): number => {
  const n = Number(v);
  return isFinite(n) ? n : 0;
};
const fmtNum = (v: unknown): string => safeNum(v).toLocaleString();

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { projects,    isLoading: projLoading } = useLiveProjects();
  const { milestones,  isLoading: mileLoading } = useLiveMilestones();
  const { investments }                          = useLiveInvestments();

  useEffect(() => {
    if (!authLoading && !user) { router.replace('/login'); return; }
  }, [user, authLoading, router]);

  if (authLoading || !user) return (
    <div className="h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={32} />
    </div>
  );

  // ── Safe aggregations ─────────────────────────────────────────────────────
  const safeInvestments   = Array.isArray(investments) ? investments : [];
  const safeProjects      = Array.isArray(projects)    ? projects    : [];
  const safeMilestones    = Array.isArray(milestones)  ? milestones  : [];

  const totalInvested       = safeInvestments.reduce((s: number, i: any) => s + safeNum(i?.amount), 0);
  const activeProjects      = safeProjects.filter((p: any) => p?.status === 'ACTIVE').length;
  const completedMilestones = safeMilestones.filter((m: any) => m?.status === 'PAID' || m?.status === 'COMPLETED').length;

  const statCards = [
    { label: 'Total Projects', value: projLoading ? '…' : safeProjects.length, icon: Briefcase,    color: 'text-teal-500' },
    { label: 'Active Nodes',   value: projLoading ? '…' : activeProjects,      icon: Activity,     color: 'text-emerald-500' },
    { label: 'Milestones',     value: mileLoading ? '…' : safeMilestones.length, icon: Clock,      color: 'text-amber-500' },
    { label: 'Completed',      value: mileLoading ? '…' : completedMilestones, icon: CheckCircle2, color: 'text-teal-500' },
  ];

  const isElevated = user.role === 'ADMIN' || user.role === 'GOVERNMENT';

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-12">

        <header className="mb-10 border-l-2 border-teal-500 pl-6">
          <p className="text-[10px] text-teal-500 uppercase font-bold tracking-[0.2em] mb-2">
            Operator Terminal // {user.role}
          </p>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic">
            Welcome, {user.full_name?.split(' ')[0] ?? 'Operator'}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Infrastructure Management OS — Live System Overview</p>
        </header>

        {/* Admin/Government — prominent command center shortcut */}
        {isElevated && (
          <div className="mb-10">
            <Link
              href={user.role === 'ADMIN' ? '/admin' : '/admin/approval'}
              className="flex items-center justify-between p-6 rounded-2xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-all"
            >
              <div className="flex items-center gap-4">
                <Crown className="text-red-400 flex-shrink-0" size={24} />
                <div>
                  <p className="text-red-400 text-base font-bold uppercase tracking-tight">
                    {user.role === 'ADMIN' ? 'Admin Command Center' : 'Government Approval Portal'}
                  </p>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {user.role === 'ADMIN'
                      ? 'System overview, approval queue, user management, ledger'
                      : 'Review milestones, authorize escrow releases, audit queue'}
                  </p>
                </div>
              </div>
              <span className="text-red-400 text-xs font-bold uppercase tracking-widest flex-shrink-0">Open →</span>
            </Link>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {statCards.map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{card.label}</p>
                  <Icon size={16} className={card.color} />
                </div>
                <p className="text-3xl font-black font-mono">{card.value}</p>
              </div>
            );
          })}
        </div>

        {/* Investor committed capital — safe guard on totalInvested */}
        {user.role === 'INVESTOR' && totalInvested > 0 && (
          <div className="mb-8 p-6 rounded-2xl border border-teal-500/30 bg-teal-500/5">
            <p className="text-[10px] text-teal-500 uppercase font-bold tracking-widest mb-1">Your Total Committed Capital</p>
            <p className="text-3xl font-black font-mono text-teal-500">${fmtNum(totalInvested)}</p>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(user.role === 'GOVERNMENT' || user.role === 'ADMIN') && (
            <Link href="/projects" className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-teal-500/50 transition-all text-left">
              <ShieldCheck className="text-teal-500 mb-4" size={24} />
              <h3 className="font-bold uppercase tracking-tight mb-1">Manage Projects</h3>
              <p className="text-zinc-500 text-xs">Create, verify and approve infrastructure proposals.</p>
            </Link>
          )}
          {user.role === 'INVESTOR' && (
            <Link href="/investments" className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-teal-500/50 transition-all text-left">
              <TrendingUp className="text-emerald-500 mb-4" size={24} />
              <h3 className="font-bold uppercase tracking-tight mb-1">Investment Nodes</h3>
              <p className="text-zinc-500 text-xs">Browse open funding pools and commit capital.</p>
            </Link>
          )}
          {(user.role === 'CONTRACTOR' || user.role === 'SUPPLIER') && (
            <Link href="/projects" className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-teal-500/50 transition-all text-left">
              <Briefcase className="text-amber-500 mb-4" size={24} />
              <h3 className="font-bold uppercase tracking-tight mb-1">Browse Projects</h3>
              <p className="text-zinc-500 text-xs">View open projects and submit your quotation.</p>
            </Link>
          )}
          {user.role === 'BANK' && (
            <Link href="/ledger" className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-teal-500/50 transition-all text-left">
              <Database className="text-purple-500 mb-4" size={24} />
              <h3 className="font-bold uppercase tracking-tight mb-1">Capital Ledger</h3>
              <p className="text-zinc-500 text-xs">Review tranche disbursements and ledger verification.</p>
            </Link>
          )}
          <Link href="/milestones" className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-teal-500/50 transition-all text-left">
            <DollarSign className="text-teal-500 mb-4" size={24} />
            <h3 className="font-bold uppercase tracking-tight mb-1">Payout Schedule</h3>
            <p className="text-zinc-500 text-xs">Track milestone payouts and escrow releases.</p>
          </Link>
          <Link href="/ledger" className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-teal-500/50 transition-all text-left">
            <Database className="text-teal-500 mb-4" size={24} />
            <h3 className="font-bold uppercase tracking-tight mb-1">Global Ledger</h3>
            <p className="text-zinc-500 text-xs">Live transparency log of all system events.</p>
          </Link>
        </div>
      </main>
    </div>
  );
}
