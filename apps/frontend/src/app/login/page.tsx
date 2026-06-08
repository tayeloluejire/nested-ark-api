'use client';
export const dynamic = 'force-dynamic';
/**
 * /login/page.tsx
 * On success → AuthContext writes ark_role cookie + redirects to role home.
 * Shows reason message if redirected by middleware.
 */
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import BrandLogo from '@/components/BrandLogo';
import { Loader2, AlertCircle, Eye, EyeOff, Lock, Mail } from 'lucide-react';

const REASON_MSG: Record<string, string> = {
  tenant_only:        'That page is for tenants only. Please log in with your tenant account.',
  landlord_only:      'That page requires a landlord account.',
  admin_only:         'Admin access required.',
  access_denied:      'You do not have permission to access that page.',
  session_expired:    'Your session expired. Please log in again.',
  switch_to_landlord: 'You need a Landlord account to access that page. Log in with your landlord credentials.',
};

function LoginContent() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') ?? '';

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Email and password are required.'); return; }
    setLoading(true); setError('');
    try { await login(email, password); }
    catch (ex: any) { setError(ex?.response?.data?.error ?? 'Invalid email or password.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8">

        {/* ── Brand header ─────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-4">
          <BrandLogo size={48} href="/" showText={false} />
          <div className="text-center space-y-1">
            <BrandLogo size={20} href="/" noLink className="justify-center" />
            <h1 className="text-3xl font-black uppercase tracking-tighter mt-2">Sign In</h1>
            <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
              Infrastructure Access Terminal
            </p>
          </div>
        </div>

        {reason && (
          <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs font-bold text-center">
            {REASON_MSG[reason] ?? 'Please log in to continue.'}
          </div>
        )}
        {error && (
          <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={13} />{error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@email.com"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-12 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-teal-500 text-black rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-teal-400 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="space-y-3">
          <p className="text-center text-xs text-zinc-600">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-teal-500 hover:text-white font-bold transition-colors">
              Register
            </Link>
          </p>
          <p className="text-center text-xs text-zinc-600">
            <Link href="/forgot-password" className="text-zinc-500 hover:text-teal-500 transition-colors">
              Forgot password?
            </Link>
          </p>
        </div>

        {/* ── Footer brand mark ─────────────────────────────────────────── */}
        <div className="pt-4 border-t border-zinc-900 flex flex-col items-center gap-1">
          <BrandLogo size={16} href="/" noLink className="opacity-30 justify-center" />
          <p className="text-[9px] text-zinc-700 font-mono tracking-widest text-center">
            © 2026 Impressions &amp; Impacts Ltd · All rights reserved
          </p>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
