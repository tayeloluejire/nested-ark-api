'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  CreditCard, ShieldCheck, RefreshCw, CheckCircle2,
  Trash2, Star, ChevronRight, Zap, Info,
} from 'lucide-react';

const API_BASE = '/api';
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}
const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(n);

// ── Complete Nigerian Bank List ────────────────────────────────────────────────
const NIGERIAN_BANKS = [
  // Fintech & Mobile Money — most used by tenants
  { name: 'OPay',                            code: '999992', category: 'Fintech' },
  { name: 'PalmPay',                         code: '999991', category: 'Fintech' },
  { name: 'Moniepoint MFB',                  code: '50515',  category: 'Fintech' },
  { name: 'Kuda Bank',                       code: '50211',  category: 'Fintech' },
  { name: 'Carbon (OneFi)',                  code: '565',    category: 'Fintech' },
  { name: 'FairMoney MFB',                   code: '51318',  category: 'Fintech' },
  { name: 'VFD MFB',                         code: '566',    category: 'Fintech' },
  { name: 'Rubies MFB',                      code: '125',    category: 'Fintech' },
  { name: 'Sparkle MFB',                     code: '51310',  category: 'Fintech' },
  { name: 'Paga',                            code: '100002', category: 'Fintech' },
  { name: '9PSB (9 Payment Service Bank)',   code: '120001', category: 'Fintech' },
  // Traditional Banks
  { name: 'Access Bank',                     code: '044',    category: 'Bank' },
  { name: 'Citibank Nigeria',                code: '023',    category: 'Bank' },
  { name: 'Ecobank Nigeria',                 code: '050',    category: 'Bank' },
  { name: 'Fidelity Bank',                   code: '070',    category: 'Bank' },
  { name: 'First Bank of Nigeria',           code: '011',    category: 'Bank' },
  { name: 'First City Monument Bank (FCMB)', code: '214',    category: 'Bank' },
  { name: 'Globus Bank',                     code: '00103',  category: 'Bank' },
  { name: 'Guaranty Trust Bank (GTBank)',    code: '058',    category: 'Bank' },
  { name: 'Heritage Bank',                   code: '030',    category: 'Bank' },
  { name: 'Keystone Bank',                   code: '082',    category: 'Bank' },
  { name: 'Parallex Bank',                   code: '104',    category: 'Bank' },
  { name: 'Polaris Bank',                    code: '076',    category: 'Bank' },
  { name: 'Providus Bank',                   code: '101',    category: 'Bank' },
  { name: 'Stanbic IBTC Bank',              code: '221',    category: 'Bank' },
  { name: 'Standard Chartered Bank',         code: '068',    category: 'Bank' },
  { name: 'Sterling Bank',                   code: '232',    category: 'Bank' },
  { name: 'SunTrust Bank',                   code: '100',    category: 'Bank' },
  { name: 'Titan Trust Bank',                code: '102',    category: 'Bank' },
  { name: 'Union Bank of Nigeria',           code: '032',    category: 'Bank' },
  { name: 'United Bank for Africa (UBA)',    code: '033',    category: 'Bank' },
  { name: 'Unity Bank',                      code: '215',    category: 'Bank' },
  { name: 'Wema Bank',                       code: '035',    category: 'Bank' },
  { name: 'Zenith Bank',                     code: '057',    category: 'Bank' },
] as const;

type Bank = typeof NIGERIAN_BANKS[number];

interface BankAccount {
  id: string; bank_name: string; bank_code: string;
  account_number: string; account_name: string; currency: string;
  preferred_debit_day: number | null; preferred_amount: number | null;
  is_verified: boolean; is_default: boolean;
  direct_debit_enabled: boolean; mandate_status: string | null;
}
interface AutoPayStatus {
  has_bank_account: boolean; bank_name?: string; account_name?: string;
  account_number_last4?: string; preferred_debit_day?: number | null;
  preferred_amount?: number | null; autopay_enabled?: boolean;
  mandate_status?: string | null; is_verified?: boolean;
  vault?: { target_amount: number; vault_balance: number; installment_amount: number; frequency: string; vault_status: string } | null;
}

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

// ── Bank Selector with search + auto-fill code ────────────────────────────────
function BankSelector({ value, onChange }: { value: { code: string; name: string }; onChange: (b: { code: string; name: string }) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = query.length >= 1
    ? NIGERIAN_BANKS.filter(b => b.name.toLowerCase().includes(query.toLowerCase()) || b.code.includes(query))
    : NIGERIAN_BANKS;
  const fintechs = filtered.filter(b => b.category === 'Fintech');
  const banks    = filtered.filter(b => b.category === 'Bank');

  const pick = (bank: Bank) => { onChange({ code: bank.code, name: bank.name }); setQuery(''); setOpen(false); };

  return (
    <div className="relative">
      <input
        className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors"
        placeholder="Search bank or fintech (e.g. OPay, GTBank…)"
        value={open ? query : value.name}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
      />
      {value.code && !open && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono text-teal-400 bg-teal-500/10 px-2 py-1 rounded border border-teal-500/20">
          {value.code}
        </span>
      )}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
          {fintechs.length > 0 && (
            <>
              <div className="px-3 py-2 bg-zinc-800/60 border-b border-zinc-700">
                <p className="text-[8px] text-teal-400 uppercase font-black tracking-widest">Fintech & Mobile Money</p>
              </div>
              {fintechs.map(b => (
                <button key={b.code} onMouseDown={() => pick(b)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800 transition-colors text-left">
                  <span className="text-sm text-white font-medium">{b.name}</span>
                  <span className="text-[9px] font-mono text-zinc-500 ml-2">{b.code}</span>
                </button>
              ))}
            </>
          )}
          {banks.length > 0 && (
            <>
              <div className="px-3 py-2 bg-zinc-800/60 border-b border-zinc-700 border-t border-zinc-700">
                <p className="text-[8px] text-zinc-400 uppercase font-black tracking-widest">Commercial Banks</p>
              </div>
              {banks.map(b => (
                <button key={b.code} onMouseDown={() => pick(b)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800 transition-colors text-left">
                  <span className="text-sm text-white font-medium">{b.name}</span>
                  <span className="text-[9px] font-mono text-zinc-500 ml-2">{b.code}</span>
                </button>
              ))}
            </>
          )}
          {fintechs.length === 0 && banks.length === 0 && (
            <div className="px-4 py-5 text-center text-zinc-600 text-sm">No bank found for &quot;{query}&quot;</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AutoPay Modal ─────────────────────────────────────────────────────────────
function AutoPayModal({ account, onSave, onClose }: { account: BankAccount; onSave: (d: number, a: number, e: boolean) => Promise<void>; onClose: () => void }) {
  const [day, setDay]       = useState(String(account.preferred_debit_day || 25));
  const [amount, setAmount] = useState(String(account.preferred_amount || ''));
  const [enable, setEnable] = useState(account.direct_debit_enabled);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handle = async () => {
    setError('');
    const d = parseInt(day), a = parseFloat(amount);
    if (!d || d < 1 || d > 28) return setError('Debit day must be between 1 and 28');
    if (!a || a < 50)          return setError('Amount must be at least ₦50');
    setLoading(true);
    try { await onSave(d, a, enable); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
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
          <button onClick={onClose} className="text-zinc-600 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-all">×</button>
        </div>
        <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-[10px] text-amber-400 flex items-start gap-2">
          <Info size={12} className="shrink-0 mt-0.5"/>
          <span>AutoPay initiates a Paystack payment to your vault on your chosen day each month. Full direct bank debit coming in the next update.</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={lbl}>Debit Day (1–28)</label><input className={inp} type="number" min="1" max="28" placeholder="e.g. 25" value={day} onChange={e => setDay(e.target.value)}/></div>
          <div><label className={lbl}>Monthly Amount (₦)</label><input className={inp} type="number" min="50" placeholder="e.g. 25000" value={amount} onChange={e => setAmount(e.target.value)}/></div>
        </div>
        <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div>
            <p className="text-xs font-bold">Enable AutoPay</p>
            <p className="text-[9px] text-zinc-500 mt-0.5">Flag account for automatic contributions</p>
          </div>
          <button onClick={() => setEnable(!enable)} className={`w-12 h-6 rounded-full transition-all relative flex-shrink-0 ${enable ? 'bg-teal-500' : 'bg-zinc-700'}`}>
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${enable ? 'left-7' : 'left-1'}`}/>
          </button>
        </div>
        {error && <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-[11px]">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onClose} className="py-3 rounded-xl border border-zinc-700 text-zinc-400 font-black text-[10px] uppercase tracking-widest hover:border-zinc-600 transition-all">Cancel</button>
          <button onClick={handle} disabled={loading} className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${loading ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-teal-500 text-black hover:bg-teal-400'}`}>
            {loading ? '⏳ Saving…' : '💾 Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Account Card ──────────────────────────────────────────────────────────────
function AccountCard({ account, onSetDefault, onAutoPayOpen, onDelete }: { account: BankAccount; onSetDefault: (id: string) => void; onAutoPayOpen: (a: BankAccount) => void; onDelete: (id: string) => void }) {
  const autopayActive = account.direct_debit_enabled && account.mandate_status !== 'CANCELLED';
  return (
    <div className={`p-5 rounded-2xl border transition-all ${account.is_default ? 'border-teal-500/30 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/20'}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${account.is_default ? 'bg-teal-500/20' : 'bg-zinc-800'}`}>
            <CreditCard size={16} className={account.is_default ? 'text-teal-400' : 'text-zinc-500'}/>
          </div>
          <div>
            <p className="font-black text-sm">{account.bank_name}</p>
            <p className="text-zinc-500 text-[10px] font-mono mt-0.5">···· ···· {account.account_number.slice(-4)}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
          {account.is_default && <span className="px-2 py-1 rounded-lg border border-teal-500/30 text-teal-400 text-[8px] font-black uppercase tracking-widest bg-teal-500/10">Default</span>}
          {account.is_verified && <span className="px-2 py-1 rounded-lg border border-green-500/30 text-green-400 text-[8px] font-black uppercase tracking-widest bg-green-500/10 flex items-center gap-1"><CheckCircle2 size={8}/> Verified</span>}
        </div>
      </div>
      <p className="text-zinc-300 text-xs font-semibold mb-3">{account.account_name}</p>
      <div className={`flex items-center justify-between p-3 rounded-xl border mb-4 ${autopayActive ? 'border-teal-500/20 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/40'}`}>
        <div className="flex items-center gap-2">
          <Zap size={12} className={autopayActive ? 'text-teal-400' : 'text-zinc-600'}/>
          <div>
            <p className="text-[10px] font-black uppercase tracking-tight">{autopayActive ? 'AutoPay Active' : 'AutoPay Not Set'}</p>
            {autopayActive && account.preferred_debit_day && <p className="text-[9px] text-zinc-500 mt-0.5">{account.preferred_amount ? fmt(account.preferred_amount) : '—'} on day {account.preferred_debit_day} monthly</p>}
            {autopayActive && account.mandate_status && <p className={`text-[8px] mt-0.5 uppercase font-bold tracking-widest ${account.mandate_status === 'ACTIVE' ? 'text-teal-400' : 'text-amber-400'}`}>{account.mandate_status === 'ACTIVE' ? '● Live' : '● Pending'}</p>}
          </div>
        </div>
        <button onClick={() => onAutoPayOpen(account)} className="text-[9px] font-black uppercase tracking-widest text-teal-400 hover:underline">{autopayActive ? 'Edit' : 'Set Up'}</button>
      </div>
      <div className="flex gap-2">
        {!account.is_default && (
          <button onClick={() => onSetDefault(account.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-zinc-700 text-zinc-400 text-[9px] font-black uppercase tracking-widest hover:border-teal-500/30 hover:text-teal-400 transition-all">
            <Star size={10}/> Set Default
          </button>
        )}
        <button onClick={() => onAutoPayOpen(account)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-teal-500/20 text-teal-400 text-[9px] font-black uppercase tracking-widest hover:bg-teal-500/10 transition-all">
          <Zap size={10}/> AutoPay
        </button>
        <button onClick={() => onDelete(account.id)} className="py-2 px-3 rounded-xl border border-zinc-800 text-zinc-600 hover:border-red-500/30 hover:text-red-400 transition-all">
          <Trash2 size={12}/>
        </button>
      </div>
    </div>
  );
}

// ── Add Account Form ──────────────────────────────────────────────────────────
function AddAccountForm({ onAdded }: { onAdded: (msg: string) => void }) {
  const [bank, setBank]               = useState({ code: '', name: '' });
  const [accountNum, setAccountNum]   = useState('');
  const [debitDay, setDebitDay]       = useState('');
  const [amount, setAmount]           = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [verifiedName, setVerifiedName] = useState('');

  const inp = "w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors";
  const lbl = "block text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-1.5";

  const handleAdd = async () => {
    setError(''); setVerifiedName('');
    if (!bank.code)                        return setError('Please select a bank');
    if (!/^\d{10}$/.test(accountNum))     return setError('Account number must be exactly 10 digits');
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/tenant/bank-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          bank_name: bank.name, bank_code: bank.code, account_number: accountNum,
          preferred_debit_day: debitDay ? parseInt(debitDay) : undefined,
          preferred_amount:    amount   ? parseFloat(amount) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to add account');
      if (data.verified && data.account_name) setVerifiedName(`✅ Verified: ${data.account_name}`);
      setBank({ code: '', name: '' }); setAccountNum(''); setDebitDay(''); setAmount('');
      setTimeout(() => onAdded(data.verified ? `✅ ${data.account_name} linked` : 'Bank account saved'), 600);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-teal-500/15 flex items-center justify-center flex-shrink-0"><CreditCard size={15} className="text-teal-400"/></div>
        <div>
          <h3 className="font-black text-sm uppercase tracking-tight">Link Bank Account</h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">Works with OPay, PalmPay, Moniepoint & all Nigerian banks · Name verified via Paystack</p>
        </div>
      </div>
      <div>
        <label className={lbl}>Select Bank or Fintech *</label>
        <BankSelector value={bank} onChange={setBank}/>
        {bank.code && <p className="text-[9px] text-teal-400 mt-1.5 font-mono">Bank code auto-filled: {bank.code}</p>}
      </div>
      <div>
        <label className={lbl}>Account / Wallet Number *</label>
        <input className={inp} type="text" inputMode="numeric" maxLength={10} placeholder="10-digit account number" value={accountNum} onChange={e => setAccountNum(e.target.value.replace(/\D/g, ''))}/>
        {verifiedName && <p className="text-[10px] text-teal-400 mt-1.5 font-bold">{verifiedName}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={lbl}>Debit Day <span className="text-zinc-700">(optional)</span></label><input className={inp} type="number" min="1" max="28" placeholder="e.g. 25" value={debitDay} onChange={e => setDebitDay(e.target.value)}/></div>
        <div><label className={lbl}>Monthly Amount ₦ <span className="text-zinc-700">(optional)</span></label><input className={inp} type="number" min="50" placeholder="e.g. 25000" value={amount} onChange={e => setAmount(e.target.value)}/></div>
      </div>
      {error && <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-[11px]">{error}</div>}
      <button onClick={handleAdd} disabled={loading} className={`w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${loading ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-teal-500 text-black hover:bg-teal-400'}`}>
        {loading ? <><RefreshCw size={13} className="animate-spin"/> Verifying…</> : '+ Link Bank Account'}
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TenantBankingPage() {
  const router = useRouter();
  const [accounts,  setAccounts]  = useState<BankAccount[]>([]);
  const [autopay,   setAutopay]   = useState<AutoPayStatus | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [modalAcct, setModalAcct] = useState<BankAccount | null>(null);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [toast,     setToast]     = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      const [acctRes, apRes] = await Promise.all([
        fetch(`${API_BASE}/tenant/bank-accounts`,  { headers: { Authorization: `Bearer ${token}` } }),
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
    await fetch(`${API_BASE}/tenant/bank-accounts/${id}/set-default`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    showToast('Default account updated ✅'); load();
  };

  const handleSaveAutoPay = async (day: number, amount: number, enable: boolean) => {
    if (!modalAcct) return;
    const token = getToken();
    const res = await fetch(`${API_BASE}/tenant/bank-accounts/${modalAcct.id}/autopay-preference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ preferred_debit_day: day, preferred_amount: amount, enable }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to save preference');
    setModalAcct(null);
    showToast(enable ? `AutoPay set: ${fmt(amount)} on day ${day} monthly ✅` : 'AutoPay preference saved');
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this bank account?')) return;
    setDeleting(id);
    const token = getToken();
    try {
      const res  = await fetch(`${API_BASE}/tenant/bank-accounts/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showToast('Bank account removed'); load();
    } catch (e: any) { showToast(`Error: ${e.message}`); }
    finally { setDeleting(null); }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar/>
      <TenantNav/>
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-teal-500 text-black text-[11px] font-black uppercase tracking-widest shadow-2xl">{toast}</div>}
      {modalAcct && <AutoPayModal account={modalAcct} onSave={handleSaveAutoPay} onClose={() => setModalAcct(null)}/>}

      <main className="flex-1 max-w-3xl mx-auto px-4 md:px-6 py-8 w-full space-y-8">
        <div className="border-l-2 border-teal-500 pl-4">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-2xl font-black uppercase tracking-tighter">My Banking</h1>
          <p className="text-zinc-500 text-xs mt-1">Linked accounts · AutoPay standing order</p>
        </div>

        {loading && <div className="flex items-center justify-center py-20"><RefreshCw className="animate-spin text-teal-500 mr-3" size={20}/><span className="text-zinc-500 font-mono text-sm">Loading…</span></div>}

        {!loading && (
          <>
            {/* AutoPay summary */}
            {autopay && (
              <div className={`p-5 rounded-2xl border ${autopay.autopay_enabled ? 'border-teal-500/30 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/20'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <Zap size={16} className={autopay.autopay_enabled ? 'text-teal-400' : 'text-zinc-600'}/>
                  <p className="text-[9px] uppercase font-black tracking-widest">{autopay.autopay_enabled ? 'AutoPay Active' : 'AutoPay Not Configured'}</p>
                </div>
                {autopay.has_bank_account ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Default Bank',   value: autopay.bank_name || '—' },
                      { label: 'Account',        value: autopay.account_name ? `${autopay.account_name} ···${autopay.account_number_last4}` : '—' },
                      { label: 'Debit Day',      value: autopay.preferred_debit_day ? `Day ${autopay.preferred_debit_day}` : 'Not set' },
                      { label: 'Monthly Amount', value: autopay.preferred_amount ? fmt(autopay.preferred_amount) : 'Not set' },
                      { label: 'AutoPay',        value: autopay.autopay_enabled ? 'Enabled' : 'Disabled', color: autopay.autopay_enabled ? 'text-teal-400' : 'text-zinc-500' },
                      { label: 'Status',         value: autopay.mandate_status || 'Not set', color: autopay.mandate_status === 'ACTIVE' ? 'text-teal-400' : 'text-amber-400' },
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
                {autopay.vault && (
                  <div className="mt-4 p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-0.5">Linked Vault</p>
                      <p className="text-xs font-black font-mono text-white">{fmt(autopay.vault.vault_balance)} / {fmt(autopay.vault.target_amount)}</p>
                      <p className="text-[9px] text-zinc-600 mt-0.5">{autopay.vault.frequency.toLowerCase()} · {fmt(autopay.vault.installment_amount)} per installment</p>
                    </div>
                    <Link href="/tenant/vault" className="text-[9px] text-teal-400 font-bold hover:underline flex items-center gap-1 flex-shrink-0">View Vault<ChevronRight size={10}/></Link>
                  </div>
                )}
              </div>
            )}

            {/* Linked accounts */}
            {accounts.length > 0 && (
              <div className="space-y-4">
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Linked Accounts ({accounts.length})</p>
                {accounts.map(acct => (
                  <div key={acct.id} style={{ opacity: deleting === acct.id ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                    <AccountCard account={acct} onSetDefault={handleSetDefault} onAutoPayOpen={a => setModalAcct(a)} onDelete={handleDelete}/>
                  </div>
                ))}
              </div>
            )}

            <AddAccountForm onAdded={msg => { load(); showToast(msg); }}/>

            {/* How AutoPay works */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/10 space-y-4">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-amber-400"/>
                <p className="text-[9px] text-amber-400 uppercase font-black tracking-widest">How AutoPay Works</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { step: '01', title: 'Link Your Account', desc: 'Save your bank account or mobile wallet (OPay, PalmPay, Moniepoint etc). Name verified instantly via Paystack NUBAN.' },
                  { step: '02', title: 'Set Your Schedule', desc: 'Choose your contribution day (1–28) and monthly amount. Nested Ark calculates the rest.' },
                  { step: '03', title: 'Automatic Savings', desc: 'On your chosen day, funds move automatically to your rent vault — no reminders, no stress, no missed payments.' },
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
                <p className="text-[9px] text-amber-400 leading-relaxed">Full Direct Debit automation coming in the next update. Your saved preferences activate automatically when it goes live.</p>
              </div>
            </div>

            {/* Security note */}
            <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/10 flex items-start gap-3">
              <ShieldCheck size={16} className="text-teal-500 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="text-xs font-black uppercase tracking-tight mb-1">Bank-Grade Security</p>
                <p className="text-[10px] text-zinc-500 leading-relaxed">Account numbers verified via Paystack NUBAN. No card details or passwords stored. All data encrypted at rest. OPay, PalmPay, Moniepoint, and all Nigerian banks supported. AutoPay transactions are SHA-256 hashed and court-admissible.</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-6">
              <Link href="/tenant/vault" className="text-[11px] text-teal-500 font-bold hover:underline flex items-center gap-1">← My Vault</Link>
              <Link href="/tenant/pay" className="text-[11px] text-zinc-500 hover:text-zinc-300 font-bold flex items-center gap-1 transition-colors">Pay Installment<ChevronRight size={11}/></Link>
            </div>
          </>
        )}
      </main>
      <Footer/>
    </div>
  );
}
