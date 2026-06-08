'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  CreditCard, ShieldCheck, RefreshCw, CheckCircle2,
  Trash2, Star, ChevronRight, Zap, Info, Building2,
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

interface LandlordBankAccount {
  id: string;
  user_id: string;
  project_id: string | null;
  account_name: string;
  account_number: string;
  bank_code: string;
  bank_name: string;
  currency: string;
  is_default: boolean;
  is_verified: boolean;
  paystack_recipient_code: string | null;
  paystack_subaccount_code: string | null;
  payout_ready: boolean;
  split_pay_ready: boolean;
  created_at: string;
}

// ── Landlord Nav ──────────────────────────────────────────────────────────────
function LandlordNav() {
  const pathname = usePathname();
  const links = [
    { href: '/landlord/dashboard',  label: 'Dashboard'   },
    { href: '/landlord/units',      label: 'My Units'    },
    { href: '/landlord/tenants',    label: 'Tenants'     },
    { href: '/landlord/receipts',   label: 'Receipts'    },
    { href: '/landlord/notices',    label: 'Notices'     },
    { href: '/landlord/inventory',  label: 'Inventory'   },
    { href: '/landlord/banking',    label: 'Banking'     },
  ];
  return (
    <nav className="border-b border-zinc-800 bg-[#050505]/90 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 flex gap-0.5 overflow-x-auto py-1" style={{ scrollbarWidth: 'none' }}>
        {links.map(l => {
          const active = pathname === l.href;
          return (
            <Link key={l.href} href={l.href}
              className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap rounded-lg transition-all flex-shrink-0 ${
                active ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
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
  const [open, setOpen]   = useState(false);

  const filtered = query.length >= 1
    ? NIGERIAN_BANKS.filter(b => b.name.toLowerCase().includes(query.toLowerCase()) || b.code.includes(query))
    : NIGERIAN_BANKS;
  const fintechs = filtered.filter(b => b.category === 'Fintech');
  const banks    = filtered.filter(b => b.category === 'Bank');

  const pick = (bank: Bank) => { onChange({ code: bank.code, name: bank.name }); setQuery(''); setOpen(false); };

  return (
    <div className="relative">
      <input
        className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none transition-colors"
        placeholder="Search bank or fintech (e.g. GTBank, Zenith…)"
        value={open ? query : value.name}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
      />
      {value.code && !open && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
          {value.code}
        </span>
      )}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
          {fintechs.length > 0 && (
            <>
              <div className="px-3 py-2 bg-zinc-800/60 border-b border-zinc-700">
                <p className="text-[8px] text-amber-400 uppercase font-black tracking-widest">Fintech & Mobile Money</p>
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

// ── Account Card ──────────────────────────────────────────────────────────────
function AccountCard({
  account, onSetDefault, onRepair, onDelete,
}: {
  account: LandlordBankAccount;
  onSetDefault: (id: string) => void;
  onRepair: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={`p-5 rounded-2xl border transition-all ${account.is_default ? 'border-amber-500/30 bg-amber-500/5' : 'border-zinc-800 bg-zinc-900/20'}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${account.is_default ? 'bg-amber-500/20' : 'bg-zinc-800'}`}>
            <CreditCard size={16} className={account.is_default ? 'text-amber-400' : 'text-zinc-500'}/>
          </div>
          <div>
            <p className="font-black text-sm">{account.bank_name}</p>
            <p className="text-zinc-500 text-[10px] font-mono mt-0.5">···· ···· {account.account_number.slice(-4)}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
          {account.is_default    && <span className="px-2 py-1 rounded-lg border border-amber-500/30 text-amber-400 text-[8px] font-black uppercase tracking-widest bg-amber-500/10">Default</span>}
          {account.is_verified   && <span className="px-2 py-1 rounded-lg border border-green-500/30 text-green-400 text-[8px] font-black uppercase tracking-widest bg-green-500/10 flex items-center gap-1"><CheckCircle2 size={8}/> Verified</span>}
        </div>
      </div>

      <p className="text-zinc-300 text-xs font-semibold mb-3">{account.account_name}</p>

      {/* Payout readiness badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest ${
          account.payout_ready ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-zinc-700 bg-zinc-900 text-zinc-600'}`}>
          <Zap size={9}/>
          {account.payout_ready ? 'Payout Ready' : 'No Recipient Code'}
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest ${
          account.split_pay_ready ? 'border-teal-500/30 bg-teal-500/10 text-teal-400' : 'border-zinc-700 bg-zinc-900 text-zinc-600'}`}>
          <Building2 size={9}/>
          {account.split_pay_ready ? 'Auto-Split Active' : 'No Subaccount'}
        </div>
      </div>

      {/* Repair prompt for legacy accounts missing codes */}
      {(!account.payout_ready || !account.split_pay_ready) && (
        <div className="mb-4 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-2">
          <Info size={11} className="text-amber-400 shrink-0 mt-0.5"/>
          <div className="flex-1">
            <p className="text-[9px] text-amber-400 leading-relaxed">
              {!account.payout_ready && !account.split_pay_ready
                ? 'Recipient code and subaccount missing — rent payouts will be deferred.'
                : !account.payout_ready
                ? 'Recipient code missing — manual payouts unavailable.'
                : 'Subaccount missing — auto-split at payment time is inactive.'}
              {' '}Repair to activate.
            </p>
          </div>
          <button
            onClick={() => onRepair(account.id)}
            className="flex-shrink-0 text-[9px] font-black uppercase tracking-widest text-amber-400 hover:underline">
            Repair
          </button>
        </div>
      )}

      <div className="flex gap-2">
        {!account.is_default && (
          <button onClick={() => onSetDefault(account.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-zinc-700 text-zinc-400 text-[9px] font-black uppercase tracking-widest hover:border-amber-500/30 hover:text-amber-400 transition-all">
            <Star size={10}/> Set Default
          </button>
        )}
        <button onClick={() => onDelete(account.id)}
          className="py-2 px-3 rounded-xl border border-zinc-800 text-zinc-600 hover:border-red-500/30 hover:text-red-400 transition-all">
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
  const [accountName, setAccountName] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  const inp = "w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none transition-colors";
  const lbl = "block text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-1.5";

  const handleAdd = async () => {
    setError(''); setSuccess('');
    if (!bank.code)                        return setError('Please select a bank');
    if (!accountName.trim())               return setError('Account name is required');
    if (!/^\d{10}$/.test(accountNum))      return setError('Account number must be exactly 10 digits');
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/landlord/bank-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          bank_name:      bank.name,
          bank_code:      bank.code,
          account_number: accountNum,
          account_name:   accountName.trim(),
          set_as_default: setAsDefault,
          currency:       'NGN',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save account');
      const acct = data.account;
      const hasRecipient  = !!acct.paystack_recipient_code;
      const hasSubaccount = !!acct.paystack_subaccount_code;
      const statusMsg = hasRecipient && hasSubaccount
        ? '✅ Payout recipient and auto-split subaccount created'
        : hasRecipient
        ? '✅ Payout recipient created (subaccount pending)'
        : '⚠️ Account saved — payout codes pending. Use Repair on the card.';
      setSuccess(statusMsg);
      setBank({ code: '', name: '' }); setAccountNum(''); setAccountName('');
      setTimeout(() => { setSuccess(''); onAdded(`Bank account saved — ${bank.name}`); }, 1800);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <CreditCard size={15} className="text-amber-400"/>
        </div>
        <div>
          <h3 className="font-black text-sm uppercase tracking-tight">Add Payout Account</h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">Rent payments route here · Paystack recipient & subaccount auto-created</p>
        </div>
      </div>

      {/* Bank selector */}
      <div>
        <label className={lbl}>Bank or Fintech *</label>
        <BankSelector value={bank} onChange={setBank}/>
        {bank.code && <p className="text-[9px] text-amber-400 mt-1.5 font-mono">Bank code auto-filled: {bank.code}</p>}
      </div>

      {/* Account name — landlord must provide this (used for Paystack recipient) */}
      <div>
        <label className={lbl}>Account Name (as registered with bank) *</label>
        <input
          className={inp}
          type="text"
          placeholder="e.g. Adewale Taiwo"
          value={accountName}
          onChange={e => setAccountName(e.target.value)}
        />
        <p className="text-[9px] text-zinc-600 mt-1.5">Must match the name on the bank account exactly — used to create your Paystack payout recipient.</p>
      </div>

      {/* Account number */}
      <div>
        <label className={lbl}>Account Number *</label>
        <input
          className={inp}
          type="text"
          inputMode="numeric"
          maxLength={10}
          placeholder="10-digit account number"
          value={accountNum}
          onChange={e => setAccountNum(e.target.value.replace(/\D/g, ''))}
        />
      </div>

      {/* Set as default toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
        <div>
          <p className="text-xs font-bold">Set as Default Payout Account</p>
          <p className="text-[9px] text-zinc-500 mt-0.5">Rent transfers route to the default account automatically</p>
        </div>
        <button
          onClick={() => setSetAsDefault(!setAsDefault)}
          className={`w-12 h-6 rounded-full transition-all relative flex-shrink-0 ${setAsDefault ? 'bg-amber-500' : 'bg-zinc-700'}`}>
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${setAsDefault ? 'left-7' : 'left-1'}`}/>
        </button>
      </div>

      {error   && <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-[11px]">{error}</div>}
      {success && <div className="p-3 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-[11px]">{success}</div>}

      <button
        onClick={handleAdd}
        disabled={loading}
        className={`w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
          loading ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-amber-500 text-black hover:bg-amber-400'}`}>
        {loading ? <><RefreshCw size={13} className="animate-spin"/> Saving…</> : '+ Add Payout Account'}
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LandlordBankingPage() {
  const router   = useRouter();
  const [accounts, setAccounts] = useState<LandlordBankAccount[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [repairing,setRepairing]= useState<string | null>(null);
  const [toast,    setToast]    = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      const res  = await fetch(`${API_BASE}/landlord/bank-accounts`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setAccounts(data.accounts || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const handleSetDefault = async (id: string) => {
    const token = getToken();
    // Optimistically update UI
    setAccounts(prev => prev.map(a => ({ ...a, is_default: a.id === id })));
    // No dedicated set-default endpoint — re-save with set_as_default flag via PATCH workaround:
    // The backend POST upserts on conflict so we just re-post with same data + set_as_default: true
    const acct = accounts.find(a => a.id === id);
    if (!acct) return;
    try {
      await fetch(`${API_BASE}/landlord/bank-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          bank_name: acct.bank_name, bank_code: acct.bank_code,
          account_number: acct.account_number, account_name: acct.account_name,
          set_as_default: true, currency: acct.currency,
        }),
      });
      showToast('Default payout account updated ✅');
      load();
    } catch { showToast('Failed to update default account'); load(); }
  };

  const handleRepair = async (id: string) => {
    setRepairing(id);
    const token = getToken();
    try {
      const res  = await fetch(`${API_BASE}/landlord/bank-accounts/${id}/create-recipient`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Repair failed');
      showToast(data.message || 'Account repaired ✅');
      load();
    } catch (e: any) { showToast(`Repair failed: ${e.message}`); }
    finally { setRepairing(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this payout account?')) return;
    setDeleting(id);
    const token = getToken();
    try {
      const res  = await fetch(`${API_BASE}/landlord/bank-accounts/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showToast('Bank account removed'); load();
    } catch (e: any) { showToast(`Error: ${e.message}`); }
    finally { setDeleting(null); }
  };

  const payoutReady  = accounts.filter(a => a.payout_ready).length;
  const splitReady   = accounts.filter(a => a.split_pay_ready).length;
  const needsRepair  = accounts.filter(a => !a.payout_ready || !a.split_pay_ready).length;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar/>
      <LandlordNav/>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-amber-500 text-black text-[11px] font-black uppercase tracking-widest shadow-2xl">
          {toast}
        </div>
      )}

      <main className="flex-1 max-w-3xl mx-auto px-4 md:px-6 py-8 w-full space-y-8">

        {/* Header */}
        <div className="border-l-2 border-amber-500 pl-4">
          <p className="text-[9px] text-amber-500 font-mono font-black tracking-widest uppercase mb-1">Landlord Portal</p>
          <h1 className="text-2xl font-black uppercase tracking-tighter">Banking & Payouts</h1>
          <p className="text-zinc-500 text-xs mt-1">Payout accounts · Paystack recipients · Auto-split configuration</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="animate-spin text-amber-500 mr-3" size={20}/>
            <span className="text-zinc-500 font-mono text-sm">Loading…</span>
          </div>
        )}

        {!loading && (
          <>
            {/* Portfolio payout status summary */}
            {accounts.length > 0 && (
              <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20">
                <div className="flex items-center gap-3 mb-3">
                  <Zap size={16} className={payoutReady === accounts.length ? 'text-green-400' : 'text-amber-400'}/>
                  <p className="text-[9px] uppercase font-black tracking-widest">
                    {payoutReady === accounts.length ? 'All Accounts Payout-Ready' : `${needsRepair} Account${needsRepair > 1 ? 's' : ''} Need Repair`}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Accounts',      value: String(accounts.length),  color: 'text-white'      },
                    { label: 'Payout Ready',  value: String(payoutReady),       color: 'text-green-400'  },
                    { label: 'Auto-Split On', value: String(splitReady),        color: 'text-teal-400'   },
                  ].map(s => (
                    <div key={s.label} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                      <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest mb-0.5">{s.label}</p>
                      <p className={`text-sm font-black font-mono ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Account cards */}
            {accounts.length > 0 && (
              <div className="space-y-4">
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Saved Accounts ({accounts.length})</p>
                {accounts.map(acct => (
                  <div key={acct.id} style={{ opacity: deleting === acct.id || repairing === acct.id ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                    {repairing === acct.id && (
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <RefreshCw size={11} className="animate-spin text-amber-400"/>
                        <span className="text-[9px] text-amber-400 font-mono">Repairing — creating Paystack codes…</span>
                      </div>
                    )}
                    <AccountCard
                      account={acct}
                      onSetDefault={handleSetDefault}
                      onRepair={handleRepair}
                      onDelete={handleDelete}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Add account form */}
            <AddAccountForm onAdded={msg => { load(); showToast(msg); }}/>

            {/* How payout routing works */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/10 space-y-4">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-amber-400"/>
                <p className="text-[9px] text-amber-400 uppercase font-black tracking-widest">How Rent Payouts Work</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { step: '01', title: 'Add Your Account', desc: 'Select your bank from the list — code auto-fills. Enter account name and number. Paystack recipient and subaccount are created instantly.' },
                  { step: '02', title: 'Auto-Split at Source', desc: 'When a tenant pays rent, Paystack routes 98% directly to your account and 2% to the platform — no manual payout needed.' },
                  { step: '03', title: 'Fallback Transfer', desc: 'If subaccount split is unavailable, a manual Paystack transfer fires via your recipient code within 24hrs of payment confirmation.' },
                ].map(s => (
                  <div key={s.step} className="flex gap-3">
                    <span className="text-[9px] font-black text-amber-500 font-mono flex-shrink-0 mt-0.5">{s.step}</span>
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
                  The default account receives all rent transfers. Accounts without Paystack codes show a Repair button — click it to backfill codes without re-entering details.
                </p>
              </div>
            </div>

            {/* Security note */}
            <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/10 flex items-start gap-3">
              <ShieldCheck size={16} className="text-amber-500 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="text-xs font-black uppercase tracking-tight mb-1">Bank-Grade Security</p>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Paystack recipient codes are created server-side — no raw account credentials stored beyond initial setup. All Nigerian banks supported. Rent transfers are SHA-256 hashed, ledger-recorded, and court-admissible under Nested Ark OS audit chain.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-6">
              <Link href="/landlord/dashboard" className="text-[11px] text-amber-500 font-bold hover:underline flex items-center gap-1">← Dashboard</Link>
              <Link href="/landlord/receipts" className="text-[11px] text-zinc-500 hover:text-zinc-300 font-bold flex items-center gap-1 transition-colors">Receipts<ChevronRight size={11}/></Link>
            </div>
          </>
        )}
      </main>
      <Footer/>
    </div>
  );
}
