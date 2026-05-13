'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { CheckCircle2, Loader2, AlertCircle, ArrowRight, ShieldCheck, DollarSign } from 'lucide-react';

// Helper to match the formatting logic in the payment initiation page
const safeN = (v: any) => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any) => safeN(v).toLocaleString();

function PaySuccessContent() {
  const params = useSearchParams();
  const reference = params.get('reference') || params.get('ref') || params.get('trxref') || '';

  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!reference) { 
      setStatus('failed'); 
      setError('No payment reference found'); 
      return; 
    }
    
    // Verify the payment via the backend
    api.get(`/api/payments/verify/${reference}`)
      .then(res => {
        setDetails(res.data);
        // Backend success check: match 'success' or 'COMPLETED'
        const isSuccessful = res.data.status === 'success' || res.data.payment_status === 'COMPLETED';
        setStatus(isSuccessful ? 'success' : 'failed');
      })
      .catch(e => {
        setError(e?.response?.data?.error ?? 'Could not verify payment');
        setStatus('failed');
      });
  }, [reference]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-md mx-auto px-6 py-20 space-y-8 w-full">

        {status === 'loading' && (
          <div className="text-center space-y-4 py-20">
            <Loader2 className="animate-spin text-teal-500 mx-auto" size={36} />
            <p className="text-zinc-400 font-bold uppercase tracking-widest text-[10px]">Verifying your payment…</p>
            <p className="text-zinc-600 text-xs">Syncing with the immutable ledger</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center space-y-6">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-teal-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" style={{ animationDuration: '2s' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <CheckCircle2 size={36} className="text-teal-400" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-black text-2xl uppercase tracking-tighter">Payment Confirmed</p>
              <p className="text-zinc-500 text-xs">Your contribution has been credited to your Flex-Pay vault.</p>
            </div>

            {details && (
              <div className="p-6 rounded-2xl border border-teal-500/20 bg-teal-500/5 text-left space-y-4">
                <div className="flex justify-between items-center border-b border-teal-500/10 pb-3">
                  <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest">Transaction Receipt</p>
                  <ShieldCheck size={14} className="text-teal-500" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Reference</span>
                    <span className="font-mono font-bold text-[11px] text-zinc-300 uppercase">{reference}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 text-sm">Amount Paid</span>
                    <span className="font-mono font-black text-xl text-teal-400">
                      {details.currency || 'NGN'} {safeF(details.amount / 100)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Status</span>
                    <span className="font-bold text-teal-500 text-[10px] uppercase tracking-widest">Verified & Secured</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-teal-500/10">
                  <p className="text-[8px] text-teal-500/60 font-bold uppercase tracking-tighter leading-tight">
                    Proof of payment generated. SHA-256 hashed and recorded on the Nested Ark ledger.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Link href="/tenant/dashboard"
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-teal-500 text-black font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-teal-400 transition-all">
                Return to Dashboard <ArrowRight size={14} />
              </Link>
              <p className="text-[9px] text-zinc-700 text-center uppercase font-bold tracking-widest">
                Vault balances are updated in real-time
              </p>
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={40} className="text-red-500" />
            </div>
            <div className="space-y-2">
              <p className="font-black text-xl uppercase tracking-tighter text-red-400">Verification Failed</p>
              <p className="text-zinc-500 text-sm px-4">{error || 'We could not confirm your payment status with Paystack.'}</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
               <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Payment Reference</p>
               <p className="font-mono text-xs text-white break-all">{reference}</p>
            </div>
            <div className="space-y-3">
              <Link href="/tenant/pay"
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white text-black font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-zinc-200 transition-all">
                Retry Payment
              </Link>
              <Link href="/tenant/dashboard" className="block text-[10px] text-zinc-500 hover:text-white uppercase font-bold tracking-widest transition-colors">
                Back to Dashboard
              </Link>
            </div>
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}

export default function PaySuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
    }>
      <PaySuccessContent />
    </Suspense>
  );
}