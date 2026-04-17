'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useLiveProjects } from '@/hooks/useLiveSystem';
import { useCurrency } from '@/hooks/useCurrency';
import CurrencySelector from '@/components/CurrencySelector';
import { ShieldCheck, Loader2, RefreshCw } from 'lucide-react';

// ── Safe number helper ────────────────────────────────────────────────────────
const safeNum = (v: unknown): number => { const n = Number(v); return isFinite(n) ? n : 0; };

export default function AdminProjectsPage() {
  const { projects, isLoading, mutate } = useLiveProjects();
  const { format, currency, setCurrency } = useCurrency();
  const [investments, setInvestments] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/investments')
      .then(r => setInvestments(r.data?.investments ?? []))
      .catch(() => {});
  }, []);

  const getFunded = (pid: string): number =>
    (Array.isArray(investments) ? investments : [])
      .filter((i: any) => i?.project_id === pid && i?.status === 'COMMITTED')
      .reduce((s: number, i: any) => s + safeNum(i?.amount), 0);

  const handleVerify = async (project: any) => {
    try {
      await api.post('/api/gov/verify-project', {
        project_id: project.id,
        official_id: 'admin',
        official_name: 'Admin Verification',
      });
      mutate();
      alert(`Project verified: ${project.title}`);
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Verification failed');
    }
  };

  const safeProjects = Array.isArray(projects) ? projects : [];

  return (
    <div className="space-y-6">
      <header className="border-l-2 border-teal-500 pl-6">
        <p className="text-[10px] text-teal-500 uppercase font-bold tracking-[0.2em] mb-1">Project Management</p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">All Projects</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {safeProjects.length} projects · {safeProjects.filter((p: any) => p?.gov_verified).length} government verified
            </p>
          </div>
          <div className="flex items-center gap-3">
            <CurrencySelector currency={currency} onSelect={setCurrency} compact={false} />
            <button onClick={() => mutate()} className="p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-teal-500 hover:border-teal-500/50 transition-all">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="py-20 text-center"><Loader2 className="animate-spin text-teal-500 mx-auto" size={24} /></div>
      ) : (
        <div className="space-y-3">
          {safeProjects.map((p: any) => {
            const budget   = safeNum(p?.budget);
            const funded   = getFunded(p?.id);
            const fillPct  = budget > 0 ? Math.min(Math.round((funded / budget) * 100), 100) : 0;

            return (
              <div key={p.id} className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 transition-all">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold uppercase tracking-tight">{p.title ?? 'Untitled'}</h3>
                      <span className={`text-[9px] px-2 py-0.5 rounded border uppercase font-bold ${
                        p.status === 'ACTIVE' ? 'border-teal-500/30 text-teal-500' : 'border-zinc-700 text-zinc-500'
                      }`}>{p.status ?? '—'}</span>
                      {p.gov_verified && (
                        <span className="flex items-center gap-1 text-[9px] text-teal-500 font-bold">
                          <ShieldCheck size={10} /> Verified
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-500 text-xs">{p.location ?? '—'}, {p.country ?? '—'} · {p.category ?? '—'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono text-lg font-bold">{format(budget)}</p>
                    {currency !== 'USD' && (
                      <p className="text-zinc-600 text-[9px] font-mono">${budget.toLocaleString()} USD</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  <div className="flex justify-between text-[9px] text-zinc-600">
                    <span>Funding Progress</span>
                    <span>{fillPct}% · {format(funded)} of {format(budget)}</span>
                  </div>
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 transition-all" style={{ width: `${fillPct}%` }} />
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {!p.gov_verified && (
                    <button onClick={() => handleVerify(p)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-teal-500/20 border border-teal-500/30 text-teal-400 font-bold rounded-lg text-[10px] uppercase tracking-widest hover:bg-teal-500/30 transition-all">
                      <ShieldCheck size={11} /> Verify Project
                    </button>
                  )}
                  <a href="/milestones"
                    className="flex items-center gap-1.5 px-3 py-2 border border-zinc-700 text-zinc-400 hover:text-white font-bold rounded-lg text-[10px] uppercase tracking-widest transition-all">
                    View Milestones
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
