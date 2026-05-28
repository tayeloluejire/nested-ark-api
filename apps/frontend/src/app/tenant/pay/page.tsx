'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MobileBottomNav from '@/components/navigation/MobileBottomNav';
import { Loader2, ShieldCheck, Wallet, ArrowLeft, RefreshCw } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('ark_token') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('ark_token') ||
    sessionStorage.getItem('token')
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(n);

// ─── Types ────────────────────────────────────────────────────────────────────
type FlowState =
  | 'loading'
  | 'linked_vault'          // has tenancy + vault → normal pay flow
  | 'standalone_vault'      // has standalone vault → route to standalone pay
  | 'no_vault'              // no tenancy, no standalone vault → redirect to init
  | 'error';

interface VaultInfo {
  id: string;
  installment_amount: number;
  vault_balance: number;
  target_amount: number;
  funded_pct: number;
  frequency: string;
  status: string;
  isStandalone?: boolean;
}

export default function PayInstallmentPage() {
  const router = useRouter();
  const [flow, setFlow]         = useState<FlowState>('loading');
  const [vault, setVault]       = useState<VaultInfo | null>(null);
  const [amount, setAmount]     = useState('');
  const [paying, setPaying]     = useState(false);
  const [error, setError]       = useState('');
  const [statusMsg, setStatus]  = useState('');

  // ── Resolve vault state on mount ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) { router.push('/login'); return; }

      try {
        // Check linked vault first (my-vault returns standalone_vault too)
        const mvRes = await fetch(`${API_BASE}/tenant/my-vault`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
          cache: 'no-store'
        });

        if (mvRes.status === 401) {
          router.push('/login');
          return;
        }

        const mvData = await mvRes.json();

        if (mvData.hasActiveTenancy && mvData.vault) {
          // Linked tenancy + vault: standard flow
          setVault({ ...mvData.vault, isStandalone: false });
          setAmount(String(mvData.vault.installment_amount || ''));
          setFlow('linked_vault');
          return;
        }

        if (!mvData.hasActiveTenancy && mvData.standalone_vault) {
          // Independent tenant with initialized standalone vault
          setVault({ ...mvData.standalone_vault, isStandalone: true });
          setAmount(String(mvData.standalone_vault.installment_amount || ''));
          setFlow('standalone_vault');
          return;
        }

        // No vault at all → redirect to vault init
        setFlow('no_vault');
      } catch (e: any) {
        setError(e.message || 'Fatal exception loading secure repository context');
        setFlow('error');
      }
    })();
  }, [router]);

  // ── Initiate payment ──────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!vault) return;
    const amt = Number(amount);
    if (!amt || amt < 50) return setError('Minimum contribution is ₦50');
    setPaying(true);
    setError('');
    setStatus('');
    try {
      const token = getToken();
      const endpoint = vault.isStandalone
        ? `${API_BASE}/tenant/standalone-vault/pay`
        : `${API_BASE}/tenant/pay-installment`;

      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ amount: amt }),
        credentials: 'include',
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.error || 'Payment initialization failed');

      setStatus(`Redirecting to Paystack Gateway Processor...`);
      window.location.href = data.authorization_url;
    } catch (e: any) {
      setError(e.message || 'Internal connection failure processing endpoint');
      setPaying(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (flow === 'loading') {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="animate-spin text-teal-500" size={32} />
          <span className="text-zinc-500 font-mono text-sm tracking-wider">Loading system vault context...</span>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      <main className="flex-grow max-w-xl w-full mx-auto px-4 py-12 pb-24 md:pb-16">
        
        {/* Dynamic Header Block */}
        <div className="mb-8">
          <div className="text-teal-500 text-[10px] font-bold tracking-[0.2em] uppercase mb-2">
            Tenant Ledger System
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-2 uppercase">
            Pay Installment
          </h1>
          <p className="text-zinc-500 text-sm">
            Contribute transactional liquidity into your absolute Flex-Pay vault repository.
          </p>
        </div>

        {/* ── Flow Matrix View Router ───────────────────────────────────────── */}
        
        {/* State A: Processing Error */}
        {flow === 'error' && (
          <div className="border border-red-500/30 bg-red-500/5 rounded-2xl p-6 text-center shadow-2xl">
            <div className="text-red-500 font-black text-xs uppercase tracking-widest mb-2">⚠️ Initialization Error</div>
            <p className="text-zinc-400 text-sm leading-relaxed mb-4">
              {error || 'Something went wrong. Please refresh and try again.'}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-800 rounded-lg text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-900 transition-all uppercase"
            >
              <RefreshCw size={12} /> Reload System
            </button>
          </div>
        )}

        {/* State B: Empty Vault Setup Link Node */}
        {flow === 'no_vault' && (
          <div className="border border-zinc-900 bg-gradient-to-b from-zinc-950 to-black p-8 rounded-2xl text-center shadow-2xl relative overflow-hidden">
            <div className="w-14 h-14 bg-teal-500/10 text-teal-500 rounded-2xl flex items-center justify-center text-xl mx-auto mb-5">🏦</div>
            <h3 className="text-white font-black text-lg uppercase tracking-tight mb-2">No Operational Vault Found</h3>
            <p className="text-zinc-500 text-sm leading-relaxed mb-6">
              Initialize your personal multi-layered vault allocation framework to begin recording metrics into the live environment. No landlord links required.
            </p>
            <button
              onClick={() => router.push('/tenant/vault')}
              className="w-full py-3 rounded-xl bg-teal-500 text-black font-black text-xs uppercase tracking-wider hover:bg-teal-400 transition-all duration-150 shadow-lg shadow-teal-500/10 mb-4"
            >
              🚀 Initialize My Vault
            </button>
            <button
              onClick={() => router.push('/tenant/dashboard')}
              className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-xs font-bold uppercase tracking-wider transition-all"
            >
              <ArrowLeft size={12} /> Dashboard Index
            </button>
          </div>
        )}

        {/* State C: Active Interactive Payment Execution Form (Linked & Standalone) */}
        {(flow === 'linked_vault' || flow === 'standalone_vault') && vault && (
          <div className="space-y-4">
            
            {/* Vault Balance Overview Strip */}
            <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-5 flex justify-between items-center relative overflow-hidden shadow-xl">
              <div>
                <div className="text-zinc-500 text-[9px] font-bold tracking-widest uppercase mb-1.5">
                  {vault.isStandalone ? 'Independent Savings Vault' : 'Flex-Pay Mapped Vault'}
                </div>
                <div className="text-lg font-black text-white font-mono tracking-tight">
                  {fmt(vault.vault_balance)} <span className="text-zinc-700 font-normal text-xs mx-1">/</span> {fmt(vault.target_amount)}
                </div>
                <div className="text-zinc-600 text-xs font-medium uppercase mt-1">
                  {vault.funded_pct}% allocated &bull; {vault.frequency.toLowerCase()}
                </div>
              </div>
              
              {/* Radial Tracking Meter Block */}
              <div className="flex flex-col items-center gap-1 w-20">
                <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/30">
                  <div 
                    className={`h-full transition-all duration-500 ease-out rounded-full ${vault.funded_pct >= 100 ? 'bg-emerald-500' : 'bg-teal-500'}`}
                    style={{ width: `${Math.min(100, vault.funded_pct)}%` }}
                  />
                </div>
                <span className="text-zinc-500 font-mono text-[10px] font-bold">{vault.funded_pct}%</span>
              </div>
            </div>

            {/* Core Operational Calculation Form Wrapper */}
            <div className="bg-gradient-to-b from-zinc-950 to-black border border-zinc-800/80 rounded-2xl p-6 shadow-2xl relative">
              <div className="mb-6">
                <label className="block text-zinc-500 text-[10px] font-bold tracking-widest uppercase mb-3">
                  Contribution Payload Target (₦)
                </label>

                {/* Instant Metric Injection Presets */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
                  {[vault.installment_amount, vault.installment_amount * 2, vault.installment_amount * 0.5]
                    .filter(v => v >= 50)
                    .map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAmount(String(v))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono tracking-tight border transition-all whitespace-nowrap ${
                          Number(amount) === v
                            ? 'bg-teal-500/10 border-teal-500/40 text-teal-400 font-bold'
                            : 'bg-zinc-900/40 border-zinc-900 text-zinc-500 hover:border-zinc-800 hover:text-zinc-400'
                        }`}
                      >
                        {fmt(v)}
                      </button>
                    ))}
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-zinc-600 text-lg font-bold">₦</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-white font-mono text-xl font-bold focus:outline-none focus:border-teal-500/50 transition-colors shadow-inner"
                  />
                </div>
              </div>

              {/* Escrow Fee Matrix Invariant Notification Panel */}
              <div className="bg-teal-500/[0.02] border border-teal-500/10 rounded-xl p-4 mb-6 flex justify-between items-center">
                <div>
                  <div className="text-zinc-500 text-[9px] font-bold tracking-wider uppercase mb-1">Gross Settlement Sum</div>
                  <div className="text-lg font-black text-white font-mono">
                    {amount && !isNaN(Number(amount)) ? fmt(Number(amount)) : '₦0.00'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-teal-400 text-[10px] font-bold uppercase tracking-wide">Platform Fee Absorbed</div>
                  <div className="text-zinc-600 text-[9px] uppercase font-semibold tracking-tight mt-0.5">
                    Escrow Locked &bull; 2% at lump release
                  </div>
                </div>
              </div>

              {/* Validation Response Banners */}
              {error && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-red-400 font-mono text-xs mb-4">
                  {error}
                </div>
              )}

              {statusMsg && (
                <div className="bg-teal-500/5 border border-teal-500/20 rounded-xl p-3 text-teal-400 font-mono text-xs mb-4 animate-pulse">
                  {statusMsg}
                </div>
              )}

              {/* Gateway Dispatch Trigger */}
              <button
                onClick={handlePay}
                disabled={paying || !amount || Number(amount) < 50}
                className={`w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all duration-200 ${
                  paying || !amount || Number(amount) < 50
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-teal-500 to-emerald-500 border-teal-400 text-black shadow-xl shadow-teal-500/5 hover:opacity-90 active:scale-[0.99]'
                }`}
              >
                {paying ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={14} /> Dispatching Gateway...
                  </span>
                ) : (
                  `Execute ${amount && !isNaN(Number(amount)) ? fmt(Number(amount)) : ''} Vault Allocation`
                )}
              </button>

              <div className="mt-5 text-center">
                <a href="/tenant/vault" className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-teal-400 text-xs font-bold uppercase tracking-wider transition-colors">
                  <ArrowLeft size={12} /> Return to Vault Index
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Technical Ledger Cryptographic Seal Note */}
        <div className="mt-8 flex items-center justify-center gap-1.5 text-zinc-700 font-mono text-[10px] uppercase tracking-wider">
          <ShieldCheck size={13} className="text-zinc-800" />
          SHA-256 Ledger Receipt Sealed Upon Confirmation Block
        </div>
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  );
}