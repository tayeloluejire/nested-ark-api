'use client';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import { Loader2, TrendingUp, RefreshCw, Save, AlertCircle, CheckCircle2, Settings } from 'lucide-react';

interface ConfigRow {
  key:        string;
  value:      string;
  label:      string;
  updated_at: string;
}

const KEY_META: Record<string, { unit: string; hint: string; min: number; max: number; step: number }> = {
  global_roi_rate:        { unit: '% p.a.', hint: 'Annual yield paid to investors. Raises this increases investor returns. Reducing conserves platform capital.', min: 1, max: 30, step: 0.5 },
  platform_escrow_fee:    { unit: '%',      hint: '% deducted from each escrow release. Goes to your Paystack balance.', min: 0, max: 10, step: 0.1 },
  platform_listing_fee:   { unit: 'USD',    hint: 'Flat fee per NAP Project ID generated. Charged at project creation.', min: 0, max: 500, step: 1 },
  platform_investment_fee:{ unit: '%',      hint: 'Placement fee on each investor commitment. Deducted at payment time.', min: 0, max: 5, step: 0.1 },
  platform_supply_fee:    { unit: '%',      hint: 'Commission on supplier dispatches. Credited on material delivery confirmation.', min: 0, max: 10, step: 0.5 },
};

export default function AdminMarketConfigPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [config,  setConfig]  = useState<ConfigRow[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving,  setSaving]  = useState<Record<string, boolean>>({});
  const [saved,   setSaved]   = useState<Record<string, boolean>>({});
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login');
  }, [user, authLoading, router]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/market/config');
      setConfig(res.data.config ?? []);
      const vals: Record<string, string> = {};
      (res.data.config ?? []).forEach((r: ConfigRow) => { vals[r.key] = r.value; });
      setEditing(vals);
    } catch (e: any) {
      setError('Failed to load market config');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (user?.role === 'ADMIN') load(); }, [user]);

  const save = async (key: string) => {
    setSaving(s => ({ ...s, [key]: true }));
    setSaved(s => ({ ...s, [key]: false }));
    setError('');
    try {
      await api.put('/api/admin/market/config', { key, value: parseFloat(editing[key]) });
      setSaved(s => ({ ...s, [key]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 3000);
      load(); // refresh
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Save failed');
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  };

  if (authLoading || !user) return (
    <div className="h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-10">
      <header className="border-l-2 border-emerald-500 pl-6 mb-10 flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-[0.2em] mb-1">Admin · Market Settings</p>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic">Market Configuration</h1>
          <p className="text-zinc-500 text-sm mt-1">Live ROI rates, platform fees and revenue levers</p>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 border border-zinc-800 rounded-xl text-zinc-500 hover:text-emerald-500 hover:border-emerald-500/40 transition-all">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Current ROI banner */}
      <div className="mb-8 p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-4">
        <TrendingUp className="text-emerald-400 flex-shrink-0" size={28} />
        <div>
          <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-widest">Live Investor ROI Rate</p>
          <p className="text-4xl font-black font-mono text-emerald-400">
            {editing['global_roi_rate'] ?? '12.00'}% <span className="text-lg text-zinc-500">per annum</span>
          </p>
          <p className="text-zinc-600 text-xs mt-1">
            Every investor currently sees and earns this yield. Changing it takes effect immediately for all new accruals.
          </p>
        </div>
      </div>

      {loading && config.length === 0 ? (
        <div className="py-16 text-center">
          <Loader2 className="animate-spin text-teal-500 mx-auto" size={28} />
        </div>
      ) : (
        <div className="space-y-4">
          {config.map(row => {
            const meta = KEY_META[row.key];
            const isDirty = editing[row.key] !== row.value;
            return (
              <div key={row.key}
                className={`p-6 rounded-2xl border transition-all ${isDirty ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/20'}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black uppercase tracking-tight">{row.label}</p>
                    <p className="text-[9px] font-mono text-zinc-600 mt-0.5">{row.key}</p>
                    {meta && <p className="text-[9px] text-zinc-500 mt-2 leading-relaxed max-w-lg">{meta.hint}</p>}
                    <p className="text-[8px] text-zinc-700 mt-2 font-mono">
                      Last updated: {new Date(row.updated_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="relative">
                      <input
                        type="number"
                        min={meta?.min ?? 0}
                        max={meta?.max ?? 100}
                        step={meta?.step ?? 0.1}
                        value={editing[row.key] ?? row.value}
                        onChange={e => setEditing(v => ({ ...v, [row.key]: e.target.value }))}
                        className="w-28 bg-black border border-zinc-700 rounded-xl px-3 py-2.5 text-white font-mono text-sm outline-none focus:border-emerald-500 transition-colors pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-[10px] font-bold pointer-events-none">
                        {meta?.unit ?? ''}
                      </span>
                    </div>

                    <button
                      onClick={() => save(row.key)}
                      disabled={saving[row.key] || !isDirty}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                        saved[row.key]
                          ? 'bg-teal-500/20 text-teal-500 border border-teal-500/30'
                          : isDirty
                          ? 'bg-emerald-500 text-black hover:bg-white'
                          : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                      }`}
                    >
                      {saving[row.key] ? (
                        <Loader2 className="animate-spin" size={12} />
                      ) : saved[row.key] ? (
                        <><CheckCircle2 size={12} /> Saved</>
                      ) : (
                        <><Save size={12} /> Save</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Visual slider */}
                {meta && (
                  <div className="mt-4">
                    <input
                      type="range"
                      min={meta.min} max={meta.max} step={meta.step}
                      value={editing[row.key] ?? row.value}
                      onChange={e => setEditing(v => ({ ...v, [row.key]: e.target.value }))}
                      className="w-full accent-emerald-500 h-1"
                    />
                    <div className="flex justify-between text-[8px] text-zinc-700 mt-1">
                      <span>{meta.min}{meta.unit}</span>
                      <span>{meta.max}{meta.unit}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Paystack settlement note */}
      <div className="mt-10 p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20">
        <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-2 flex items-center gap-2">
          <Settings size={10} className="text-teal-500" /> Paystack Settlement — Impressions &amp; Impacts Ltd
        </p>
        <p className="text-zinc-400 text-xs leading-relaxed">
          All platform fees (escrow %, listing flat fee, investment placement %) are automatically split by Paystack and
          credited to your <strong className="text-white">main Paystack balance</strong> (Account ID: 1656019).
          Investor principal is held in the <strong className="text-white">Ark Escrow subaccount</strong> until
          tri-layer milestone release. Monitor live revenue in the{' '}
          <a href="/admin/revenue" className="text-teal-500 hover:text-white underline">Revenue Engine →</a>
        </p>
      </div>
    </div>
  );
}
