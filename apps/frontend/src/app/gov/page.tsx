'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, canAccess } from '@/lib/AuthContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  ShieldCheck, CheckCircle2, Clock, AlertTriangle, Loader2,
  RefreshCw, FileText, Users, BarChart3, Wifi, Globe, Activity,
  ChevronRight, Eye, Database
} from 'lucide-react';

// ── Defensive numeric helpers — never crash on undefined/null/NaN ──────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();
const safeD = (v: any, d = 2): string => safeN(v).toFixed(d);


export default function GovernmentPortal() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [queue, setQueue]     = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    if (!authLoading && !user) { router.replace('/login'); return; }
    if (!authLoading && user && !canAccess(user.role, '/gov')) {
      router.replace(user.role === 'ADMIN' ? '/admin' : '/dashboard');
    }
  }, [user, authLoading, router]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [q, p, s] = await Promise.allSettled([
        api.get('/api/admin/approval-queue'),
        api.get('/api/projects'),
        api.get('/api/admin/summary'),
      ]);
      if (q.status === 'fulfilled') setQueue(q.value.data.milestones ?? []);
      if (p.status === 'fulfilled') setProjects(p.value.data.projects ?? []);
      if (s.status === 'fulfilled') setSummary(s.value.data.summary);
      setLastSync(new Date().toLocaleTimeString());
    } finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { if (user) { load(); const iv = setInterval(() => load(true), 20000); return () => clearInterval(iv); } }, [user, load]);

  const handleApprove = async (milestoneId: string, approved: boolean) => {
    try {
      await api.post(`/api/admin/milestones/${milestoneId}/human-approve`, { approved, notes: approved ? 'Government audit approved' : 'Rejected — does not meet standards' });
      setActionMsg(approved ? '✅ Milestone approved' : '❌ Milestone rejected');
      setTimeout(() => setActionMsg(''), 3000);
      load(true);
    } catch (err: any) {
      setActionMsg('Error: ' + (err?.response?.data?.error ?? 'Unknown'));
      setTimeout(() => setActionMsg(''), 4000);
    }
  };

  const handleVerifyProject = async (projectId: string) => {
    try {
      await api.post(`/api/projects/${projectId}/verify`);
      setActionMsg('✅ Project government-verified');
      setTimeout(() => setActionMsg(''), 3000);
      load(true);
    } catch { setActionMsg('Verification endpoint unavailable'); setTimeout(() => setActionMsg(''), 3000); }
  };

  if (authLoading || !user) return <div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={32}/></div>;

  const pending   = queue.filter(m => m.human_status !== 'VERIFIED');
  const readyFull = queue.filter(m => m.release_ready);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar/>
      {/* pulse bar */}
      <div className="border-b border-zinc-800 bg-black px-6 py-2 flex items-center gap-5 text-[9px] font-mono uppercase tracking-widest overflow-x-auto">
        <span className="flex items-center gap-1.5 text-teal-500 flex-shrink-0"><Wifi size={8}/> Gov Portal</span>
        {lastSync && <span className="text-zinc-600 flex-shrink-0">Synced {lastSync}</span>}
        <span className="flex items-center gap-1.5 text-amber-400 flex-shrink-0"><Clock size={8}/> {pending.length} awaiting audit</span>
        <span className="flex items-center gap-1.5 text-emerald-400 flex-shrink-0"><CheckCircle2 size={8}/> {readyFull.length} ready for release</span>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full space-y-8">
        {/* header */}
        <header className="border-l-2 border-teal-500 pl-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[9px] text-teal-500 uppercase font-bold tracking-[0.2em] mb-1">Government Portal</p>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">Oversight Command</h1>
            <p className="text-zinc-500 text-sm mt-1">Milestone audits · Project authorization · Escrow oversight</p>
          </div>
          <button onClick={() => load(false)} className="p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-teal-500 hover:border-teal-500/40 transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
          </button>
        </header>

        {actionMsg && (
          <div className={`p-3 rounded-xl border text-xs font-bold uppercase tracking-widest text-center ${actionMsg.startsWith('✅') ? 'border-teal-500/30 bg-teal-500/5 text-teal-400' : 'border-red-500/30 bg-red-500/5 text-red-400'}`}>
            {actionMsg}
          </div>
        )}

        {/* summary cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Projects',       value: summary?.projects?.active ?? '—',   icon: Globe,         color: 'text-teal-500' },
            { label: 'Pending Audits',         value: pending.length,                     icon: Clock,         color: 'text-amber-400' },
            { label: 'Release-Ready',          value: readyFull.length,                   icon: CheckCircle2,  color: 'text-emerald-400' },
            { label: 'Total Invested',         value: `$${(safeN(summary?.investments?.total) / 1000).toFixed(0)}k`, icon: BarChart3, color: 'text-teal-500' },
          ].map(c => { const Icon = c.icon; return (
            <div key={c.label} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/30">
              <div className="flex items-center justify-between mb-2"><p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{c.label}</p><Icon size={14} className={c.color}/></div>
              <p className={`text-2xl font-black font-mono ${c.color}`}>{loading ? '…' : c.value}</p>
            </div>
          ); })}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Milestone Audit Queue ──────────────────────────────────────── */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <ShieldCheck size={14} className="text-teal-500"/> Human Audit Queue
            </h2>
            {loading && <div className="py-10 text-center"><Loader2 className="animate-spin text-teal-500 mx-auto" size={20}/></div>}
            {!loading && queue.length === 0 && <p className="text-zinc-600 text-xs border border-dashed border-zinc-800 rounded-xl p-6 text-center">No milestones in queue</p>}
            {queue.slice(0,8).map(m => {
              const triColor = (status: string) => status === 'VERIFIED' ? 'text-teal-500 border-teal-500/40' : 'text-zinc-500 border-zinc-700';
              return (
                <div key={m.id} className={`p-5 rounded-xl border transition-all ${m.release_ready ? 'border-emerald-500/30 bg-emerald-500/5' : m.human_status === 'VERIFIED' ? 'border-teal-500/20 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/20'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-xs uppercase tracking-tight">{m.title}</p>
                      <p className="text-zinc-500 text-[9px]">{m.project_title} · ${safeF(m.budget_allocation)}</p>
                    </div>
                    <span className={`text-[8px] px-2 py-1 rounded border font-bold uppercase flex-shrink-0 ${m.release_ready ? 'border-emerald-500/40 text-emerald-400' : m.human_status === 'VERIFIED' ? 'border-teal-500/40 text-teal-500' : 'border-amber-500/40 text-amber-400'}`}>
                      {m.release_ready ? 'RELEASE READY' : m.human_status === 'VERIFIED' ? 'AUDITED' : 'PENDING AUDIT'}
                    </span>
                  </div>
                  {/* tri-layer status */}
                  <div className="flex gap-2 mb-3">
                    {[{l:'AI',s:m.ai_status},{l:'Human',s:m.human_status},{l:'Drone',s:m.drone_status}].map(v => (
                      <span key={v.l} className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${triColor(v.s)}`}>{v.l}: {v.s}</span>
                    ))}
                  </div>
                  {/* action buttons */}
                  {m.human_status !== 'VERIFIED' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(m.id, true)}
                        className="flex-1 py-2 bg-teal-500 text-black font-bold rounded-lg text-[9px] uppercase tracking-widest hover:bg-teal-400 transition-all">
                        Approve Audit
                      </button>
                      <button onClick={() => handleApprove(m.id, false)}
                        className="flex-1 py-2 border border-red-500/30 text-red-400 font-bold rounded-lg text-[9px] uppercase tracking-widest hover:bg-red-500/10 transition-all">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Project Authorization ─────────────────────────────────────── */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <Globe size={14} className="text-teal-500"/> Project Authorization
            </h2>
            {projects.slice(0, 6).map(p => (
              <div key={p.id} className={`p-5 rounded-xl border transition-all ${p.gov_verified ? 'border-teal-500/20 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/20'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-bold text-xs uppercase tracking-tight">{p.title}</p>
                    <p className="text-zinc-500 text-[9px]">{p.location}, {p.country} · ${safeF(p.budget)}</p>
                  </div>
                  <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${p.gov_verified ? 'border-teal-500/40 text-teal-500' : 'border-zinc-700 text-zinc-500'}`}>
                    {p.gov_verified ? '✓ VERIFIED' : 'UNVERIFIED'}
                  </span>
                </div>
                {!p.gov_verified && (
                  <button onClick={() => handleVerifyProject(p.id)}
                    className="w-full py-2 bg-teal-500/20 border border-teal-500/30 text-teal-400 font-bold rounded-lg text-[9px] uppercase tracking-widest hover:bg-teal-500/30 transition-all">
                    Government Verify
                  </button>
                )}
              </div>
            ))}
            <div className="flex gap-3">
              <Link href="/ledger" className="flex-1 flex items-center gap-2 p-4 rounded-xl border border-zinc-800 bg-zinc-900/20 hover:border-teal-500/50 transition-all">
                <Database size={14} className="text-teal-500"/>
                <div><p className="text-[10px] font-bold uppercase tracking-widest">Full Ledger</p><p className="text-[9px] text-zinc-500">All events</p></div>
              </Link>
              <Link href="/admin" className="flex-1 flex items-center gap-2 p-4 rounded-xl border border-zinc-800 bg-zinc-900/20 hover:border-red-500/50 transition-all">
                <Activity size={14} className="text-red-400"/>
                <div><p className="text-[10px] font-bold uppercase tracking-widest">Admin Panel</p><p className="text-[9px] text-zinc-500">System overview</p></div>
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer/>
    </div>
  );
}
