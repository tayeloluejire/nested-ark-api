'use client';
export const dynamic = 'force-dynamic';
/**
 * src/app/tenant/pay/success/page.tsx
 * Paystack redirects here after payment: /tenant/pay/success?ref=RENT-XXXX-...
 * We verify the payment and show confirmation.
 */
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { CheckCircle2, Loader2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

const safeF = (v: any): string => { const n = Number(v); return (v == null || isNaN(n)) ? '0' : n.toLocaleString(); };

function PaySuccessContent() {
  const params    = useSearchParams();
  const router    = useRouter();
  const reference = params.get('reference') || params.get('ref') || params.get('trxref') || '';

  const [status,  setStatus]  = useState<'loading'|'success'|'failed'>('loading');
  const [details, setDetails] = useState<any>(null);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!reference) { setStatus('failed'); setError('No payment reference found'); return; }
    api.get(`/api/payments/verify/${reference}`)
      .then(res => {
        setDetails(res.data);
        setStatus(res.data.status === 'success' || res.data.payment_status === 'COMPLETED' ? 'success' : 'failed');
      })
      .catch(e => {
        setError(e?.response?.data?.error ?? 'Could not verify payment');
        setStatus('failed');
      });
  }, [reference]);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <main className="max-w-md mx-auto px-6 py-20 space-y-8">

        {status === 'loading' && (
          <div className="text-center space-y-4 py-20">
            <Loader2 className="animate-spin text-teal-500 mx-auto" size={36} />
            <p className="text-zinc-400 font-bold">Verifying your payment…</p>
            <p className="text-zinc-600 text-sm">This takes just a moment</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center space-y-6">
            {/* Success animation ring */}
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-teal-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" style={{ animationDuration: '1s', animationIterationCount: 1 }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <CheckCircle2 size={36} className="text-teal-400" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-black text-2xl uppercase tracking-tight">Payment Confirmed</p>
              <p className="text-zinc-500 text-sm">Your rent payment has been received and your vault updated</p>
            </div>

            {details && (
              <div className="p-5 rounded-2xl border border-teal-500/20 bg-teal-500/5 text-left space-y-3">
                <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest">Receipt</p>
                {[
                  ['Reference', reference],
                  ['Amount', details.amount ? `₦${safeF(details.amount / 100)}` : '—'],
                  ['Status', 'COMPLETED'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-zinc-500">{k}</span>
                    <span className="font-bold font-mono text-white">{v}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 pt-2 border-t border-teal-500/20">
                  <ShieldCheck size={11} className="text-teal-500" />
                  <p className="text-[9px] text-teal-500 font-bold">SHA-256 hashed · Immutable ledger entry created</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Link href="/tenant/dashboard"
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-teal-500 text-black font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-teal-400 transition-all">
                Back to Dashboard <ArrowRight size={14} />
              </Link>
              <p className="text-[9px] text-zinc-700 text-center">
                Your Flex-Pay vault has been credited. Check your vault balance on the dashboard.
              </p>
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div className="text-center space-y-6">
            <AlertCircle size={40} className="text-amber-400 mx-auto" />
            <div className="space-y-2">
              <p className="font-black text-xl uppercase tracking-tight">Payment Verification Failed</p>
              <p className="text-zinc-500 text-sm">{error || 'We could not confirm your payment status'}</p>
            </div>
            <div className="space-y-2">
              <Link href="/tenant/dashboard"
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-teal-500 text-black font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-teal-400 transition-all">
                Go to Dashboard
              </Link>
              <p className="text-[9px] text-zinc-600 text-center">
                If money was deducted, contact support with reference: <span className="font-mono text-zinc-400">{reference}</span>
              </p>
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
    <Suspense fallback={<div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={28} /></div>}>
      <PaySuccessContent />
    </Suspense>
  );
}
