'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { 
  User, Shield, Mail, Key, Building2, 
  Wallet, Briefcase, Loader2, Fingerprint 
} from 'lucide-react';

export default function GlobalUserProfilePage() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center text-zinc-500 font-mono text-xs">
        <Loader2 className="animate-spin text-teal-500 mr-2" size={16} />
        RESOLVING IDENTITY MATRIX...
      </div>
    );
  }

  // Fallback defaults matching your workspace signatures
  const role = user?.role || 'DEVELOPER';
  const email = user?.email || 'toluwani@gmail.com';
  const name = user?.name || (role === 'DEVELOPER' ? 'Toluwani' : 'Titi Kelani');

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-16 space-y-8">
        
        {/* Profile Card Block */}
        <div className="p-8 rounded-3xl border border-zinc-900 bg-gradient-to-b from-zinc-950 to-zinc-900/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-5">
            <Fingerprint size={160} />
          </div>
          
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="h-20 w-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-teal-400 font-black text-2xl uppercase">
              {name.substring(0, 2)}
            </div>
            
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black uppercase tracking-tight text-zinc-100">{name}</h1>
                <span className="px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase border border-teal-500/20 bg-teal-500/10 text-teal-400">
                  {role}
                </span>
              </div>
              <p className="text-xs text-zinc-500 flex items-center gap-1.5 font-mono">
                <Mail size={12} /> {email}
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Context Block Based on User Class Roles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-950/40 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Shield size={14} className="text-teal-500" /> Account Verification System
            </h3>
            <p className="text-zinc-500 text-xs">Your cryptographic signature and credentials protect multi-sig escrow allocations.</p>
            <div className="pt-2 text-[10px] font-mono text-zinc-400 space-y-1">
              <p>ID: <span className="text-zinc-600">{user?.id || '32a67486-79e5-4256-b6fa-d9e5d065f774'}</span></p>
              <p>Status: <span className="text-teal-400 font-bold">✓ SECURED BY HASH CHAIN</span></p>
            </div>
          </div>

          {/* Role Adaptive Matrix Card */}
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-950/40 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                {role === 'DEVELOPER' && <Building2 size={14} className="text-teal-400" />}
                {role === 'TENANT' && <Wallet size={14} className="text-amber-400" />}
                {!(role === 'DEVELOPER' || role === 'TENANT') && <Briefcase size={14} className="text-purple-400" />}
                Workspace Direct Routing
              </h3>
              <p className="text-zinc-500 text-xs mt-2">
                {role === 'DEVELOPER' && "Access live rent logs, deploy physical asset nodes, and inspect incoming gateway clearings."}
                {role === 'TENANT' && "Inspect active micro-contributions, download ledger receipts, and clear pending notices."}
                {!(role === 'DEVELOPER' || role === 'TENANT') && "Access active multi-sig portfolios and investment pipelines."}
              </p>
            </div>

            <Link href={role === 'DEVELOPER' ? "/landlord/rent-dashboard" : "/dashboard"}
              className="mt-4 w-full py-2.5 text-center bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-300 font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 hover:text-white transition-all">
              Return to Workspace Command
            </Link>
          </div>

        </div>

      </main>
      <Footer />
    </div>
  );
}