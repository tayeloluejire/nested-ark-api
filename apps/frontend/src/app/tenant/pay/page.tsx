'use client';
export const dynamic = 'force-dynamic';
/**
 * src/app/tenant/pay/page.tsx
 *
 * Tenant Flex-Pay installment page.
 * - Shows vault context (balance, target, frequency)
 * - Allows tenant to enter a CUSTOM payment amount
 * - Minimum: NGN 100. Suggested: installment_amount
 * - POSTs { vault_id, amount } to /api/tenant/pay-installment
 * - Backend initializes Paystack and returns authorization_url
 * - Redirects to Paystack checkout
 * - On success: Paystack redirects to /tenant/pay/success
 */
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  DollarSign, Loader2, AlertCircle, ArrowLeft,
  ExternalLink, ShieldCheck, CheckCircle2, Building2,
} from 'lucide-react';

const safeN = (v: any) => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any) => safeN(v).toLocaleString();

const QUICK_AMOUNTS = [
  { label: '₦5,000',    value: 5000 },
  { label: '₦10,000',   value: 10000 },
  { label: '₦50,000',   value: 50000 },
  { label: '₦100,000',  value: 100000 },
  { label: '₦500,000',  value: 500000 },
  { label: '₦1,000,000', value: 1000000 },
];

function PayContent() {
  const [vault,   setVault]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying,  setPaying]  = useState(false);
  const [error,   setError]   = useState('');
  const [amount,  setAmount]  = useState<number>(0);

  useEffect(() => {
    api.get('/api/tenant/my-vault')
      .then(r => {
        const v = r.data.vault;
        setVault(v);
        // Default amount = installment OR 0 if installment is unreasonably large
        const suggested = safeN(v?.installment_amount);
        setAmount(suggested > 0 && suggested <= 5000000 ? suggested : 0);
      })
      .catch(e => setError(e?.response?.data?.error ?? 'Could not load vault info.'))
      .finally(() => setLoading(false));
  }, []);

  const initPayment = async () => {
    if (!amount || amount < 100) {
      setError('Please enter a payment amount (minimum NGN 100).'); return;
    }
    setPaying(true); setError('');
    try {
      const res = await api.post('/api/tenant/pay-installment', {
        vault_id: vault?.id ?? undefined,
        amount,                               // ← custom amount tenant entered
      });
      const url = res.data.authorization_url || res.data.payment_url;
      if (url) {
        window.location.href = url;
      } else {
        setError('Payment link not returned. Please try again.');
        setPaying(false);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Could not initiate payment. Please try again.');
      setPaying(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="flex items-center justify-center py-40">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
      <Footer />
    </div>
  );

  const fundedPct = vault
    ? Math.min(Math.round((safeN(vault.vault_balance) / (safeN(vault.target_amount) || 1)) * 100), 100)
    : 0;

  const afterPaymentPct = vault
    ? Math.min(Math.round(((safeN(vault.vault_balance) + amount) / (safeN(vault.target_amount) || 1)) * 100), 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-xl mx-auto px-6 py-10 space-y-8 w-full">

        <Link href="/tenant/dashboard"
          className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
          <ArrowLeft size={13} /> Dashboard
        </Link>

        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Pay Installment</h1>
          <p className="text-zinc-500 text-xs mt-1">Contribute to your Flex-Pay vault via Paystack</p>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {!vault && !error ? (
          <div className="py-12 text-center border border-dashed border-zinc-800 rounded-2xl space-y-3">
            <DollarSign className="text-zinc-700 mx-auto" size={36} />
            <p className="text-zinc-400 font-bold">No active vault found</p>
            <p className="text-zinc-600 text-sm">Contact your landlord to set up your Flex-Pay vault.</p>
          </div>
        ) : vault && (
          <>
            {/* Vault summary */}
            <div className="p-5 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-3">
              <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest">Your Vault</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono font-bold text-2xl text-teal-400">
                    {vault.currency || 'NGN'} {safeF(vault.vault_balance)}
                  </p>
                  <p className="text-[9px] text-zinc-500 mt-0.5">Balance · {fundedPct}% funded</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-400">Target</p>
                  <p className="font-mono font-bold text-white">{vault.currency || 'NGN'} {safeF(vault.target_amount)}</p>
                </div>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${fundedPct >= 80 ? 'bg-teal-500' : fundedPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${fundedPct}%` }} />
              </div>
              {vault.bank_name && (
                <div className="flex items-center gap-2 pt-2 border-t border-teal-500/20">
                  <Building2 size={11} className="text-teal-500 flex-shrink-0" />
                  <p className="text-[9px] text-zinc-500">
                    Landlord account: <span className="text-zinc-300 font-bold">{vault.bank_name}</span>
                    {vault.account_number && <> · {vault.account_number}</>}
                    {vault.account_name && <> ({vault.account_name})</>}
                  </p>
                </div>
              )}
            </div>

            {/* ── Custom amount input ───────────────────────────────────────── */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
              <div>
                <p className="text-[9px] text-zinc-400 uppercase font-black tracking-widest mb-1">Payment Amount (NGN)</p>
                <p className="text-[10px] text-zinc-600 mb-3">
                  Pay any amount — your vault accumulates contributions until it reaches the target.
                  Suggested installment: <span className="text-teal-400 font-bold">{vault.currency || 'NGN'} {safeF(vault.installment_amount)}</span>
                </p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm">₦</span>
                  <input
                    type="number"
                    value={amount || ''}
                    onChange={e => setAmount(Number(e.target.value))}
                    placeholder="Enter amount e.g. 50000"
                    min={100}
                    className="w-full bg-zinc-900 border border-zinc-700 pl-9 pr-4 py-3.5 rounded-xl text-sm font-mono text-white outline-none focus:border-teal-500 transition-colors"
                  />
                </div>
              </div>

              {/* Quick-pick amounts */}
              <div>
                <p className="text-[9px] text-zinc-600 uppercase font-bold mb-2">Quick select</p>
                <div className="flex gap-2 flex-wrap">
                  {QUICK_AMOUNTS.map(q => (
                    <button key={q.value} onClick={() => setAmount(q.value)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                        amount === q.value
                          ? 'bg-teal-500 text-black'
                          : 'border border-zinc-700 text-zinc-400 hover:text-teal-400 hover:border-teal-500/30'
                      }`}>
                      {q.label}
                    </button>
                  ))}
                  {/* Also show suggested installment if it's not in the quick-picks */}
                  {safeN(vault.installment_amount) > 0 &&
                   !QUICK_AMOUNTS.some(q => q.value === safeN(vault.installment_amount)) && (
                    <button onClick={() => setAmount(safeN(vault.installment_amount))}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                        amount === safeN(vault.installment_amount)
                          ? 'bg-teal-500 text-black border-teal-500'
                          : 'border-teal-500/30 text-teal-400 hover:bg-teal-500/10'
                      }`}>
                      {vault.currency || 'NGN'} {safeF(vault.installment_amount)} (suggested)
                    </button>
                  )}
                </div>
              </div>

              {/* Live preview */}
              {amount >= 100 && (
                <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">You pay</span>
                    <span className="font-mono font-bold text-white">{vault.currency || 'NGN'} {safeF(amount)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">Vault after payment</span>
                    <span className="font-mono font-bold text-teal-400">{vault.currency || 'NGN'} {safeF(safeN(vault.vault_balance) + amount)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">Funded %</span>
                    <span className="font-bold text-teal-400">{afterPaymentPct}%</span>
                  </div>
                  <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-teal-500 rounded-full transition-all"
                      style={{ width: `${afterPaymentPct}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Pay button */}
            <button onClick={initPayment} disabled={paying || !amount || amount < 100}
              className="w-full py-4 bg-teal-500 text-black rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-teal-400 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {paying
                ? <><Loader2 size={16} className="animate-spin" /> Redirecting to Paystack…</>
                : <><ExternalLink size={16} /> Pay {amount >= 100 ? `${vault.currency || 'NGN'} ${safeF(amount)}` : '…'}</>
              }
            </button>

            <p className="text-[9px] text-zinc-600 text-center leading-relaxed">
              You will be redirected to a secure Paystack checkout page.
              Your payment is automatically recorded on the immutable ledger.
            </p>

            <div className="flex flex-wrap gap-2 justify-center">
              {[
                <><ShieldCheck size={9} /> Secured by Paystack</>,
                <><CheckCircle2 size={9} /> SHA-256 Ledger Receipt</>,
                <><ShieldCheck size={9} /> Vault Auto-Updated</>,
              ].map((b, i) => (
                <span key={i} className="flex items-center gap-1 text-[8px] text-teal-500 border border-teal-500/20 px-3 py-1.5 rounded-lg font-bold uppercase">
                  {b}
                </span>
              ))}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function TenantPayPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
    }>
      <PayContent />
    </Suspense>
  );
}
