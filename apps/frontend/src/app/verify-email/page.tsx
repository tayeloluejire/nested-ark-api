'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import api from '@/lib/api';
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';

function VerifyContent() {
  const params = useSearchParams();
  const token  = params.get('token');
  const [phase,       setPhase]       = useState<'loading'|'ok'|'fail'|'no-token'>('loading');
  const [resendEmail, setResendEmail] = useState('');
  const [resent,      setResent]      = useState(false);
  const [busy,        setBusy]        = useState(false);

  useEffect(() => {
    if (!token) { setPhase('no-token'); return; }
    api.get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => setPhase('ok'))
      .catch(() => setPhase('fail'));
  }, [token]);

  const resend = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await api.post('/api/auth/resend-verification', { email: resendEmail }); setResent(true); }
    catch { setResent(true); } // show success either way (anti-enumeration)
    finally { setBusy(false); }
  };

  if (phase === 'loading') return (
    <div className="text-center space-y-4">
      <Loader2 className="animate-spin text-teal-500 mx-auto" size={40} />
      <p className="text-zinc-400 text-sm uppercase tracking-widest font-bold">Verifying your account…</p>
    </div>
  );

  if (phase === 'ok') return (
    <div className="text-center space-y-6">
      <div className="relative mx-auto w-20 h-20">
        <div className="absolute inset-0 rounded-full bg-teal-500/10 animate-ping" />
        <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-teal-500/20 border-2 border-teal-500/40">
          <CheckCircle2 className="text-teal-500" size={36} />
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-black uppercase tracking-tight">Email Verified</h2>
        <p className="text-teal-500 text-sm mt-1">Your operator account is fully active.</p>
      </div>
      <p className="text-zinc-400 text-sm">You can now sign in, fund projects, and manage your portfolio.</p>
      <Link href="/login" className="block w-full py-4 bg-white text-black font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-teal-500 transition-all">
        Sign In to Your Portal →
      </Link>
    </div>
  );

  // fail or no-token
  return (
    <div className="text-center space-y-6">
      <AlertCircle className="text-red-400 mx-auto" size={40} />
      <div>
        <h2 className="text-xl font-black uppercase">Verification Failed</h2>
        <p className="text-zinc-500 text-sm mt-1">
          {phase === 'no-token' ? 'No verification token found in this link.' : 'Token expired or already used.'}
        </p>
      </div>
      {!resent ? (
        <form onSubmit={resend} className="space-y-3 text-left">
          <p className="text-zinc-400 text-xs text-center">Enter your email to receive a fresh link:</p>
          <input required type="email" placeholder="Your email address" value={resendEmail}
            onChange={e => setResendEmail(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500" />
          <button type="submit" disabled={busy}
            className="w-full py-3 bg-teal-500 text-black font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-teal-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="animate-spin" size={14} /> : <><RefreshCw size={12} /> Resend Verification Link</>}
          </button>
        </form>
      ) : (
        <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/5">
          <p className="text-teal-400 text-sm font-bold">✅ Check your inbox — new link sent.</p>
        </div>
      )}
      <Link href="/login" className="block text-zinc-500 hover:text-white text-xs uppercase font-bold tracking-widest transition-colors">
        ← Back to Login
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <div className="w-full max-w-[400px] space-y-8">
        <div className="text-center">
          <Image src="/nested_ark_icon.png" alt="Logo" width={48} height={48} priority
            className="mx-auto mb-3" style={{ width: '48px', height: 'auto' }} />
          <h1 className="text-sm font-black uppercase tracking-[0.2em]">Nested Ark <span className="text-teal-500">OS</span></h1>
          <p className="text-[9px] text-zinc-700 uppercase tracking-widest mt-1 font-mono">Account Verification</p>
        </div>
        <Suspense fallback={<div className="text-center"><Loader2 className="animate-spin text-teal-500 mx-auto" size={28} /></div>}>
          <VerifyContent />
        </Suspense>
        <p className="text-center text-[8px] text-zinc-700 border-t border-zinc-900 pt-4">
          <ShieldCheck size={9} className="inline text-teal-500/40 mr-1" />
          Impressions &amp; Impacts Ltd · nestedark@gmail.com
        </p>
      </div>
    </div>
  );
}
