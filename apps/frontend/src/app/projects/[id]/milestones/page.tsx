'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {

// ── Defensive numeric helpers — never crash on undefined/null/NaN ──────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any, fallback = '0'): string => safeN(v).toLocaleString();
const safeD = (v: any, d = 2): string => safeN(v).toFixed(d);

  Hammer, ShieldCheck, Loader2, AlertCircle, ArrowLeft,
  CheckCircle2, Clock, Lock, Unlock, TrendingUp, RefreshCw
} from 'lucide-react';

interface MilestoneData {
  id: string; title: string; description: string;
  budget_allocation: number; status: string;
  milestone_type: string;
  mobilization_pct: number;
  mobilization_amount: number; mobilization_paid: boolean; mobilization_paid_at: string;
  completion_amount: number;  completion_paid: boolean;  completion_paid_at: string;
  ai_status: string; human_status: string; drone_status: string;
  tri_layer_complete: boolean; can_release_completion: boolean;
}

const LAYER_LABEL: Record<string, string> = {
  VERIFIED: '✓ Verified', PENDING: '⏳ Pending', REJECTED: '✗ Rejected',
};
const LAYER_COLOR: Record<string, string> = {
  VERIFIED: 'text-teal-400', PENDING: 'text-amber-400', REJECTED: 'text-red-400',
};

export default function MilestonesMobilizationPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();

  const [milestones, setMilestones] = useState<MilestoneData[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [acting,     setActing]     = useState<Record<string, boolean>>({});
  const [results,    setResults]    = useState<Record<string, string>>({});

  const load = async () => {
    if (!projectId) return;
    setLoading(true); setError('');
    try {
      const [milestonesRes] = await Promise.all([
        api.get(`/api/projects/${projectId}/milestones`),
      ]);
      const raw: any[] = milestonesRes.data.milestones ?? milestonesRes.data ?? [];

      // Fetch mobilization status for each milestone
      const enriched = await Promise.all(raw.map(async (m: any) => {
        try {
          const r = await api.get(`/api/milestones/${m.id}/mobilization-status`);
          return { ...m, ...r.data.milestone, tri_layer_complete: r.data.tri_layer_complete, can_release_completion: r.data.can_release_completion };
        } catch { return m; }
      }));
      setMilestones(enriched);
    } catch (ex: any) {
      setError(ex?.response?.data?.error ?? 'Could not load milestones.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const mobilize = async (milestoneId: string) => {
    setActing(a => ({ ...a, [milestoneId]: true }));
    try {
      const res = await api.post(`/api/milestones/${milestoneId}/mobilize`);
      setResults(r => ({ ...r, [milestoneId]: `✓ ${res.data.message}` }));
      load();
    } catch (ex: any) {
      setResults(r => ({ ...r, [milestoneId]: `✗ ${ex?.response?.data?.error ?? 'Failed'}` }));
    } finally { setActing(a => ({ ...a, [milestoneId]: false })); }
  };

  const releaseCompletion = async (milestoneId: string) => {
    setActing(a => ({ ...a, [`complete-${milestoneId}`]: true }));
    try {
      const res = await api.post(`/api/milestones/${milestoneId}/release-completion`);
      setResults(r => ({ ...r, [`complete-${milestoneId}`]: `✓ ${res.data.message}` }));
      load();
    } catch (ex: any) {
      setResults(r => ({ ...r, [`complete-${milestoneId}`]: `✗ ${ex?.response?.data?.error ?? 'Failed'}` }));
    } finally { setActing(a => ({ ...a, [`complete-${milestoneId}`]: false })); }
  };

  const setMobilizationPct = async (milestoneId: string, pct: number) => {
    try {
      await api.put(`/api/milestones/${milestoneId}`, { mobilization_pct: pct });
      load();
    } catch (ex: any) { alert(ex?.response?.data?.error ?? 'Update failed'); }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div>
          <button onClick={() => router.back()}
            className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-5">
            <ArrowLeft size={12} /> Back
          </button>
          <div className="border-l-2 border-amber-500 pl-5">
            <p className="text-[9px] text-amber-500 font-mono font-black tracking-widest uppercase mb-1">
              Mobilization Escrow Engine
            </p>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Milestone Payments</h1>
            <p className="text-zinc-500 text-xs mt-1">
              70/30 split — mobilization released instantly, balance held until tri-layer verification
            </p>
          </div>
        </div>

        {/* Explainer */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { step: '01', title: 'Developer Funds', body: 'Full milestone budget is committed to the Ark Escrow vault. Contractor is notified.' },
            { step: '02', title: '70% Mobilization', body: 'Developer clicks "Release Mobilization". 70% is instantly released so contractor can buy materials and start work.' },
            { step: '03', title: '30% on Completion', body: 'After AI + Human + Drone tri-layer verification, developer releases the 30% balance. Platform takes 2%.' },
          ].map(s => (
            <div key={s.step} className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-2">
              <p className="text-[9px] text-amber-500 font-mono font-black uppercase">{s.step}</p>
              <p className="text-xs font-black uppercase tracking-tight">{s.title}</p>
              <p className="text-[9px] text-zinc-500 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        {loading && (
          <div className="py-20 flex items-center justify-center">
            <Loader2 className="animate-spin text-teal-500" size={28} />
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {!loading && milestones.length === 0 && (
          <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl space-y-3">
            <Hammer className="text-zinc-700 mx-auto" size={32} />
            <p className="text-zinc-500 font-bold">No milestones yet</p>
            <p className="text-zinc-700 text-sm">Add milestones to this project to enable mobilization escrow</p>
          </div>
        )}

        {!loading && milestones.map((m: any) => {
          const totalBudget    = parseFloat(m.budget_allocation || 0);
          const mobilPct       = parseFloat(m.mobilization_pct  || 70);
          const completionPct  = 100 - mobilPct;
          const mobilAmount    = m.mobilization_amount ?? (totalBudget * mobilPct / 100);
          const completionAmt  = m.completion_amount   ?? (totalBudget * completionPct / 100);
          const isSplit        = m.milestone_type === 'MOBILIZATION_SPLIT' || m.mobilization_paid;

          return (
            <div key={m.id} className={`p-6 rounded-2xl border ${
              m.status === 'PAID' ? 'border-teal-500/30 bg-teal-500/5' :
              m.mobilization_paid ? 'border-amber-500/30 bg-amber-500/5' :
              'border-zinc-800 bg-zinc-900/20'
            } space-y-5`}>

              {/* Milestone header */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-bold text-base uppercase tracking-tight">{m.title}</h3>
                  {m.description && <p className="text-[10px] text-zinc-500 mt-1">{m.description}</p>}
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-xl">₦{safeF(totalBudget)}</p>
                  <span className={`text-[8px] px-2 py-1 rounded font-bold uppercase ${
                    m.status === 'PAID'        ? 'bg-teal-500/20 text-teal-400' :
                    m.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-zinc-800 text-zinc-500'
                  }`}>{m.status}</span>
                </div>
              </div>

              {/* Split visualization */}
              <div className="space-y-2">
                <div className="flex gap-1 h-3 rounded-full overflow-hidden">
                  <div className="bg-amber-500 rounded-l-full transition-all flex items-center justify-center"
                    style={{ width: `${mobilPct}%` }}>
                  </div>
                  <div className="bg-zinc-700 rounded-r-full flex-1" />
                </div>
                <div className="flex justify-between text-[9px]">
                  <span className="text-amber-400 font-mono font-bold">{mobilPct}% Mobilization — ₦{safeF(mobilAmount)}</span>
                  <span className="text-zinc-500 font-mono">{completionPct}% Completion — ₦{safeF(completionAmt)}</span>
                </div>
              </div>

              {/* Split % selector (only before mobilization) */}
              {!m.mobilization_paid && (
                <div className="flex items-center gap-3">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Mobilization %</span>
                  {[50, 60, 70, 80].map(pct => (
                    <button key={pct} onClick={() => setMobilizationPct(m.id, pct)}
                      className={`px-3 py-1 rounded-lg text-[9px] font-bold border transition-all ${
                        Math.round(mobilPct) === pct
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                          : 'border-zinc-700 text-zinc-500 hover:text-white'
                      }`}>{pct}%</button>
                  ))}
                </div>
              )}

              {/* Mobilization section */}
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 space-y-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    {m.mobilization_paid
                      ? <Unlock size={14} className="text-amber-400" />
                      : <Lock size={14} className="text-zinc-600" />}
                    <div>
                      <p className="text-xs font-bold">Mobilization Payment</p>
                      <p className="text-[9px] text-zinc-500">₦{safeF(mobilAmount)} · {mobilPct}%</p>
                    </div>
                  </div>
                  {m.mobilization_paid ? (
                    <span className="flex items-center gap-1 text-[9px] text-teal-400 font-bold">
                      <CheckCircle2 size={10} /> Released {m.mobilization_paid_at ? new Date(m.mobilization_paid_at).toLocaleDateString() : ''}
                    </span>
                  ) : (
                    <button onClick={() => mobilize(m.id)} disabled={acting[m.id]}
                      className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-black font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-white transition-all disabled:opacity-60">
                      {acting[m.id] ? <Loader2 className="animate-spin" size={10} /> : <Unlock size={10} />}
                      Release {mobilPct}% Mobilization
                    </button>
                  )}
                </div>
                {results[m.id] && (
                  <p className={`text-[9px] font-bold font-mono ${results[m.id].startsWith('✓') ? 'text-teal-400' : 'text-red-400'}`}>
                    {results[m.id]}
                  </p>
                )}
              </div>

              {/* Tri-layer verification status */}
              {m.mobilization_paid && (
                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 space-y-3">
                  <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Tri-Layer Verification</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'AI Analysis', status: m.ai_status },
                      { label: 'Human Audit', status: m.human_status },
                      { label: 'Drone Survey', status: m.drone_status },
                    ].map(layer => (
                      <div key={layer.label} className={`p-3 rounded-xl border ${
                        layer.status === 'VERIFIED' ? 'border-teal-500/30 bg-teal-500/5' :
                        layer.status === 'REJECTED' ? 'border-red-500/30 bg-red-500/5' :
                        'border-zinc-800 bg-zinc-900/20'
                      } text-center space-y-1`}>
                        <p className="text-[9px] text-zinc-500 uppercase font-bold">{layer.label}</p>
                        <p className={`text-xs font-bold ${LAYER_COLOR[layer.status] ?? 'text-zinc-400'}`}>
                          {LAYER_LABEL[layer.status] ?? layer.status}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Completion release */}
                  <div className="flex items-center justify-between gap-4 flex-wrap pt-2 border-t border-zinc-800">
                    <div>
                      <p className="text-xs font-bold">Completion Payment</p>
                      <p className="text-[9px] text-zinc-500">₦{safeF(completionAmt)} · {completionPct}% balance</p>
                    </div>
                    {m.completion_paid ? (
                      <span className="flex items-center gap-1 text-[9px] text-teal-400 font-bold">
                        <CheckCircle2 size={10} /> Released {m.completion_paid_at ? new Date(m.completion_paid_at).toLocaleDateString() : ''}
                      </span>
                    ) : m.can_release_completion ? (
                      <button onClick={() => releaseCompletion(m.id)} disabled={acting[`complete-${m.id}`]}
                        className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 text-black font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-white transition-all disabled:opacity-60">
                        {acting[`complete-${m.id}`] ? <Loader2 className="animate-spin" size={10} /> : <Unlock size={10} />}
                        Release {completionPct}% Balance
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-[9px] text-amber-400 font-bold">
                        <Clock size={10} /> Awaiting full verification
                      </span>
                    )}
                  </div>
                  {results[`complete-${m.id}`] && (
                    <p className={`text-[9px] font-bold font-mono ${results[`complete-${m.id}`].startsWith('✓') ? 'text-teal-400' : 'text-red-400'}`}>
                      {results[`complete-${m.id}`]}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

      </main>
      <Footer />
    </div>
  );
}
