'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import api from '@/lib/api';
import { CheckCircle2, Loader2, AlertCircle, ShieldCheck, Database, ArrowRight, RefreshCw } from 'lucide-react';

// ── Defensive numeric helpers — never crash on undefined/null/NaN ──────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();
const safeD = (v: any, d = 2): string => safeN(v).toFixed(d);


function SuccessContent() {
  const params = useSearchParams();
  // Paystack sends: callback_url?trxref=XXX&reference=XXX
  // We also store ref in sessionStorage as fallback
  const reference =
    params.get('ref') ||
    params.get('reference') ||
    params.get('trxref') ||
    (typeof window !== 'undefined' ? sessionStorage.getItem('last_payment_ref') : null);

  const [phase, setPhase] = useState<'verifying' | 'success' | 'pending' | 'failed' | 'no-ref'>('verifying');
  const [txData, setTxData] = useState<any>(null);
  const [attempts, setAttempts] = useState(0);

  const verify = async () => {
    if (!reference) { setPhase('no-ref'); return; }
    try {
      const res = await api.get(`/api/payments/verify/${encodeURIComponent(reference)}`);
      const d = res.data;
      const s = (d.status || '').toLowerCase();
      if (s === 'success' || s === 'SUCCESS') {
        setPhase('success'); setTxData(d);
        // Clear session storage
        if (typeof window !== 'undefined') sessionStorage.removeItem('last_payment_ref');
      } else if (s === 'pending') {
        setPhase('pending'); setTxData(d);
      } else {
        setPhase('failed'); setTxData(d);
      }
    } catch {
      setPhase('failed');
    }
  };

  useEffect(() => {
    if (!reference) { setPhase('no-ref'); return; }
    verify();
    // Paystack webhooks can be slightly delayed — retry twice more
    const t1 = setTimeout(() => { setAttempts(1); verify(); }, 3000);
    const t2 = setTimeout(() => { setAttempts(2); verify(); }, 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [reference]);

  if (phase === 'verifying') return (
    <div className="text-center space-y-5">
      <Loader2 className="animate-spin text-teal-500 mx-auto" size={44} />
      <div>
        <p className="text-white text-sm font-bold uppercase tracking-widest">Confirming Payment...</p>
        <p className="text-zinc-500 text-xs mt-1">Verifying with Paystack</p>
      </div>
      {reference && <p className="text-zinc-700 text-[9px] font-mono">{reference}</p>}
    </div>
  );

  if (phase === 'success') return (
    <div className="text-center space-y-6">
      <div className="relative mx-auto w-20 h-20">
        <div className="absolute inset-0 rounded-full bg-teal-500/10 animate-ping" />
        <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-teal-500/20 border-2 border-teal-500/40">
          <CheckCircle2 className="text-teal-500" size={36} />
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-black uppercase tracking-tight">Investment Confirmed</h2>
        <p className="text-teal-500 text-sm mt-1">Capital secured in escrow node</p>
      </div>
      {txData && (
        <div className="text-left space-y-2">
          {[
            { label: 'Amount Paid', value: txData.amount_ngn ? `₦${safeF(txData.amount_ngn)}` : '—' },
            { label: 'Reference', value: `${reference?.slice(0, 22)}...` },
            { label: 'Channel', value: (txData.channel || 'Card').toUpperCase() },
            { label: 'Escrow Status', value: 'COMMITTED & LOCKED', hi: true },
          ].map(r => (
            <div key={r.label} className="flex justify-between items-center px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/20">
              <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{r.label}</span>
              <span className={`font-mono text-sm ${r.hi ? 'text-teal-500 font-bold' : 'text-white'}`}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
      <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/5 flex items-start gap-3 text-left">
        <ShieldCheck className="text-teal-500 flex-shrink-0 mt-0.5" size={16} />
        <p className="text-zinc-400 text-xs leading-relaxed">
          Your capital is locked in the Nested Ark escrow. Funds release to the contractor only after <strong className="text-white">AI + Human + Drone</strong> verification passes for each milestone.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/investments" className="flex-1 py-3 bg-white text-black font-bold rounded-xl text-xs uppercase tracking-widest text-center hover:bg-teal-500 transition-all flex items-center justify-center gap-2">
          <ArrowRight size={14} /> View Portfolio
        </Link>
        <Link href="/ledger" className="flex items-center gap-1.5 px-4 py-3 border border-zinc-800 text-zinc-400 hover:text-teal-500 font-bold rounded-xl text-xs uppercase tracking-widest transition-all">
          <Database size={13} /> Ledger
        </Link>
      </div>
    </div>
  );

  if (phase === 'pending') return (
    <div className="text-center space-y-5">
      <Loader2 className="animate-spin text-amber-400 mx-auto" size={40} />
      <div>
        <h2 className="text-xl font-black uppercase">Payment Processing</h2>
        <p className="text-zinc-500 text-sm mt-1">Your payment is being confirmed. This takes up to 2 minutes.</p>
      </div>
      <p className="text-zinc-700 text-[9px] font-mono">{reference}</p>
      <button onClick={verify} className="flex items-center gap-2 mx-auto px-5 py-3 border border-zinc-800 text-zinc-400 hover:text-teal-500 font-bold rounded-xl text-xs uppercase tracking-widest transition-all">
        <RefreshCw size={13} /> Check Again
      </button>
      <p className="text-zinc-600 text-[9px]">If payment was deducted, it will appear in your portfolio shortly.</p>
    </div>
  );

  if (phase === 'failed') return (
    <div className="text-center space-y-5">
      <AlertCircle className="text-red-400 mx-auto" size={40} />
      <div>
        <h2 className="text-xl font-black uppercase">Payment Not Completed</h2>
        <p className="text-zinc-500 text-sm mt-1">The transaction was cancelled or not completed.</p>
      </div>
      {reference && <p className="text-zinc-700 text-[9px] font-mono">{reference}</p>}
      <div className="flex gap-3">
        <Link href="/investments" className="flex-1 py-3 bg-white text-black font-bold rounded-xl text-xs uppercase tracking-widest text-center hover:bg-teal-500 transition-all">
          Try Again
        </Link>
        <a href="mailto:nestedark@gmail.com?subject=Payment Issue" className="flex-1 py-3 border border-zinc-800 text-zinc-400 font-bold rounded-xl text-xs uppercase tracking-widest text-center hover:text-white transition-all">
          Support
        </a>
      </div>
    </div>
  );

  return (
    <div className="text-center space-y-4">
      <AlertCircle className="text-amber-400 mx-auto" size={36} />
      <p className="text-zinc-400 text-sm">No payment reference found.</p>
      <Link href="/investments" className="block py-3 bg-white text-black font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-teal-500 transition-all">Back to Investments</Link>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <div className="w-full max-w-[440px] space-y-8">
        <div className="text-center">
          <Image src="/nested_ark_icon.png" alt="Logo" width={48} height={48} priority className="mx-auto mb-4" style={{ width: '48px', height: 'auto' }} />
          <p className="text-[9px] text-zinc-700 uppercase tracking-widest font-mono">Nested Ark Infrastructure OS</p>
        </div>
        <Suspense fallback={<div className="text-center"><Loader2 className="animate-spin text-teal-500 mx-auto" size={28} /></div>}>
          <SuccessContent />
        </Suspense>
      </div>
    </div>
  );
}
