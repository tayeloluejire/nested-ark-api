'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import {
  DollarSign, Calendar, TrendingUp, Loader2, AlertCircle,
  CheckCircle2, Clock, Zap, ArrowRight
} from 'lucide-react';

// ── Defensive numeric helpers — never crash on undefined/null/NaN ──────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();
const safeD = (v: any, d = 2): string => safeN(v).toFixed(d);


interface Vault {
  id: string; vault_balance: number; target_amount: number; frequency: string;
  installment_amount: number; next_due_date: string; cashout_mode: string;
  status: string; funded_periods: number; funded_pct: number;
  total_contributed: number; contribution_count: number;
  tenant_name: string; unit_name: string; rent_amount: number;
}

const FREQ_LABELS: Record<string, { label: string; desc: string; color: string }> = {
  WEEKLY:    { label: 'Weekly',    desc: 'Pay every week — easiest to manage with daily/weekly income', color: 'border-teal-500 bg-teal-500/5' },
  MONTHLY:   { label: 'Monthly',  desc: 'Pay once a month — ideal for salaried workers',               color: 'border-blue-500 bg-blue-500/5' },
  QUARTERLY: { label: 'Quarterly', desc: 'Pay every 3 months — good for business owners',              color: 'border-amber-500 bg-amber-500/5' },
};

export default function TenantFlexPayPage() {
  const { tenancyId } = useParams<{ tenancyId: string }>();
  const { user }      = useAuth();

  const [vault,      setVault]      = useState<Vault | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [setupMode,  setSetupMode]  = useState(false);
  const [frequency,  setFrequency]  = useState('MONTHLY');
  const [cashoutMode,setCashoutMode]= useState('LUMP_SUM');
  const [settingUp,  setSettingUp]  = useState(false);
  const [contributing, setContributing] = useState(false);
  const [setupResult, setSetupResult]   = useState('');
  const [payAmount,  setPayAmount]  = useState('');

  const load = async () => {
    if (!tenancyId) return;
    setLoading(true); setError('');
    try {
      const res = await api.get(`/api/flex-pay/vault/${tenancyId}`);
      setVault(res.data.vault);
    } catch (ex: any) {
      if (ex?.response?.status === 404) {
        setSetupMode(true);
      } else {
        setError(ex?.response?.data?.error ?? 'Could not load vault.');
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tenancyId]);

  const setupVault = async () => {
    setSettingUp(true); setSetupResult('');
    try {
      await api.post('/api/flex-pay/setup', { tenancy_id: tenancyId, frequency, cashout_mode: cashoutMode });
      setSetupMode(false);
      load();
    } catch (ex: any) {
      setSetupResult(ex?.response?.data?.error ?? 'Setup failed');
    } finally { setSettingUp(false); }
  };

  const contribute = async () => {
    if (!vault || !payAmount) return;
    setContributing(true);
    try {
      // In production: initiate Paystack payment first, then call this on callback
      const res = await api.post('/api/flex-pay/contribute', {
        vault_id:   vault.id,
        amount_ngn: parseFloat(payAmount),
      });
      alert(res.data.message);
      load();
    } catch (ex: any) {
      alert(ex?.response?.data?.error ?? 'Payment failed');
    } finally { setContributing(false); setPayAmount(''); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white"><Navbar />
      <div className="flex items-center justify-center py-40">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div><Footer /></div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">

        {/* Header */}
        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Flex-Pay Vault</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Pay Your Way</h1>
          <p className="text-zinc-500 text-xs mt-1">Set up weekly, monthly or quarterly payments. Pay on your schedule.</p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Setup mode */}
        {setupMode && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/10">
              <p className="text-sm font-bold mb-1">How it works</p>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Instead of paying a full year upfront, the Ark Vault lets you pay in smaller installments
                (weekly, monthly or quarterly). The vault accumulates your payments and releases them
                to your landlord when fully funded. You're always protected by the Ark ledger.
              </p>
            </div>

            <div>
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-3">Payment Frequency</p>
              <div className="space-y-3">
                {Object.entries(FREQ_LABELS).map(([key, f]) => (
                  <button key={key} type="button" onClick={() => setFrequency(key)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all ${
                      frequency === key ? f.color : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700'
                    }`}>
                    <div className="flex items-center justify-between">
                      <p className="font-black text-xs uppercase tracking-widest">{f.label}</p>
                      {frequency === key && <CheckCircle2 size={14} className="text-teal-400" />}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">{f.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-3">Landlord Cashout Mode</p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setCashoutMode('LUMP_SUM')}
                  className={`p-4 rounded-2xl border text-left transition-all ${cashoutMode === 'LUMP_SUM' ? 'border-teal-500 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/20'}`}>
                  <p className="font-black text-xs uppercase">Lump Sum</p>
                  <p className="text-[9px] text-zinc-500 mt-1">Landlord gets full amount once vault is funded</p>
                </button>
                <button type="button" onClick={() => setCashoutMode('DRAWDOWN')}
                  className={`p-4 rounded-2xl border text-left transition-all ${cashoutMode === 'DRAWDOWN' ? 'border-teal-500 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/20'}`}>
                  <p className="font-black text-xs uppercase">Drawdown</p>
                  <p className="text-[9px] text-zinc-500 mt-1">Landlord receives monthly from the vault</p>
                </button>
              </div>
            </div>

            {setupResult && (
              <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-bold">
                {setupResult}
              </div>
            )}

            <button onClick={setupVault} disabled={settingUp}
              className="w-full py-4 bg-teal-500 text-black font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-white transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {settingUp ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
              Activate My Flex-Pay Vault
            </button>
          </div>
        )}

        {/* Active vault */}
        {vault && !setupMode && (
          <div className="space-y-6">
            {/* Vault card */}
            <div className="p-6 rounded-2xl border border-teal-500/30 bg-teal-500/5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] text-teal-500 uppercase font-bold tracking-widest">Your Vault</p>
                  <p className="font-black text-xl mt-1">{vault.unit_name}</p>
                </div>
                <span className={`text-[8px] px-2 py-1 rounded font-bold uppercase ${
                  vault.status === 'FUNDED_READY' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' :
                  vault.status === 'ACTIVE' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                  'bg-zinc-800 text-zinc-500 border border-zinc-700'
                }`}>{vault.status}</span>
              </div>

              {/* Progress ring replacement — bar */}
              <div>
                <div className="flex justify-between text-[9px] text-zinc-500 mb-2">
                  <span>Vault progress</span>
                  <span className="text-teal-400 font-bold">{vault.funded_pct}%</span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all"
                    style={{ width: `${vault.funded_pct}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-900/50 rounded-xl">
                  <p className="text-[8px] text-zinc-600 uppercase font-bold mb-1">Current Balance</p>
                  <p className="font-mono font-bold text-lg text-teal-400">₦{safeF(vault.vault_balance)}</p>
                </div>
                <div className="p-3 bg-zinc-900/50 rounded-xl">
                  <p className="text-[8px] text-zinc-600 uppercase font-bold mb-1">Target</p>
                  <p className="font-mono font-bold text-lg">₦{safeF(vault.target_amount)}</p>
                </div>
                <div className="p-3 bg-zinc-900/50 rounded-xl">
                  <p className="text-[8px] text-zinc-600 uppercase font-bold mb-1">Frequency</p>
                  <p className="font-bold text-sm capitalize">{vault.frequency}</p>
                </div>
                <div className="p-3 bg-zinc-900/50 rounded-xl">
                  <p className="text-[8px] text-zinc-600 uppercase font-bold mb-1">Installment</p>
                  <p className="font-mono font-bold text-sm text-amber-400">₦{safeF(vault.installment_amount)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[9px] text-zinc-500">
                <Calendar size={9} />
                Next due: <span className="text-white font-bold">{vault.next_due_date ? new Date(vault.next_due_date).toLocaleDateString() : '—'}</span>
                <span className="ml-auto">{vault.contribution_count} contributions · {vault.funded_periods} periods funded</span>
              </div>
            </div>

            {/* Pay now */}
            {vault.status === 'ACTIVE' && (
              <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
                <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Make a Contribution</p>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-mono">₦</span>
                    <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                      placeholder={vault.installment_amount.toString()}
                      className="w-full bg-black border border-zinc-700 rounded-xl pl-8 pr-4 py-3 text-sm text-white font-mono focus:border-teal-500 outline-none" />
                  </div>
                  <button onClick={contribute} disabled={contributing || !payAmount}
                    className="px-6 py-3 bg-teal-500 text-black font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-white transition-all disabled:opacity-60 flex items-center gap-2">
                    {contributing ? <Loader2 className="animate-spin" size={12} /> : <DollarSign size={12} />}
                    Pay
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[vault.installment_amount, vault.installment_amount * 2, Math.ceil(vault.target_amount / 4)].map(amt => (
                    <button key={amt} onClick={() => setPayAmount(amt.toString())}
                      className="px-3 py-1.5 border border-zinc-700 text-zinc-400 hover:text-teal-400 font-mono text-[9px] rounded-lg transition-all">
                      ₦{safeF(amt)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {vault.status === 'FUNDED_READY' && (
              <div className="p-5 rounded-2xl border border-teal-500/30 bg-teal-500/10 text-center space-y-3">
                <CheckCircle2 className="text-teal-400 mx-auto" size={28} />
                <p className="font-black text-sm uppercase">Vault Fully Funded!</p>
                <p className="text-[10px] text-zinc-500">Your landlord has been notified. Cashout is awaiting their confirmation.</p>
              </div>
            )}
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}
