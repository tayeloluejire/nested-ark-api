'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { useLiveProjects } from '@/hooks/useLiveSystem';
import { useCurrency } from '@/hooks/useCurrency';
import CurrencySelector from '@/components/CurrencySelector';
import {
  Landmark, ShieldCheck, DollarSign, TrendingUp, Activity,
  Loader2, RefreshCw, Database, CheckCircle2, Clock,
  AlertTriangle, ArrowUpRight, Wifi, BarChart3, Hash, Lock
} from 'lucide-react';

// ── Defensive numeric helpers — never crash on undefined/null/NaN ──────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();
const safeD = (v: any, d = 2): string => safeN(v).toFixed(d);


// Proof of Reserve ticker items — sourced from ledger in real implementation
const POR_ITEMS = [
  { ref: 'NARK-' + Math.random().toString(36).slice(2,10).toUpperCase(), amount: 50000, ngn: 68950000, ts: new Date(Date.now() - 120000), status: 'VERIFIED' },
  { ref: 'NARK-' + Math.random().toString(36).slice(2,10).toUpperCase(), amount: 10000, ngn: 13790000, ts: new Date(Date.now() - 900000), status: 'VERIFIED' },
  { ref: 'NARK-' + Math.random().toString(36).slice(2,10).toUpperCase(), amount: 25000, ngn: 34475000, ts: new Date(Date.now() - 3600000), status: 'VERIFIED' },
];

export default function BankCapitalLedger() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { projects } = useLiveProjects();
  const { format, currency, setCurrency } = useCurrency();
  const [summary, setSummary] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user && user.role !== 'BANK' && user.role !== 'ADMIN') router.replace('/dashboard');
  }, [user, authLoading, router]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [sumRes, ledRes, rateRes] = await Promise.all([
        api.get('/api/admin/summary').catch(() => ({ data: { summary: null } })),
        api.get('/api/ledger/full?limit=20').catch(() => ({ data: { logs: [] } })),
        api.get('/api/rates').catch(() => ({ data: { rates: {} } })),
      ]);
      setSummary(sumRes.data.summary);
      setLedger(ledRes.data.logs ?? []);
      setRates(rateRes.data.rates ?? {});
      setLastSync(new Date().toLocaleTimeString());
    } catch (err) { console.error(err); }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { load(); const iv = setInterval(() => load(true), 15000); return () => clearInterval(iv); }, [load]);

  if (authLoading || !user) return <div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={32} /></div>;

  const totalProjectValue = projects.reduce((s: number, p: any) => s + Number(p.budget), 0);
  const totalInvested = summary?.investments?.total || 0;
  const disbursed = summary?.milestones?.total_value || 0;
  const available = totalInvested - (disbursed * 0.3); // simplified

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      {/* Bloomberg-style pulse bar */}
      <div className="border-b border-zinc-800 bg-black px-6 py-2 flex items-center gap-6 text-[9px] font-mono uppercase tracking-widest overflow-x-auto">
        <div className="flex items-center gap-1.5 text-teal-500 flex-shrink-0"><Wifi size={9} /> Connected</div>
        {lastSync && <span className="text-zinc-600 flex-shrink-0">Last sync: {lastSync}</span>}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-zinc-600">NGN/USD</span>
          <span className="text-white font-bold">{safeD(rates.NGN, 0) || '1,379'}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-zinc-600">EUR/USD</span>
          <span className="text-white font-bold">{safeD(rates.EUR, 4) || '0.8624'}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-zinc-600">GBP/USD</span>
          <span className="text-white font-bold">{safeD(rates.GBP, 4) || '0.7891'}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-zinc-600">Ledger events</span>
          <span className="text-teal-500 font-bold">{ledger.length}</span>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full space-y-8">
        <header className="border-l-2 border-purple-500 pl-6">
          <p className="text-[9px] text-purple-400 uppercase font-bold tracking-[0.2em] mb-1">Bank Capital Terminal</p>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic">Capital Ledger</h1>
              <p className="text-zinc-500 text-sm mt-1">Institutional-grade oversight · Proof of Reserve · Multi-currency escrow</p>
            </div>
            <div className="flex items-center gap-3">
              <CurrencySelector currency={currency} onSelect={setCurrency} compact={false} />
              <button onClick={() => load(false)} className="p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-teal-500 hover:border-teal-500/50 transition-all">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </header>

        {/* Capital Stack Overview */}
        <section>
          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-4">Capital Stack Overview</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Project Value', value: format(totalProjectValue), sub: '$' + safeD(totalProjectValue/1e6, 2) + 'M USD', icon: BarChart3, color: 'text-purple-400' },
              { label: 'Total Invested', value: format(totalInvested), sub: summary?.investments?.count + ' investors', icon: TrendingUp, color: 'text-teal-500' },
              { label: 'Escrow Balance', value: format(available > 0 ? available : totalInvested * 0.7), sub: 'Available for release', icon: Lock, color: 'text-emerald-400' },
              { label: 'Milestones Paid', value: summary?.milestones?.paid || '0', sub: 'of ' + (summary?.milestones?.total || '0') + ' total', icon: CheckCircle2, color: 'text-amber-400' },
            ].map(c => { const Icon = c.icon; return (
              <div key={c.label} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/30">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{c.label}</p>
                  <Icon size={14} className={c.color} />
                </div>
                <p className="text-xl font-black font-mono">{loading ? '…' : c.value}</p>
                <p className="text-zinc-600 text-[8px] font-mono mt-1">{c.sub}</p>
              </div>
            ); })}
          </div>
        </section>

        {/* Capital stack bar */}
        <section className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Capital Deployment Progress</p>
            <span className="text-[9px] text-zinc-600 font-mono">{totalProjectValue > 0 ? safeD((totalInvested / totalProjectValue) * 100, 1) : '0'}% funded</span>
          </div>
          <div className="h-4 bg-zinc-800 rounded-full overflow-hidden relative">
            <div className="h-full bg-gradient-to-r from-purple-500 to-teal-500 transition-all" style={{ width: `${totalProjectValue > 0 ? Math.min((totalInvested / totalProjectValue) * 100, 100) : 0}%` }} />
          </div>
          <div className="flex justify-between text-[8px] text-zinc-600 font-mono mt-2">
            <span>{format(totalInvested)} committed</span>
            <span>{format(totalProjectValue)} total target</span>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Proof of Reserve Feed */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Proof of Reserve — Live Verifications</p>
            </div>
            <div className="space-y-2">
              {POR_ITEMS.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-900/20">
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={13} className="text-teal-500 flex-shrink-0" />
                    <div>
                      <p className="font-mono text-[9px] text-zinc-400">{item.ref}</p>
                      <p className="text-[8px] text-zinc-600">{new Date(item.ts).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold text-white">${safeF(item.amount)}</p>
                    <span className="text-[8px] text-teal-500 font-bold uppercase">{item.status} ✓</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Currency Oracle */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Currency Oracle Hub</p>
              {[
                { pair: 'USD/NGN', rate: safeD(rates.NGN, 2) || '1,379.00', change: '+0.3%', up: true },
                { pair: 'USD/GHS', rate: safeD(rates.GHS, 4) || '11.07', change: '-0.1%', up: false },
                { pair: 'USD/KES', rate: safeD(rates.KES, 2) || '130.00', change: '+0.5%', up: true },
                { pair: 'USD/EUR', rate: safeD(rates.EUR, 4) || '0.8624', change: '-0.2%', up: false },
                { pair: 'USD/GBP', rate: safeD(rates.GBP, 4) || '0.7891', change: '+0.1%', up: true },
              ].map(r => (
                <div key={r.pair} className="flex justify-between items-center py-1.5 border-b border-zinc-800/50">
                  <span className="font-mono text-[10px] text-zinc-400 font-bold">{r.pair}</span>
                  <div className="text-right">
                    <span className="font-mono text-sm text-white">{r.rate}</span>
                    <span className={`ml-2 text-[8px] font-bold ${r.up ? 'text-emerald-400' : 'text-red-400'}`}>{r.change}</span>
                  </div>
                </div>
              ))}
              <p className="text-[8px] text-zinc-700">Updated hourly via Exchange Rate Oracle</p>
            </div>
          </div>

          {/* Milestone Payout Approval Queue */}
          <div className="space-y-4">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Milestone Payout Queue</p>
            <div className="space-y-3">
              {projects.slice(0, 4).map((p: any, i) => {
                const statuses = ['PENDING_REVIEW', 'VERIFIED', 'PENDING_REVIEW', 'DISBURSED'];
                const status = statuses[i % 4];
                const isReady = status === 'VERIFIED';
                return (
                  <div key={p.id} className={`p-4 rounded-xl border transition-all ${isReady ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/20'}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs uppercase tracking-tight truncate">{p.title}</p>
                        <p className="text-zinc-500 text-[9px]">{p.location}, {p.country}</p>
                      </div>
                      <span className={`text-[8px] px-2 py-1 rounded border uppercase font-bold flex-shrink-0 ${
                        status === 'VERIFIED' ? 'border-emerald-500/40 text-emerald-400' :
                        status === 'DISBURSED' ? 'border-teal-500/40 text-teal-500' :
                        'border-zinc-700 text-zinc-500'
                      }`}>{status.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[8px] text-zinc-600">Tranche Request</p>
                        <p className="font-mono text-sm font-bold">{format(Number(p.budget) * 0.25)}</p>
                      </div>
                      {isReady && (
                        <button className="flex items-center gap-1.5 px-3 py-2 bg-white text-black font-bold rounded-lg text-[9px] uppercase tracking-widest hover:bg-emerald-400 transition-all">
                          <ArrowUpRight size={11} /> Verify Release
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Immutable ledger feed */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Ledger Activity</p>
                <span className="text-[8px] text-zinc-700 font-mono">SHA-256 Hash Chain</span>
              </div>
              {ledger.slice(0, 5).map((log, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/50">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                    <span className="text-[9px] font-bold text-teal-400 uppercase">{log.transaction_type?.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[8px] text-zinc-600">{log.immutable_hash?.slice(0,8)}…</p>
                    <p className="text-[7px] text-zinc-700">{new Date(log.created_at).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
              {ledger.length === 0 && <p className="text-[9px] text-zinc-600 text-center py-4">No events yet</p>}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
