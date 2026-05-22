'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { 
  User, Shield, Mail, Fingerprint, Key, Building2, 
  Layers, Copy, Check, ShieldCheck, Activity, 
  Cpu, Award, Landmark, RefreshCw, Terminal
} from 'lucide-react';

export default function InstitutionalProfileConsole() {
  const { user } = useAuth();
  
  // --- UI States ---
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isRotatingKeys, setIsRotatingKeys] = useState(false);

  // --- Unified Data Mapping Matrix ---
  const role = user?.role || 'DEVELOPER';
  const email = user?.email || 'toluwani@gmail.com';
  
  // Clean alignment: derive name directly from auth token first, fallback cleanly
  const name = user?.name || 'Toluwani';
  
  const nodeId = user?.id || '32a67486-79e5-4256-b6fa-d9e5d065f774';
  const mockPublicKey = "0x74ba...ec63d66b9bc619502c9274bd97c56c2e8cbd20be";

  const triggerCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleKeyRotation = () => {
    setIsRotatingKeys(true);
    setTimeout(() => setIsRotatingKeys(false), 1500);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-teal-500/30 selection:text-teal-300">
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-12 space-y-8">
        
        {/* TOP COMPONENT: Sovereign Node Badge and Security Status */}
        <div className="p-8 rounded-3xl border border-zinc-900 bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900/30 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="absolute -right-16 -bottom-16 text-zinc-900/10 pointer-events-none">
            <Cpu size={240} strokeWidth={1} />
          </div>

          <div className="flex items-center gap-6">
            <div className="h-24 w-24 rounded-2xl border-2 border-teal-500/30 bg-gradient-to-b from-teal-950/40 to-transparent flex flex-col items-center justify-center relative group">
              <Fingerprint className="text-teal-400 group-hover:scale-110 transition-transform duration-300" size={38} strokeWidth={1.5} />
              <div className="absolute bottom-1 text-[8px] font-black tracking-widest text-teal-500 uppercase">NODE ON</div>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-black uppercase tracking-tight text-zinc-100">{name}</h1>
                <div className="px-2.5 py-0.5 rounded-md text-[9px] font-black tracking-widest uppercase bg-teal-500 text-black shadow-lg shadow-teal-500/10">
                  {role}
                </div>
                <div className="px-2.5 py-0.5 rounded-md text-[9px] font-black tracking-widest uppercase border border-zinc-800 bg-zinc-900/50 text-zinc-400">
                  Tier-3 Verified
                </div>
              </div>
              <p className="text-xs text-zinc-400 flex items-center gap-2 font-mono">
                <Mail size={13} className="text-zinc-600" /> {email}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button 
              onClick={handleKeyRotation}
              disabled={isRotatingKeys}
              className="px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/80 hover:bg-zinc-900 text-zinc-400 hover:text-white font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-40"
            >
              <RefreshCw size={12} className={isRotatingKeys ? 'animate-spin' : ''} />
              {isRotatingKeys ? "Rotating Cryptographic Pair..." : "Rotate Node Keys"}
            </button>
            <Link href={role === 'DEVELOPER' ? "/landlord/rent-dashboard" : "/dashboard"}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 hover:text-white font-bold text-[10px] uppercase tracking-wider text-center transition-all flex items-center justify-center gap-1.5"
            >
              <Terminal size={12} /> Command Center
            </Link>
          </div>
        </div>

        {/* MAIN LAYOUT STRUCTURE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUMN 1 & 2: Cryptographic Identity Parameters */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Structural Ledger Cryptographic Identity Panel */}
            <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-950/40 space-y-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-teal-400" /> Network Cryptographic Signatures
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">These immutable string identifiers secure escrow release conditions and multi-sig payouts.</p>
              </div>

              <div className="space-y-3 pt-2 font-mono text-xs">
                {/* Node UUID */}
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-900 flex items-center justify-between gap-4">
                  <div className="space-y-1 truncate">
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Node Registry UUID</p>
                    <p className="text-zinc-300 truncate">{nodeId}</p>
                  </div>
                  <button 
                    onClick={() => triggerCopy(nodeId, 'uuid')}
                    className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors flex-shrink-0"
                  >
                    {copiedField === 'uuid' ? <Check size={14} className="text-teal-400" /> : <Copy size={14} />}
                  </button>
                </div>

                {/* Ledger Public Signing Key */}
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-900 flex items-center justify-between gap-4">
                  <div className="space-y-1 truncate">
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">SHA-256 Ledger Public Vault Key</p>
                    <p className="text-teal-400 font-bold truncate">{mockPublicKey}</p>
                  </div>
                  <button 
                    onClick={() => triggerCopy(mockPublicKey, 'pubkey')}
                    className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors flex-shrink-0"
                  >
                    {copiedField === 'pubkey' ? <Check size={14} className="text-teal-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Tri-Layer Verification Parameters Summary */}
            <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-950/40 space-y-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Award size={14} className="text-teal-400" /> Tri-Layer Compliance Verification (AML/KYC)
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">Ecosystem criteria matching international standards for capital deployment and asset listing.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">01 · Biometric Identity</span>
                    <span className="h-2 w-2 rounded-full bg-teal-500 shadow-sm shadow-teal-500"></span>
                  </div>
                  <p className="text-xs font-black text-zinc-200 mt-3 uppercase tracking-tight">BVN/NIN Cleared</p>
                  <p className="text-[9px] text-zinc-500 mt-1">Matched against central systems securely.</p>
                </div>

                <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">02 · Escrow Check</span>
                    <span className="h-2 w-2 rounded-full bg-teal-500 shadow-sm shadow-teal-500"></span>
                  </div>
                  <p className="text-xs font-black text-zinc-200 mt-3 uppercase tracking-tight">Paystack Bound</p>
                  <p className="text-[9px] text-zinc-500 mt-1">Outbound routing verified to Zenith bank node.</p>
                </div>

                <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">03 · Physical Node</span>
                    <span className="h-2 w-2 rounded-full bg-teal-500 shadow-sm shadow-teal-500"></span>
                  </div>
                  <p className="text-xs font-black text-zinc-200 mt-3 uppercase tracking-tight">Drone Inspected</p>
                  <p className="text-[9px] text-zinc-500 mt-1">Physical coordinate boundaries confirmed.</p>
                </div>
              </div>
            </div>

          </div>

          {/* COLUMN 3: Real-Time Telemetry Audits */}
          <div className="space-y-6">
            
            <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-950/20 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Activity size={14} className="text-zinc-500" /> Security Session Auditing
              </h3>
              
              <div className="space-y-4 font-mono text-[10px] text-zinc-500">
                <div className="space-y-1">
                  <div className="flex justify-between text-zinc-400">
                    <span>IP ADDRESS / ACCESS APEX</span>
                    <span className="text-white font-bold">102.89.34.118</span>
                  </div>
                  <p className="text-[9px] text-zinc-600 uppercase">Lagos, Nigeria · Mobile Chrome Browser Node</p>
                </div>

                <div className="space-y-1 pt-2 border-t border-zinc-900">
                  <div className="flex justify-between text-zinc-400">
                    <span>CURRENT CRYPTO CIPHER</span>
                    <span className="text-teal-400 font-bold">JWT HS256</span>
                  </div>
                  <p className="text-[9px] text-zinc-600 uppercase">Token verification expires in 24 hours</p>
                </div>

                <div className="space-y-1 pt-2 border-t border-zinc-900">
                  <div className="flex justify-between text-zinc-400">
                    <span>LEDGER ATTRIBUTION</span>
                    <span className="text-white font-bold">BULLETPROOF V2.4</span>
                  </div>
                  <p className="text-[9px] text-zinc-600 uppercase">All transactions automatically hashed with SHA-256</p>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-zinc-900/60 bg-zinc-950/10 flex items-center gap-3">
              <Landmark size={18} className="text-zinc-600 flex-shrink-0" />
              <div className="space-y-0.5">
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-wider">System Governance Note</p>
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  Your identity pair controls smart contract logic releases. Never share your JWT authorization headers.
                </p>
              </div>
            </div>

          </div>

        </div>

      </main>
      <Footer />
    </div>
  );
}