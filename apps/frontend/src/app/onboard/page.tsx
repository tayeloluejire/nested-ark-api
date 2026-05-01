'use client';
export const dynamic = 'force-dynamic';
/**
 * /onboard/page.tsx
 * Public landing page for tenant invite links.
 * Redirects tenant to /onboard/[unitId] if unitId is missing from URL.
 * IMPORTANT: actual tenant account creation happens via the landlord-issued
 * invite — the backend API validates the invite token server-side.
 * Tenants CANNOT create their own tenancy from this page.
 */
import { Suspense } from 'react';
import Link from 'next/link';
import { Home, Loader2 } from 'lucide-react';

function OnboardLanding() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-6">
      <div className="text-center space-y-6 max-w-md">
        <Home className="text-teal-500 mx-auto" size={48}/>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Tenant Onboarding</h1>
          <p className="text-zinc-500 text-sm mt-2">
            You need a landlord-issued invite link to continue.
            Check your email for a link in the format:
          </p>
          <p className="mt-2 font-mono text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 inline-block">
            /onboard/[unit-id]
          </p>
        </div>
        <Link href="/login"
          className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all">
          Go to Login
        </Link>
      </div>
    </div>
  );
}

export default function OnboardPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={28}/></div>}>
      <OnboardLanding/>
    </Suspense>
  );
}
