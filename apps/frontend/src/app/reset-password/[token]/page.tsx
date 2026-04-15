'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import api from '@/lib/api';
import { Loader2, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';

type Phase = 'verifying' | 'ready' | 'expired' | 'success' | 'error';

export default function ResetPasswordPage() {
  const params   = useParams();
  const router   = useRouter();
  const token    = params?.token as string;

  const [phase,       setPhase]       = useState<Phase>('verifying');
  const [emailHint,   setEmailHint]   = useState('');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy,        setBusy]        = useState(false);
  const [errMsg,      setErrMsg]      = useState('');

  // ── Step 1: verify token on mount ────────────────────────────────────────
  useEffect(() => {
    if (!token) { setPhase('expired'); return; }
    api.post('/api/auth/verify-reset-token', { token })
      .then(res => {
        setEmailHint(res.data.email_hint ?? '');
        setPhase('ready');
      })
      .catch(() => setPhase('expired'));
  }, [token]);

  // ── Step 2: submit new password ───────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg('');
    if (password.length < 8) { setErrMsg('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setErrMsg('Passwords do not match'); return; }
    setBusy(true);
    try {
      await api.post('/api/auth/reset-password', { token, new_password: password });
      setPhase('success');
    } catch (ex: any) {
      setErrMsg(ex?.response?.data?.error ?? 'Reset failed. Try requesting a new link.');
      setPhase('error');
    } finally { setBusy(false); }
  };

  // ── Verifying ─────────────────────────────────────────────────────────────
  if (phase === 'verifying') return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="animate-spin text-teal-500 mx-auto" size={32} />
        <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-[0.2em]">Validating recovery token…</p>
      </div>
    </div>
  );

  // ── Token expired / invalid ───────────────────────────────────────────────
  if (phase === 'expired') return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-[400px] text-center space-y-6">
        <Image src="/nested_ark_icon.png" alt="Nested Ark" width={48} height={48} priority
          className="mx-auto" style={{ width: '48px', height: 'auto' }} />
        <AlertCircle className="text-red-400 mx-auto" size={40} />
        <div>
          <h2 className="text-xl font-black uppercase">Token Expired</h2>
          <p className="text-zinc-500 text-sm mt-2 leading-relaxed">
            This reset link has expired or already been used. Reset links are valid for 15 minutes and can
            only be used once.
          </p>
        </div>
        <Link href="/forgot-password"
          className="block w-full py-4 bg-white text-black font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-teal-500 transition-all">
          Request New Reset Link
        </Link>
        <Link href="/login"
          className="block text-zinc-500 hover:text-white text-xs uppercase font-bold tracking-widest transition-colors">
          ← Back to Login
        </Link>
      </div>
    </div>
  );

  // ── Success ───────────────────────────────────────────────────────────────
  if (phase === 'success') return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-[400px] text-center space-y-6">
        <Image src="/nested_ark_icon.png" alt="Nested Ark" width={48} height={48} priority
          className="mx-auto" style={{ width: '48px', height: 'auto' }} />
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-teal-500/10 animate-ping" />
          <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-teal-500/20 border-2 border-teal-500/40">
            <CheckCircle2 className="text-teal-500" size={36} />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter">Access Key Updated</h2>
          <p className="text-teal-500 text-sm mt-1">Operator credentials reset successfully.</p>
        </div>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Your new access key is active. You can now sign in to your operator account.
        </p>
        <Link href="/login"
          className="block w-full py-4 bg-white text-black font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-teal-500 transition-all">
          Sign In to Your Portal →
        </Link>
        <p className="text-[8px] text-zinc-700 font-mono">
          <ShieldCheck size={9} className="inline text-teal-500/40 mr-1" />
          Impressions &amp; Impacts Ltd · nestedark@gmail.com
        </p>
      </div>
    </div>
  );

  // ── Password form (phase = 'ready' | 'error') ─────────────────────────────
  const strength = password.length === 0 ? 0
    : password.length < 8  ? 1
    : password.length < 12 ? 2
    : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3;
  const strengthLabel = ['', 'Too short', 'Weak', 'Good', 'Strong'][strength];
  const strengthColor = ['', 'bg-red-500', 'bg-amber-500', 'bg-teal-500', 'bg-emerald-500'][strength];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-[420px] space-y-8">

        {/* Logo */}
        <div className="text-center space-y-3">
          <Image src="/nested_ark_icon.png" alt="Nested Ark" width={48} height={48} priority
            className="mx-auto" style={{ width: '48px', height: 'auto' }} />
          <h1 className="text-sm font-black uppercase tracking-[0.2em]">
            Nested Ark <span className="text-teal-500">OS</span>
          </h1>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Recovery Protocol</p>
        </div>

        {/* Header */}
        <div className="border-l-2 border-teal-500 pl-5">
          <h2 className="text-2xl font-black uppercase tracking-tighter">Set New Access Key</h2>
          {emailHint && (
            <p className="text-zinc-500 text-xs mt-1">
              Resetting for: <span className="text-teal-500 font-mono">{emailHint}</span>
            </p>
          )}
        </div>

        {/* Error */}
        {phase === 'error' && errMsg && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-bold flex items-start gap-2">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> {errMsg}
            <Link href="/forgot-password" className="ml-auto text-teal-500 hover:text-white transition-colors whitespace-nowrap">
              New link →
            </Link>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* New password */}
          <div>
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block mb-2">
              New Access Key (min. 8 characters)
            </label>
            <div className="relative">
              <KeyRound size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                required
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="New password"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-11 pr-12 py-4 text-white text-sm outline-none focus:border-teal-500 transition-colors"
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {/* Strength bar */}
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(n => (
                    <div key={n} className={`h-1 flex-1 rounded-full transition-all ${n <= strength ? strengthColor : 'bg-zinc-800'}`} />
                  ))}
                </div>
                <p className="text-[8px] text-zinc-500 uppercase font-bold">{strengthLabel}</p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block mb-2">
              Confirm New Key
            </label>
            <div className="relative">
              <KeyRound size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                required
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat password"
                className={`w-full bg-zinc-900 border rounded-xl pl-11 pr-12 py-4 text-white text-sm outline-none transition-colors ${
                  confirm && confirm !== password
                    ? 'border-red-500/50 focus:border-red-500'
                    : confirm && confirm === password
                    ? 'border-teal-500/50 focus:border-teal-500'
                    : 'border-zinc-800 focus:border-teal-500'
                }`}
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {confirm && confirm !== password && (
              <p className="text-red-400 text-[9px] font-bold mt-1">Passwords do not match</p>
            )}
            {confirm && confirm === password && (
              <p className="text-teal-500 text-[9px] font-bold mt-1 flex items-center gap-1">
                <CheckCircle2 size={9} /> Passwords match
              </p>
            )}
          </div>

          {/* Inline error from API */}
          {errMsg && phase !== 'error' && (
            <p className="text-red-400 text-xs font-bold">{errMsg}</p>
          )}

          <button
            type="submit"
            disabled={busy || password.length < 8 || password !== confirm}
            className="w-full py-4 bg-white text-black font-black uppercase tracking-[0.15em] text-xs rounded-xl hover:bg-teal-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy
              ? <><Loader2 className="animate-spin" size={14} /> Updating Key…</>
              : <><ShieldCheck size={14} /> Confirm New Key</>
            }
          </button>
        </form>

        <div className="text-center">
          <Link href="/login"
            className="text-[9px] text-zinc-600 hover:text-teal-500 font-bold uppercase tracking-widest transition-colors">
            ← Return to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
