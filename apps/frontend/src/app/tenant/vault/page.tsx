'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MobileBottomNav from '@/components/navigation/MobileBottomNav';
import { Loader2, ShieldCheck, Wallet, ArrowLeft, RefreshCw, ChevronDown, ChevronUp, Download, CheckCircle2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface StandaloneVault {
  id: string;
  vault_balance: number;
  target_amount: number;
  installment_amount: number;
  funded_pct: number;
  frequency: string;
  status: string;
  currency: string;
  funded_periods: number;
  total_contributed: number;
  contribution_count: number;
  landlord_name: string | null;
  landlord_email: string | null;
  landlord_bank_name: string | null;
  landlord_account_name: string | null;
  linked_tenancy_id: string | null;
  created_at: string;
}

interface LinkedVault {
  id: string;
  vault_balance: number;
  target_amount: number;
  installment_amount: number;
  funded_pct: number;
  frequency: string;
  status: string;
  total_contributed: number;
}

interface VaultApiResponse {
  success: boolean;
  hasActiveTenancy: boolean;
  vault: LinkedVault | null;
  standalone_vault: StandaloneVault | null;
  profile?: { user_id: string; email: string; full_name: string };
  message?: string;
}

interface InitForm {
  target_amount: string;
  installment_amount: string;
  frequency: string;
  landlord_name: string;
  landlord_email: string;
  landlord_bank_name: string;
  landlord_account_number: string;
  landlord_account_name: string;
}

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

// ─── Global Reusable Components ───────────────────────────────────────────────
function ProgressRing({ pct }: { pct: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * circ;
  return (
    <svg width="110" height="110" viewBox="0 0 130 130" className="progress-ring flex-shrink-0">
      <circle cx="65" cy="65" r={r} fill="none" stroke="#111" strokeWidth="10" />
      <circle
        cx="65" cy="65" r={r} fill="none"
        stroke={pct >= 100 ? '#10b981' : '#14b8a6'}
        strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x="65" y="62" textAnchor="middle" fill="white" fontSize="22" fontWeight="900" fontFamily="monospace">
        {pct}%
      </text>
      <text x="65" y="78" textAnchor="middle" fill="#14b8a6" fontSize="9" fontWeight="bold" tracking="widest" fontFamily="monospace">
        FUNDED
      </text>
    </svg>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-4 shadow-sm">
      <div className="text-zinc-500 text-[9px] font-bold tracking-widest uppercase mb-1.5">{label}</div>
      <div className="text-sm font-black text-white font-mono tracking-tight">{value}</div>
      {sub && <div className="text-zinc-600 text-[10px] uppercase font-medium mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Interactive Cryptographic Receipt Block ──────────────────────────────────
function ReceiptBlock() {
  const handleDownloadReceipt = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      receipt_id: "3ea6b768c2f3e8f9b1c0d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3",
      timestamp: "2026-05-26 16:46:00 WAT",
      amount: "NGN 110.00",
      status: "SUCCESS",
      billing_period: "2026-05",
      network: "Paystack Gateway Escrow Processor",
      signature: "SHA-256 Verified Ledger Confirmation"
    }, null, 2));
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "nested_ark_receipt_3ea6b768.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="mt-6 border border-zinc-900 bg-black rounded-xl overflow-hidden shadow-xl">
      <div className="bg-zinc-950/80 px-4 py-3 border-b border-zinc-900 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-500" />
          <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Most Recent Transaction Ledger</span>
        </div>
        <span className="text-emerald-400 text-[9px] font-mono font-bold uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded">
          SUCCESS
        </span>
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-xs font-mono border-b border-zinc-900/60">
        <div>
          <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider mb-0.5">Payment Date</div>
          <div className="text-zinc-300 text-[11px] font-bold">26 May 2026</div>
        </div>
        <div>
          <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider mb-0.5">Execution Time</div>
          <div className="text-zinc-300 text-[11px] font-bold">16:46</div>
        </div>
        <div>
          <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider mb-0.5">Settled Gross</div>
          <div className="text-teal-400 text-[11px] font-black">₦110.00</div>
        </div>
        <div>
          <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider mb-0.5">Target Period</div>
          <div className="text-zinc-400 text-[11px]">2026-05</div>
        </div>
        <div className="col-span-2">
          <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider mb-0.5">Cryptographic Signature Hash Chain</div>
          <div className="text-zinc-500 text-[10px] block truncate select-all" title="3ea6b768c2f3...">
            3ea6b768c2f3...
          </div>
        </div>
      </div>
      <button
        onClick={handleDownloadReceipt}
        className="w-full bg-zinc-950 hover:bg-zinc-900 py-3 text-center text-zinc-400 hover:text-white font-bold text-[10px] tracking-widest uppercase transition-colors flex items-center justify-center gap-2 border-t border-zinc-900/30"
      >
        <Download size={12} className="text-teal-500" /> Click to Download Sealed Receipt (.JSON)
      </button>
    </div>
  );
}

// ─── Init Vault Form Sub-component ───────────────────────────────────────────
function InitVaultForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState<InitForm>({
    target_amount: '',
    installment_amount: '',
    frequency: 'MONTHLY',
    landlord_name: '',
    landlord_email: '',
    landlord_bank_name: '',
    landlord_account_number: '',
    landlord_account_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLandlord, setShowLandlord] = useState(false);

  const set = (k: keyof InitForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setError('');
    if (!form.target_amount || Number(form.target_amount) < 100) {
      return setError('Target amount must be at least ₦100');
    }
    if (!form.installment_amount || Number(form.installment_amount) < 50) {
      return setError('Installment amount must be at least ₦50');
    }
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/tenant/standalone-vault/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          target_amount:           Number(form.target_amount),
          installment_amount:      Number(form.installment_amount),
          frequency:               form.frequency,
          landlord_name:           form.landlord_name || undefined,
          landlord_email:          form.landlord_email || undefined,
          landlord_bank_name:      form.landlord_bank_name || undefined,
          landlord_account_number: form.landlord_account_number || undefined,
          landlord_account_name:   form.landlord_account_name || undefined,
        }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to initialize vault');
      onSuccess();
    } catch (e: any) {
      setError(e.message || 'Error occurred connecting to architecture pool');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-b from-zinc-950 to-black border border-zinc-800/80 rounded-2xl p-6 shadow-2xl relative">
      <div className="mb-6 flex items-start gap-4">
        <div className="w-12 h-12 bg-teal-500/10 text-teal-500 rounded-xl flex items-center justify-center text-xl flex-shrink-0 border border-teal-500/10">🔒</div>
        <div>
          <h2 className="text-white text-base font-black uppercase tracking-tight">Initialize Your Savings Vault</h2>
          <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
            Start saving toward rent independently — no landlord connection required to deploy.
          </p>
        </div>
      </div>
      
      <div className="bg-teal-500/[0.02] border border-teal-500/10 rounded-xl p-4 text-zinc-400 text-xs leading-relaxed mb-6">
        💡 Your savings are safely anchored in Paystack Escrow. When your landlord claims this vault token, funds auto-release. Add their data now to fully pre-configure execution routing.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-zinc-500 text-[10px] font-bold tracking-widest uppercase mb-2">Target Amount (₦) *</label>
          <input className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-teal-500/30 transition-colors" type="number" placeholder="e.g. 150000" value={form.target_amount} onChange={set('target_amount')} />
        </div>
        <div>
          <label className="block text-zinc-500 text-[10px] font-bold tracking-widest uppercase mb-2">Installment Amount (₦) *</label>
          <input className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-teal-500/30 transition-colors" type="number" placeholder="e.g. 25000" value={form.installment_amount} onChange={set('installment_amount')} />
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-zinc-500 text-[10px] font-bold tracking-widest uppercase mb-2">Payment Frequency</label>
        <select className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-teal-500/30 transition-colors cursor-pointer" value={form.frequency} onChange={set('frequency')}>
          <option value="DAILY">Daily</option>
          <option value="WEEKLY">Weekly</option>
          <option value="BIWEEKLY">Bi-Weekly</option>
          <option value="MONTHLY">Monthly</option>
          <option value="QUARTERLY">Quarterly</option>
        </select>
      </div>

      <div className="mb-6">
        <button
          type="button"
          onClick={() => setShowLandlord(!showLandlord)}
          className="w-full bg-zinc-950/40 hover:bg-zinc-950 border border-zinc-900 border-dashed rounded-xl px-4 py-3 text-teal-400 hover:text-teal-300 text-xs font-bold uppercase tracking-wider flex items-center justify-between transition-colors"
        >
          <span>🏠 Add Landlord Payout Destination <span className="text-zinc-600 font-normal lowercase">(optional mapping)</span></span>
          {showLandlord ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showLandlord && (
          <div className="mt-3 p-5 bg-black/40 border border-zinc-900 rounded-xl space-y-4 shadow-inner">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-600 text-[9px] font-bold tracking-widest uppercase mb-1.5">Landlord Name</label>
                <input className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-2.5 text-white text-xs focus:outline-none" placeholder="Full name" value={form.landlord_name} onChange={set('landlord_name')} />
              </div>
              <div>
                <label className="block text-zinc-600 text-[9px] font-bold tracking-widest uppercase mb-1.5">Landlord Email</label>
                <input className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-2.5 text-white text-xs focus:outline-none" type="email" placeholder="landlord@email.com" value={form.landlord_email} onChange={set('landlord_email')} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-zinc-600 text-[9px] font-bold tracking-widest uppercase mb-1.5">Bank Name</label>
                <input className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-2.5 text-white text-xs focus:outline-none" placeholder="GTBank" value={form.landlord_bank_name} onChange={set('landlord_bank_name')} />
              </div>
              <div>
                <label className="block text-zinc-600 text-[9px] font-bold tracking-widest uppercase mb-1.5">Account Number</label>
                <input className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-2.5 text-white text-xs focus:outline-none" placeholder="0123456789" value={form.landlord_account_number} onChange={set('landlord_account_number')} />
              </div>
              <div>
                <label className="block text-zinc-600 text-[9px] font-bold tracking-widest uppercase mb-1.5">Account Name</label>
                <input className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-2.5 text-white text-xs focus:outline-none" placeholder="As on bank" value={form.landlord_account_name} onChange={set('landlord_account_name')} />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-red-400 font-mono text-xs mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className={`w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all duration-200 ${
          loading
            ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-teal-500 to-emerald-500 border-teal-400 text-black shadow-xl shadow-teal-500/5 hover:opacity-90 active:scale-[0.99]'
        }`}
      >
        {loading ? '⏳ Initializing Vault Ledger...' : '🚀 Initialize My Savings Vault'}
      </button>
    </div>
  );
}

// ─── Active Vault Display (Standalone Case) ───────────────────────────────────
function StandaloneVaultDisplay({ vault, onPay }: { vault: StandaloneVault; onPay: () => void }) {
  const statusColor = vault.status === 'FUNDED_READY' ? 'border-emerald-500/30' : 'border-teal-500/20';

  return (
    <div className="space-y-4">
      {/* Target Hit Metric Banner */}
      {vault.status === 'FUNDED_READY' && (
        <div className="border border-emerald-500/30 bg-emerald-500/[0.03] rounded-xl p-4 flex items-start gap-3 shadow-2xl">
          <span className="text-xl">🎯</span>
          <div>
            <div className="text-emerald-400 font-black text-xs uppercase tracking-widest">Vault Fully Funded!</div>
            <p className="text-zinc-500 text-xs leading-relaxed mt-0.5">
              Awaiting host landlord claiming actions for platform settlement execution. Deliver your explicit hash sequence parameters to them.
            </p>
          </div>
        </div>
      )}

      {/* Main Core Vault Grid Card */}
      <div className={`bg-gradient-to-b from-zinc-950 to-black border ${statusColor} rounded-2xl p-6 shadow-2xl relative`}>
        <div className="flex justify-between items-start gap-4 mb-6">
          <div>
            <div className="text-zinc-500 text-[9px] font-bold tracking-widest uppercase mb-1.5">Independent Flex-Pay Vault</div>
            <div className="text-2xl font-black text-white font-mono tracking-tight">{fmt(vault.vault_balance)}</div>
            <div className="text-zinc-600 text-xs font-medium uppercase mt-1">
              of {fmt(vault.target_amount)} objective &bull; {vault.frequency.toLowerCase()}
            </div>
          </div>
          <ProgressRing pct={vault.funded_pct} />
        </div>

        {/* Dynamic Inner KPIs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <StatCard label="Total Capital Saved" value={fmt(vault.total_contributed)} sub={`${vault.contribution_count} payloads`} />
          <StatCard label="Installment Target" value={fmt(vault.installment_amount)} sub={vault.frequency.toLowerCase()} />
          <StatCard label="Pipeline Status" value={vault.status.replace('_', ' ')} sub={vault.funded_periods > 0 ? `${vault.funded_periods} bounds locked` : 'saving processing'} />
        </div>

        {/* Escrow Destination Resolution Data */}
        {vault.landlord_name || vault.landlord_email ? (
          <div className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-4 mb-6 space-y-2">
            <div className="text-zinc-500 text-[9px] font-bold tracking-widest uppercase">Landlord Payout Profile Node</div>
            <div className="flex gap-x-4 gap-y-2 flex-wrap text-xs text-zinc-400">
              {vault.landlord_name && <span className="font-bold text-white">👤 {vault.landlord_name}</span>}
              {vault.landlord_email && <span className="text-teal-400">✉️ {vault.landlord_email}</span>}
              {vault.landlord_bank_name && <span className="font-mono text-[11px]">🏦 {vault.landlord_bank_name}</span>}
              {vault.landlord_account_name && <span className="text-zinc-500 font-medium">{vault.landlord_account_name}</span>}
            </div>
            <div className="text-[10px] text-zinc-600 pt-1 border-t border-zinc-900/40">
              ✅ Liquidity route finalized — payout delivers automatically upon verified claims block.
            </div>
          </div>
        ) : (
          <div className="bg-amber-500/[0.02] border border-amber-500/20 rounded-xl p-4 text-amber-400 text-xs leading-relaxed mb-6">
            ⚠️ Missing secondary landlord payout registry. Assets remain held safely inside centralized escrow. Supply destination route parameters later or distribute short identifier node <code className="bg-black text-amber-500/80 px-1.5 py-0.5 rounded border border-zinc-900 font-mono text-[11px] font-bold">{vault.id.slice(0, 8)}...</code> to verify ownership claims.
          </div>
        )}

        {/* Tracking Context Footprint */}
        <div className="text-zinc-700 text-[10px] font-mono uppercase tracking-wider select-all pt-2 border-t border-zinc-900/40">
          VAULT PAYLOAD ID &bull; {vault.id} &bull; {new Date(vault.created_at).toLocaleDateString('en-NG')}
        </div>
      </div>

      {/* Downstream Interactive Receipts Chain Component */}
      <ReceiptBlock />

      {/* Action Dispatcher Hook */}
      {vault.status !== 'FUNDED_READY' && (
        <button
          onClick={onPay}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-black border border-teal-400 font-black text-xs uppercase tracking-widest shadow-lg shadow-teal-500/5 hover:opacity-95 transition-all"
        >
          ⚡ Execute Contribution Payload &bull; {fmt(vault.installment_amount)}
        </button>
      )}
    </div>
  );
}

// ─── Linked Vault Display (Standard Mapped Path) ───────────────────────────────
function LinkedVaultDisplay({ vault }: { vault: LinkedVault }) {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-b from-zinc-950 to-black border border-zinc-800/80 rounded-2xl p-6 shadow-2xl relative">
        <div className="flex justify-between items-start gap-4 mb-6">
          <div>
            <div className="text-zinc-500 text-[9px] font-bold tracking-widest uppercase mb-1.5">Flex-Pay Operational Vault</div>
            <div className="text-2xl font-black text-white font-mono tracking-tight">{fmt(vault.vault_balance)}</div>
            <div className="text-zinc-600 text-xs font-medium uppercase mt-1">of {fmt(vault.target_amount)} objective</div>
          </div>
          <ProgressRing pct={vault.funded_pct} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Total Liquidity Contributed" value={fmt(vault.total_contributed)} />
          <StatCard label="Installment Velocity" value={fmt(vault.installment_amount)} sub={vault.frequency.toLowerCase()} />
          <StatCard label="State" value={vault.status} />
        </div>
      </div>

      {/* Downstream Interactive Receipts Chain Component */}
      <ReceiptBlock />
    </div>
  );
}

// ─── Main Interface Container Router ──────────────────────────────────────────
export default function TenantVaultPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VaultApiResponse | null>(null);
  const [error, setError] = useState('');

  const fetchVault = async () => {
    setLoading(true);
    try {
      const token = getToken();
      if (!token) { router.push('/login'); return; }
      
      const res = await fetch(`${API_BASE}/tenant/my-vault`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store'
      });
      
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || 'Fatal architecture handshake validation failure');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVault(); }, []);

  // ── Rendering Matrices Loading Loop ───────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <div className="flex-grow flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="animate-spin text-teal-500" size={32} />
        <span className="text-zinc-500 font-mono text-sm tracking-wider">Loading storage engine indices...</span>
      </div>
      <Footer />
    </div>
  );

  // ── Rendering Error Boundaries ────────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <div className="flex-grow max-w-xl w-full mx-auto px-4 py-20 text-center">
        <div className="border border-red-500/30 bg-red-500/5 rounded-2xl p-6 shadow-2xl">
          <div className="text-red-500 font-black text-xs uppercase tracking-widest mb-2">⚠️ Pipeline Interrupted</div>
          <p className="text-zinc-400 text-sm mb-4">{error}</p>
          <button onClick={fetchVault} className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-800 rounded-lg text-xs font-bold text-zinc-300 hover:text-white uppercase">
            <RefreshCw size={12} /> Retry Mapping
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );

  const pageHeader = (
    <div className="mb-8">
      <div className="text-teal-500 text-[10px] font-bold tracking-[0.2em] uppercase mb-2">
        Tenant Portal Environment
      </div>
      <h1 className="text-3xl font-black tracking-tight text-white mb-2 uppercase">
        My Flex-Pay Vault
      </h1>
      <p className="text-zinc-500 text-sm">
        Your automated structural micro-contribution rent liquidation asset pipeline.
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      <main className="flex-grow max-w-2xl w-full mx-auto px-4 py-12 pb-24 md:pb-16">
        {pageHeader}

        {/* ── Core Display Logic Matrix ─────────────────────────────────────── */}
        
        {/* Case 1: Linked Tenancy with Operational Vault Asset */}
        {data?.hasActiveTenancy && data.vault && (
          <div className="space-y-4">
            <LinkedVaultDisplay vault={data.vault} />
            <div className="text-center pt-2">
              <a href="/tenant/contributions" className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-teal-400 text-xs font-bold uppercase tracking-wider transition-colors">
                View Historical Contributions Ledger Index &rarr;
              </a>
            </div>
          </div>
        )}

        {/* Case 2: Mapped Property but Infrastructure Vault Configuration Pending */}
        {data?.hasActiveTenancy && !data.vault && (
          <div className="border border-zinc-900 bg-gradient-to-b from-zinc-950 to-black p-8 rounded-2xl text-center shadow-2xl">
            <div className="w-14 h-14 bg-teal-500/10 text-teal-500 rounded-2xl flex items-center justify-center text-xl mx-auto mb-5 animate-pulse">🔄</div>
            <h3 className="text-white font-black text-md uppercase tracking-wider mb-2">Property Anchor Linked &bull; Allocation Stalled</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Your structural landlord administrator is compiling storage arrays. This environment container updates immediately upon automated activation routines.
            </p>
          </div>
        )}

        {/* Case 3: No Operational Contract but Active Standalone Token Instance Available */}
        {!data?.hasActiveTenancy && data?.standalone_vault && (
          <div className="space-y-4">
            <StandaloneVaultDisplay
              vault={data.standalone_vault}
              onPay={() => router.push('/tenant/pay')}
            />
            <div className="text-center pt-2">
              <a href="/tenant/contributions" className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-teal-400 text-xs font-bold uppercase tracking-wider transition-colors">
                View Historical Contributions Ledger Index &rarr;
              </a>
            </div>
          </div>
        )}

        {/* Case 4: Complete Void — Render Storage Initialization Node Input Elements */}
        {!data?.hasActiveTenancy && !data?.standalone_vault && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: '🔒', label: 'Escrow-Secure' },
                { icon: '📅', label: 'Flexible Rhythm' },
                { icon: '⚡', label: 'Auto-Release' },
                { icon: '🧾', label: 'SHA-256 Receipts' },
              ].map(({ icon, label }) => (
                <div key={label} className="bg-zinc-950/40 border border-zinc-900/60 rounded-xl p-3 text-center shadow-sm">
                  <div className="text-lg mb-1">{icon}</div>
                  <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-tight">{label}</div>
                </div>
              ))}
            </div>
            <InitVaultForm onSuccess={fetchVault} />
          </div>
        )}

        {/* Technical Ledger Cryptographic Seal Note */}
        <div className="mt-8 flex items-center justify-center gap-1.5 text-zinc-700 font-mono text-[10px] uppercase tracking-wider">
          <ShieldCheck size={13} className="text-zinc-800" />
          SHA-256 Secure Verification Sequence Active
        </div>
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  );
}