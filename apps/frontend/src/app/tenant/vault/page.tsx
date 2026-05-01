'use client';
export const dynamic = 'force-dynamic';
/**
 * /tenant/vault/page.tsx
 * Real API: GET /api/tenant/my-vault
 * Returns: vault (vault_balance, target_amount, funded_pct, installment_amount,
 *          frequency, currency, next_due_date, cashout_mode, total_contributed)
 */
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { TrendingUp, DollarSign, Loader2, AlertCircle, ArrowLeft, ArrowRight, ShieldCheck, Calendar } from 'lucide-react';

const safeN = (v:any) => { const n=Number(v); return(v==null||isNaN(n))?0:n; };
const safeF = (v:any) => safeN(v).toLocaleString();

function VaultContent() {
  const [vault,   setVault]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.get('/api/tenant/my-vault')
      .then(r => setVault(r.data.vault))
      .catch(e => setError(e?.response?.data?.error ?? 'Could not load vault.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white"><Navbar />
      <div className="flex items-center justify-center py-40"><Loader2 className="animate-spin text-teal-500" size={28} /></div>
    <Footer /></div>
  );

  const fundedPct = vault
    ? Math.min(Math.round((safeN(vault.vault_balance) / (safeN(vault.target_amount) || 1)) * 100), 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-6 py-10 space-y-8 w-full">

        <Link href="/tenant/dashboard" className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
          <ArrowLeft size={13} /> Dashboard
        </Link>

        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">My Flex-Pay Vault</h1>
          <p className="text-zinc-500 text-xs mt-1">Your micro-contribution rent engine</p>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {!vault && !error ? (
          <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
            <TrendingUp className="text-zinc-700 mx-auto" size={36} />
            <p className="text-zinc-400 font-bold">No vault set up yet</p>
            <p className="text-zinc-600 text-sm">Your landlord will set up your Flex-Pay vault when you are onboarded.</p>
          </div>
        ) : vault && (
          <>
            {/* Vault gauge */}
            <div className="p-6 rounded-3xl border border-teal-500/20 bg-teal-500/5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest mb-1">Vault Balance</p>
                  <p className="text-4xl font-black font-mono text-teal-400">
                    {vault.currency || 'NGN'} {safeF(vault.vault_balance)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-white">{fundedPct}%</p>
                  <p className="text-[9px] text-zinc-500 uppercase font-bold">funded</p>
                </div>
              </div>
              <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${fundedPct >= 80 ? 'bg-teal-500' : fundedPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${fundedPct}%` }}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Target (Rent)',    value: `${vault.currency||'NGN'} ${safeF(vault.target_amount)}` },
                  { label: 'Installment',      value: `${vault.currency||'NGN'} ${safeF(vault.installment_amount)}` },
                  { label: 'Frequency',        value: vault.frequency || 'MONTHLY' },
                  { label: 'Next Due',         value: vault.next_due_date || '—' },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800 text-center">
                    <p className="text-xs font-bold text-white">{s.value}</p>
                    <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              {vault.total_contributed && (
                <div className="flex items-center justify-between text-[9px] text-zinc-500 pt-2 border-t border-teal-500/20">
                  <span>Total contributed all-time</span>
                  <span className="font-mono font-bold text-white">{vault.currency||'NGN'} {safeF(vault.total_contributed)}</span>
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/10 space-y-3">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">How Flex-Pay Works</p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { step:'01', title:'Make Installment', body:'Pay a small installment via Paystack — weekly, monthly, or quarterly.' },
                  { step:'02', title:'Vault Fills Up',   body:'By rent day, your vault has the full amount ready automatically.' },
                  { step:'03', title:'Auto-Disbursed',   body:'Landlord receives full rent. You get a SHA-256 ledger receipt.' },
                ].map(s => (
                  <div key={s.step} className="space-y-1">
                    <p className="text-teal-500 font-mono font-black text-[9px] uppercase tracking-widest">{s.step}</p>
                    <p className="text-white text-xs font-bold">{s.title}</p>
                    <p className="text-zinc-500 text-[10px] leading-relaxed">{s.body}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Pay installment CTA */}
            <Link href="/tenant/pay"
              className="flex items-center justify-between p-5 rounded-2xl border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 transition-all group">
              <div className="flex items-center gap-3">
                <DollarSign size={20} className="text-teal-400" />
                <div>
                  <p className="font-black text-sm uppercase tracking-tight">Pay Next Installment</p>
                  <p className="text-[10px] text-zinc-500">{vault.currency||'NGN'} {safeF(vault.installment_amount)} · {vault.frequency}</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-teal-500 group-hover:translate-x-1 transition-transform" />
            </Link>
          </>
        )}

        <Link href="/tenant/contributions"
          className="flex items-center justify-center gap-2 py-3 border border-zinc-800 rounded-xl text-zinc-500 text-[9px] font-bold uppercase tracking-widest hover:text-teal-400 hover:border-teal-500/30 transition-all">
          View All Contributions <ArrowRight size={10} />
        </Link>

      </main>
      <Footer />
    </div>
  );
}

export default function TenantVaultPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={28} /></div>}>
      <VaultContent />
    </Suspense>
  );
}
