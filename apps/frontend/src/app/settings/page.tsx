'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { 
  Sliders, Shield, RefreshCw, SlidersHorizontal, 
  ToggleLeft, ToggleRight, Database, BellRing, 
  HelpCircle, AlertTriangle, CheckCircle, Save
} from 'lucide-react';

export default function WorldClassSettingsConsole() {
  const { user } = useAuth();
  const role = user?.role || 'DEVELOPER';

  // --- Interactive State Matrix ---
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Core Yield Controls
  const [cronInterval, setCronInterval] = useState('30'); // 30 mins, 1 hour, 12 hours, 24 hours
  const [escrowMode, setEscrowMode] = useState('MAIN_BALANCE'); // MAIN_BALANCE vs SUBACCOUNT_SPLIT
  const [autoSweep, setAutoSweep] = useState(true);
  const [bearerCover, setBearerCover] = useState('PLATFORM'); // PLATFORM vs TENANT

  // Communication Hooks
  const [smsReminders, setSmsReminders] = useState(true);
  const [overdueEscalation, setOverdueEscalation] = useState(true);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    // Mimic enterprise infrastructure updating window
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-900">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <SlidersHorizontal className="text-teal-400" size={24} /> Infrastructure Parameters
            </h1>
            <p className="text-zinc-500 text-xs mt-1">
              Adjust transaction intervals, modify platform ledger variables, and configure direct bank sweeps.
            </p>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Commiting Changes...
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle size={14} />
                Ledger Config Updated!
              </>
            ) : (
              <>
                <Save size={14} />
                Save Configurations
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT/MID PANELS: Tweakable Knobs */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 1. Automated Payout Sweep Configuration */}
            <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-950/40 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200">Payout & Settlement Timing</h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Control how quickly cleared funds are wired out to Zenith Bank.</p>
                </div>
                <button 
                  onClick={() => setAutoSweep(!autoSweep)}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  {autoSweep ? (
                    <span className="text-teal-400 flex items-center gap-1 text-[10px] font-bold bg-teal-500/5 px-2 py-1 rounded-md border border-teal-500/10">
                      AUTOMATED CRON SWEEP ACTIVE
                    </span>
                  ) : (
                    <span className="text-zinc-500 flex items-center gap-1 text-[10px] font-bold bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800">
                      MANUAL RELEASES ONLY
                    </span>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Cron Execution Interval</label>
                  <select 
                    value={cronInterval}
                    onChange={(e) => setCronInterval(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-zinc-300 focus:outline-none focus:border-teal-500"
                  >
                    <option value="30">Every 30 Minutes (Aggressive)</option>
                    <option value="60">Every 1 Hour (Standard)</option>
                    <option value="720">Every 12 Hours (Delayed Sweep)</option>
                    <option value="1440">Every 24 Hours (Daily Bulk Batch)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Bearer of Gateway Transaction Fees</label>
                  <select 
                    value={bearerCover}
                    onChange={(e) => setBearerCover(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-zinc-300 focus:outline-none focus:border-teal-500"
                  >
                    <option value="PLATFORM">Platform Absorbs Fees (1.5% Bearer Account)</option>
                    <option value="TENANT">Pass Gateway Fees to Tenant Checkout Portal</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Gateway Escrow Routing Architectures */}
            <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-950/40 space-y-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200">Escrow Core Routing Mode</h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">Toggle between platform pool consolidation or isolated vendor subaccount splits.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div 
                  onClick={() => setEscrowMode('MAIN_BALANCE')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${escrowMode === 'MAIN_BALANCE' ? 'border-teal-500/30 bg-teal-500/5' : 'border-zinc-900 bg-zinc-950 hover:border-zinc-800'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Main Balance Escrow</span>
                    <input type="radio" checked={escrowMode === 'MAIN_BALANCE'} readOnly className="accent-teal-500" />
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-2">Funds accumulate in main balance and clear natively using your background 30-min cron loop. (Recommended)</p>
                </div>

                <div 
                  onClick={() => setEscrowMode('SUBACCOUNT_SPLIT')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${escrowMode === 'SUBACCOUNT_SPLIT' ? 'border-amber-500/30 bg-amber-500/5' : 'border-zinc-900 bg-zinc-950 hover:border-zinc-800'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300">Direct Subaccount Splits</span>
                    <input type="radio" checked={escrowMode === 'SUBACCOUNT_SPLIT'} readOnly className="accent-amber-500" />
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-2">Utilize Paystack inline vendor split mechanics directly on checkout initialization rules.</p>
                </div>
              </div>
            </div>

            {/* 3. Communication and Automation Automation */}
            <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-950/40 space-y-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200">Notification & Alert Automation</h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">Define automated client interaction rules for upcoming and overdue collections.</p>
              </div>

              <div className="divide-y divide-zinc-900 text-xs">
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <p className="font-bold text-zinc-300">Automated SMS Vault Reminders</p>
                    <p className="text-[10px] text-zinc-500">Fires multi-channel messaging 7 days prior to tenant next due date schedules.</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={smsReminders} 
                    onChange={() => setSmsReminders(!smsReminders)}
                    className="accent-teal-500 h-4 w-4 bg-zinc-900 border-zinc-800 rounded"
                  />
                </div>

                <div className="flex items-center justify-between py-3 pt-4">
                  <div className="space-y-0.5">
                    <p className="font-bold text-zinc-300">Instant Litigation Pre-Notice Routing</p>
                    <p className="text-[10px] text-zinc-500">Spawns structural legal warnings inside tenant dashboard panels if overdue status exceeds 14 days.</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={overdueEscalation} 
                    onChange={() => setOverdueEscalation(!overdueEscalation)}
                    className="accent-teal-500 h-4 w-4 bg-zinc-900 border-zinc-800 rounded"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT PANEL: Live Read-Only Telemetry Logs */}
          <div className="space-y-6">
            
            <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-950/20 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Database size={14} className="text-zinc-500" /> Network Node Metadata
              </h3>
              
              <div className="space-y-2.5 font-mono text-[10px] text-zinc-500">
                <div className="flex justify-between py-1.5 border-b border-zinc-900">
                  <span>Core Node Version</span>
                  <span className="text-white font-bold">v2.4-Stable</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-zinc-900">
                  <span>Geographic Zone</span>
                  <span className="text-teal-400 font-bold">Lagos, Nigeria (NG)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-zinc-900">
                  <span>Ledger State</span>
                  <span className="text-teal-400 font-bold">SHA-256 Chain Locked</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span>Active Destination</span>
                  <span className="text-white truncate max-w-[140px]">Zenith ****8532</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-500/80 leading-relaxed font-medium">
                  Modifying the Escrow Core Routing Mode switches live gateway variables instantly. Ensure active balances match transaction volumes before modifying production routing fields.
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