'use client';
export const dynamic = 'force-dynamic';
/**
 * src/app/tenant/pay/page.tsx
 *
 * Tenant "Pay Now" page — live Paystack checkout
 * 
 * Flow:
 *  1. Load tenancy + vault state
 *  2. Tenant selects amount (installment, custom, or full rent)
 *  3. Click "Pay Now" → POST /api/rental/payments/initialize
 *  4. Receive Paystack authorization_url → redirect tenant to checkout
 *  5. Paystack redirects to /tenant/pay/success?ref=REF on completion
 *  6. Dashboard auto-refreshes vault balance
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  CreditCard, Loader2, AlertCircle, CheckCircle2,
  TrendingUp, Calendar, ShieldCheck, Zap,
  Lock, ArrowRight, Building2, DollarSign, RefreshCw,
  Wallet, ChevronRight, Info,
} from 'lucide-react';

const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();
const fmtDate = (s: any) => s ? new Date(s).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const today = () => new Date().toISOString().slice(0, 7); // YYYY-MM

interface Tenancy {
  id: string; tenant_name: string; tenant_email: string;
  unit_name: string; project_title: string; project_number: string;
  rent_amount: number; currency: string; status: string;
}
interface Vault {
  id: string; vault_balance: number; target_amount: number;
  installment_amount: number; frequency: string; next_due_date: string;
  status: string; funded_pct: number;
}

type AmountOption = 'installment' | 'full' | 'custom';

function TenantPayContent() {
  const router     = useRouter();
  const params     = useSearchParams();
  const tenancyId  = params.get('tenancy_id');

  const [tenancy,    setTenancy]    = useState<Tenancy | null>(null);
  const [vault,      setVault]      = useState<Vault | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [amountOpt,  setAmountOpt]  = useState<AmountOption>('installment');
  const [customAmt,  setCustomAmt]  = useState('');
  const [month,      setMonth]      = useState(today());
  const [initiating, setInitiating] = useState(false);
  const [payError,   setPayError]   = useState('');

  const load = useCallback(async () => {
    if (!tenancyId) { setError('No tenancy specified'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [tRes, vRes] = await Promise.all([
        api.get('/api/tenant/my-tenancy'),
        api.get('/api/tenant/my-vault').catch(() => ({ data: { vault: null } })),
      ]);
      setTenancy(tRes.data.tenancy ?? tRes.data);
      setVault(vRes.data.vault ?? null);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Could not load tenancy');
    } finally { setLoading(false); }
  }, [tenancyId]);

  useEffect(() => { load(); }, [load]);

  const payAmount = (): number => {
    if (amountOpt === 'installment') return safeN(vault?.installment_amount ?? tenancy?.rent_amount);
    if (amountOpt === 'full')        return safeN(tenancy?.rent_amount);
    return safeN(customAmt);
  };

  const initiatePay = async () => {
    const amount = payAmount();
    if (amount <= 0) { setPayError('Enter a valid amount'); return; }
    if (amount < 100) { setPayError('Minimum payment is ₦100'); return; }

    setInitiating(true); setPayError('');
    try {
      const res = await api.post('/api/rental/payments/initialize', {
        tenancy_id: tenancyId,
        period_month: month,
        amount_ngn: amount,
      });
      // Redirect to Paystack hosted checkout
      window.location.href = res.data.authorization_url;
    } catch (e: any) {
      setPayError(e?.response?.data?.error ?? 'Could not initialise payment. Please try again.');
      setInitiating(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="flex items-center justify-center py-40"><Loader2 className="animate-spin text-teal-500" size={28} /></div>
      <Footer />
    </div>
  );

  if (error || !tenancy) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="max-w-md mx-auto px-6 py-40 text-center space-y-5">
        <AlertCircle className="text-amber-400 mx-auto" size={36} />
        <p className="font-bold">{error || 'No active tenancy found'}</p>
        <Link href="/tenant/dashboard" className="inline-flex items-center gap-2 px-6 py-3 border border-zinc-700 text-zinc-400 rounded-xl text-xs uppercase font-bold hover:text-white transition-all">
          Back to Dashboard
        </Link>
      </div>
      <Footer />
    </div>
  );

  const cur      = tenancy.currency || 'NGN';
  const symbol   = cur === 'GBP' ? '£' : cur === 'USD' ? '$' : '₦';
  const amount   = payAmount();
  const dueDate  = vault?.next_due_date ? fmtDate(vault.next_due_date) : '—';
  const isOverdue = vault?.next_due_date ? new Date(vault.next_due_date) < new Date() : false;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <main className="max-w-lg mx-auto px-6 py-12 space-y-8">

        {/* Header */}
        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Rent Payment</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Pay Now</h1>
          <p className="text-zinc-500 text-xs mt-1">{tenancy.unit_name} · {tenancy.project_title}</p>
        </div>

        {/* Overdue alert */}
        {isOverdue && (
          <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/5 flex items-center gap-3">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-black text-red-300">Rent Overdue</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Due date was {dueDate}. Pay now to avoid a formal notice.</p>
            </div>
          </div>
        )}

        {/* Vault status card */}
        {vault && (
          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Flex-Pay Vault</p>
              <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase border ${vault.status === 'ACTIVE' ? 'border-teal-500/40 text-teal-400' : 'border-amber-500/40 text-amber-400'}`}>
                {vault.status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono font-bold text-xl text-teal-400">{symbol}{safeF(vault.vault_balance)}</p>
                <p className="text-[9px] text-zinc-500">of {symbol}{safeF(vault.target_amount)} target</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-zinc-500">Next due</p>
                <p className={`text-sm font-bold ${isOverdue ? 'text-red-400' : 'text-zinc-300'}`}>{dueDate}</p>
              </div>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${vault.funded_pct >= 80 ? 'bg-teal-500' : vault.funded_pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(vault.funded_pct, 100)}%` }} />
            </div>
            <p className="text-[9px] text-zinc-600">{vault.funded_pct}% funded · {vault.frequency} installments</p>
          </div>
        )}

        {/* Amount selection */}
        <div className="space-y-4">
          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Select Amount</p>

          <div className="space-y-2">
            {/* Installment option */}
            {vault && (
              <button onClick={() => setAmountOpt('installment')}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all ${amountOpt === 'installment' ? 'border-teal-500/40 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700'}`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Zap size={13} className={amountOpt === 'installment' ? 'text-teal-400' : 'text-zinc-600'} />
                    <p className="font-bold text-sm">
                      {vault.frequency.charAt(0) + vault.frequency.slice(1).toLowerCase()} Installment
                    </p>
                    <span className="text-[8px] px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 font-black uppercase">Recommended</span>
                  </div>
                  <p className="text-[9px] text-zinc-500 ml-5">Your scheduled Flex-Pay contribution</p>
                </div>
                <p className="font-mono font-bold text-lg text-teal-400">{symbol}{safeF(vault.installment_amount)}</p>
              </button>
            )}

            {/* Full rent option */}
            <button onClick={() => setAmountOpt('full')}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all ${amountOpt === 'full' ? 'border-teal-500/40 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700'}`}>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <DollarSign size={13} className={amountOpt === 'full' ? 'text-teal-400' : 'text-zinc-600'} />
                  <p className="font-bold text-sm">Full Month Rent</p>
                </div>
                <p className="text-[9px] text-zinc-500 ml-5">Pay the entire monthly rent in one go</p>
              </div>
              <p className="font-mono font-bold text-lg text-white">{symbol}{safeF(tenancy.rent_amount)}</p>
            </button>

            {/* Custom amount option */}
            <button onClick={() => setAmountOpt('custom')}
              className={`w-full p-4 rounded-2xl border text-left transition-all ${amountOpt === 'custom' ? 'border-teal-500/40 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Wallet size={13} className={amountOpt === 'custom' ? 'text-teal-400' : 'text-zinc-600'} />
                <p className="font-bold text-sm">Custom Amount</p>
              </div>
              {amountOpt === 'custom' && (
                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm">{symbol}</span>
                  <input
                    type="number"
                    min={100}
                    value={customAmt}
                    onChange={e => setCustomAmt(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none"
                    autoFocus
                  />
                </div>
              )}
            </button>
          </div>

          {/* Period month */}
          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">
              Paying for period
            </label>
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none"
            />
          </div>
        </div>

        {/* Payment summary */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Payment Summary</p>
          <div className="space-y-2">
            {[
              ['Tenant',   tenancy.tenant_name],
              ['Unit',     `${tenancy.unit_name} · ${tenancy.project_number}`],
              ['Period',   month],
              ['Amount',   `${symbol}${safeF(amount)}`],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-zinc-500">{label}</span>
                <span className="font-bold text-white">{val}</span>
              </div>
            ))}
            <div className="border-t border-zinc-800 pt-2 flex justify-between">
              <span className="text-zinc-400 font-bold">You Pay</span>
              <span className="font-mono font-black text-xl text-teal-400">{symbol}{safeF(amount)}</span>
            </div>
          </div>
        </div>

        {/* Security note */}
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-800 bg-zinc-900/10">
          <ShieldCheck size={16} className="text-teal-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-zinc-300">Secured by Paystack</p>
            <p className="text-[9px] text-zinc-600 leading-relaxed">
              You'll be redirected to Paystack's secure checkout. Pay via card, bank transfer, USSD, or mobile money.
              Your payment is SHA-256 hashed and recorded on the immutable ledger.
            </p>
          </div>
        </div>

        {payError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={12} /> {payError}
          </div>
        )}

        {/* Pay button */}
        <button
          onClick={initiatePay}
          disabled={initiating || amount <= 0}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-teal-500 text-black font-black text-sm uppercase tracking-widest hover:bg-teal-400 transition-all disabled:opacity-60 shadow-lg shadow-teal-500/20"
        >
          {initiating
            ? <><Loader2 size={16} className="animate-spin" /> Redirecting to Paystack…</>
            : <><Lock size={15} /> Pay {symbol}{safeF(amount)} Securely</>
          }
        </button>

        <p className="text-center text-[9px] text-zinc-700">
          Powered by Paystack · PCI-DSS compliant · 256-bit SSL encryption
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link href="/tenant/dashboard" className="text-[9px] text-zinc-600 hover:text-zinc-400 uppercase font-bold tracking-widest transition-all">
            Back to Dashboard
          </Link>
          <span className="text-zinc-800">·</span>
          <Link href={`/tenant/flex-pay/${tenancyId}`} className="text-[9px] text-zinc-600 hover:text-zinc-400 uppercase font-bold tracking-widest transition-all">
            View Vault
          </Link>
        </div>

      </main>
      <Footer />
    </div>
  );
}

export default function TenantPayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={28} /></div>}>
      <TenantPayContent />
    </Suspense>
  );
}
