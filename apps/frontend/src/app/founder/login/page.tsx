'use client';
export const dynamic = 'force-dynamic';

/**
 * /founder/login/page.tsx
 * Isolated Founder / Platform Admin login.
 * Role-validates on response — only FOUNDER / DEVELOPER / ADMIN role proceeds.
 * Founder accounts are created directly in DB (not via public registration).
 * Uses window.location.href for hard redirect to bypass Next.js middleware role routing.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Loader2, Eye, EyeOff, AlertCircle, Lock } from 'lucide-react';

const API_BASE = '/api';

export default function FounderLoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) { setError('Email and password are required'); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Login failed');

      // Role gate — only FOUNDER / DEVELOPER / ADMIN may proceed
      const role = (data.user?.role || data.role || '').toUpperCase();
      const ALLOWED = ['FOUNDER', 'DEVELOPER', 'ADMIN'];
      if (!ALLOWED.includes(role)) {
        setError('Access denied. This portal is restricted to platform administrators.');
        setLoading(false);
        return;
      }

      // Persist token — same pattern as all other portals
      const token = data.token || data.tokens?.access_token || data.access_token;
      if (token) {
        localStorage.setItem('token', token);
        sessionStorage.setItem('token', token);
        localStorage.setItem('ark_role', role);
        localStorage.setItem('ark_user', JSON.stringify(data.user));

        // Write cookies so Next.js middleware can read role + token
        // (middleware cannot access localStorage — cookies only)
        document.cookie = `ark_token=${token}; path=/; SameSite=Lax`;
        document.cookie = `ark_role=${role}; path=/; SameSite=Lax`;
      }

      // Hard redirect — bypasses Next.js middleware role-based routing
      // that would otherwise send DEVELOPER role to /projects/my/
      window.location.href = '/admin/founder';
    } catch (e: any) {
      setError(e.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  const inp = `w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors focus:border-teal-500`;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center px-4">

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm space-y-8 relative z-10">

        {/* Brand mark */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto">
            <ShieldCheck size={24} className="text-teal-400" />
          </div>
          <div>
            <p className="text-[9px] text-teal-500 font-mono font-black tracking-[0.3em] uppercase mb-1">
              Nested Ark OS
            </p>
            <h1 className="text-2xl font-black uppercase tracking-tighter">Founder Access</h1>
            <p className="text-zinc-600 text-xs mt-1">Platform administration · Restricted</p>
          </div>
        </div>

        {/* Login card */}
        <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">

          {/* Security notice */}
          <div className="flex items-start gap-2 p-3 rounded-xl border border-zinc-800 bg-black/40">
            <Lock size={10} className="text-zinc-600 shrink-0 mt-0.5" />
            <p className="text-[9px] text-zinc-600 leading-relaxed">
              Restricted access. Founder accounts are provisioned directly by the platform administrator — not via public registration.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/5">
              <AlertCircle size={12} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-400 leading-relaxed">{error}</p>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              autoComplete="username"
              placeholder="founder@nestedark.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className={inp}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className={`${inp} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className={`w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 mt-2 ${
              loading
                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                : 'bg-teal-500 text-black hover:bg-teal-400'
            }`}>
            {loading
              ? <><Loader2 size={13} className="animate-spin" /> Authenticating…</>
              : <><ShieldCheck size={13} /> Access Command Center</>
            }
          </button>
        </div>

        {/* Footer nav */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-4 text-[10px] text-zinc-700">
            <Link href="/login" className="hover:text-zinc-400 transition-colors">
              Tenant / Landlord Login
            </Link>
            <span>·</span>
            <Link href="/" className="hover:text-zinc-400 transition-colors">
              Home
            </Link>
          </div>
          <p className="text-[9px] text-zinc-800 font-mono">
            Impressions &amp; Impacts Ltd · Nested Ark OS
          </p>
        </div>
      </div>
    </div>
  );
}
