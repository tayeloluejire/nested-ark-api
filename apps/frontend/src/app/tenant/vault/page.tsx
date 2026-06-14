'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  Lock, ShieldCheck, DollarSign, ChevronRight,
  RefreshCw, AlertCircle, Info, CreditCard,
} from 'lucide-react';

const API_BASE = '/api';
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}
const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(n);

// ── TenantNav — includes My Banking ──────────────────────────────────────────
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

// ── Types ─────────────────────────────────────────────────────────────────────
interface StandaloneVault {
  id: string; vault_balance: number; target_amount: number; installment_amount: number;
  funded_pct: number; frequency: string; status: string; currency: string;
  funded_periods: number; total_contributed: number; contribution_count: number;
  rent_amount: number | null; platform_fee_amount: number | null;
  landlord_name: string|null; landlord_email: string|null;
  landlord_bank_name: string|null; landlord_account_name: string|null;
  landlord_account_number: string|null;
  linked_tenancy_id: string|null; created_at: string;
  payout_preference: 'TENANT' | 'LANDLORD' | 'ASK' | null;
  tenant_bank_name: string|null; tenant_account_number: string|null; tenant_account_name: string|null;
}
interface LinkedVault {
  id: string; vault_balance: number; target_amount: number; installment_amount: number;
  funded_pct: number; frequency: string; status: string; total_contributed: number; currency?: string;
}
interface VaultApiResponse {
  success: boolean; hasActiveTenancy: boolean;
  vault: LinkedVault|null; standalone_vault: StandaloneVault|null;
  profile?: { email: string; full_name: string };
}
interface InitForm {
  rent_amount: string; frequency: string;
  landlord_name: string; landlord_email: string;
  landlord_bank_name: string; landlord_account_number: string; landlord_account_name: string;
  payout_preference: 'TENANT' | 'LANDLORD' | 'ASK';
  tenant_bank_name: string; tenant_account_number: string; tenant_account_name: string;
  due_date: string;
}

// ── Fee calculator (mirrors backend exactly) ───────────────────────────────────
const PLATFORM_FEE_PCT = 0.02;
const PERIODS: Record<string, number> = {
  DAILY: 365, WEEKLY: 52, BIWEEKLY: 26, MONTHLY: 12, QUARTERLY: 4,
};
function calcFees(rentAmount: number, frequency: string) {
  const fee         = Math.round(rentAmount * PLATFORM_FEE_PCT * 100) / 100;
  const target      = Math.round((rentAmount + fee) * 100) / 100;
  const periods     = PERIODS[frequency] || 12;
  const installment = Math.ceil((target / periods) * 100) / 100;
  return { fee, target, installment, periods };
}

// ── ProgressRing ──────────────────────────────────────────────────────────────
function ProgressRing({ pct }: { pct: number }) {
  const r = 54, circ = 2 * Math.PI * r, dash = (pct / 100) * circ;
  const col = pct >= 100 ? '#10b981' : pct >= 80 ? '#14b8a6' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="130" height="130" viewBox="0 0 130 130">
      <circle cx="65" cy="65" r={r} fill="none" stroke="#18181b" strokeWidth="10"/>
      <circle cx="65" cy="65" r={r} fill="none" stroke={col} strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ/4}
        strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.8s ease' }}/>
      <text x="65" y="60" textAnchor="middle" fill="white" fontSize="22" fontWeight="700" fontFamily="monospace">{pct}%</text>
      <text x="65" y="78" textAnchor="middle" fill={col} fontSize="9" fontFamily="monospace" letterSpacing="2">FUNDED</text>
    </svg>
  );
}

// ── EscrowSeal ────────────────────────────────────────────────────────────────
function EscrowSeal({ status }: { status: string }) {
  const ready = status === 'FUNDED_READY';
  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl border ${ready ? 'border-teal-500/30 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/20'}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${ready ? 'bg-teal-500/20' : 'bg-zinc-800'}`}>
        <Lock size={14} className={ready ? 'text-teal-400' : 'text-zinc-500'}/>
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-300">
          {ready ? '🔓 Escrow Release Pending' : '🔒 Vault Escrow Active'}
        </p>
        <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
          {ready
            ? 'Vault fully funded. Funds will be disbursed to your landlord within 24 hours.'
            : 'Funds held in Paystack escrow. Auto-disbursed when vault reaches 100%.'}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <ShieldCheck size={9} className="text-teal-500"/>
          <span className="text-[8px] text-teal-500 font-bold uppercase tracking-widest">
            Paystack-secured · SHA-256 · Court-admissible
          </span>
        </div>
      </div>
    </div>
  );
}

// ── VaultStats Grid ───────────────────────────────────────────────────────────
function VaultStats({ items }: { items: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {items.map(s => (
        <div key={s.label} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
          <p className="text-zinc-600 uppercase font-bold text-[8px] mb-0.5">{s.label}</p>
          <p className={`font-black font-mono text-[11px] ${s.color || 'text-white'}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Fee Breakdown Panel ───────────────────────────────────────────────────────
function FeeBreakdown({ rentAmount, frequency }: { rentAmount: number; frequency: string }) {
  const { fee, target, installment } = calcFees(rentAmount, frequency);
  const freqLabel = frequency.charAt(0) + frequency.slice(1).toLowerCase();
  return (
    <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/5 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Info size={11} className="text-teal-500"/>
        <span className="text-[9px] text-teal-500 uppercase font-black tracking-widest">Your Rent Plan</span>
      </div>
      <div className="space-y-2">
        {[
          { label: 'Rent Amount',              value: fmt(rentAmount),  color: 'text-white'     },
          { label: 'Rent Success Fee (2%)',    value: fmt(fee),         color: 'text-amber-400' },
          { label: 'Total Savings Target',     value: fmt(target),      color: 'text-teal-400', bold: true },
          { label: `${freqLabel} Contribution`, value: fmt(installment), color: 'text-teal-300', bold: true },
        ].map(r => (
          <div key={r.label} className={`flex justify-between items-center text-[10px] ${r.bold ? 'border-t border-teal-500/20 pt-2' : ''}`}>
            <span className={r.bold ? 'text-zinc-300 font-bold' : 'text-zinc-500'}>{r.label}</span>
            <span className={`font-mono font-bold ${r.color}`}>{r.value}</span>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-zinc-600 leading-relaxed pt-1 border-t border-zinc-800">
        The 2% Rent Success Fee covers: automated rent planning, smart vault, AutoPay, contribution tracking, secure escrow, and payment history.{' '}
        <span className="text-zinc-500">Landlord always receives 100% of agreed rent.</span>
      </p>
    </div>
  );
}

// ── Init Vault Form — 2-step: form → confirm ──────────────────────────────────
function InitVaultForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState<InitForm>({
    rent_amount: '', frequency: 'MONTHLY',
    landlord_name: '', landlord_email: '',
    landlord_bank_name: '', landlord_account_number: '', landlord_account_name: '',
    payout_preference: 'ASK',
    tenant_bank_name: '', tenant_account_number: '', tenant_account_name: '',
    due_date: '',
  });
  const [step,    setStep]    = useState<'form' | 'confirm'>('form');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [showLL,  setShowLL]  = useState(false);

  const set = (k: keyof InitForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const setPayoutPreference = (p: 'TENANT' | 'LANDLORD' | 'ASK') =>
    setForm(f => ({ ...f, payout_preference: p }));

  const rentNum = parseFloat(form.rent_amount) || 0;
  const fees    = rentNum >= 100 ? calcFees(rentNum, form.frequency) : null;

  const handleContinue = () => {
    setError('');
    if (!form.rent_amount || rentNum < 100) return setError('Rent amount must be at least ₦100');
    if (fees && fees.installment < 50) {
      return setError(`Calculated installment (${fmt(fees.installment)}) is below ₦50 minimum. Choose a less frequent schedule or increase rent amount.`);
    }
    if (form.payout_preference === 'LANDLORD') {
      if (!form.landlord_account_number || !form.landlord_bank_name || !form.landlord_account_name) {
        return setError('Please provide landlord bank name, account number and account name for direct payout.');
      }
    }
    if (form.payout_preference === 'TENANT') {
      if (!form.tenant_account_number || !form.tenant_bank_name || !form.tenant_account_name) {
        return setError('Please provide your bank name, account number and account name to receive funds.');
      }
    }
    setStep('confirm');
  };

  const handleSubmit = async () => {
    setError(''); setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/tenant/standalone-vault/init`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          rent_amount:             rentNum,
          frequency:               form.frequency,
          landlord_name:           form.landlord_name           || undefined,
          landlord_email:          form.landlord_email          || undefined,
          landlord_bank_name:      form.landlord_bank_name      || undefined,
          landlord_account_number: form.landlord_account_number || undefined,
          landlord_account_name:   form.landlord_account_name   || undefined,
          payout_preference:       form.payout_preference,
          tenant_bank_name:        form.tenant_bank_name        || undefined,
          tenant_account_number:   form.tenant_account_number   || undefined,
          tenant_account_name:     form.tenant_account_name     || undefined,
          due_date:                form.due_date                || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to initialize vault');
      onSuccess();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const inp = "w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors";
  const lbl = "block text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-1.5";

  // ── Step 2: Confirm ───────────────────────────────────────────────────────
  if (step === 'confirm' && fees) {
    return (
      <div className="p-6 rounded-2xl border border-teal-500/20 bg-zinc-900/20 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center text-xl flex-shrink-0">✅</div>
          <div>
            <h2 className="font-black text-sm uppercase tracking-tight">Confirm Your Rent Plan</h2>
            <p className="text-[10px] text-zinc-500 mt-0.5">Review before activating your vault</p>
          </div>
        </div>

        <FeeBreakdown rentAmount={rentNum} frequency={form.frequency} />

        {/* Payout preference summary */}
        <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-1 text-[10px]">
          <p className="text-zinc-500 uppercase font-bold tracking-widest text-[8px] mb-2">On 100% Completion</p>
          {form.payout_preference === 'TENANT' && (
            <>
              <p className="text-teal-400">🏦 Funds withdraw to your bank account</p>
              <p className="text-white">{form.tenant_account_name} · {form.tenant_bank_name} · {form.tenant_account_number}</p>
            </>
          )}
          {form.payout_preference === 'LANDLORD' && (
            <>
              <p className="text-teal-400">🏠 Funds release directly to your landlord</p>
              <p className="text-white">{form.landlord_account_name} · {form.landlord_bank_name} · {form.landlord_account_number}</p>
              {form.landlord_name && <p className="text-zinc-400">👤 {form.landlord_name}</p>}
            </>
          )}
          {form.payout_preference === 'ASK' && (
            <p className="text-amber-400">🤔 We'll ask you to choose when your vault reaches 100%</p>
          )}
          {form.due_date && (
            <p className="text-zinc-500 mt-1">📅 Rent due: {new Date(form.due_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          )}
        </div>

        {form.landlord_name && form.payout_preference !== 'LANDLORD' && (
          <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-1 text-[10px]">
            <p className="text-zinc-500 uppercase font-bold tracking-widest text-[8px] mb-2">Landlord On Record</p>
            {form.landlord_name      && <p className="text-white">👤 {form.landlord_name}</p>}
            {form.landlord_email     && <p className="text-teal-400">✉️ {form.landlord_email}</p>}
            {form.landlord_bank_name && <p className="text-zinc-400">🏦 {form.landlord_bank_name}</p>}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-[11px]">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setStep('form')}
            className="py-3.5 rounded-xl border border-zinc-700 text-zinc-400 font-black text-[10px] uppercase tracking-widest hover:border-zinc-600 transition-all">
            ← Edit
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className={`py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
              loading ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-teal-500 text-black hover:bg-teal-400'}`}>
            {loading ? '⏳ Activating…' : '🚀 Activate Vault'}
          </button>
        </div>
      </div>
    );
  }

  // ── Step 1: Form ──────────────────────────────────────────────────────────
  return (
    <div className="p-6 rounded-2xl border border-teal-500/20 bg-zinc-900/20 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center text-xl flex-shrink-0">🔒</div>
        <div>
          <h2 className="font-black text-sm uppercase tracking-tight">Create Your Rent Plan</h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Free to create — 2% Rent Success Fee applies only when rent is disbursed to your landlord.
          </p>
        </div>
      </div>

      <div className="p-3 rounded-xl border border-teal-500/15 bg-teal-500/5 text-[10px] text-teal-400 leading-relaxed">
        💡 Enter your actual rent amount. Nested Ark calculates your savings target, installment schedule, and the transparent 2% fee. Savings held in Paystack escrow — landlord receives 100% of agreed rent.
      </div>

      {/* Rent amount — primary input */}
      <div>
        <label className={lbl}>Your Annual Rent Amount (₦) *</label>
        <input className={inp} type="number" min="100" step="1000"
          placeholder="e.g. 1200000"
          value={form.rent_amount} onChange={set('rent_amount')}/>
        <p className="text-[9px] text-zinc-600 mt-1.5">Enter the total rent amount your landlord will receive (e.g. annual rent).</p>
      </div>

      {/* Frequency */}
      <div>
        <label className={lbl}>Contribution Frequency</label>
        <select className={inp + " cursor-pointer"} value={form.frequency} onChange={set('frequency')}>
          <option value="MONTHLY">Monthly (12 payments/year)</option>
          <option value="WEEKLY">Weekly (52 payments/year)</option>
          <option value="BIWEEKLY">Bi-Weekly (26 payments/year)</option>
          <option value="QUARTERLY">Quarterly (4 payments/year)</option>
          <option value="DAILY">Daily (365 payments/year)</option>
        </select>
      </div>

      {/* Rent due date — powers Rent Mandate Vault reminders */}
      <div>
        <label className={lbl}>Rent Due Date (optional)</label>
        <input className={inp} type="date" value={form.due_date} onChange={set('due_date')}/>
        <p className="text-[9px] text-zinc-600 mt-1.5">
          Set this so Nested Ark can send you savings reminders and a countdown to your rent date.
        </p>
      </div>

      {/* Payout Preference — Smart Choice (Option C) */}
      <div>
        <label className={lbl}>When Your Vault Reaches 100%, What Should Happen?</label>
        <div className="space-y-2">
          {[
            { key: 'TENANT'   as const, icon: '🏦', title: 'Send to My Account',   sub: 'Withdraw the full amount to my own bank account. I will pay my landlord myself.' },
            { key: 'LANDLORD' as const, icon: '🏠', title: 'Pay My Landlord Directly', sub: 'Release funds directly to the landlord bank account I provide below.' },
            { key: 'ASK'      as const, icon: '🤔', title: 'Ask Me When Target Is Reached', sub: "I'm not sure yet — let me decide when my vault is fully funded." },
          ].map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setPayoutPreference(opt.key)}
              className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                form.payout_preference === opt.key
                  ? 'border-teal-500/50 bg-teal-500/10'
                  : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
              }`}
            >
              <span className="text-lg leading-none">{opt.icon}</span>
              <div className="flex-1">
                <p className={`text-[11px] font-black uppercase tracking-tight ${
                  form.payout_preference === opt.key ? 'text-teal-400' : 'text-zinc-300'
                }`}>{opt.title}</p>
                <p className="text-[9px] text-zinc-500 mt-0.5 leading-relaxed">{opt.sub}</p>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                form.payout_preference === opt.key ? 'border-teal-500' : 'border-zinc-700'
              }`}>
                {form.payout_preference === opt.key && <div className="w-2 h-2 rounded-full bg-teal-500"/>}
              </div>
            </button>
          ))}
        </div>
        <p className="text-[9px] text-zinc-600 mt-1.5">
          You can change this anytime before your vault matures — even if your landlord isn't on Nested Ark yet.
        </p>
      </div>

      {/* Tenant's own bank account — required if payout_preference === TENANT */}
      {form.payout_preference === 'TENANT' && (
        <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/5 space-y-4">
          <p className="text-[9px] text-teal-400 uppercase font-black tracking-widest">Your Bank Account (Withdrawal Destination)</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Bank Name *</label>
              <input className={inp} placeholder="GTBank" value={form.tenant_bank_name} onChange={set('tenant_bank_name')}/>
            </div>
            <div>
              <label className={lbl}>Account Number *</label>
              <input className={inp} placeholder="0123456789" value={form.tenant_account_number} onChange={set('tenant_account_number')}/>
            </div>
            <div>
              <label className={lbl}>Account Name *</label>
              <input className={inp} placeholder="As on bank" value={form.tenant_account_name} onChange={set('tenant_account_name')}/>
            </div>
          </div>
        </div>
      )}

      {/* Live fee breakdown — renders as soon as valid rent amount entered */}
      {fees && <FeeBreakdown rentAmount={rentNum} frequency={form.frequency} />}

      {/* Landlord details — required if payout_preference === LANDLORD, optional otherwise */}
      {form.payout_preference === 'LANDLORD' ? (
        <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/5 space-y-4">
          <p className="text-[9px] text-teal-400 uppercase font-black tracking-widest">Landlord Payout Details (Required)</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Landlord Name</label>
              <input className={inp} placeholder="Full name" value={form.landlord_name} onChange={set('landlord_name')}/>
            </div>
            <div>
              <label className={lbl}>Landlord Email</label>
              <input className={inp} type="email" placeholder="landlord@email.com" value={form.landlord_email} onChange={set('landlord_email')}/>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Bank Name *</label>
              <input className={inp} placeholder="GTBank" value={form.landlord_bank_name} onChange={set('landlord_bank_name')}/>
            </div>
            <div>
              <label className={lbl}>Account Number *</label>
              <input className={inp} placeholder="0123456789" value={form.landlord_account_number} onChange={set('landlord_account_number')}/>
            </div>
            <div>
              <label className={lbl}>Account Name *</label>
              <input className={inp} placeholder="As on bank" value={form.landlord_account_name} onChange={set('landlord_account_name')}/>
            </div>
          </div>
        </div>
      ) : (
        <>
          <button onClick={() => setShowLL(!showLL)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-500 text-[10px] hover:border-teal-500/30 hover:text-teal-400 transition-all">
            <span>🏠 Add Landlord Payout Details <span className="text-zinc-700">(optional — pre-configures auto-release)</span></span>
            <span className="text-xs">{showLL ? '▲' : '▼'}</span>
          </button>

          {showLL && (
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Landlord Name</label>
                  <input className={inp} placeholder="Full name" value={form.landlord_name} onChange={set('landlord_name')}/>
                </div>
                <div>
                  <label className={lbl}>Landlord Email</label>
                  <input className={inp} type="email" placeholder="landlord@email.com" value={form.landlord_email} onChange={set('landlord_email')}/>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={lbl}>Bank Name</label>
                  <input className={inp} placeholder="GTBank" value={form.landlord_bank_name} onChange={set('landlord_bank_name')}/>
                </div>
                <div>
                  <label className={lbl}>Account Number</label>
                  <input className={inp} placeholder="0123456789" value={form.landlord_account_number} onChange={set('landlord_account_number')}/>
                </div>
                <div>
                  <label className={lbl}>Account Name</label>
                  <input className={inp} placeholder="As on bank" value={form.landlord_account_name} onChange={set('landlord_account_name')}/>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-[11px]">{error}</div>
      )}

      <button onClick={handleContinue} disabled={!fees}
        className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
          !fees
            ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            : 'bg-teal-500 text-black hover:bg-teal-400 cursor-pointer'}`}>
        Continue — Review Rent Plan →
      </button>
    </div>
  );
}

// ── Payout Choice Prompt — shown when payout_preference === ASK and vault is full ─
function PayoutChoicePrompt({ vaultId }: { vaultId: string }) {
  const [choice,  setChoice]  = useState<'TENANT' | 'LANDLORD' | null>(null);
  const [bank,    setBank]    = useState('');
  const [acct,    setAcct]    = useState('');
  const [name,    setName]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [done,    setDone]    = useState(false);

  const inp = "w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors";
  const lbl = "block text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-1.5";

  const handleSubmit = async () => {
    if (!choice) return setError('Please choose where your funds should go.');
    if (!bank || !acct || !name) return setError('Please fill in all bank account details.');
    setError(''); setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/tenant/standalone-vault/${vaultId}/payout-choice`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          payout_choice: choice,
          bank_name: bank, account_number: acct, account_name: name,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save payout choice');
      setDone(true);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (done) {
    return (
      <div className="p-4 rounded-2xl border border-teal-500/30 bg-teal-500/5 text-center">
        <p className="text-teal-400 font-black text-sm">✅ Payout destination saved</p>
        <p className="text-zinc-500 text-[10px] mt-1">Funds will be disbursed within 24 hours.</p>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-4">
      <p className="text-[9px] text-amber-400 uppercase font-black tracking-widest">
        Your Vault Is Full — Where Should the Funds Go?
      </p>

      <div className="grid grid-cols-2 gap-2">
        {[
          { key: 'TENANT'   as const, icon: '🏦', title: 'Send to My Account' },
          { key: 'LANDLORD' as const, icon: '🏠', title: 'Pay My Landlord' },
        ].map(opt => (
          <button key={opt.key} type="button" onClick={() => setChoice(opt.key)}
            className={`p-3 rounded-xl border text-center transition-all ${
              choice === opt.key ? 'border-teal-500/50 bg-teal-500/10 text-teal-400' : 'border-zinc-800 bg-zinc-900/30 text-zinc-400 hover:border-zinc-700'
            }`}>
            <div className="text-lg mb-1">{opt.icon}</div>
            <p className="text-[10px] font-black uppercase tracking-tight">{opt.title}</p>
          </button>
        ))}
      </div>

      {choice && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={lbl}>{choice === 'TENANT' ? 'Your Bank' : 'Landlord Bank'}</label>
            <input className={inp} placeholder="GTBank" value={bank} onChange={e => setBank(e.target.value)}/>
          </div>
          <div>
            <label className={lbl}>Account Number</label>
            <input className={inp} placeholder="0123456789" value={acct} onChange={e => setAcct(e.target.value)}/>
          </div>
          <div>
            <label className={lbl}>Account Name</label>
            <input className={inp} placeholder="As on bank" value={name} onChange={e => setName(e.target.value)}/>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-[11px]">{error}</div>
      )}

      <button onClick={handleSubmit} disabled={loading || !choice}
        className={`w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
          loading || !choice ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-teal-500 text-black hover:bg-teal-400'}`}>
        {loading ? '⏳ Saving…' : 'Confirm Payout Destination'}
      </button>
    </div>
  );
}

// ── Standalone Vault Display ──────────────────────────────────────────────────
function StandaloneVaultDisplay({ vault, onPay }: { vault: StandaloneVault; onPay: () => void }) {
  const col = vault.status === 'FUNDED_READY' ? '#10b981' : '#14b8a6';
  const hasBreakdown = vault.rent_amount != null && vault.platform_fee_amount != null;

  return (
    <div className="space-y-4">
      {vault.status === 'FUNDED_READY' && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-teal-500/30 bg-teal-500/5">
          <span className="text-xl">🎯</span>
          <div>
            <p className="text-teal-400 font-black text-sm">Vault Fully Funded!</p>
            {vault.payout_preference === 'TENANT' && (
              <p className="text-zinc-500 text-[10px] mt-0.5">
                Funds will be withdrawn to your account ({vault.tenant_bank_name} · {vault.tenant_account_number}) within 24 hours.
              </p>
            )}
            {vault.payout_preference === 'LANDLORD' && (
              <p className="text-zinc-500 text-[10px] mt-0.5">
                Funds will be released directly to your landlord ({vault.landlord_bank_name} · {vault.landlord_account_number}) within 24 hours.
              </p>
            )}
            {(vault.payout_preference === 'ASK' || !vault.payout_preference) && (
              <p className="text-zinc-500 text-[10px] mt-0.5">
                Choose where your funds go below — to your account or directly to your landlord.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Payout choice prompt — shown when preference is ASK and vault is fully funded */}
      {vault.status === 'FUNDED_READY' && (vault.payout_preference === 'ASK' || !vault.payout_preference) && (
        <PayoutChoicePrompt vaultId={vault.id}/>
      )}

      <div className="p-6 rounded-2xl border bg-zinc-900/20" style={{ borderColor: `${col}30` }}>
        <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-5">Independent Flex-Pay Vault</p>

        <div className="flex flex-col md:flex-row items-center gap-8 mb-6">
          <ProgressRing pct={vault.funded_pct}/>
          <div className="flex-1 w-full space-y-3">
            <div>
              <p className="font-black font-mono text-2xl text-white">{fmt(vault.vault_balance)}</p>
              <p className="text-zinc-500 text-xs mt-0.5">
                of {fmt(vault.target_amount)} target · {vault.frequency.toLowerCase()}
              </p>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${vault.funded_pct}%`, background: col }}/>
            </div>
          </div>
        </div>

        <VaultStats items={[
          { label: 'Total Saved',    value: fmt(vault.total_contributed),  color: 'text-teal-400' },
          { label: 'Installment',    value: fmt(vault.installment_amount), color: 'text-white' },
          { label: 'Payments',       value: String(vault.contribution_count), color: 'text-zinc-300' },
          { label: 'Funded Periods', value: String(vault.funded_periods),  color: 'text-zinc-300' },
          { label: 'Status',         value: vault.status.replace('_', ' '),
            color: vault.status === 'FUNDED_READY' ? 'text-teal-400' : 'text-zinc-300' },
          { label: 'Currency',       value: vault.currency },
        ]}/>

        {/* Fee transparency breakdown */}
        {hasBreakdown && (
          <div className="mt-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-2">Rent Plan Breakdown</p>
            {[
              { label: 'Rent Amount',           value: fmt(vault.rent_amount!),         color: 'text-white' },
              { label: 'Rent Success Fee (2%)', value: fmt(vault.platform_fee_amount!), color: 'text-amber-400' },
              { label: 'Total Target',          value: fmt(vault.target_amount),         color: 'text-teal-400', bold: true },
            ].map(r => (
              <div key={r.label} className={`flex justify-between text-[10px] ${r.bold ? 'border-t border-zinc-700 pt-2 font-bold' : ''}`}>
                <span className={r.bold ? 'text-zinc-300' : 'text-zinc-500'}>{r.label}</span>
                <span className={`font-mono ${r.color}`}>{r.value}</span>
              </div>
            ))}
            <p className="text-[9px] text-zinc-600 pt-1">
              Landlord receives 100% of {fmt(vault.rent_amount!)} when vault matures.
            </p>
          </div>
        )}

        {/* Payout destination — reflects chosen preference */}
        {vault.payout_preference === 'TENANT' && vault.tenant_account_number ? (
          <div className="mt-4 p-4 rounded-xl border border-teal-500/15 bg-teal-500/5">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-2">Payout Destination — Your Account</p>
            <div className="flex gap-4 flex-wrap text-xs">
              <span className="text-white">👤 {vault.tenant_account_name}</span>
              <span className="text-teal-400">🏦 {vault.tenant_bank_name}</span>
              <span className="text-zinc-400">{vault.tenant_account_number}</span>
            </div>
            <p className="text-[9px] text-zinc-600 mt-2">✅ On completion, funds disburse to your own bank account.</p>
          </div>
        ) : (vault.landlord_name || vault.landlord_email || vault.landlord_bank_name) ? (
          <div className="mt-4 p-4 rounded-xl border border-teal-500/15 bg-teal-500/5">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-2">
              Payout Destination — {vault.payout_preference === 'LANDLORD' ? 'Landlord (Direct)' : 'Landlord'}
            </p>
            <div className="flex gap-4 flex-wrap text-xs">
              {vault.landlord_name         && <span className="text-white">👤 {vault.landlord_name}</span>}
              {vault.landlord_email        && <span className="text-teal-400">✉️ {vault.landlord_email}</span>}
              {vault.landlord_bank_name    && <span className="text-zinc-400">🏦 {vault.landlord_bank_name}</span>}
              {vault.landlord_account_name && <span className="text-zinc-400">{vault.landlord_account_name}</span>}
            </div>
            <p className="text-[9px] text-zinc-600 mt-2">
              {vault.payout_preference === 'LANDLORD'
                ? '✅ Auto-release configured — funds disburse directly to landlord, even if they never join Nested Ark.'
                : '✅ Auto-release configured — funds disburse when vault is claimed by landlord'}
            </p>
          </div>
        ) : (
          <div className="mt-4 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-[10px] text-amber-400">
            ⚠️ No payout destination set. Add your bank account or your landlord's bank details to pre-configure escrow release, or share vault ID{' '}
            <code className="bg-zinc-900 px-1 py-0.5 rounded text-zinc-400">{vault.id.slice(0, 8)}…</code> with your landlord.
          </div>
        )}

        {/* Payout preference badge */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">On Completion:</span>
          <span className="text-[8px] text-teal-500 font-black uppercase tracking-widest">
            {vault.payout_preference === 'TENANT' && '🏦 Send to My Account'}
            {vault.payout_preference === 'LANDLORD' && '🏠 Pay Landlord Directly'}
            {(vault.payout_preference === 'ASK' || !vault.payout_preference) && '🤔 Ask Me When Ready'}
          </span>
        </div>

        <p className="text-[8px] text-zinc-700 font-mono mt-4">
          VAULT · {vault.id} · {new Date(vault.created_at).toLocaleDateString('en-NG')}
        </p>
      </div>

      <EscrowSeal status={vault.status}/>

      {vault.status !== 'FUNDED_READY' && (
        <button onClick={onPay}
          className="w-full py-4 bg-teal-500 text-black font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all flex items-center justify-center gap-2">
          <DollarSign size={14}/> Pay {fmt(vault.installment_amount)} Installment
        </button>
      )}

      {/* AutoPay prompt */}
      <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CreditCard size={16} className="text-teal-500 flex-shrink-0"/>
          <div>
            <p className="text-xs font-black uppercase tracking-tight">Enable AutoPay</p>
            <p className="text-[9px] text-zinc-500 mt-0.5">Link your bank account for automatic contributions</p>
          </div>
        </div>
        <Link href="/tenant/banking"
          className="px-3 py-1.5 rounded-lg border border-teal-500/30 text-teal-400 text-[9px] font-black uppercase tracking-widest hover:bg-teal-500/10 transition-all flex-shrink-0">
          Set Up →
        </Link>
      </div>

      <div className="flex items-center justify-center gap-6 pt-2">
        <Link href="/tenant/contributions" className="text-[11px] text-teal-500 font-bold hover:underline flex items-center gap-1">
          View All Contributions<ChevronRight size={11}/>
        </Link>
        <Link href="/tenant/pay" className="text-[11px] text-zinc-500 hover:text-zinc-300 font-bold flex items-center gap-1">
          Pay Installment<ChevronRight size={11}/>
        </Link>
      </div>
    </div>
  );
}

// ── Linked Vault Display ──────────────────────────────────────────────────────
function LinkedVaultDisplay({ vault, onPay }: { vault: LinkedVault; onPay: () => void }) {
  return (
    <div className="space-y-4">
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20">
        <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-5">Flex-Pay Vault</p>
        <div className="flex flex-col md:flex-row items-center gap-8 mb-6">
          <ProgressRing pct={vault.funded_pct}/>
          <div className="flex-1 w-full space-y-3">
            <div>
              <p className="font-black font-mono text-2xl text-white">{fmt(vault.vault_balance)}</p>
              <p className="text-zinc-500 text-xs mt-0.5">of {fmt(vault.target_amount)} target</p>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${vault.funded_pct}%`, background: vault.funded_pct >= 80 ? '#14b8a6' : vault.funded_pct >= 50 ? '#f59e0b' : '#ef4444' }}/>
            </div>
          </div>
        </div>
        <VaultStats items={[
          { label: 'Vault Balance', value: fmt(vault.vault_balance),                                    color: 'text-teal-400'  },
          { label: 'Annual Target', value: fmt(vault.target_amount),                                     color: 'text-white'     },
          { label: 'Remaining',     value: fmt(Math.max(0, vault.target_amount - vault.vault_balance)),  color: 'text-zinc-300'  },
          { label: 'Contributed',   value: fmt(vault.total_contributed),                                 color: 'text-zinc-300'  },
          { label: 'Installment',   value: fmt(vault.installment_amount),                                color: 'text-amber-400' },
          { label: 'Status',        value: vault.status,
            color: vault.status === 'FUNDED_READY' ? 'text-teal-400' : vault.status === 'OVERDUE' ? 'text-red-400' : 'text-zinc-300' },
        ]}/>
        <button onClick={onPay}
          className="w-full mt-5 py-3.5 bg-teal-500 text-black font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all flex items-center justify-center gap-2">
          <DollarSign size={13}/> Pay {fmt(vault.installment_amount)} Installment
        </button>
      </div>
      <EscrowSeal status={vault.status}/>
      <div className="flex items-center justify-center pt-1">
        <Link href="/tenant/contributions" className="text-[11px] text-teal-500 font-bold hover:underline flex items-center gap-1">
          View All Contributions<ChevronRight size={11}/>
        </Link>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TenantVaultPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data,    setData]    = useState<VaultApiResponse | null>(null);
  const [error,   setError]   = useState('');

  const fetchVault = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      if (!token) { router.push('/login'); return; }
      const res = await fetch(`${API_BASE}/tenant/my-vault`, { headers: { Authorization: `Bearer ${token}` } });
      setData(await res.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchVault(); }, [fetchVault]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar/>
      <TenantNav/>
      <main className="flex-1 max-w-3xl mx-auto px-4 md:px-6 py-8 w-full">

        <div className="border-l-2 border-teal-500 pl-4 mb-8">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-2xl font-black uppercase tracking-tighter">My Flex-Pay Vault</h1>
          <p className="text-zinc-500 text-xs mt-1">Your micro-contribution rent engine</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="animate-spin text-teal-500 mr-3" size={20}/>
            <span className="text-zinc-500 font-mono text-sm">Loading vault…</span>
          </div>
        )}
        {!loading && error && (
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400">
            <AlertCircle size={16}/><span className="text-sm">{error}</span>
          </div>
        )}

        {/* Case 1: Linked tenancy + vault */}
        {!loading && !error && data?.hasActiveTenancy && data.vault && (
          <LinkedVaultDisplay vault={data.vault} onPay={() => router.push('/tenant/pay')}/>
        )}
        {/* Case 2: Linked tenancy, vault pending */}
        {!loading && !error && data?.hasActiveTenancy && !data.vault && (
          <div className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900/20 text-center">
            <div className="text-4xl mb-4">🔄</div>
            <p className="font-black text-sm uppercase tracking-tight mb-2">Property Linked — Vault Pending</p>
            <p className="text-zinc-500 text-xs">Your landlord is setting up your Flex-Pay vault. You'll be notified when it activates.</p>
          </div>
        )}
        {/* Case 3: Independent with standalone vault */}
        {!loading && !error && !data?.hasActiveTenancy && data?.standalone_vault && (
          <StandaloneVaultDisplay vault={data.standalone_vault} onPay={() => router.push('/tenant/pay')}/>
        )}
        {/* Case 4: Independent, no vault — show init form */}
        {!loading && !error && !data?.hasActiveTenancy && !data?.standalone_vault && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[['🔒','Escrow-held'],['📅','Your rhythm'],['⚡','Auto-disburse'],['🧾','SHA-256 receipts']].map(([icon, label]) => (
                <div key={label} className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/30 text-center">
                  <div className="text-xl mb-1">{icon}</div>
                  <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">{label}</p>
                </div>
              ))}
            </div>
            <InitVaultForm onSuccess={fetchVault}/>
          </>
        )}

      </main>
      <Footer/>
    </div>
  );
}
