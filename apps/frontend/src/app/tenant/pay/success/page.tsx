'use client';
export const dynamic = 'force-dynamic';
/**
 * /tenant/pay/success/page.tsx
 * Paystack redirects here after successful vault installment payment.
 * Verifies the reference via backend, then shows confirmation + updated vault state.
 */
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { CheckCircle, Loader2, AlertCircle, ArrowRight, TrendingUp, Shield } from 'lucide-react';

const safeN = (v: any) => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any) => safeN(v).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type VerifyResult = {
  verified:       boolean;
  amount_ngn:     number;
  reference:      string;
  vault_balance:  number;
  target_amount:  number;
  funded_pct:     number;
  vault_status:   string;
  tenant_name:    string;
  period_label:   string;
  ledger_hash:    string;
};

function SuccessContent() {
  const params    = useSearchParams();
  const reference = params.get('reference') || params.get('trxref') || '';

  const [status,  setStatus]  = useState<'loading' | 'success' | 'error'>('loading');
  const [result,  setResult]  = useState<VerifyResult | null>(null);
  const [errMsg,  setErrMsg]  = useState('');

  useEffect(() => {
    if (!reference) {
      setErrMsg('No payment reference found.');
      setStatus('error');
      return;
    }

    // Give webhook 2s to process, then verify
    const timer = setTimeout(() => {
      api.get(`/api/tenant/verify-payment?reference=${encodeURIComponent(reference)}`)
        .then(r => {
          setResult(r.data);
          setStatus('success');
        })
        .catch(e => {
          setErrMsg(e?.response?.data?.error ?? 'Could not verify payment. Please check your vault.');
          setStatus('error');
        });
    }, 2000);

    return () => clearTimeout(timer);
  }, [reference]);

  const fundedPct = result
    ? Math.min(Math.round((safeN(result.vault_balance) / (safeN(result.target_amount) || 1)) * 100), 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto px-6 py-16 w-full space-y-8">

        {/* Loading */}
        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-teal-500" size={36} />
            <p className="text-zinc-400 font-bold text-sm uppercase tracking-widest">Confirming your payment…</p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl border border-red-500/20 bg-red-500/5 flex items-center gap-3 text-red-400">
              <AlertCircle size={20} />
              <div>
                <p className="font-black text-sm">Payment Verification Issue</p>
                <p className="text-xs text-red-400/70 mt-0.5">{errMsg}</p>
              </div>
            </div>
            <p className="text-zinc-500 text-sm">
              If you completed payment, your vault will update shortly. Check your vault balance or contact support with reference: <span className="font-mono text-white text-xs">{reference}</span>
            </p>
            <Link href="/tenant/vault" className="flex items-center gap-2 text-teal-400 text-sm font-bold hover:underline">
              Check My Vault <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {/* Success */}
        {status === 'success' && result && (
          <div className="space-y-6">

            {/* Hero confirmation */}
            <div className="text-center space-y-3 py-4">
              <div className="w-16 h-16 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mx-auto">
                <CheckCircle className="text-teal-400" size={32} />
              </div>
              <h1 className="text-3xl font-black uppercase tracking-tighter">Payment Confirmed</h1>
              <p className="text-zinc-500 text-sm">Your installment has been credited to your vault</p>
            </div>

            {/* Amount card */}
            <div className="p-6 rounded-3xl border border-teal-500/20 bg-teal-500/5 text-center">
              <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest mb-1">Amount Paid</p>
              <p className="text-5xl font-black font-mono text-teal-400">₦{safeF(result.amount_ngn)}</p>
              <p className="text-[9px] text-zinc-600 font-mono mt-2 break-all">ref: {result.reference}</p>
            </div>

            {/* Updated vault gauge */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Updated Vault Balance</p>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-black font-mono text-white">₦{safeF(result.vault_balance)}</p>
                <div className="text-right">
                  <p className="text-2xl font-black text-teal-400">{fundedPct}%</p>
                  <p className="text-[9px] text-zinc-600 uppercase font-bold">funded</p>
                </div>
              </div>
              <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${fundedPct >= 80 ? 'bg-teal-500' : fundedPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${fundedPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[9px] text-zinc-600 pt-1">
                <span>Target</span>
                <span className="font-mono font-bold text-zinc-400">₦{safeF(result.target_amount)}</span>
              </div>
              {result.vault_status === 'FUNDED_READY' && (
                <div className="p-3 rounded-xl border border-teal-500/30 bg-teal-500/10 text-center">
                  <p className="text-teal-400 font-black text-xs uppercase tracking-widest">🎉 Vault Fully Funded!</p>
                  <p className="text-zinc-500 text-[10px] mt-0.5">Your landlord has been notified. Disbursement will proceed automatically.</p>
                </div>
              )}
            </div>

            {/* Ledger receipt */}
            <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/10 space-y-2">
              <div className="flex items-center gap-2 text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
                <Shield size={10} className="text-teal-500" /> SHA-256 Ledger Receipt
              </div>
              <p className="font-mono text-[9px] text-zinc-600 break-all leading-relaxed">{result.ledger_hash}</p>
              <p className="text-[9px] text-zinc-600">Period: <span className="text-zinc-400 font-bold">{result.period_label}</span></p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Link href="/tenant/pay"
                className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800 hover:border-teal-500/30 hover:bg-teal-500/5 transition-all group">
                <span className="text-sm font-bold uppercase tracking-tight">Make Another Installment</span>
                <ArrowRight size={14} className="text-zinc-600 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
              </Link>
              <Link href="/tenant/vault"
                className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800 hover:border-zinc-600 transition-all group">
                <span className="text-sm font-bold uppercase tracking-tight text-zinc-400">View My Vault</span>
                <ArrowRight size={14} className="text-zinc-600 group-hover:translate-x-1 transition-all" />
              </Link>
              <Link href="/tenant/contributions"
                className="flex items-center justify-center gap-2 py-3 border border-zinc-800 rounded-xl text-zinc-600 text-[9px] font-bold uppercase tracking-widest hover:text-teal-400 hover:border-teal-500/30 transition-all">
                <TrendingUp size={10} /> View Contribution History
              </Link>
            </div>

          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function TenantPaySuccessPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
