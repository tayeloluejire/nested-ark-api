'use client';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth, getRoleRoute, UserRole } from '@/lib/AuthContext';
import api from '@/lib/api';
import { Loader2, Eye, EyeOff, ShieldCheck, RefreshCw, Mail } from 'lucide-react';

// ── All 8 portals shown on the login page ────────────────────────────────────
const PORTALS = [
  { role: 'DEVELOPER',  emoji: '🏠', label: 'Developer',  desc: 'Create projects, upload plans, manage builds',       dest: '/projects/my',    restricted: false },
  { role: 'INVESTOR',   emoji: '💰', label: 'Investor',   desc: 'Fund projects, track yield and escrow',              dest: '/portfolio',      restricted: false },
  { role: 'CONTRACTOR', emoji: '🏗', label: 'Contractor', desc: 'Browse project IDs, bid on milestones',              dest: '/projects',       restricted: false },
  { role: 'VERIFIER',   emoji: '🔍', label: 'Verifier',   desc: 'Audit sites, verify evidence, release funds',        dest: '/admin/approval', restricted: false },
  { role: 'SUPPLIER',   emoji: '🚚', label: 'Supplier',   desc: 'Dispatch materials, delivery tracking',              dest: '/supplier',       restricted: false },
  { role: 'BANK',       emoji: '🏦', label: 'Bank',       desc: 'Capital tranches, AML compliance, ledger',           dest: '/bank',           restricted: false },
  { role: 'GOVERNMENT', emoji: '🏛', label: 'Government', desc: 'Approve milestones, authorize escrow releases',      dest: '/gov',            restricted: false },
  { role: 'ADMIN',      emoji: '⚙️', label: 'Admin',      desc: 'Command center — system-assigned only',             dest: '/admin',          restricted: true  },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading, user } = useAuth();

  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [otpCode,   setOtpCode]   = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [step,      setStep]      = useState<'creds' | '2fa'>('creds');
  const [busy,      setBusy]      = useState(false);
  const [resending, setResending] = useState(false);
  const [error,     setError]     = useState('');
  const [notice,    setNotice]    = useState('');

  // ── Auth redirect ────────────────────────────────────────────────────────────
  // If user is already logged in, redirect immediately WITHOUT showing the login
  // form first. The previous code returned the spinner while authLoading=true,
  // then called router.replace() in useEffect — but the form briefly rendered
  // between the spinner unmounting and the navigation completing, causing the
  // visible "jerk" between /login and /tenant/dashboard.
  //
  // Fix: while authLoading OR while authenticated, show the spinner and nothing
  // else. The form only renders once we are certain the user is NOT logged in.
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      router.replace(getRoleRoute(user.role as UserRole));
    }
  }, [isAuthenticated, authLoading, user, router]);

  // Show spinner for the entire duration of the auth check AND during redirect
  if (authLoading || isAuthenticated) return (
    <div className="h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="animate-spin text-teal-500 mx-auto" size={32} />
        <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-[0.2em]">
          {isAuthenticated ? 'Redirecting…' : 'Verifying session…'}
        </p>
      </div>
    </div>
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const payload = step === '2fa'
        ? { email, password, otp_code: otpCode.trim() }
        : { email, password };

      const res = await api.post('/api/auth/login', payload);

      if (res.data.requires_2fa) {
        setStep('2fa');
        setNotice(`A 6-digit code was sent to ${email}.`);
        setBusy(false); return;
      }

      const route = await login(email, password);
      router.replace(route);
    } catch (ex: any) {
      setError(ex?.response?.data?.error ?? 'Sign-in failed. Check your credentials.');
    } finally { setBusy(false); }
  };

  const resendOtp = async () => {
    setResending(true); setError('');
    try {
      await api.post('/api/auth/send-otp', { email });
      setNotice('New code sent to your email.');
    } catch { setNotice('Could not resend. Try again.'); }
    finally { setResending(false); }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[480px] space-y-8">

        {/* Logo */}
        <div className="text-center space-y-2">
          <Image src="/nested_ark_icon.png" alt="Nested Ark" width={48} height={48} priority
            className="mx-auto" style={{ width: '48px', height: 'auto' }} />
          <h1 className="text-sm font-black uppercase tracking-[0.2em]">
            Nested Ark <span className="text-teal-500">OS</span>
          </h1>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">
            One door. Your role routes you to the right command center.
          </p>
        </div>

        {/* Portal directory — 4×2 grid */}
        <div className="grid grid-cols-4 gap-1.5">
          {PORTALS.map(p => (
            <div
              key={p.role}
              className={`p-2.5 rounded-xl border text-center space-y-1 transition-all ${
                p.restricted
                  ? 'border-zinc-800/50 bg-zinc-900/10 opacity-40'
                  : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 hover:bg-zinc-900/40'
              }`}
            >
              <p className="text-base leading-none">{p.emoji}</p>
              <p className="text-[8px] font-black uppercase tracking-wide text-white">{p.label}</p>
              <p className="text-[7px] text-zinc-600 leading-tight hidden sm:block">{p.desc}</p>
              {!p.restricted
                ? <p className="text-[6px] text-teal-500 font-mono">→ {p.dest}</p>
                : <p className="text-[6px] text-zinc-700 italic">System-assigned</p>
              }
            </div>
          ))}
        </div>

        {/* Notices */}
        {notice && (
          <div className="flex items-start gap-2 p-4 rounded-xl bg-teal-500/5 border border-teal-500/20 text-teal-400 text-xs">
            <Mail size={14} className="flex-shrink-0 mt-0.5" /> {notice}
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-bold">
            {error}
          </div>
        )}

        {/* Form label */}
        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest text-center -mb-4">
          {step === 'creds' ? 'Establish Connection' : '2-Factor Verification'}
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          {step === 'creds' ? (
            <>
              <input
                required type="email" placeholder="Operator email address"
                value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white text-sm outline-none focus:border-teal-500 transition-colors"
              />
              <div className="relative">
                <input
                  required type={showPw ? 'text' : 'password'} placeholder="Access key (password)"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pr-12 text-white text-sm outline-none focus:border-teal-500 transition-colors"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <input
                required type="text" inputMode="numeric" maxLength={6}
                placeholder="000000" value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-5 text-white text-3xl font-mono text-center tracking-[0.5em] outline-none focus:border-teal-500 transition-colors"
              />
              <div className="flex justify-between">
                <button type="button" onClick={resendOtp} disabled={resending}
                  className="flex items-center gap-2 text-[10px] text-zinc-500 hover:text-teal-500 font-bold uppercase transition-colors">
                  <RefreshCw size={11} className={resending ? 'animate-spin' : ''} /> Resend code
                </button>
                <button type="button"
                  onClick={() => { setStep('creds'); setOtpCode(''); setError(''); setNotice(''); }}
                  className="text-[10px] text-zinc-500 hover:text-white font-bold uppercase transition-colors">
                  ← Back
                </button>
              </div>
            </div>
          )}

          <button type="submit" disabled={busy}
            className="w-full py-4 bg-white text-black font-black uppercase tracking-[0.15em] text-xs rounded-xl hover:bg-teal-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {busy
              ? <><Loader2 className="animate-spin" size={14} /> Analyzing Credentials…</>
              : step === '2fa'
                ? <><ShieldCheck size={14} /> Confirm Identity</>
                : 'Establish Connection'
            }
          </button>
        </form>

        <div className="flex justify-between text-[9px] text-zinc-600 uppercase font-bold tracking-widest">
          <Link href="/register" className="hover:text-teal-500 transition-colors">New Operator? Apply for Access</Link>
          <Link href="/forgot-password" className="hover:text-teal-500 transition-colors">Recover Access</Link>
        </div>

        <div className="text-center text-[8px] text-zinc-700 pt-2 border-t border-zinc-900">
          <ShieldCheck size={9} className="inline text-teal-500/40 mr-1" />
          A product of Impressions &amp; Impacts Ltd · nestedark@gmail.com
        </div>
      </div>
    </div>
  );
}
