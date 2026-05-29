'use client';
export const dynamic = 'force-dynamic';
/**
 * /tenant/pay/page.tsx
 * Handles both linked-tenancy and standalone vault payment flows.
 */
import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ArrowLeft, Loader2, ShieldCheck, ExternalLink, AlertCircle, Zap } from 'lucide-react';

const API_BASE = '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', minimumFractionDigits: 2,
  }).format(Number(n || 0));

// ── Types ─────────────────────────────────────────────────────────────────────
type FlowState = 'loading' | 'linked_vault' | 'standalone_vault' | 'no_vault' | 'error';

interface VaultInfo {
  id:                 string;
  installment_amount: number;
  vault_balance:      number;
  target_amount:      number;
  funded_pct:         number;
  frequency:          string;
  status:             string;
  isStandalone?:      boolean;
  currency?:          string;
}

function PayContent() {
  const router = useRouter();
  const [flow,      setFlow]      = useState<FlowState>('loading');
  const [vault,     setVault]     = useState<VaultInfo | null>(null);
  const [amount,    setAmount]    = useState('');
  const [paying,    setPaying]    = useState(false);
  const [error,     setError]     = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // ── Resolve vault state ───────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) { router.push('/login'); return; }
      try {
        const res  = await fetch(`${API_BASE}/tenant/my-vault`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) { router.push('/login'); return; }
        const data = await res.json();

        if (data.hasActiveTenancy && data.vault) {
          setVault({ ...data.vault, isStandalone: false });
          setAmount(String(data.vault.installment_amount || ''));
          setFlow('linked_vault');
          return;
        }
        if (!data.hasActiveTenancy && data.standalone_vault) {
          setVault({ ...data.standalone_vault, isStandalone: true });
          setAmount(String(data.standalone_vault.installment_amount || ''));
          setFlow('standalone_vault');
          return;
        }
        setFlow('no_vault');
      } catch (e: any) {
        setError(e.message || 'Failed to load vault');
        setFlow('error');
      }
    })();
  }, [router]);

  // ── Pay handler ───────────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!vault) return;
    const amt = Number(amount);
    if (!amt || amt < 50) { setError('Minimum contribution is ₦50'); return; }
    setPaying(true);
    setError('');
    setStatusMsg('');
    try {
      const token    = getToken();
      const endpoint = vault.isStandalone
        ? `${API_BASE}/tenant/standalone-vault/pay`
        : `${API_BASE}/tenant/pay-installment`;

      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Payment initialization failed');
      setStatusMsg('Redirecting to Paystack…');
      window.location.href = data.authorization_url;
    } catch (e: any) {
      setError(e.message);
      setPaying(false);
    }
  };

  const cur     = vault?.currency || 'NGN';
  const fundPct = vault?.funded_pct ?? 0;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (flow === 'loading') return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
      <Footer />
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if (flow === 'error') return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-xl mx-auto px-6 py-10 w-full space-y-6">
        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Pay Installment</h1>
        </div>
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
          <AlertCircle size={14} /> {error || 'Something went wrong. Please refresh.'}
        </div>
        <Link href="/tenant/dashboard" className="text-teal-500 text-xs font-bold hover:underline flex items-center gap-1">
          <ArrowLeft size={11} /> Back to Dashboard
        </Link>
      </main>
      <Footer />
    </div>
  );

  // ── No vault ──────────────────────────────────────────────────────────────
  if (flow === 'no_vault') return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-xl mx-auto px-6 py-10 w-full space-y-8">
        <Link href="/tenant/dashboard"
          className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors w-fit">
          <ArrowLeft size={13} /> Dashboard
        </Link>
        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Pay Installment</h1>
          <p className="text-zinc-500 text-xs mt-1">Contribute to your Flex-Pay vault via Paystack</p>
        </div>
        <div className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900/20 text-center space-y-5">
          <div className="text-5xl">🏦</div>
          <div>
            <p className="text-white font-black text-lg mb-2">No Active Vault Found</p>
            <p className="text-zinc-500 text-sm leading-relaxed max-w-sm mx-auto">
              Initialize your personal savings vault to start contributing toward rent.
              No landlord required — you control your own savings timeline.
            </p>
          </div>
          <Link href="/tenant/vault"
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-black text-sm uppercase rounded-xl hover:bg-teal-400 transition-all tracking-widest">
            <Zap size={15} /> Initialize My Vault
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );

  // ── Payment form ──────────────────────────────────────────────────────────
  const quickAmounts = vault
    ? [vault.installment_amount * 0.5, vault.installment_amount, vault.installment_amount * 2].filter(v => v >= 50)
    : [];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-xl mx-auto px-6 py-10 w-full space-y-8">

        <Link href="/tenant/dashboard"
          className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors w-fit">
          <ArrowLeft size={13} /> Dashboard
        </Link>

        {/* Header */}
        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Pay Installment</h1>
          <p className="text-zinc-500 text-xs mt-1">
            Contribute to your {vault?.isStandalone ? 'independent' : 'Flex-Pay'} vault via Paystack
          </p>
        </div>

        {/* Vault summary card */}
        {vault && (
          <div className={`p-5 rounded-2xl border ${
            vault.isStandalone
              ? 'border-green-500/20 bg-green-500/5'
              : 'border-teal-500/20 bg-teal-500/5'
          } space-y-3`}>
            <p className="text-[9px] uppercase font-black tracking-widest text-zinc-500">
              {vault.isStandalone ? 'Independent Savings Vault' : 'Flex-Pay Vault'}
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono font-black text-2xl text-teal-400">{cur} {vault.vault_balance.toLocaleString()}</p>
                <p className="text-[9px] text-zinc-500 mt-0.5">Balance · {fundPct}% funded</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-zinc-400">Target</p>
                <p className="font-mono font-bold text-white">{cur} {vault.target_amount.toLocaleString()}</p>
              </div>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${
                fundPct >= 80 ? 'bg-teal-500' : fundPct >= 50 ? 'bg-amber-500' : 'bg-red-500'
              }`} style={{ width: `${fundPct}%` }} />
            </div>
            <div className="flex items-center justify-between text-[9px] text-zinc-500">
              <span>Installment: {cur} {vault.installment_amount.toLocaleString()}</span>
              <span>{vault.frequency?.toLowerCase()}</span>
            </div>
          </div>
        )}

        {/* Payment form card */}
        <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-5">
          <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Contribution Amount</p>

          {/* Quick-pick amounts */}
          {quickAmounts.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {quickAmounts.map(v => (
                <button key={v} onClick={() => setAmount(String(v))}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    Number(amount) === v
                      ? 'bg-teal-500/20 border-teal-500/50 text-teal-400'
                      : 'bg-zinc-900/40 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}>
                  {fmt(v)}
                </button>
              ))}
            </div>
          )}

          {/* Amount input */}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm">₦</span>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Enter amount e.g. 50000"
              min={50}
              className="w-full bg-zinc-900 border border-zinc-700 pl-9 pr-4 py-4 rounded-xl text-white font-mono text-lg outline-none focus:border-teal-500 transition-colors"
            />
          </div>

          {/* Preview strip */}
          {amount && !isNaN(Number(amount)) && Number(amount) >= 50 && (
            <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-zinc-800">
              <div>
                <p className="text-[9px] text-zinc-500 uppercase font-bold">You Pay</p>
                <p className="text-white font-black font-mono text-xl">{fmt(Number(amount))}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-teal-500 font-bold">Platform covers Paystack fee</p>
                <p className="text-[9px] text-zinc-600">2% platform fee deducted at disbursement</p>
              </div>
            </div>
          )}

          {/* Errors / status */}
          {error && (
            <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={12} /> {error}
            </div>
          )}
          {statusMsg && (
            <div className="p-3 rounded-xl border border-teal-500/20 bg-teal-500/5 text-teal-400 text-xs font-bold flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" /> {statusMsg}
            </div>
          )}

          {/* Pay button */}
          <button
            onClick={handlePay}
            disabled={paying || !amount || Number(amount) < 50 || vault?.status === 'FUNDED_READY'}
            className="w-full py-4 bg-teal-500 text-black font-black text-sm uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {paying
              ? <><Loader2 size={16} className="animate-spin" /> Preparing Paystack…</>
              : vault?.status === 'FUNDED_READY'
                ? '🎉 Vault Already Funded'
                : <><ExternalLink size={16} /> Pay {amount && !isNaN(Number(amount)) ? fmt(Number(amount)) : '…'} via Paystack</>
            }
          </button>

          <p className="text-[9px] text-zinc-600 text-center leading-relaxed">
            You will be redirected to a secure Paystack checkout.
            Your payment is automatically recorded on the immutable SHA-256 ledger.
          </p>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap gap-2 justify-center">
          {[
            <><ShieldCheck size={9} /> Secured by Paystack</>,
            <><ShieldCheck size={9} /> SHA-256 Ledger Receipt</>,
            <><ShieldCheck size={9} /> Vault Auto-Updated</>,
          ].map((b, i) => (
            <span key={i} className="flex items-center gap-1 text-[8px] text-teal-500 border border-teal-500/20 px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest">
              {b}
            </span>
          ))}
        </div>

        <div className="text-center">
          <Link href="/tenant/vault" className="text-zinc-500 text-xs hover:text-teal-400 transition-colors">
            ← Back to Vault
          </Link>
        </div>

      </main>
      <Footer />
    </div>
  );
}

export default function TenantPayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
    }>
      <PayContent />
    </Suspense>
  );
}
