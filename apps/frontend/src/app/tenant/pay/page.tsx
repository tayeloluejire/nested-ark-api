'use client';
export const dynamic = 'force-dynamic';
/**
 * /tenant/pay/page.tsx
 * Real API: POST /api/tenant/pay-installment  { vault_id? }
 * Backend auto-resolves vault from JWT — vault_id optional.
 * Returns: { authorization_url, reference, access_code }
 * Redirects to Paystack checkout.
 * Also loads: GET /api/tenant/my-vault for context display.
 */
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { DollarSign, Loader2, AlertCircle, ArrowLeft, ExternalLink, ShieldCheck, CheckCircle2 } from 'lucide-react';

const safeN = (v:any) => { const n=Number(v); return(v==null||isNaN(n))?0:n; };
const safeF = (v:any) => safeN(v).toLocaleString();

function PayContent() {
  const [vault,   setVault]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying,  setPaying]  = useState(false);
  const [success, setSuccess] = useState('');
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.get('/api/tenant/my-vault')
      .then(r => setVault(r.data.vault))
      .catch(e => setError(e?.response?.data?.error ?? 'Could not load vault info.'))
      .finally(() => setLoading(false));
  }, []);

  // POST /api/tenant/pay-installment — vault_id is optional (backend resolves from JWT)
  const initPayment = async () => {
    setPaying(true); setError('');
    try {
      const res = await api.post('/api/tenant/pay-installment', {
        vault_id: vault?.id ?? undefined,
      });
      // Backend returns Paystack authorization_url
      const url = res.data.authorization_url || res.data.payment_url;
      if (url) {
        window.location.href = url;
      } else {
        setError('Payment link not returned. Please try again.');
        setPaying(false);
      }
    } catch(e:any) {
      setError(e?.response?.data?.error ?? 'Could not initiate payment. Please try again.');
      setPaying(false);
    }
  };

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
      <main className="flex-1 max-w-xl mx-auto px-6 py-10 space-y-8 w-full">

        <Link href="/tenant/dashboard" className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
          <ArrowLeft size={13} /> Dashboard
        </Link>

        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Pay Installment</h1>
          <p className="text-zinc-500 text-xs mt-1">Flex-Pay vault contribution via Paystack</p>
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
            {/* Vault context */}
            <div className="p-5 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-3">
              <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest">Your Vault</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono font-bold text-2xl text-teal-400">
                    {vault.currency || 'NGN'} {safeF(vault.vault_balance)}
                  </p>
                  <p className="text-[9px] text-zinc-500 mt-0.5">Current balance · {fundedPct}% of rent funded</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-lg text-white">{vault.currency||'NGN'} {safeF(vault.installment_amount)}</p>
                  <p className="text-[9px] text-zinc-500">{vault.frequency} installment</p>
                </div>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${fundedPct >= 80 ? 'bg-teal-500' : fundedPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${fundedPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>Target: {vault.currency||'NGN'} {safeF(vault.target_amount)}</span>
                {vault.next_due_date && <span>Next due: {vault.next_due_date}</span>}
              </div>
            </div>

            {/* Payment summary box */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Payment Summary</p>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-sm">Amount to pay</span>
                <span className="font-mono font-bold text-xl text-white">
                  {vault.currency||'NGN'} {safeF(vault.installment_amount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-600">
                <span>Frequency</span>
                <span className="font-bold">{vault.frequency}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-600">
                <span>After payment, vault will be</span>
                <span className="font-bold text-teal-400">
                  ~{Math.min(fundedPct + Math.round((safeN(vault.installment_amount) / (safeN(vault.target_amount)||1)) * 100), 100)}% funded
                </span>
              </div>
            </div>

            <button onClick={initPayment} disabled={paying}
              className="w-full py-4 bg-teal-500 text-black rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-teal-400 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {paying ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
              {paying ? 'Redirecting to Paystack…' : `Pay ${vault.currency||'NGN'} ${safeF(vault.installment_amount)}`}
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
    <Suspense fallback={<div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={28} /></div>}>
      <PayContent />
    </Suspense>
  );
}
