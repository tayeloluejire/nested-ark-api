'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { DollarSign, Shield, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react';

const API_BASE = '/api';
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}
const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(n);

// ── TenantNav ─────────────────────────────────────────────────────────────────
function TenantNav() {
  const pathname = usePathname();
  const links = [
    { href: '/tenant/dashboard',     label: 'My Dashboard' },
    { href: '/tenant/vault',         label: 'My Vault'     },
    { href: '/tenant/pay',           label: 'Pay Rent'     },
    { href: '/tenant/contributions', label: 'History'      },
    { href: '/tenant/notices',       label: 'My Notices'   },
    { href: '/marketplace',          label: 'Marketplace'  },
  ];
  return (
    <nav className="border-b border-zinc-800 bg-[#050505]/90 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 flex gap-0.5 overflow-x-auto py-1" style={{ scrollbarWidth: 'none' }}>
        {links.map(l => {
          const active = pathname === l.href || pathname?.startsWith(l.href + '/');
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

// ── Types ─────────────────────────────────────────────────────────────────────
type FlowState = 'loading' | 'linked_vault' | 'standalone_vault' | 'no_vault' | 'error';
interface VaultInfo {
  id: string; installment_amount: number; vault_balance: number;
  target_amount: number; funded_pct: number; frequency: string;
  status: string; isStandalone?: boolean;
}

export default function PayInstallmentPage() {
  const router = useRouter();
  const [flow,     setFlow]   = useState<FlowState>('loading');
  const [vault,    setVault]  = useState<VaultInfo | null>(null);
  const [amount,   setAmount] = useState('');
  const [paying,   setPaying] = useState(false);
  const [error,    setError]  = useState('');
  const [statusMsg,setStatus] = useState('');

  // ── Resolve vault on mount ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) { router.push('/login'); return; }
      try {
        const res  = await fetch(`${API_BASE}/tenant/my-vault`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.hasActiveTenancy && data.vault) {
          setVault({ ...data.vault, isStandalone: false });
          setAmount(String(data.vault.installment_amount || ''));
          setFlow('linked_vault');
        } else if (!data.hasActiveTenancy && data.standalone_vault) {
          setVault({ ...data.standalone_vault, isStandalone: true });
          setAmount(String(data.standalone_vault.installment_amount || ''));
          setFlow('standalone_vault');
        } else {
          setFlow('no_vault');
        }
      } catch (e: any) { setError(e.message); setFlow('error'); }
    })();
  }, []);

  // ── Initiate payment ──────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!vault) return;
    const amt = Number(amount);
    if (!amt || amt < 50) return setError('Minimum contribution is ₦50');
    setPaying(true); setError(''); setStatus('');
    try {
      const token    = getToken();
      const endpoint = vault.isStandalone
        ? `${API_BASE}/tenant/standalone-vault/pay`
        : `${API_BASE}/tenant/pay-installment`;
      const res  = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Payment initialization failed');
      setStatus('Redirecting to Paystack…');
      window.location.href = data.authorization_url;
    } catch (e: any) { setError(e.message); setPaying(false); }
  };

  // ── Quick amount presets ──────────────────────────────────────────────────
  const presets = vault
    ? [vault.installment_amount, vault.installment_amount * 2, vault.installment_amount * 0.5].filter(v => v >= 50)
    : [];

  // ── Shell ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <TenantNav />

      <main className="flex-1 max-w-xl mx-auto px-4 md:px-6 py-8 w-full">

        {/* Header */}
        <div className="border-l-2 border-teal-500 pl-4 mb-8">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-2xl font-black uppercase tracking-tighter">Pay Installment</h1>
          <p className="text-zinc-500 text-xs mt-1">Contribute to your Flex-Pay vault via Paystack</p>
        </div>

        {/* Loading */}
        {flow === 'loading' && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="animate-spin text-teal-500 mr-3" size={20} />
            <span className="text-zinc-500 font-mono text-sm">Loading vault…</span>
          </div>
        )}

        {/* Error */}
        {flow === 'error' && (
          <div className="flex items-center gap-3 p-5 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400">
            <AlertCircle size={18} />
            <div>
              <p className="font-bold text-sm">Something went wrong</p>
              <p className="text-xs mt-0.5">{error || 'Please refresh and try again.'}</p>
            </div>
          </div>
        )}

        {/* No vault */}
        {flow === 'no_vault' && (
          <div className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900/20 text-center space-y-5">
            <div className="text-5xl">🏦</div>
            <div>
              <p className="font-black text-sm uppercase tracking-tight mb-2">No Active Vault Found</p>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Initialize your personal savings vault to start contributing toward rent.
                No landlord required — you control your savings timeline.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => router.push('/tenant/vault')}
                className="w-full py-3.5 bg-teal-500 text-black font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all">
                🚀 Initialize My Vault
              </button>
              <Link href="/tenant/dashboard"
                className="block text-center text-zinc-600 text-xs hover:text-zinc-400 transition-colors">
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* Payment form — linked or standalone */}
        {(flow === 'linked_vault' || flow === 'standalone_vault') && vault && (
          <div className="space-y-5">

            {/* Vault summary card */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex items-center justify-between gap-4">
              <div>
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-1">
                  {vault.isStandalone ? 'Independent Savings Vault' : 'Flex-Pay Vault'}
                </p>
                <p className="font-black font-mono text-base text-white">
                  {fmt(vault.vault_balance)} <span className="text-zinc-600 font-normal text-xs">/ {fmt(vault.target_amount)}</span>
                </p>
                <p className="text-zinc-500 text-xs mt-0.5">{vault.funded_pct}% funded · {vault.frequency.toLowerCase()}</p>
              </div>
              {/* Mini ring */}
              <div className="flex-shrink-0">
                <div className="relative w-14 h-14">
                  <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                    <circle cx="28" cy="28" r="22" fill="none" stroke="#18181b" strokeWidth="5"/>
                    <circle cx="28" cy="28" r="22" fill="none"
                      stroke={vault.funded_pct >= 100 ? '#10b981' : '#14b8a6'} strokeWidth="5"
                      strokeDasharray={`${(vault.funded_pct / 100) * 2 * Math.PI * 22} ${2 * Math.PI * 22}`}
                      strokeLinecap="round"/>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black font-mono text-white">
                    {vault.funded_pct}%
                  </span>
                </div>
              </div>
            </div>

            {/* Payment card */}
            <div className="p-6 rounded-2xl border border-teal-500/20 bg-zinc-900/20 space-y-5">

              {/* Amount input */}
              <div>
                <label className="block text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-3">
                  Contribution Amount (₦)
                </label>

                {/* Quick presets */}
                <div className="flex gap-2 mb-3 flex-wrap">
                  {presets.map(v => (
                    <button key={v} onClick={() => setAmount(String(v))}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                        Number(amount) === v
                          ? 'border-teal-500 bg-teal-500/20 text-teal-400'
                          : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                      }`}>
                      {fmt(v)}
                    </button>
                  ))}
                </div>

                <input
                  type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-4 text-white text-2xl font-black font-mono focus:border-teal-500 outline-none transition-colors"
                />
              </div>

              {/* Fee breakdown */}
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-0.5">You Pay Exactly</p>
                  <p className="font-black font-mono text-xl text-white">
                    {amount && !isNaN(Number(amount)) ? fmt(Number(amount)) : '₦0.00'}
                  </p>
                </div>
                <div className="text-right space-y-0.5">
                  <p className="text-[9px] text-teal-400 font-bold">Platform covers Paystack fee</p>
                  <p className="text-[9px] text-zinc-600">Funds held in escrow</p>
                  <p className="text-[9px] text-zinc-600">2% platform fee at release</p>
                </div>
              </div>

              {/* Error / Status */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-[11px]">
                  <AlertCircle size={13} /> {error}
                </div>
              )}
              {statusMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-teal-500/30 bg-teal-500/10 text-teal-400 text-[11px]">
                  <RefreshCw size={11} className="animate-spin" /> {statusMsg}
                </div>
              )}

              {/* Pay button */}
              <button onClick={handlePay}
                disabled={paying || !amount || Number(amount) < 50}
                className={`w-full py-4 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  paying || !amount || Number(amount) < 50
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                    : 'bg-teal-500 text-black hover:bg-teal-400 cursor-pointer'
                }`}>
                {paying
                  ? <><RefreshCw size={14} className="animate-spin"/> Preparing Paystack…</>
                  : <><DollarSign size={14}/> Pay {amount && !isNaN(Number(amount)) ? fmt(Number(amount)) : ''} via Paystack</>
                }
              </button>

              {/* SHA note */}
              <div className="flex items-center justify-center gap-2 pt-1">
                <Shield size={10} className="text-teal-500" />
                <span className="text-[9px] text-zinc-600 font-mono">SHA-256 receipt issued on payment confirmation</span>
              </div>
            </div>

            {/* Footer nav */}
            <div className="flex items-center justify-center gap-6">
              <Link href="/tenant/vault" className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
                ← My Vault
              </Link>
              <Link href="/tenant/contributions" className="text-[11px] text-teal-500 font-bold hover:underline flex items-center gap-1">
                Contribution History <ChevronRight size={11}/>
              </Link>
            </div>
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}
