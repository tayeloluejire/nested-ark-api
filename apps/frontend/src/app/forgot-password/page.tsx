'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import api from '@/lib/api';
import { Loader2, Mail, ShieldCheck, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

type Phase = 'form' | 'sent' | 'error';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [errMsg, setErrMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) return;

    setBusy(true);
    setErrMsg('');

    try {
      // Hits the corrected BASE_URL from api.ts
      await api.post('/api/auth/forgot-password', { email: cleanEmail });
      setPhase('sent');
    } catch (ex: any) {
      console.error('Recovery Protocol Error:', ex);
      
      // If server responded with a timeout or SMTP error we previously saw
      const serverError = ex?.response?.data?.error;
      const networkError = ex?.code === 'ECONNABORTED' ? 'Server timeout. Please try again.' : null;
      
      setErrMsg(serverError || networkError || 'Recovery protocol failed. Connection interrupted.');
      setPhase('error');
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'sent') return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-[420px] text-center space-y-6">
        <Image src="/nested_ark_icon.png" alt="Nested Ark" width={48} height={48} priority className="mx-auto" />
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-teal-500/10 animate-ping" />
          <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-teal-500/20 border-2 border-teal-500/30">
            <Mail className="text-teal-500" size={32} />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter">Check Your Email</h2>
          <p className="text-teal-500 text-sm mt-1">Recovery link dispatched</p>
        </div>
        <p className="text-zinc-400 text-sm leading-relaxed">
          If <strong className="text-white">{email}</strong> is registered, a reset link has been sent.
          Check your inbox and spam folder.
        </p>
        <button onClick={() => { setPhase('form'); setEmail(''); }} className="w-full py-3 border border-zinc-700 text-zinc-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:border-teal-500 hover:text-teal-500 transition-all">
          Try Another Email
        </button>
        <Link href="/login" className="block w-full py-4 bg-white text-black font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-teal-500 transition-all">
          Back to Sign In
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-[420px] space-y-8">
        <div className="text-center space-y-3">
          <Image src="/nested_ark_icon.png" alt="Nested Ark" width={48} height={48} priority className="mx-auto" />
          <h1 className="text-sm font-black uppercase tracking-[0.2em]">Nested Ark <span className="text-teal-500">OS</span></h1>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Recovery Protocol</p>
        </div>

        <div className="border-l-2 border-teal-500 pl-5">
          <h2 className="text-2xl font-black uppercase tracking-tighter">Reset Access Key</h2>
          <p className="text-zinc-500 text-xs mt-1 leading-relaxed">Enter your operator email address.</p>
        </div>

        {phase === 'error' && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-bold flex items-start gap-2">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> {errMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-11 pr-4 py-4 text-white text-sm outline-none focus:border-teal-500 transition-colors" />
          </div>
          <button type="submit" disabled={busy || !email.trim()} className="w-full py-4 bg-white text-black font-black uppercase tracking-[0.15em] text-xs rounded-xl hover:bg-teal-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <><Loader2 className="animate-spin" size={14} /> Dispatching...</> : <><Mail size={14} /> Request Link</>}
          </button>
        </form>

        <div className="text-center">
          <Link href="/login" className="inline-flex items-center gap-2 text-[9px] text-zinc-600 hover:text-teal-500 font-bold uppercase tracking-widest transition-colors">
            <ArrowLeft size={10} /> Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}