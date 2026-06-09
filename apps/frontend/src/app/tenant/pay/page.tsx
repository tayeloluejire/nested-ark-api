'use client';
export const dynamic = 'force-dynamic';

/**
 * /tenant/pay/page.tsx
 * The "Pay Rent" page. Loads the tenant's active vault and initiates
 * a Paystack payment. Redirects to /tenant/pay/success?reference=...
 * after Paystack checkout completes.
 *
 * Supports both:
 *   - Linked flex vault  (tenant has a landlord tenancy)
 *   - Standalone vault   (independent tenant, no landlord yet)
 */

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  Zap, RefreshCw, ShieldCheck, ArrowRight,
  TrendingUp, Info, CreditCard, Building2,
} from 'lucide-react';

const API_BASE = '/api';
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}
const fmt = (n: number) =>
  `₦${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── TenantNav ─────────────────────────────────────────────────────────────────
function TenantNav() {
  const pathname = usePathname();
  const links = [
    { href: '/tenant/dashboard',     label: 'My Dashboard' },
    { href: '/tenant/vault',         label: 'My Vault'     },
    { href: '/tenant/pay',           label: 'Pay Rent'     },
    { href: '/tenant/contributions', label: 'History'      },
    { href: '/tenant/banking',       label: 'My Banking'   },
    { href: '/tenant/notices',       label: 'My Notices'   },
    { href: '/marketplace',          label: 'Marketplace'  },
  ];
  return (
    <nav className="border-b border-zinc-800 bg-[#050505]/90 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 flex gap-0.5 overflow-x-auto py-1" style={{ scrollbarWidth: 'none' }}>
        {links.map(l => {
          const active = pathname === l.href;
          return (
            <Link key={l.href} href={l.href}
              className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap rounded-lg transition-all flex-shrink-0 ${
                active ? 'text-teal-400 bg-teal-500/10 border border-teal-500/20'
                       : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60'}`}>
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ── Vault types ───────────────────────────────────────────────────────────────
interface VaultInfo {
  type:              'flex' | 'standalone';
  id:                string;
  vault_balance:     number;
  target_amount:     number;
  installment_amount:number;
  funded_pct:        number;
  status:            string;
  frequency:         string;
  currency:          string;
  // flex only
  tenancy_id?:       string;
  landlord_name?:    string;
  landlord_email?:   string;
  bank_name?:        string;
  // standalone only
  landlord_user_id?: string;
}

export default function TenantPayPage() {
  const router = useRouter();
  const [vault,    setVault]    = useState<VaultInfo | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [paying,   setPaying]   = useState(false);
  const [error,    setError]    = useState('');
  const [customAmt,setCustomAmt]= useState('');
  const [useCustom,setUseCustom]= useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = getToken();
    if (!token) { router.push('/login'); return; }

    try {
      // Try flex vault first
      const flexRes  = await fetch(`${API_BASE}/tenant/vault`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const flexData = await flexRes.json();

      if (flexData.vault && flexData.vault.status !== 'MIGRATED' && flexData.vault.status !== 'CLOSED') {
        const v = flexData.vault;
        const bal = parseFloat(v.vault_balance) || 0;
        const tgt = parseFloat(v.target_amount)  || 1;
        setVault({
          type:               'flex',
          id:                 v.id,
          vault_balance:      bal,
          target_amount:      tgt,
          installment_amount: parseFloat(v.installment_amount) || 100,
          funded_pct:         Math.min(Math.round((bal / tgt) * 100), 100),
          status:             v.status,
          frequency:          v.frequency || 'MONTHLY',
          currency:           v.currency  || 'NGN',
          tenancy_id:         v.tenancy_id,
          landlord_name:      flexData.landlord?.name,
          landlord_email:     flexData.landlord?.email,
          bank_name:          flexData.landlord?.bank_name,
        });
        setLoading(false);
        return;
      }

      // Fall back to standalone vault
      const svRes  = await fetch(`${API_BASE}/tenant/standalone-vault`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const svData = await svRes.json();

      if (svData.vault) {
        const v = svData.vault;
        const bal = parseFloat(v.vault_balance) || 0;
        const tgt = parseFloat(v.target_amount)  || 1;
        setVault({
          type:               'standalone',
          id:                 v.id,
          vault_balance:      bal,
          target_amount:      tgt,
          installment_amount: parseFloat(v.installment_amount) || 100,
          funded_pct:         Math.min(Math.round((bal / tgt) * 100), 100),
          status:             v.status,
          frequency:          v.frequency || 'MONTHLY',
          currency:           v.currency  || 'NGN',
          landlord_user_id:   v.landlord_user_id,
          landlord_name:      svData.landlord?.name,
          landlord_email:     svData.landlord?.email,
          bank_name:          svData.landlord?.bank_name,
        });
        setLoading(false);
        return;
      }

      // No vault at all
      setVault(null);
    } catch (e: any) {
      setError('Failed to load vault. Please try again.');
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const handlePay = async () => {
    if (!vault) return;
    setPaying(true);
    setError('');
    const token = getToken();

    const amount = useCustom && customAmt
      ? parseFloat(customAmt)
      : vault.installment_amount;

    if (isNaN(amount) || amount < 50) {
      setError('Minimum payment is ₦50');
      setPaying(false);
      return;
    }

    try {
      const endpoint = vault.type === 'standalone'
        ? `${API_BASE}/tenant/standalone-vault/pay`
        : `${API_BASE}/tenant/flex-pay/pay`;

      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ amount }),
      });
      const data = await res.json();

      if (!res.ok || !data.authorization_url) {
        throw new Error(data.error || 'Could not initiate payment');
      }

      // Redirect to Paystack checkout
      window.location.href = data.authorization_url;
    } catch (e: any) {
      setError(e.message);
      setPaying(false);
    }
  };

  const freqLabel = (f: string) => ({
    DAILY: 'day', WEEKLY: 'week', BIWEEKLY: 'fortnight',
    MONTHLY: 'month', QUARTERLY: 'quarter', ANNUAL: 'year',
  }[f?.toUpperCase()] ?? 'period');

  const barColor = (pct: number) =>
    pct >= 80 ? 'bg-teal-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <TenantNav />

      <main className="flex-1 max-w-2xl mx-auto px-4 md:px-6 py-8 w-full space-y-6">

        {/* Header */}
        <div className="border-l-2 border-teal-500 pl-4">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-2xl font-black uppercase tracking-tighter">Pay Rent</h1>
          <p className="text-zinc-500 text-xs mt-1">Make an installment contribution to your vault</p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="animate-spin text-teal-500 mr-3" size={20} />
            <span className="text-zinc-500 font-mono text-sm">Loading vault…</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 flex items-start gap-2">
            <Info size={13} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs leading-relaxed">{error}</p>
          </div>
        )}

        {/* No vault */}
        {!loading && !vault && (
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center mx-auto">
              <Building2 size={20} className="text-zinc-600" />
            </div>
            <div>
              <p className="font-black text-sm uppercase tracking-tight">No Active Vault</p>
              <p className="text-zinc-600 text-xs mt-2 leading-relaxed">
                You don't have an active rent vault yet. Set one up to start saving.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/tenant/vault"
                className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800 hover:border-teal-500/30 hover:bg-teal-500/5 transition-all group">
                <span className="text-sm font-bold">Set Up My Vault</span>
                <ArrowRight size={14} className="text-zinc-600 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
              </Link>
            </div>
          </div>
        )}

        {/* Vault loaded */}
        {!loading && vault && (
          <>
            {/* Vault summary card */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-1">
                    {vault.type === 'standalone' ? 'Independent Savings Vault' : 'Flex-Pay Vault'}
                  </p>
                  <p className="text-2xl font-black font-mono">{fmt(vault.vault_balance)}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">of {fmt(vault.target_amount)} target · {freqLabel(vault.frequency)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-3xl font-black text-teal-400">{vault.funded_pct}%</p>
                  <p className="text-[9px] text-zinc-600 uppercase font-bold">funded</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barColor(vault.funded_pct)}`}
                  style={{ width: `${vault.funded_pct}%` }}
                />
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Installment',  value: fmt(vault.installment_amount) },
                  { label: 'Status',       value: vault.status },
                  { label: 'Currency',     value: vault.currency },
                ].map(s => (
                  <div key={s.label} className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                    <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest mb-0.5">{s.label}</p>
                    <p className="text-xs font-black font-mono truncate">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Landlord destination */}
              {vault.landlord_name && (
                <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 text-[10px] text-zinc-500 space-y-0.5">
                  <p>👤 {vault.landlord_name}</p>
                  {vault.landlord_email && <p>✉️ {vault.landlord_email}</p>}
                  {vault.bank_name      && <p>🏦 {vault.bank_name}</p>}
                  <p className="text-teal-500 mt-1">✅ Auto-release configured — funds disburse when vault is claimed by landlord</p>
                </div>
              )}

              <p className="text-[8px] text-zinc-700 font-mono">
                VAULT · {vault.id} · {new Date().toLocaleDateString('en-NG')}
              </p>
            </div>

            {/* FUNDED_READY state — vault is full */}
            {vault.status === 'FUNDED_READY' && (
              <div className="p-4 rounded-2xl border border-teal-500/30 bg-teal-500/10 flex items-start gap-3">
                <Zap size={14} className="text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-sm text-teal-400 uppercase tracking-tight">🎉 Vault Fully Funded</p>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                    Your vault has reached its target. Disbursement to your landlord will proceed automatically.
                    You can still top up if needed.
                  </p>
                </div>
              </div>
            )}

            {/* Payment card */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-500/15 flex items-center justify-center flex-shrink-0">
                  <CreditCard size={15} className="text-teal-400" />
                </div>
                <div>
                  <p className="font-black text-sm uppercase tracking-tight">Make a Payment</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Secured by Paystack · SHA-256 ledger</p>
                </div>
              </div>

              {/* Amount selector */}
              <div className="space-y-3">
                {/* Default installment button */}
                <button
                  onClick={() => setUseCustom(false)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                    !useCustom
                      ? 'border-teal-500/40 bg-teal-500/10'
                      : 'border-zinc-800 hover:border-zinc-700'}`}>
                  <div className="text-left">
                    <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Default Installment</p>
                    <p className="text-xl font-black font-mono mt-0.5">{fmt(vault.installment_amount)}</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${!useCustom ? 'border-teal-400 bg-teal-400' : 'border-zinc-600'}`} />
                </button>

                {/* Custom amount */}
                <button
                  onClick={() => setUseCustom(true)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                    useCustom
                      ? 'border-teal-500/40 bg-teal-500/10'
                      : 'border-zinc-800 hover:border-zinc-700'}`}>
                  <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Custom Amount</p>
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${useCustom ? 'border-teal-400 bg-teal-400' : 'border-zinc-600'}`} />
                </button>

                {useCustom && (
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-black text-sm">₦</span>
                    <input
                      type="number"
                      min={50}
                      placeholder="Enter amount (min ₦50)"
                      value={customAmt}
                      onChange={e => setCustomAmt(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-xl pl-8 pr-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* Pay button */}
              <button
                onClick={handlePay}
                disabled={paying || vault.status === 'MIGRATED' || vault.status === 'CLOSED'}
                className={`w-full py-4 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  paying || vault.status === 'MIGRATED' || vault.status === 'CLOSED'
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                    : 'bg-teal-500 text-black hover:bg-teal-400'}`}>
                {paying
                  ? <><RefreshCw size={14} className="animate-spin" /> Redirecting to Paystack…</>
                  : <><Zap size={14} /> Pay {fmt(useCustom && customAmt ? parseFloat(customAmt) || 0 : vault.installment_amount)} Installment</>
                }
              </button>

              {/* Trust line */}
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <span className="flex items-center gap-1.5 text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                  <ShieldCheck size={9} className="text-teal-600" /> Paystack-secured
                </span>
                <span className="text-zinc-800">·</span>
                <span className="flex items-center gap-1.5 text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                  🔐 SHA-256 · Court-admissible
                </span>
              </div>
            </div>

            {/* Quick links */}
            <div className="flex items-center justify-center gap-6">
              <Link href="/tenant/vault"
                className="text-[11px] text-teal-500 font-bold hover:underline flex items-center gap-1">
                ← My Vault
              </Link>
              <Link href="/tenant/contributions"
                className="text-[11px] text-zinc-500 hover:text-zinc-300 font-bold flex items-center gap-1 transition-colors">
                <TrendingUp size={10} /> Pay History
              </Link>
              <Link href="/tenant/banking"
                className="text-[11px] text-zinc-500 hover:text-zinc-300 font-bold flex items-center gap-1 transition-colors">
                AutoPay →
              </Link>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
