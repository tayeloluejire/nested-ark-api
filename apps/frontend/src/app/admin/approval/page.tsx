'use client';
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import CurrencySelector from '@/components/CurrencySelector';
import { ShieldCheck, Bot, Camera, Users, CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw, ArrowUpRight, Clock, DollarSign, Lock, Activity } from 'lucide-react';

// ── Defensive numeric helpers — never crash on undefined/null/NaN ──────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();
const safeD = (v: any, d = 2): string => safeN(v).toFixed(d);


interface Milestone {
  id: string; title: string; description: string; status: string;
  budget_allocation: number; project_id: string; project_title: string;
  location: string; country: string; total_invested: number; investor_count: number;
  ai_status: string; human_status: string; drone_status: string;
  ai_hash: string | null; evidence_url: string | null; drone_url: string | null;
  release_ready: boolean; pending_layers: string[]; payout_date: string | null;
}

function VerLayer({ label, status, icon: Icon }: { label: string; status: string; icon: any }) {
  const ok = status === 'VERIFIED', rej = status === 'REJECTED';
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-center ${ok ? 'border-teal-500/40 bg-teal-500/5' : rej ? 'border-red-500/40 bg-red-500/5' : 'border-zinc-800 bg-zinc-900/20'}`}>
      <Icon size={11} className={ok ? 'text-teal-500' : rej ? 'text-red-400' : 'text-zinc-600'} />
      <span className="text-[9px] font-bold uppercase tracking-wider flex-1">{label}</span>
      <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${ok ? 'bg-teal-500 animate-pulse' : rej ? 'bg-red-400' : 'bg-zinc-700'}`} />
    </div>
  );
}

function ApprovalCard({ m, onRefresh }: { m: Milestone; onRefresh: () => void }) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { format, currency } = useCurrency();
  const isPaid = m.status === 'PAID';

  const handleHumanApprove = async (approved: boolean) => {
    setSubmitting(true);
    try {
      await api.post(`/api/admin/milestones/${m.id}/human-approve`, { approved, notes });
      onRefresh();
    } catch (err: any) { alert(err?.response?.data?.error ?? 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleRelease = async (skipDrone = false) => {
    if (!confirm(`AUTHORIZE RELEASE of $${safeF(m.budget_allocation)} for "${m.title}"?\n\nIrreversible — will be logged to immutable ledger.`)) return;
    setReleasing(true);
    try {
      const res = await api.post(`/api/admin/milestones/${m.id}/release`, { notes, skip_drone: skipDrone });
      alert(`Funds released!\nAmount: $${safeF(m.budget_allocation)}\nLedger: ${res.data.ledger_hash?.slice(0, 20)}...`);
      onRefresh();
    } catch (err: any) {
      const gate = err?.response?.data?.gate;
      alert(gate ? `Blocked:\nAI: ${gate.ai}\nHuman: ${gate.human}\nDrone: ${gate.drone}` : err?.response?.data?.error ?? 'Failed');
    } finally { setReleasing(false); }
  };

  return (
    <div className={`rounded-2xl border transition-all ${isPaid ? 'border-teal-900/30 bg-teal-950/5' : m.release_ready ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/20'}`}>
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-bold uppercase tracking-tight">{m.title}</h3>
              <span className={`text-[9px] px-2 py-0.5 rounded border uppercase font-bold ${isPaid ? 'border-teal-500/50 text-teal-500' : m.release_ready ? 'border-emerald-500/50 text-emerald-400' : 'border-zinc-700 text-zinc-500'}`}>
                {isPaid ? 'PAID' : m.release_ready ? 'RELEASE READY' : m.status}
              </span>
            </div>
            <p className="text-zinc-500 text-xs">{m.project_title} · {m.location}, {m.country}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Allocation</p>
            <p className="font-mono text-xl font-bold">{format(Number(m.budget_allocation))}</p>
            {currency !== 'USD' && <p className="text-zinc-600 text-[9px] font-mono">${safeF(m.budget_allocation)} USD</p>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <VerLayer label="AI Validator" status={m.ai_status || 'PENDING'} icon={Bot} />
          <VerLayer label="Human Audit" status={m.human_status || 'PENDING'} icon={Users} />
          <VerLayer label="Drone Capture" status={m.drone_status || 'PENDING'} icon={Camera} />
        </div>
        <div className="flex items-center gap-4 text-[10px] text-zinc-600 mb-3 flex-wrap">
          <span>{format(m.total_invested)} invested · {m.investor_count} investors</span>
          {m.ai_hash && <span className="font-mono truncate max-w-[120px]">Hash: {m.ai_hash.slice(0, 10)}…</span>}
        </div>
        {(m.evidence_url || m.drone_url) && (
          <div className="flex gap-2 mb-3">
            {m.evidence_url && <a href={m.evidence_url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all">Evidence</a>}
            {m.drone_url && <a href={m.drone_url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all">Drone Feed</a>}
          </div>
        )}
        {!isPaid && <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-teal-500 uppercase font-bold tracking-widest hover:underline">{expanded ? '▲ Hide Actions' : '▼ Show Actions'}</button>}
        {isPaid && m.payout_date && <p className="text-[10px] text-teal-500 font-bold flex items-center gap-1"><CheckCircle2 size={10} /> Released {new Date(m.payout_date).toLocaleDateString()}</p>}
      </div>
      {expanded && !isPaid && (
        <div className="border-t border-zinc-800 p-6 space-y-4 bg-zinc-900/30">
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Audit notes — document your findings, inspection summary, or release authorization..." className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors resize-none" />
          <div className="flex flex-wrap gap-3">
            {m.human_status !== 'VERIFIED' && (
              <>
                <button disabled={submitting} onClick={() => handleHumanApprove(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-500/20 border border-teal-500/30 text-teal-400 font-bold rounded-xl text-[10px] uppercase tracking-widest hover:bg-teal-500/30 transition-all disabled:opacity-50">
                  {submitting ? <Loader2 className="animate-spin" size={12} /> : <CheckCircle2 size={12} />} Approve Audit
                </button>
                <button disabled={submitting} onClick={() => handleHumanApprove(false)} className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 font-bold rounded-xl text-[10px] uppercase tracking-widest hover:bg-red-500/20 transition-all disabled:opacity-50">
                  <XCircle size={12} /> Reject
                </button>
              </>
            )}
            {m.release_ready && (
              <button disabled={releasing} onClick={() => handleRelease(false)} className="flex items-center gap-2 px-5 py-2.5 bg-white text-black font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all active:scale-95 disabled:opacity-50">
                {releasing ? <Activity className="animate-spin" size={12} /> : <ArrowUpRight size={12} />} Authorize Release
              </button>
            )}
            {m.human_status === 'VERIFIED' && m.ai_status === 'VERIFIED' && m.drone_status !== 'VERIFIED' && (
              <button disabled={releasing} onClick={() => handleRelease(true)} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold rounded-xl text-[10px] uppercase tracking-widest hover:bg-amber-500/30 transition-all disabled:opacity-50">
                <AlertTriangle size={12} /> Release (Skip Drone)
              </button>
            )}
          </div>
          {m.pending_layers.length > 0 && <p className="text-[10px] text-zinc-600 font-mono">Pending: {m.pending_layers.join(' · ')}</p>}
        </div>
      )}
    </div>
  );
}

export default function ApprovalQueuePage() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all'|'ready'|'pending'|'paid'>('all');
  const { currency, setCurrency } = useCurrency();

  const load = useCallback(async () => {
    try { const res = await api.get('/api/admin/approval-queue'); setMilestones(res.data.milestones ?? []); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, [load]);

  const counts = { ready: milestones.filter(m => m.release_ready).length, pending: milestones.filter(m => !m.release_ready && m.status !== 'PAID').length, paid: milestones.filter(m => m.status === 'PAID').length };
  const filtered = milestones.filter(m => filter === 'ready' ? m.release_ready : filter === 'pending' ? (!m.release_ready && m.status !== 'PAID') : filter === 'paid' ? m.status === 'PAID' : true);

  return (
    <div className="space-y-6">
      <header className="border-l-2 border-teal-500 pl-6">
        <p className="text-[10px] text-teal-500 uppercase font-bold tracking-[0.2em] mb-1">Secure Terminal</p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">Approval Queue</h1>
            <p className="text-zinc-500 text-sm mt-1">Review evidence · audit milestones · authorize fund releases</p>
          </div>
          <div className="flex items-center gap-3">
            <CurrencySelector currency={currency} onSelect={setCurrency} compact={false} />
            <button onClick={load} className="p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-teal-500 hover:border-teal-500/50 transition-all"><RefreshCw size={14} /></button>
          </div>
        </div>
      </header>
      <div className="flex items-center gap-2 flex-wrap">
        {[{ key: 'all', label: `All (${milestones.length})` }, { key: 'ready', label: `Release Ready (${counts.ready})`, urgent: counts.ready > 0 }, { key: 'pending', label: `Pending (${counts.pending})` }, { key: 'paid', label: `Paid (${counts.paid})` }].map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key as any)} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${filter === tab.key ? 'bg-teal-500/20 text-teal-500 border border-teal-500/30' : (tab as any).urgent ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'border border-zinc-800 text-zinc-500 hover:text-white'}`}>{tab.label}</button>
        ))}
      </div>
      {loading ? <div className="py-20 text-center"><Loader2 className="animate-spin text-teal-500 mx-auto" size={24} /></div> : filtered.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl">
          <Lock className="mx-auto text-zinc-700 mb-4" size={28} />
          <p className="text-zinc-600 text-xs uppercase font-bold tracking-widest">No milestones in this queue</p>
        </div>
      ) : (
        <div className="space-y-4">{filtered.map(m => <ApprovalCard key={m.id} m={m} onRefresh={load} />)}</div>
      )}
    </div>
  );
}
