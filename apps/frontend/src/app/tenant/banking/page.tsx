'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  CreditCard, ShieldCheck, RefreshCw, AlertCircle,
  CheckCircle2, Trash2, Star, ChevronRight, Zap, Info,
} from 'lucide-react';

const API_BASE = '/api';
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}
const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(n);

// ── Nigerian banks list ───────────────────────────────────────────────────────
const NIGERIAN_BANKS = [
  { name: 'Access Bank',                  code: '044' },
  { name: 'Citibank Nigeria',             code: '023' },
  { name: 'Ecobank Nigeria',              code: '050' },
  { name: 'Fidelity Bank',               code: '070' },
  { name: 'First Bank of Nigeria',        code: '011' },
  { name: 'First City Monument Bank',     code: '214' },
  { name: 'Globus Bank',                  code: '00103' },
  { name: 'Guaranty Trust Bank',          code: '058' },
  { name: 'Heritage Bank',               code: '030' },
  { name: 'Keystone Bank',               code: '082' },
  { name: 'Kuda Bank',                   code: '50211' },
  { name: 'Moniepoint',                  code: '50515' },
  { name: 'OPay',                        code: '999992' },
  { name: 'Palmpay',                     code: '999991' },
  { name: 'Polaris Bank',                code: '076' },
  { name: 'Providus Bank',               code: '101' },
  { name: 'Stanbic IBTC Bank',           code: '221' },
  { name: 'Standard Chartered Bank',     code: '068' },
  { name: 'Sterling Bank',               code: '232' },
  { name: 'Titan Trust Bank',            code: '102' },
  { name: 'Union Bank of Nigeria',        code: '032' },
  { name: 'United Bank for Africa',       code: '033' },
  { name: 'Unity Bank',                  code: '215' },
  { name: 'VFD Microfinance Bank',        code: '566' },
  { name: 'Wema Bank',                   code: '035' },
  { name: 'Zenith Bank',                 code: '057' },
];

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

// ── Types ─────────────────────────────────────────────────────────────────────
interface BankAccount {
  id: string; bank_name: string; bank_code: string;
  account_number: string; account_name: string; currency: string;
  preferred_debit_day: number | null; preferred_amount: number | null;
  is_verified: boolean; is_default: boolean;
  direct_debit_enabled: boolean; mandate_status: string | null;
  created_at: string;
}
interface AutoPayStatus {
  has_bank_account: boolean; bank_name?: string; account_name?: string;
  account_number_last4?: string; preferred_debit_day?: number | null;
  preferred_amount?: number | null; autopay_enabled?: boolean;
  mandate_status?: string | null; is_verified?: boolean;
  vault?: {
    target_amount: number; rent_amount: number | null;
    platform_fee_amount: number | null; vault_balance: number;
    installment_amount: number; frequency: string; vault_status: string;
  } | null;
}
interface AddForm {
  bank_code: string; account_number: string;
  preferred_debit_day: string; preferred_amount: string;
}

// ── AutoPay Pref Modal ────────────────────────────────────────────────────────
function AutoPayModal({
  account, onSave, onClose,
}: {
  account: BankAccount;
  onSave: (day: number, amount: number, enable: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [day,     setDay]     = useState(String(account.preferred_debit_day   || 25));
  const [amount,  setAmount]  = useState(String(account.preferred_amount      || ''));
  const [enable,  setEnable]  = useState(account.direct_debit_enabled);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handle = async () => {
    setError('');
    const d = parseInt(day); const a = parseFloat(amount);
    if (!d || d < 1 || d > 28) return setError('Debit day must be between 1 and 28');
    if (!a || a < 50)          return setError('Contribution amount must be at least ₦50');
    setLoading(true);
    try { await onSave(d, a, enable); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const inp = "w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors";
  const lbl = "block text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-sm uppercase tracking-tight">AutoPay Preference</h3>
            <p className="text-[10px] text-zinc-500 mt-0.5">{account.bank_name} ···{account.account_number.slice(-4)}</p>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-[10px] text-amber-400 flex items-start gap-2">
          <Info size={12} className="shrink-0 mt-0.5"/>
          <span>AutoPay will automatically initiate a Paystack payment to your vault on your chosen day each month. Direct Debit activation coming in the next update.</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Debit Day (1–28)</label>
            <input className={inp} type="number" min="1" max="28"
              placeholder="e.g. 25" value={day} onChange={e => setDay(e.target.value)}/>
          </div>
          <div>
            <label className={lbl}>Monthly Amount (₦)</label>
            <input className={inp} type="number" min="50"
              placeholder="e.g. 25000" value={amount} onChange={e => setAmount(e.target.value)}/>
          </div>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div>
            <p className="text-xs font-bold">Enable AutoPay</p>
            <p className="text-[9px] text-zinc-500 mt-0.5">Save preference and activate automatic contributions</p>
          </div>
          <button onClick={() => setEnable(!enable)}
            className={`w-12 h-6 rounded-full transition-all relative ${enable ? 'bg-teal-500' : 'bg-zinc-700'}`}>
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${enable ? 'left-7' : 'left-1'}`}/>
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-[11px]">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button onClick={onClose}
            className="py-3 rounded-xl border border-zinc-700 text-zinc-400 font-black text-[10px] uppercase tracking-widest hover:border-zinc-600 transition-all">
            Cancel
          </button>
          <button onClick={handle} disabled={loading}
            className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
              loading ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-teal-500 text-black hover:bg-teal-400'}`}>
            {loading ? '⏳ Saving…' : '💾 Save Preference'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bank Account Card ─────────────────────────────────────────────────────────
function AccountCard({
  account, onSetDefault, onAutoPayOpen, onDelete,
}: {
  account:        BankAccount;
  onSetDefault:   (id: string) => void;
  onAutoPayOpen:  (a: BankAccount) => void;
  onDelete:       (id: string) => void;
}) {
  const autopayActive = account.direct_debit_enabled && account.mandate_status !== 'CANCELLED';
  return (
    <div className={`p-5 rounded-2xl border transition-all ${
      account.is_default ? 'border-teal-500/30 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/20'}`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            account.is_default ? 'bg-teal-500/20' : 'bg-zinc-800'}`}>
            <CreditCard size={16} className={account.is_default ? 'text-teal-400' : 'text-zinc-500'}/>
          </div>
          <div>
            <p className="font-black text-sm">{account.bank_name}</p>
            <p className="text-zinc-500 text-[10px] font-mono mt-0.5">
              ···· ···· {account.account_number.slice(-4)}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {account.is_default && (
            <span className="px-2 py-1 rounded-lg border border-teal-500/30 text-teal-400 text-[8px] font-black uppercase tracking-widest bg-teal-500/10">
              Default
            </span>
          )}
          {account.is_verified && (
            <span className="px-2 py-1 rounded-lg border border-green-500/30 text-green-400 text-[8px] font-black uppercase tracking-widest bg-green-500/10 flex items-center gap-1">
              <CheckCircle2 size={8}/> Verified
            </span>
          )}
        </div>
      </div>

      {/* Account name */}
      <p className="text-zinc-300 text-xs font-semibold mb-3">{account.account_name}</p>

      {/* AutoPay status */}
      <div className={`flex items-center justify-between p-3 rounded-xl border mb-4 ${
        autopayActive ? 'border-teal-500/20 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/40'}`}>
        <div className="flex items-center gap-2">
          <Zap size={12} className={autopayActive ? 'text-teal-400' : 'text-zinc-600'}/>
          <div>
            <p className="text-[10px] font-black uppercase tracking-tight">
              {autopayActive ? 'AutoPay Active' : 'AutoPay Not Set'}
            </p>
            {autopayActive && account.preferred_debit_day && (
              <p className="text-[9px] text-zinc-500 mt-0.5">
                {account.preferred_amount ? fmt(account.preferred_amount) : '—'} on day {account.preferred_debit_day} monthly
              </p>
            )}
            {autopayActive && account.mandate_status && (
              <p className={`text-[8px] mt-0.5 uppercase font-bold tracking-widest ${
                account.mandate_status === 'ACTIVE' ? 'text-teal-400' : 'text-amber-400'}`}>
                {account.mandate_status === 'ACTIVE' ? '● Live' : '● Pending activation'}
              </p>
            )}
          </div>
        </div>
        <button onClick={() => onAutoPayOpen(account)}
          className="text-[9px] font-black uppercase tracking-widest text-teal-400 hover:underline">
          {autopayActive ? 'Edit' : 'Set Up'}
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {!account.is_default && (
          <button onClick={() => onSetDefault(account.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-zinc-700 text-zinc-400 text-[9px] font-black uppercase tracking-widest hover:border-teal-500/30 hover:text-teal-400 transition-all">
            <Star size={10}/> Set Default
          </button>
        )}
        <button onClick={() => onAutoPayOpen(account)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-teal-500/20 text-teal-400 text-[9px] font-black uppercase tracking-widest hover:bg-teal-500/10 transition-all">
          <Zap size={10}/> AutoPay
        </button>
        <button onClick={() => onDelete(account.id)}
          className="py-2 px-3 rounded-xl border border-zinc-800 text-zinc-600 hover:border-red-500/30 hover:text-red-400 transition-all">
          <Trash2 size={12}/>
        </button>
      </div>
    </div>
  );
}

// ── Add Account Form ──────────────────────────────────────────────────────────
function AddAccountForm({ onAdded }: { onAdded: () => void }) {
  const [form,     setForm]     = useState<AddForm>({ bank_code: '', account_number: '', preferred_debit_day: '', preferred_amount: '' });
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [verified, setVerified] = useState('');

  const set = (k: keyof AddForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    setVerified('');
  };

  const handleAdd = async () => {
    setError(''); setVerified('');
    if (!form.bank_code)                          return setError('Please select a bank');
    if (!/^\d{10}$/.test(form.account_number))    return setError('Account number must be exactly 10 digits');
    setLoading(true);
    try {
      const token = getToken();
      const selectedBank = NIGERIAN_BANKS.find(b => b.code === form.bank_code);
      const res = await fetch(`${API_BASE}/tenant/bank-accounts`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          bank_name:           selectedBank?.name || '',
          bank_code:           form.bank_code,
          account_number:      form.account_number,
          preferred_debit_day: form.preferred_debit_day ? parseInt(form.preferred_debit_day) : undefined,
          preferred_amount:    form.preferred_amount    ? parseFloat(form.preferred_amount)  : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to add account');
      if (data.verified && data.account_name) setVerified(`✅ Verified: ${data.account_name}`);
      setForm({ bank_code: '', account_number: '', preferred_debit_day: '', preferred_amount: '' });
      setTimeout(onAdded, 800);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const inp = "w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors";
  const lbl = "block text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-1.5";

  return (
    <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-teal-500/15 flex items-center justify-center flex-shrink-0">
          <CreditCard size={15} className="text-teal-400"/>
        </div>
        <div>
          <h3 className="font-black text-sm uppercase tracking-tight">Link Bank Account</h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">Account name is verified instantly via Paystack</p>
        </div>
      </div>

      {/* Bank selector */}
      <div>
        <label className={lbl}>Select Bank *</label>
        <select className={inp + " cursor-pointer"} value={form.bank_code} onChange={set('bank_code')}>
          <option value="">— Choose your bank —</option>
          {NIGERIAN_BANKS.map(b => (
            <option key={b.code} value={b.code}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Account number */}
      <div>
        <label className={lbl}>Account Number *</label>
        <input className={inp} type="text" inputMode="numeric" maxLength={10}
          placeholder="10-digit account number"
          value={form.account_number} onChange={set('account_number')}/>
        {verified && (
          <p className="text-[10px] text-teal-400 mt-1.5 font-bold">{verified}</p>
        )}
      </div>

      {/* Optional AutoPay setup at add time */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Debit Day (optional)</label>
          <input className={inp} type="number" min="1" max="28"
            placeholder="e.g. 25" value={form.preferred_debit_day} onChange={set('preferred_debit_day')}/>
        </div>
        <div>
          <label className={lbl}>Monthly Amount (optional)</label>
          <input className={inp} type="number" min="50"
            placeholder="e.g. 25000" value={form.preferred_amount} onChange={set('preferred_amount')}/>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-[11px]">{error}</div>
      )}

      <button onClick={handleAdd} disabled={loading}
        className={`w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
          loading ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-teal-500 text-black hover:bg-teal-400'}`}>
        {loading ? <><RefreshCw size={13} className="animate-spin"/> Verifying & Saving…</> : '+ Link Bank Account'}
      </button>
    </div>
  );
}

// ── AutoPay Explainer ─────────────────────────────────────────────────────────
function AutoPayExplainer() {
  return (
    <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/10 space-y-4">
      <div className="flex items-center gap-2">
        <Zap size={16} className="text-amber-400"/>
        <p className="text-[9px] text-amber-400 uppercase font-black tracking-widest">How AutoPay Works</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { step: '01', title: 'Link Your Bank', desc: 'Save your bank account. Account name is instantly verified via Paystack NUBAN.' },
          { step: '02', title: 'Set Your Schedule', desc: 'Choose your contribution day (1–28) and monthly amount. We calculate the rest.' },
          { step: '03', title: 'Automatic Savings', desc: 'On your chosen day, funds move automatically to your rent vault — no reminders, no stress.' },
        ].map(s => (
          <div key={s.step} className="flex gap-3">
            <span className="text-[9px] font-black text-teal-500 font-mono flex-shrink-0 mt-0.5">{s.step}</span>
            <div>
              <p className="text-xs font-black uppercase tracking-tight mb-1">{s.title}</p>
              <p className="text-[10px] text-zinc-500 leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-2">
        <Info size={11} className="text-amber-400 shrink-0 mt-0.5"/>
        <p className="text-[9px] text-amber-400 leading-relaxed">
          Full Direct Debit automation (bank-to-vault without any manual step) is coming in the next platform update. Your saved preferences will activate automatically when it goes live.
        </p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TenantBankingPage() {
  const router = useRouter();
  const [accounts,   setAccounts]   = useState<BankAccount[]>([]);
  const [autopay,    setAutopay]    = useState<AutoPayStatus | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [modalAcct,  setModalAcct]  = useState<BankAccount | null>(null);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [toast,      setToast]      = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      const [acctRes, apRes] = await Promise.all([
        fetch(`${API_BASE}/tenant/bank-accounts`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/tenant/autopay-status`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const acctData = await acctRes.json();
      const apData   = await apRes.json();
      if (acctData.success) setAccounts(acctData.accounts || []);
      if (apData.success)   setAutopay(apData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const handleSetDefault = async (id: string) => {
    const token = getToken();
    await fetch(`${API_BASE}/tenant/bank-accounts/${id}/set-default`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    showToast('Default account updated');
    load();
  };

  const handleSaveAutoPay = async (day: number, amount: number, enable: boolean) => {
    if (!modalAcct) return;
    const token = getToken();
    const res   = await fetch(`${API_BASE}/tenant/bank-accounts/${modalAcct.id}/autopay-preference`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ preferred_debit_day: day, preferred_amount: amount, enable }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to save AutoPay preference');
    setModalAcct(null);
    showToast(enable ? `AutoPay set: ${fmt(amount)} on day ${day} monthly` : 'AutoPay preference saved');
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this bank account?')) return;
    setDeleting(id);
    const token = getToken();
    try {
      const res  = await fetch(`${API_BASE}/tenant/bank-accounts/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showToast('Bank account removed');
      load();
    } catch (e: any) { showToast(`Error: ${e.message}`); }
    finally { setDeleting(null); }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar/>
      <TenantNav/>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-teal-500 text-black text-[11px] font-black uppercase tracking-widest shadow-xl">
          {toast}
        </div>
      )}

      {/* AutoPay modal */}
      {modalAcct && (
        <AutoPayModal
          account={modalAcct}
          onSave={handleSaveAutoPay}
          onClose={() => setModalAcct(null)}
        />
      )}

      <main className="flex-1 max-w-3xl mx-auto px-4 md:px-6 py-8 w-full space-y-8">

        {/* Header */}
        <div className="border-l-2 border-teal-500 pl-4">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-2xl font-black uppercase tracking-tighter">My Banking</h1>
          <p className="text-zinc-500 text-xs mt-1">Linked accounts · AutoPay standing order</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="animate-spin text-teal-500 mr-3" size={20}/>
            <span className="text-zinc-500 font-mono text-sm">Loading banking details…</span>
          </div>
        )}

        {!loading && (
          <>
            {/* AutoPay status summary */}
            {autopay && (
              <div className={`p-5 rounded-2xl border ${
                autopay.autopay_enabled ? 'border-teal-500/30 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/20'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <Zap size={16} className={autopay.autopay_enabled ? 'text-teal-400' : 'text-zinc-600'}/>
                  <p className="text-[9px] uppercase font-black tracking-widest">
                    {autopay.autopay_enabled ? 'AutoPay Active' : 'AutoPay Not Configured'}
                  </p>
                </div>
                {autopay.has_bank_account ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Default Bank',  value: autopay.bank_name || '—' },
                      { label: 'Account',       value: autopay.account_name ? `${autopay.account_name} ···${autopay.account_number_last4}` : '—' },
                      { label: 'Debit Day',     value: autopay.preferred_debit_day ? `Day ${autopay.preferred_debit_day}` : 'Not set' },
                      { label: 'Monthly Amount', value: autopay.preferred_amount ? fmt(autopay.preferred_amount) : 'Not set' },
                      { label: 'AutoPay',       value: autopay.autopay_enabled ? 'Enabled' : 'Disabled',
                        color: autopay.autopay_enabled ? 'text-teal-400' : 'text-zinc-500' },
                      { label: 'Status',        value: autopay.mandate_status || 'Not set',
                        color: autopay.mandate_status === 'ACTIVE' ? 'text-teal-400' : 'text-amber-400' },
                    ].map(s => (
                      <div key={s.label} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                        <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest mb-0.5">{s.label}</p>
                        <p className={`text-[11px] font-black font-mono ${(s as any).color || 'text-white'}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-xs">No bank account linked yet. Add one below to enable AutoPay.</p>
                )}

                {/* Vault linkage if found */}
                {autopay.vault && (
                  <div className="mt-4 p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-0.5">Linked Vault</p>
                      <p className="text-xs font-black font-mono text-white">
                        {fmt(autopay.vault.vault_balance)} / {fmt(autopay.vault.target_amount)}
                      </p>
                      <p className="text-[9px] text-zinc-600 mt-0.5">
                        {autopay.vault.frequency.toLowerCase()} · {fmt(autopay.vault.installment_amount)} per installment
                      </p>
                    </div>
                    <Link href="/tenant/vault"
                      className="text-[9px] text-teal-400 font-bold hover:underline flex items-center gap-1 flex-shrink-0">
                      View Vault<ChevronRight size={10}/>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Linked accounts */}
            {accounts.length > 0 && (
              <div className="space-y-4">
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Linked Accounts ({accounts.length})</p>
                {accounts.map(acct => (
                  <div key={acct.id} style={{ opacity: deleting === acct.id ? 0.5 : 1 }}>
                    <AccountCard
                      account={acct}
                      onSetDefault={handleSetDefault}
                      onAutoPayOpen={a => setModalAcct(a)}
                      onDelete={handleDelete}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Add account form */}
            <AddAccountForm onAdded={() => { load(); showToast('Bank account linked successfully'); }}/>

            {/* How AutoPay works */}
            <AutoPayExplainer/>

            {/* Security note */}
            <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/10 flex items-start gap-3">
              <ShieldCheck size={16} className="text-teal-500 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="text-xs font-black uppercase tracking-tight mb-1">Bank-Grade Security</p>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Account numbers are verified via Paystack NUBAN. No card details or passwords are stored.
                  All banking data is encrypted at rest. AutoPay transactions are SHA-256 hashed and court-admissible.
                </p>
              </div>
            </div>

            {/* Footer nav */}
            <div className="flex items-center justify-center gap-6">
              <Link href="/tenant/vault" className="text-[11px] text-teal-500 font-bold hover:underline flex items-center gap-1">
                ← My Vault
              </Link>
              <Link href="/tenant/pay" className="text-[11px] text-zinc-500 hover:text-zinc-300 font-bold flex items-center gap-1">
                Pay Installment<ChevronRight size={11}/>
              </Link>
            </div>
          </>
        )}
      </main>
      <Footer/>
    </div>
  );
}
