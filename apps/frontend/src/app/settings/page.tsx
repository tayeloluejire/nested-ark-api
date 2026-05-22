'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { 
  Sliders, Bell, ShieldAlert, Key, 
  CreditCard, RefreshCw, Layers 
} from 'lucide-react';

export default function GlobalUserSettingsPage() {
  const { user } = useAuth();
  const role = user?.role || 'DEVELOPER';
  const [notif, setNotif] = useState(true);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-16 space-y-8">
        
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
            <Sliders className="text-teal-400" size={22} /> Platform Configurations
          </h1>
          <p className="text-zinc-500 text-xs mt-1">
            Manage your network node variables, notification hooks, and default escrow settlement preferences.
          </p>
        </div>

        <div className="space-y-4">
          
          {/* Security Sub-Panel */}
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-950/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Key size={14} className="text-zinc-500" /> Security Credentials
              </h3>
              <p className="text-zinc-500 text-xs">Enforce tri-layer confirmation algorithms on outbound ledger transactions.</p>
            </div>
            <button className="px-4 py-2 border border-zinc-800 bg-zinc-900 text-zinc-400 font-bold text-[10px] uppercase tracking-wider rounded-xl hover:text-white hover:bg-zinc-800 transition-all">
              Rotate JWT Signature
            </button>
          </div>

          {/* Core Role Bound Logic Card */}
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-950/40 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <CreditCard size={14} className="text-teal-400" /> 
              {role === 'DEVELOPER' ? "Escrow & Settlement Matrix" : "Tenant Rent Reminders"}
            </h3>
            
            {role === 'DEVELOPER' ? (
              <div className="text-xs space-y-2 text-zinc-400">
                <p className="text-zinc-500">Current active configuration rules parsed directly from terminal modules:</p>
                <ul className="space-y-1.5 font-mono text-[10px]">
                  <li className="flex items-center gap-2">🟢 Paystack Escrow Loop: <span className="text-teal-400 font-bold">Main Balance Enabled</span></li>
                  <li className="flex items-center gap-2">🟢 Automated Bank Sweep: <span className="text-teal-400 font-bold">Zenith Bank Node (****8532)</span></li>
                  <li className="flex items-center gap-2">🟢 Payout Check Window: <span className="text-amber-400 font-bold">Cron Loop Active (Every 30m)</span></li>
                </ul>
              </div>
            ) : (
              <div className="text-xs space-y-2 text-zinc-400">
                <p className="text-zinc-500">Your configuration preferences for the Flex-Pay micro-contribution engine:</p>
                <div className="flex items-center justify-between py-2 border-t border-zinc-900">
                  <span className="text-zinc-300">Enable Automated SMS/Email Vault Reminder Hooks</span>
                  <input 
                    type="checkbox" 
                    checked={notif} 
                    onChange={() => setNotif(!notif)}
                    className="accent-teal-500 h-4 w-4 bg-zinc-900 border-zinc-800 rounded"
                  />
                </div>
              </div>
            )}
          </div>

          {/* System Environment Read-Only Audit Row */}
          <div className="p-6 rounded-2xl border border-zinc-900/40 bg-zinc-950/10 flex items-center justify-between text-[10px] text-zinc-600 uppercase font-bold tracking-widest font-mono">
            <span>Core Version: v2.4</span>
            <span>Region: Geo-Aware (NG)</span>
            <span>Ledger Track: Secure</span>
          </div>

        </div>

      </main>
      <Footer />
    </div>
  );
}