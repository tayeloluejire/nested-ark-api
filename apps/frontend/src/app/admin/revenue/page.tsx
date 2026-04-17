'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import { Loader2, TrendingUp, RefreshCw, Save, AlertCircle, CheckCircle2, Globe, DollarSign } from 'lucide-react';

// ── Safe number helper ────────────────────────────────────────────────────────
const safeNum = (v: unknown): number => { const n = Number(v); return isFinite(n) ? n : 0; };

const KEY_META: Record<string, {
  unit: string; hint: string; min: number; max: number; step: number;
  incomeBase?: number; incomeLabel?: string;
}> = {
  global_roi_rate:         { unit: '% p.a.', min: 1,  max: 30,  step: 0.5, hint: 'Annual yield paid to investors globally. Raising this increases investor returns; reducing it conserves platform capital.' },
  platform_escrow_fee:     { unit: '%',      min: 0,  max: 10,  step: 0.1, incomeBase: 18400000, incomeLabel: 'AUM × rate × 15% released/mo', hint: '% deducted from each escrow release. Credited directly to your Paystack balance.' },
  platform_listing_fee:    { unit: 'USD',    min: 0,  max: 500, step: 5,   incomeBase: 163,      incomeLabel: 'Active projects × flat fee',   hint: 'Flat fee per NAP Project ID generated. Charged at project creation.' },
  platform_investment_fee: { unit: '%',      min: 0,  max: 5,   step: 0.1, incomeBase: 18400000, incomeLabel: 'AUM × rate × 8% new/mo',       hint: 'Placement fee on each investor commitment. Deducted at payment time.' },
  platform_supply_fee:     { unit: '%',      min: 0,  max: 10,  step: 0.5, incomeBase: 18400000, incomeLabel: 'AUM × rate × 5% supply/mo',    hint: 'Commission on supplier/contractor dispatches.' },
};

const CURRENCY_BREAKDOWN = [
  { flag: '🇳🇬', label: 'NGN · Nigeria',        value: '₦18.4M',   color: 'text-teal-400' },
  { flag: '🇦🇪', label: 'AED · UAE',             value: 'AED 84k',  color: 'text-amber-400' },
  { flag: '🇬🇧', label: 'GBP · United Kingdom',  value: '£12,400',  color: 'text-blue-400' },
  { flag: '🇰🇪', label: 'KES · Kenya',            value: 'KES 4.2M', color: 'text-green-400' },
  { flag: '🇸🇬', label: 'SGD · Singapore',        value: 'SGD 34k',  color: 'text-purple-400' },
  { flag: '🇿🇦', label: 'ZAR · South Africa',     value: 'ZAR 210k', color: 'text-zinc-400' },
];

interface ConfigRow { key: string; value: string; label: string; updated_at: string; }

export default function AdminRevenueEnginePage() {
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
      const rows: ConfigRow[] = res.data?.config ?? [];
      setConfig(rows);
      const vals: Record<string, string> = {};
      rows.forEach(r => { if (r.key) vals[r.key] = r.value ?? '0'; });
      setEditing(vals);
    } catch { setError('Failed to load market config.'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { if (user?.role === 'ADMIN') load(); }, [user]); // eslint-disable-line

  const save = async (key: string) => {
    setSaving(s => ({ ...s, [key]: true }));
    setSaved(s =>  ({ ...s, [key]: false }));
    setError('');
    try {
      await api.put('/api/admin/market/config', { key, value: parseFloat(editing[key] ?? '0') });
      setSaved(s => ({ ...s, [key]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 3000);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Save failed.');
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  };

  const estimateIncome = (key: string, val: string): string => {
    const meta = KEY_META[key];
    if (!meta?.incomeBase) return '';
    const v = safeNum(val);
    if (meta.unit === 'USD') return `≈ $${Math.round(v * meta.incomeBase).toLocaleString()}`;
    const rate   = v / 100;
    const factor = key === 'platform_investment_fee' ? 0.08 : key === 'platform_supply_fee' ? 0.05 : 0.15;
    return `≈ $${Math.round(meta.incomeBase * rate * factor).toLocaleString()}/mo`;
  };

  const totalRevenue = Object.entries(editing).reduce((sum, [key, val]) => {
    const meta = KEY_META[key];
    if (!meta?.incomeBase) return sum;
    const v = safeNum(val);
    if (meta.unit === 'USD') return sum + v * meta.incomeBase;
    const rate   = v / 100;
    const factor = key === 'platform_investment_fee' ? 0.08 : key === 'platform_supply_fee' ? 0.05 : 0.15;
    return sum + meta.incomeBase * rate * factor;
  }, 0);

  if (authLoading || !user) return (
    <div className="h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={28} />
    </div>
  );

  const liveRoi = editing['global_roi_rate'] ?? '12.00';

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-10 max-w-5xl mx-auto space-y-8">

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="border-l-2 border-emerald-500 pl-5">
          <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-[0.2em] mb-1">Admin · Market Settings</p>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic">Revenue Engine</h1>
          <p className="text-zinc-500 text-sm mt-1">Live ROI rates, platform fees and global revenue levers</p>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 border border-zinc-800 rounded-xl text-zinc-500 hover:text-emerald-500 hover:border-emerald-500/40 transition-all">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* ROI Banner */}
      <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-5">
        <TrendingUp className="text-emerald-400 flex-shrink-0" size={32} />
        <div>
          <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-widest">Live Global Investor ROI Rate</p>
          <p className="text-4xl font-black font-mono text-emerald-400">
            {liveRoi}%<span className="text-lg text-zinc-500 ml-2">per annum</span>
          </p>
          <p className="text-zinc-600 text-xs mt-1">Every investor globally earns this yield. Changes take effect immediately on all new accruals.</p>
        </div>
      </div>

      {/* Revenue Estimate */}
      <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex items-center gap-5">
        <DollarSign className="text-amber-400 flex-shrink-0" size={24} />
        <div>
          <p className="text-[9px] text-amber-500 uppercase font-bold tracking-widest">Estimated Monthly Platform Revenue</p>
          <p className="text-3xl font-black font-mono text-amber-400">${Math.round(totalRevenue).toLocaleString()}</p>
          <p className="text-zinc-600 text-xs mt-1">Based on current fee config × $18.4M AUM</p>
        </div>
      </div>

      {/* Fee sliders */}
      {loading && config.length === 0 ? (
        <div className="py-16 text-center"><Loader2 className="animate-spin text-teal-500 mx-auto" size={24} /></div>
      ) : (
        <div className="space-y-4">
          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Platform Fee Levers</p>
          {config.map(row => {
            const meta    = KEY_META[row.key];
            const curVal  = editing[row.key] ?? row.value ?? '0';
            const isDirty = curVal !== row.value;
            const income  = estimateIncome(row.key, curVal);
            return (
              <div key={row.key}
                className={`p-6 rounded-2xl border transition-all ${isDirty ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/20'}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black uppercase tracking-tight">{row.label}</p>
                    <p className="text-[9px] font-mono text-zinc-600 mt-0.5">{row.key}</p>
                    {meta && <p className="text-[9px] text-zinc-500 mt-2 leading-relaxed max-w-lg">{meta.hint}</p>}
                    {income && <p className="text-[9px] text-emerald-500 font-bold mt-2 font-mono">{income}</p>}
                    {meta?.incomeLabel && <p className="text-[8px] text-zinc-600 font-mono mt-0.5">{meta.incomeLabel}</p>}
                    <p className="text-[8px] text-zinc-700 mt-1 font-mono">
                      Last updated: {row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="relative">
                      <input type="number"
                        min={meta?.min ?? 0} max={meta?.max ?? 100} step={meta?.step ?? 0.1}
                        value={curVal}
                        onChange={e => setEditing(v => ({ ...v, [row.key]: e.target.value }))}
                        className="w-28 bg-black border border-zinc-700 rounded-xl px-3 py-2.5 text-white font-mono text-sm outline-none focus:border-emerald-500 transition-colors pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-[10px] font-bold pointer-events-none">
                        {meta?.unit ?? ''}
                      </span>
                    </div>
                    <button onClick={() => save(row.key)} disabled={saving[row.key] || !isDirty}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                        saved[row.key]  ? 'bg-teal-500/20 text-teal-500 border border-teal-500/30' :
                        isDirty         ? 'bg-emerald-500 text-black hover:bg-white' :
                                          'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                      }`}>
                      {saving[row.key] ? <Loader2 className="animate-spin" size={12} /> :
                       saved[row.key]  ? <><CheckCircle2 size={12} /> Saved</> :
                       <><Save size={12} /> Save</>}
                    </button>
                  </div>
                </div>
                {meta && (
                  <div className="mt-4">
                    <input type="range" min={meta.min} max={meta.max} step={meta.step}
                      value={curVal}
                      onChange={e => setEditing(v => ({ ...v, [row.key]: e.target.value }))}
                      className="w-full accent-emerald-500 h-1" />
                    <div className="flex justify-between text-[8px] text-zinc-700 mt-1">
                      <span>{meta.min}{meta.unit}</span><span>{meta.max}{meta.unit}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Currency Breakdown */}
      <div className="space-y-3">
        <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest flex items-center gap-2">
          <Globe size={10} /> Global Revenue Map · Currency Breakdown
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {CURRENCY_BREAKDOWN.map(c => (
            <div key={c.label} className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex items-center gap-3">
              <span className="text-xl">{c.flag}</span>
              <div>
                <p className="text-[9px] text-zinc-500 font-mono">{c.label}</p>
                <p className={`font-mono font-bold text-sm ${c.color}`}>{c.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20">
        <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-3">
          Paystack Settlement — Impressions &amp; Impacts Ltd
        </p>
        <p className="text-zinc-400 text-xs leading-relaxed">
          All platform fees are automatically split by Paystack and credited to your{' '}
          <strong className="text-white">main Paystack balance</strong> (Account ID: 1656019).
          Investor principal is held in the <strong className="text-white">Ark Escrow subaccount</strong> until
          tri-layer milestone release. SHA-256 hash written on every transaction.
        </p>
      </div>
    </div>
  );
}
