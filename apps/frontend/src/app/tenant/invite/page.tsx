'use client';
export const dynamic = 'force-dynamic';
/**
 * src/app/tenant/invite/page.tsx
 *
 * PUBLIC — no authentication required.
 * Tenant clicks their invite link: /tenant/invite?token=UUID&unit=UUID
 *
 * Flow:
 *   1. Validate token via GET /api/rental/invite/:token  (public, no auth)
 *   2. Show property preview (unit name, rent, landlord property)
 *   3. If tenant already has account → "Sign In & Activate"
 *   4. If new tenant → "Create Your Account" → /register?token=...&email=...
 *   5. After login/register the app calls POST /api/rental/consume-invite
 *      to link their user account to the tenancy
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import {
  Building2, Loader2, AlertCircle, CheckCircle2,
  Home, DollarSign, Calendar, ShieldCheck, ArrowRight, LogIn, UserPlus,
} from 'lucide-react';

const safeF = (v: any) => Number(v ?? 0).toLocaleString();

// ─────────────────────────────────────────────────────────────────────────────

function InviteContent() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const { user, loading: authLoading } = useAuth();

  const token  = searchParams.get('token')  ?? '';
  const unitId = searchParams.get('unit')   ?? '';

  const [invite,     setInvite]     = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [consuming,  setConsuming]  = useState(false);
  const [consumed,   setConsumed]   = useState(false);

  // ── Step 1: Validate token (no auth needed) ────────────────────────────────
  useEffect(() => {
    if (!token) { setError('Invalid invite link — no token provided.'); setLoading(false); return; }
    fetch(`/api/rental/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (!data.valid) { setError(data.error ?? 'Invalid or expired invite link.'); }
        else { setInvite(data); }
      })
      .catch(() => setError('Could not validate invite. Please try again.'))
      .finally(() => setLoading(false));
  }, [token]);

  // ── Step 2: If already logged in, auto-consume ────────────────────────────
  useEffect(() => {
    if (!authLoading && user && invite && !consumed) {
      consumeInvite();
    }
  }, [authLoading, user, invite]);

  const consumeInvite = async () => {
    if (!token || consumed) return;
    setConsuming(true);
    try {
      await api.post('/api/rental/consume-invite', { tenancy_id: token });
      setConsumed(true);
      setTimeout(() => router.push('/tenant/dashboard'), 1500);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Could not activate tenancy. Please contact your landlord.');
    } finally { setConsuming(false); }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading || authLoading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={32} />
    </div>
  );

  // ── Invalid link ─────────────────────────────────────────────────────────
  if (error && !invite) return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <AlertCircle size={28} className="text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-black uppercase mb-2">Invalid Invite Link</h1>
          <p className="text-zinc-500 text-sm">{error}</p>
        </div>
        <p className="text-zinc-600 text-xs">Contact your landlord to generate a new invite link.</p>
      </div>
    </div>
  );

  // ── Activated success ─────────────────────────────────────────────────────
  if (consumed) return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mx-auto">
          <CheckCircle2 size={28} className="text-teal-400" />
        </div>
        <div>
          <h1 className="text-xl font-black uppercase mb-2">Tenancy Activated!</h1>
          <p className="text-zinc-500 text-sm">Redirecting you to your dashboard…</p>
        </div>
        <Loader2 className="animate-spin text-teal-500 mx-auto" size={20} />
      </div>
    </div>
  );

  // ── Main invite view ──────────────────────────────────────────────────────
  const registerUrl = `/register?token=${token}&unit=${unitId}&email=${encodeURIComponent(invite?.tenant_email ?? '')}&role=TENANT`;
  const loginUrl    = `/login?redirect=${encodeURIComponent(`/tenant/invite?token=${token}&unit=${unitId}`)}`;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">

      {/* Header bar */}
      <div className="border-b border-zinc-900 bg-black/80 px-6 py-3 flex items-center gap-3">
        <div className="w-6 h-6 bg-teal-500 rounded-md flex items-center justify-center">
          <span className="text-black font-black text-[9px]">NA</span>
        </div>
        <span className="font-black uppercase text-xs tracking-widest text-white">Nested Ark OS</span>
        <span className="ml-auto text-[9px] text-zinc-600 font-mono uppercase tracking-widest">Tenant Invite Portal</span>
      </div>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full space-y-6">

          {/* Welcome badge */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mx-auto">
              <Home size={28} className="text-teal-400" />
            </div>
            <p className="text-[10px] text-teal-500 uppercase font-black tracking-[0.2em]">You've been invited</p>
            <h1 className="text-2xl font-black uppercase tracking-tight">Welcome, {invite?.tenant_name?.split(' ')[0]}!</h1>
            <p className="text-zinc-500 text-sm">Your landlord has reserved a unit for you on Nested Ark OS.</p>
          </div>

          {/* Property preview card */}
          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/30 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
                <Building2 size={18} className="text-teal-500" />
              </div>
              <div>
                <p className="font-black uppercase text-sm">{invite?.unit_name}</p>
                <p className="text-zinc-500 text-xs">{invite?.project_title}</p>
                {invite?.location && (
                  <p className="text-zinc-600 text-[10px] mt-0.5">{invite.location}{invite.country ? `, ${invite.country}` : ''}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-zinc-800/50">
                <p className="text-[8px] text-zinc-500 uppercase font-bold mb-1 flex items-center gap-1"><DollarSign size={8}/> Monthly Rent</p>
                <p className="font-mono font-black text-teal-400 text-sm">{invite?.currency ?? 'NGN'} {safeF(invite?.rent_amount)}</p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-800/50">
                <p className="text-[8px] text-zinc-500 uppercase font-bold mb-1 flex items-center gap-1"><Calendar size={8}/> Frequency</p>
                <p className="font-bold text-sm capitalize">{invite?.payment_frequency ?? 'Monthly'}</p>
              </div>
              {invite?.bedrooms > 0 && (
                <div className="p-3 rounded-xl bg-zinc-800/50">
                  <p className="text-[8px] text-zinc-500 uppercase font-bold mb-1">Bedrooms</p>
                  <p className="font-bold text-sm">{invite.bedrooms} BR</p>
                </div>
              )}
              {invite?.security_deposit > 0 && (
                <div className="p-3 rounded-xl bg-zinc-800/50">
                  <p className="text-[8px] text-zinc-500 uppercase font-bold mb-1">Security Deposit</p>
                  <p className="font-mono font-bold text-sm">{invite?.currency ?? 'NGN'} {safeF(invite?.security_deposit)}</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[9px] text-zinc-600 pt-1 border-t border-zinc-800">
              <ShieldCheck size={10} className="text-teal-500" />
              Tenancy secured by SHA-256 hash chain · Nested Ark OS
            </div>
          </div>

          {/* Flex-Pay info */}
          <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/5 text-sm space-y-1">
            <p className="font-bold text-teal-400 text-xs uppercase tracking-widest">Flex-Pay Vault</p>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Instead of paying a large lump sum, Nested Ark lets you contribute weekly, monthly, or quarterly 
              into your personal vault. Your landlord receives payment automatically when your vault fills up.
            </p>
          </div>

          {/* CTA buttons */}
          {consuming ? (
            <div className="flex items-center justify-center gap-2 py-4 text-teal-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm font-bold">Activating your tenancy…</span>
            </div>
          ) : invite?.already_registered ? (
            // Tenant already has an account
            <div className="space-y-3">
              <p className="text-center text-zinc-500 text-xs">You already have a Nested Ark account. Sign in to activate your tenancy.</p>
              <Link href={loginUrl}
                className="flex items-center justify-center gap-2 py-4 bg-teal-500 text-black font-black text-sm uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all">
                <LogIn size={16} /> Sign In & Activate
              </Link>
            </div>
          ) : (
            // New tenant — needs to register
            <div className="space-y-3">
              <Link href={registerUrl}
                className="flex items-center justify-center gap-2 py-4 bg-teal-500 text-black font-black text-sm uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all">
                <UserPlus size={16} /> Create Account & Activate
              </Link>
              <p className="text-center text-zinc-600 text-[10px]">
                Already have an account?{' '}
                <Link href={loginUrl} className="text-teal-500 hover:underline font-bold">Sign In</Link>
              </p>
            </div>
          )}

          <p className="text-center text-zinc-700 text-[9px]">
            This invite is linked to {invite?.tenant_email}. Do not share this link.
          </p>

        </div>
      </main>

      {/* Footer strip */}
      <div className="border-t border-zinc-900 px-6 py-4 flex items-center justify-center gap-5 text-[8px] text-zinc-700 uppercase tracking-widest">
        <span className="flex items-center gap-1"><ShieldCheck size={8} className="text-teal-500"/>Secured</span>
        <span>SHA-256 Ledger</span>
        <span>© 2026 Nested Ark OS</span>
      </div>
    </div>
  );
}

export default function TenantInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    }>
      <InviteContent />
    </Suspense>
  );
}
