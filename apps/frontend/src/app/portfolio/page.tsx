'use client';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, canAccess } from '@/lib/AuthContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCurrency } from '@/hooks/useCurrency';
import api from '@/lib/api';
import {
  TrendingUp, Shield, Wallet, DollarSign, Loader2, RefreshCw,
  ExternalLink, CheckCircle2, Download, CreditCard, Activity,
  ArrowUpRight, Lock, Building2, Wifi, AlertTriangle, ShieldCheck,
  BadgeCheck, BarChart3
} from 'lucide-react';
import InvestmentCertificate from '@/components/InvestmentCertificate';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Summary {
  total_invested_ngn:        number;
  estimated_earnings_ngn:    number;
  available_to_withdraw_ngn: number;
  escrow_held_ngn:           number;   // backend key
  portfolio_value_ngn:       number;   // total_invested + estimated_earnings
  active_positions:          number;
  milestones_paid:           number;
  kyc_status:                string;
  roi_rate:                  number;
}

interface Investment {
  id: string;
  project_id: string;
  amount: number;
  status: string;
  created_at: string;
  project_title: string;
  location: string;
  country: string;
  project_budget: number;
  expected_roi: number;
  timeline_months: number;
}

interface Payment {
  id: string;
  amount_ngn: number;
  status: string;
  created_at: string;
  paid_at?: string;
  project_title: string;
  paystack_reference: string;
  payment_channel?: string;
  channel?: string;          // backend may return either key
}

// ── Formatters ─────────────────────────────────────────────────────────────────
function fmtNgn(raw: any): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || isNaN(n) || n === 0) return '₦0';
  if (n > 0 && n < 100)       return `₦${n.toFixed(2)}`;   // sub-₦100: show paise (tiny daily accruals)
  if (n >= 1_000_000_000)     return `₦${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)         return `₦${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)             return `₦${(n / 1_000).toFixed(1)}k`;
  return `₦${Math.round(n).toLocaleString()}`;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)     return `${Math.floor(diff / 1_000)}s ago`;
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Client-side ticking earnings ──────────────────────────────────────────────
// The server gives a snapshot of earnings at the moment of the API call.
// We then add per-second micro-accruals on the client so the display
// ticks up visibly between the 30-second API refreshes.
// Formula: totalInvested × (roi/100) / secondsPerYear
function useTickingEarnings(baseEarnings: number, totalInvested: number, roiRate: number) {
  const [earnings, setEarnings] = useState(baseEarnings);
  const baseRef   = useRef(baseEarnings);
  const timeRef   = useRef(Date.now());

  // When the server gives us a new base, reset the clock
  useEffect(() => {
    baseRef.current = baseEarnings;
    timeRef.current = Date.now();
    setEarnings(baseEarnings);
  }, [baseEarnings]);

  useEffect(() => {
    if (totalInvested <= 0) return;
    const perSecond = totalInvested * (roiRate / 100) / 31_536_000;
    const iv = setInterval(() => {
      const elapsed = (Date.now() - timeRef.current) / 1000;
      setEarnings(baseRef.current + perSecond * elapsed);
    }, 1000);
    return () => clearInterval(iv);
  }, [totalInvested, roiRate]);

  return earnings;
}

// ── Withdrawal modal ──────────────────────────────────────────────────────────
function WithdrawModal({ available, onClose }: { available: number; onClose: () => void }) {
  const [form, setForm] = useState({ bank_name: '', account_number: '', account_name: '', amount: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err,  setErr]  = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0)  { setErr('Enter a valid amount'); return; }
    if (amt > available)   { setErr(`Max available: ${fmtNgn(available)}`); return; }
    setBusy(true); setErr('');
    try {
      await api.post('/api/escrow/withdraw', {
        amount: amt, bank_name: form.bank_name,
        account_number: form.account_number, account_name: form.account_name,
      });
      setDone(true);
    } catch (ex: any) {
      setErr(ex?.response?.data?.error ?? 'Request failed — try again.');
    } finally { setBusy(false); }
  };

  if (done) return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-950 border border-teal-500/30 rounded-3xl p-8 text-center space-y-5">
        <div className="relative mx-auto w-16 h-16">
          <div className="absolute inset-0 rounded-full bg-teal-500/10 animate-ping" />
          <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-teal-500/20 border-2 border-teal-500/40">
            <CheckCircle2 className="text-teal-500" size={28} />
          </div>
        </div>
        <h3 className="text-xl font-black uppercase">Request Submitted</h3>
        <p className="text-zinc-400 text-sm">Funds will be transferred within 1–3 business days via Paystack Transfer.</p>
        <button onClick={onClose} className="w-full py-3 bg-white text-black font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-teal-500 transition-all">Done</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-8 space-y-5">
        <div>
          <h3 className="text-xl font-bold uppercase">Withdraw Earnings</h3>
          <p className="text-zinc-500 text-xs mt-1">Available: <span className="text-teal-500 font-bold">{fmtNgn(available)}</span></p>
        </div>
        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[10px] text-amber-400 font-bold uppercase tracking-widest flex items-start gap-2">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          Principal locked until project tenure ends. Only realized earnings are withdrawable.
        </div>
        <form onSubmit={submit} className="space-y-3">
          {[
            { key: 'bank_name',      ph: 'Bank Name (e.g. Access Bank)' },
            { key: 'account_number', ph: 'Account Number — 10-digit NUBAN', max: 10 },
            { key: 'account_name',   ph: 'Account Name (as registered with bank)' },
          ].map(f => (
            <input key={f.key} required value={(form as any)[f.key]}
              onChange={e => setForm({ ...form, [f.key]: e.target.value })}
              placeholder={f.ph} maxLength={f.max}
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500" />
          ))}
          <input required type="number" value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })}
            placeholder={`Amount (NGN) — max ${fmtNgn(available)}`} max={available}
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500" />
          {err && <p className="text-red-400 text-xs font-bold">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={busy}
              className="flex-1 py-4 bg-white text-black font-bold uppercase text-xs tracking-widest rounded-xl hover:bg-teal-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {busy ? <Loader2 className="animate-spin" size={14} /> : <><ArrowUpRight size={12} /> Request Payout</>}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-4 border border-zinc-700 text-zinc-400 font-bold uppercase text-xs rounded-xl hover:text-white">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Inline ROI calculator ─────────────────────────────────────────────────────
function RoiCalc({ roiRate }: { roiRate: number }) {
  const [amount, setAmount] = useState(50_000);
  const earn6m  = Math.round(amount * (roiRate / 100) * 0.5);
  const earnAnn = Math.round(amount * (roiRate / 100));
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Investment Amount (NGN)</p>
        <p className="font-mono text-teal-500 font-bold">₦{amount.toLocaleString()}</p>
      </div>
      <input type="range" min={5_000} max={5_000_000} step={5_000} value={amount}
        onChange={e => setAmount(Number(e.target.value))} className="w-full accent-teal-500" />
      <div className="flex justify-between text-[9px] text-zinc-600 font-mono">
        <span>₦5,000</span><span>₦5,000,000</span>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
          <p className="text-[9px] text-zinc-500 uppercase font-bold">6-month Yield</p>
          <p className="font-mono text-teal-400 font-black text-lg mt-1">+₦{earn6m.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
          <p className="text-[9px] text-zinc-500 uppercase font-bold">Annual ROI</p>
          <p className="font-mono text-white font-black text-lg mt-1">+{roiRate}% Est.</p>
        </div>
      </div>
      <Link href="/investments"
        className="flex items-center justify-center gap-2 w-full py-3 bg-white text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-teal-500 transition-all mt-1">
        <TrendingUp size={12} /> Fund a Project
      </Link>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { format } = useCurrency();

  const [summary,      setSummary]      = useState<Summary | null>(null);
  const [investments,  setInvestments]  = useState<Investment[]>([]);
  const [payments,     setPayments]     = useState<Payment[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [lastSync,     setLastSync]     = useState('');
  const [autoRefresh,  setAutoRefresh]  = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!authLoading && !user)                                   { router.replace('/login'); return; }
    if (!authLoading && user && !canAccess(user.role, '/portfolio')) router.replace('/dashboard');
  }, [user, authLoading, router]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Promise.allSettled — resilient: one failure won't blank the whole page
      const [s, inv, pay] = await Promise.allSettled([
        api.get('/api/portfolio/summary'),
        api.get('/api/investments/my'),
        api.get('/api/payments/history'),
      ]);
      if (s.status   === 'fulfilled') setSummary(s.value.data.summary);
      if (inv.status === 'fulfilled') setInvestments(inv.value.data.investments ?? []);
      if (pay.status === 'fulfilled') setPayments(pay.value.data.transactions   ?? []);
      setLastSync(new Date().toLocaleTimeString());
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!autoRefresh) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => load(true), 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, load]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const totalNgn     = Number(summary?.total_invested_ngn        ?? 0);
  const baseEarnings = Number(summary?.estimated_earnings_ngn    ?? 0);
  const availableNgn = Number(summary?.available_to_withdraw_ngn ?? 0);
  const escrowHeld   = Number(summary?.escrow_held_ngn           ?? 0);
  const roiRate      = Number(summary?.roi_rate                  ?? 12);
  const positions    = Number(summary?.active_positions          ?? investments.length);
  const milestonesPd = Number(summary?.milestones_paid           ?? 0);
  const kycStatus    = summary?.kyc_status ?? 'NOT_SUBMITTED';
  const kycVerified  = kycStatus === 'VERIFIED';

  // Live ticking earnings — adds per-second micro-accruals between API calls
  const earningsNgn = useTickingEarnings(baseEarnings, totalNgn, roiRate);
  const portfolioValue = totalNgn + earningsNgn;

  // ── Loading guard ───────────────────────────────────────────────────────────
  if (authLoading || !user) return (
    <div className="h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      {showWithdraw && (
        <WithdrawModal
          available={availableNgn}
          onClose={() => { setShowWithdraw(false); load(true); }}
        />
      )}

      <Navbar />

      {/* Live system pulse bar */}
      <div className="border-b border-zinc-800 bg-black px-6 py-2 flex items-center gap-5 text-[9px] font-mono uppercase tracking-widest overflow-x-auto">
        <span className="flex items-center gap-1.5 text-teal-500 flex-shrink-0">
          <Wifi size={8} className="animate-pulse" /> Portfolio Live
        </span>
        {lastSync && <span className="text-zinc-600 flex-shrink-0">Synced {lastSync}</span>}
        <button
          onClick={() => setAutoRefresh(v => !v)}
          className={`flex items-center gap-1 flex-shrink-0 transition-colors ${autoRefresh ? 'text-teal-500' : 'text-zinc-600 hover:text-white'}`}
        >
          <Activity size={8} /> {autoRefresh ? 'Live' : 'Paused'}
        </button>
        <span className="text-zinc-400 flex-shrink-0">{positions} position{positions !== 1 ? 's' : ''}</span>
        <span className={`flex items-center gap-1.5 flex-shrink-0 font-bold ${kycVerified ? 'text-teal-500' : 'text-amber-400'}`}>
          {kycVerified ? <BadgeCheck size={8} /> : <AlertTriangle size={8} />}
          KYC: {kycStatus}
          {!kycVerified && (
            <Link href="/kyc" className="underline ml-1 hover:text-white">Verify →</Link>
          )}
        </span>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full space-y-10">

        {/* Header */}
        <header className="border-l-2 border-teal-500 pl-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[9px] text-teal-500 uppercase font-bold tracking-[0.2em] mb-1">Investor Command</p>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic">My Portfolio</h1>
            <p className="text-zinc-500 text-sm mt-1">Welcome, {user.full_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(v => !v)}
              className={`p-2 rounded-lg border transition-all ${autoRefresh ? 'border-teal-500/40 text-teal-500' : 'border-zinc-800 text-zinc-500'}`}
            >
              <Activity size={14} />
            </button>
            <button onClick={() => load(false)} disabled={loading}
              className="p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-teal-500 transition-all">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {/* Capital Cards */}
        {loading && !summary
          ? <div className="py-10 text-center"><Loader2 className="animate-spin text-teal-500 mx-auto" size={28} /></div>
          : (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {/* Portfolio Value — ticks up every second */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 relative overflow-hidden">
              <div className="absolute top-3 right-3 opacity-5"><TrendingUp size={44} /></div>
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-[0.2em] mb-1">Portfolio Value</p>
              <p className="text-2xl font-black font-mono tabular-nums">{fmtNgn(portfolioValue)}</p>
              <p className="text-[10px] text-zinc-600 mt-1">Escrow secured</p>
              {totalNgn > 0 && (
                <p className="text-[9px] text-zinc-500 mt-0.5">{format(totalNgn / 1379)} USD equiv.</p>
              )}
            </div>

            {/* Realized Earnings — ticks up every second */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 relative overflow-hidden">
              <div className="absolute top-3 right-3 opacity-5"><DollarSign size={44} /></div>
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-[0.2em] mb-1">
                Realized Earnings ({roiRate}%)
              </p>
              <p className="text-2xl font-black font-mono text-teal-400 tabular-nums">
                {earningsNgn > 0 ? `+${fmtNgn(earningsNgn)}` : '₦0'}
              </p>
              <p className="text-[10px] text-zinc-600 mt-1">Above inflation yield</p>
              <p className="text-[9px] text-zinc-500 mt-0.5">6-month accrual on committed capital</p>
            </div>

            {/* Available Liquidity */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 relative overflow-hidden">
              <div className="absolute top-3 right-3 opacity-5"><Wallet size={44} /></div>
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-[0.2em] mb-1">Available Liquidity</p>
              <p className="text-2xl font-black font-mono text-emerald-400">{fmtNgn(availableNgn)}</p>
              <p className="text-[10px] text-zinc-600 mt-1">Ready for withdrawal</p>
              <button
                onClick={() => kycVerified ? setShowWithdraw(true) : router.push('/kyc')}
                className="mt-3 px-4 py-1.5 bg-white text-black font-bold text-[9px] uppercase tracking-widest rounded-lg hover:bg-teal-500 transition-all"
              >
                {kycVerified ? 'Withdraw' : 'Verify KYC first'}
              </button>
            </div>

            {/* Escrow Secured */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 relative overflow-hidden">
              <div className="absolute top-3 right-3 opacity-5"><Shield size={44} /></div>
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-[0.2em] mb-1">Escrow Secured</p>
              <p className="text-2xl font-black font-mono text-teal-500">{fmtNgn(escrowHeld)}</p>
              <p className="text-[10px] text-zinc-600 mt-1">Tri-layer verified escrow</p>
              <p className="text-[9px] text-zinc-500 mt-0.5">{milestonesPd} milestone{milestonesPd !== 1 ? 's' : ''} paid out</p>
            </div>

          </section>
        )}

        {/* ROI Calculator */}
        <section className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 max-w-xl">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
            <BarChart3 size={12} className="text-teal-500" /> ROI Calculator
          </h3>
          <RoiCalc roiRate={roiRate} />
        </section>

        {/* Active Positions */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
            <Activity size={14} className="text-teal-500" /> My Active Positions ({investments.length})
          </h2>

          {loading && investments.length === 0 && (
            <div className="py-8 text-center">
              <Loader2 className="animate-spin text-teal-500 mx-auto" size={20} />
            </div>
          )}

          {!loading && investments.length === 0 && (
            <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
              <Lock className="text-zinc-700 mx-auto" size={32} />
              <p className="text-zinc-500 text-sm">No active positions yet</p>
              <Link href="/investments"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-teal-500 transition-all">
                <TrendingUp size={12} /> Browse Investment Nodes
              </Link>
            </div>
          )}

          {investments.map(inv => {
            const principal = Number(inv.amount);
            const roiPct    = Number(inv.expected_roi) || roiRate;
            const tenure    = Number(inv.timeline_months) || 24;
            const elapsed   = Math.max(0, Math.floor(
              (Date.now() - new Date(inv.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30.5)
            ));
            const progress  = Math.min((elapsed / tenure) * 100, 100);
            const remaining = Math.max(tenure - elapsed, 0);
            const estYield  = Math.round(principal * (roiPct / 100) * 0.5); // 6-month est.

            return (
              <div key={inv.id} className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 transition-all">
                <div className="flex flex-col md:flex-row gap-6 justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold uppercase tracking-tight">{inv.project_title ?? 'Project'}</h3>
                      <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${
                        inv.status === 'COMMITTED' ? 'border-teal-500/40 text-teal-500' : 'border-zinc-700 text-zinc-500'
                      }`}>{inv.status}</span>
                    </div>
                    {inv.location && (
                      <p className="text-zinc-500 text-xs">{inv.location}, {inv.country}</p>
                    )}
                    {/* Tenure progress bar */}
                    <div className="mt-4 space-y-1">
                      <div className="flex justify-between text-[9px] text-zinc-500 uppercase font-bold">
                        <span>Tenure — {elapsed}mo elapsed</span>
                        <span>{remaining}mo of {tenure}mo remaining</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3 min-w-[180px] flex-shrink-0">
                    <div className="text-right">
                      <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Committed (NGN)</p>
                      <p className="font-mono text-xl font-bold">{fmtNgn(principal)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Est. Yield ({roiPct}% p.a.)</p>
                      <p className="font-mono text-teal-400 font-bold">+{fmtNgn(estYield)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/projects/${inv.project_id}`}
                        className="flex items-center gap-1 px-3 py-2 border border-zinc-700 text-zinc-400 font-bold rounded-lg text-[9px] uppercase hover:text-teal-500 hover:border-teal-500/40 transition-all">
                        <ExternalLink size={10} /> Pitch
                      </Link>
                      <InvestmentCertificate
                        investment={{
                          id: inv.id,
                          amount: inv.amount,
                          created_at: inv.created_at,
                          project_title: inv.project_title ?? 'Infrastructure Project',
                          project_id: inv.project_id,
                          status: inv.status,
                        }}
                        ledgerHash={''}
                        investorName={user.full_name ?? 'Investor'}
                        roiRate={Number(inv.expected_roi) || roiRate}
                        projectNumber={(inv as any).project_number}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Payment History */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
            <CreditCard size={14} className="text-teal-500" /> Payment History
          </h2>
          <div className="rounded-2xl border border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[560px]">
                <thead className="bg-zinc-900 text-zinc-500 uppercase text-[9px] tracking-widest">
                  <tr>
                    {['Date', 'Project', 'Amount (NGN)', 'Channel', 'Status', 'Reference'].map(h => (
                      <th key={h} className="px-5 py-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {payments.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-zinc-600">No payment history yet</td></tr>
                  )}
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="px-5 py-4 text-zinc-400 font-mono text-[10px]">
                        {new Date(p.paid_at ?? p.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-white font-bold uppercase text-[10px] max-w-[130px] truncate">
                        {p.project_title ?? '—'}
                      </td>
                      <td className="px-5 py-4 font-mono text-white">₦{Number(p.amount_ngn).toLocaleString()}</td>
                      <td className="px-5 py-4 text-zinc-500 uppercase text-[9px]">
                        {p.payment_channel ?? p.channel ?? 'Paystack'}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${
                          p.status === 'SUCCESS' ? 'border-teal-500/40 text-teal-500' :
                          p.status === 'PENDING' ? 'border-amber-500/40 text-amber-400' :
                          'border-red-500/40 text-red-400'
                        }`}>{p.status}</span>
                      </td>
                      <td className="px-5 py-4 text-zinc-600 font-mono text-[9px] max-w-[120px] truncate">
                        {p.paystack_reference}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Quick links */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/investments', label: 'Browse Nodes',     icon: TrendingUp,  desc: 'Fund new projects'     },
            { href: '/kyc',         label: 'KYC Verification', icon: ShieldCheck, desc: 'Unlock withdrawals'    },
            { href: '/ledger',      label: 'Global Ledger',    icon: Activity,    desc: 'Immutable audit trail' },
            { href: '/map',         label: 'Project Map',      icon: Building2,   desc: 'Geo-visual overview'   },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/20 hover:border-teal-500/40 hover:bg-teal-500/5 transition-all">
              <item.icon size={16} className="text-teal-500 mb-3" />
              <p className="text-xs font-bold uppercase tracking-wider text-white">{item.label}</p>
              <p className="text-[9px] text-zinc-500 mt-1">{item.desc}</p>
            </Link>
          ))}
        </section>

      </main>
      <Footer />
    </div>
  );
}
