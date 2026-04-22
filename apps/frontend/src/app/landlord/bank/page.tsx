'use client';
export const dynamic = 'force-dynamic';
/**
 * src/app/landlord/bank/page.tsx
 * 
 * Landlord Bank Account Management
 * - Add Nigerian bank accounts (verified via Paystack /bank/resolve)
 * - Paystack Transfer Recipient created automatically on save
 * - Set default payout account
 * - View payout history
 * - Trigger manual payout (for testing / on-demand)
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import {
  Landmark, Plus, Trash2, CheckCircle2, Loader2, AlertCircle,
  ShieldCheck, RefreshCw, X, Building2, ChevronRight,
  Download, TrendingUp, Info, Eye, EyeOff, Check,
} from 'lucide-react';

const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();
const fmtDate = (s: any) => s ? new Date(s).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  bank_code: string;
  currency: string;
  paystack_recipient_code?: string;
  is_verified: boolean;
  is_default: boolean;
  created_at: string;
}
interface Bank { id: number; name: string; code: string; }
interface Payout { id: string; reference: string; amount_ngn: number; bank_name: string; account_name: string; created_at: string; }

export default function LandlordBankPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [accounts,  setAccounts]  = useState<BankAccount[]>([]);
  const [banks,     setBanks]     = useState<Bank[]>([]);
  const [payouts,   setPayouts]   = useState<Payout[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);
  const [tab,       setTab]       = useState<'accounts'|'history'>('accounts');

  // Add account form
  const [form, setForm] = useState({
    account_number: '', bank_code: '', bank_name: '',
    account_name: '', currency: 'NGN', set_as_default: true,
  });
  const [verifying,   setVerifying]   = useState(false);
  const [verified,    setVerified]    = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState('');
  const [showAcctNum, setShowAcctNum] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [acctRes, bankRes, payRes] = await Promise.all([
        api.get('/api/landlord/bank-accounts'),
        api.get('/api/paystack/banks').catch(() => ({ data: { banks: [] } })),
        api.get('/api/landlord/payout-history').catch(() => ({ data: { payouts: [] } })),
      ]);
      setAccounts(acctRes.data.accounts ?? []);
      setBanks(bankRes.data.banks ?? []);
      setPayouts(payRes.data.payouts ?? []);
    } catch (e) {
      // non-fatal — user sees empty state
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!authLoading && user) load(); }, [authLoading, user, load]);

  const setF = (k: string, v: any) => {
    setForm(f => ({ ...f, [k]: v }));
    setVerified(false);
    setVerifyError('');
  };

  const handleBankSelect = (code: string) => {
    const bank = banks.find(b => b.code === code);
    setF('bank_code', code);
    setF('bank_name', bank?.name ?? '');
    setVerified(false);
    setVerifyError('');
  };

  const verifyAccount = async () => {
    if (!form.account_number.trim() || !form.bank_code) {
      setVerifyError('Select a bank and enter your 10-digit account number');
      return;
    }
    if (form.account_number.replace(/\D/g, '').length < 10) {
      setVerifyError('Account number must be 10 digits');
      return;
    }
    setVerifying(true); setVerifyError(''); setVerified(false);
    try {
      const res = await api.post('/api/paystack/resolve-account', {
        account_number: form.account_number.replace(/\D/g, ''),
        bank_code: form.bank_code,
      });
      setF('account_name', res.data.account_name);
      setF('account_number', res.data.account_number);
      setVerified(true);
    } catch (e: any) {
      setVerifyError(e?.response?.data?.error ?? 'Could not verify account — check number and bank');
    } finally { setVerifying(false); }
  };

  const saveAccount = async () => {
    if (!verified) { setSaveError('Verify your account number first'); return; }
    setSaving(true); setSaveError('');
    try {
      await api.post('/api/landlord/bank-accounts', {
        ...form,
        account_number: form.account_number.replace(/\D/g, ''),
      });
      setShowAdd(false);
      setForm({ account_number: '', bank_code: '', bank_name: '', account_name: '', currency: 'NGN', set_as_default: true });
      setVerified(false);
      load();
    } catch (e: any) {
      setSaveError(e?.response?.data?.error ?? 'Could not save bank account');
    } finally { setSaving(false); }
  };

  const deleteAccount = async (id: string) => {
    if (!confirm('Remove this bank account?')) return;
    try {
      await api.delete(`/api/landlord/bank-accounts/${id}`);
      load();
    } catch (e: any) { alert(e?.response?.data?.error ?? 'Could not remove account'); }
  };

  if (authLoading || !user) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={28} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto px-6 py-12 w-full space-y-8">

        {/* Header */}
        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Payout Settings</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Bank Accounts</h1>
          <p className="text-zinc-500 text-xs mt-1">
            Link your Nigerian bank account to receive rent payouts directly via Paystack Transfer
          </p>
        </div>

        {/* How it works */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/10 space-y-4">
          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">How rent payouts work</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { step: '01', title: 'Tenant pays', body: 'Tenant pays rent via Paystack (card, bank transfer, USSD).' },
              { step: '02', title: 'Ark holds escrow', body: 'Funds are held securely in the Nested Ark escrow vault.' },
              { step: '03', title: 'You receive', body: 'On the due date, rent minus platform fee is sent directly to your bank.' },
            ].map(s => (
              <div key={s.step} className="space-y-2">
                <p className="text-teal-500 font-mono font-black text-[9px] uppercase tracking-widest">{s.step}</p>
                <p className="text-white text-xs font-bold">{s.title}</p>
                <p className="text-zinc-500 text-[10px] leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2 p-3 rounded-xl border border-teal-500/20 bg-teal-500/5 text-[9px] text-zinc-400 leading-relaxed">
            <Info size={11} className="text-teal-500 flex-shrink-0 mt-0.5" />
            Account verification is done live via Paystack. Your account name is confirmed before saving.
            A Transfer Recipient is created so payouts are processed T+1 on the next business day.
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl w-fit">
          {[
            { key: 'accounts', label: `Accounts (${accounts.length})` },
            { key: 'history',  label: `Payout History (${payouts.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === t.key ? 'bg-teal-500 text-black' : 'text-zinc-500 hover:text-white'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ACCOUNTS TAB ── */}
        {tab === 'accounts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Saved Accounts</p>
              <button onClick={() => { setShowAdd(true); setVerified(false); setVerifyError(''); setSaveError(''); }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-500 text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-teal-400 transition-all">
                <Plus size={12} /> Add Account
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-teal-500" size={24} /></div>
            ) : accounts.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl space-y-5">
                <Landmark className="text-zinc-700 mx-auto" size={40} />
                <div>
                  <p className="text-zinc-400 font-bold">No bank accounts linked yet</p>
                  <p className="text-zinc-600 text-sm mt-1">Add your bank account to receive rent payouts automatically</p>
                </div>
                <button onClick={() => setShowAdd(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all">
                  <Plus size={13} /> Add Bank Account
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map(acct => (
                  <div key={acct.id} className={`p-5 rounded-2xl border space-y-3 ${acct.is_default ? 'border-teal-500/30 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/20'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-base">{acct.account_name}</p>
                          {acct.is_default && (
                            <span className="text-[7px] px-2 py-0.5 rounded-full font-black uppercase border border-teal-500/40 bg-teal-500/10 text-teal-400">Default</span>
                          )}
                          {acct.is_verified && (
                            <span className="flex items-center gap-1 text-[8px] text-teal-400 font-bold">
                              <ShieldCheck size={10} /> Verified
                            </span>
                          )}
                          {acct.paystack_recipient_code && (
                            <span className="text-[7px] px-2 py-0.5 rounded-full font-black uppercase border border-green-500/30 bg-green-500/10 text-green-400">
                              Paystack Linked
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-400">{acct.bank_name}</p>
                        <p className="font-mono text-[10px] text-zinc-600">
                          •••• •••• {acct.account_number.slice(-4)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => deleteAccount(acct.id)}
                          className="p-2 rounded-xl border border-zinc-800 text-zinc-600 hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/5 transition-all">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    {acct.paystack_recipient_code && (
                      <p className="text-[8px] text-zinc-700 font-mono">
                        Recipient: {acct.paystack_recipient_code}
                      </p>
                    )}
                    <p className="text-[8px] text-zinc-700">Added {fmtDate(acct.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <div className="space-y-4">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Payout History</p>
            {payouts.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
                <TrendingUp className="text-zinc-700 mx-auto" size={40} />
                <p className="text-zinc-400 font-bold">No payouts yet</p>
                <p className="text-zinc-600 text-sm">Rent payouts will appear here once tenants make payments</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payouts.map((p, i) => (
                  <div key={p.id ?? i} className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-bold text-sm">₦{safeF(p.amount_ngn)}</p>
                      <p className="text-[9px] text-zinc-500">{p.account_name} · {p.bank_name}</p>
                      <p className="font-mono text-[8px] text-zinc-700">{p.reference}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-teal-400 font-bold uppercase">Transferred</p>
                      <p className="text-[8px] text-zinc-600">{fmtDate(p.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* ── Add Account Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

            <div className="flex items-center justify-between p-5 border-b border-zinc-900 flex-shrink-0">
              <div>
                <p className="text-[8px] text-teal-500 uppercase font-black tracking-[0.25em]">Link Bank Account</p>
                <p className="text-sm font-black uppercase tracking-tight text-white mt-0.5">Add Payout Account</p>
              </div>
              <button onClick={() => setShowAdd(false)} className="p-2 rounded-xl text-zinc-600 hover:text-white hover:bg-zinc-800 transition-all"><X size={16} /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">

              {/* Bank selector */}
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Bank *</label>
                <select value={form.bank_code} onChange={e => handleBankSelect(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none">
                  <option value="">Select your bank…</option>
                  {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                  {/* Fallback common Nigerian banks if Paystack API is unavailable */}
                  {banks.length === 0 && [
                    ['044','Access Bank'],['014','Afribank'],['023','Citibank'],['063','Diamond Bank'],
                    ['050','Ecobank'],['011','First Bank'],['214','First City Monument Bank'],
                    ['070','Fidelity Bank'],['058','GTBank'],['030','Heritage Bank'],['082','Keystone Bank'],
                    ['076','Polaris Bank'],['101','ProvidusBank'],['221','Stanbic IBTC'],['068','Standard Chartered'],
                    ['232','Sterling Bank'],['100','Suntrust Bank'],['032','Union Bank'],['033','United Bank for Africa'],
                    ['215','Unity Bank'],['035','Wema Bank'],['057','Zenith Bank'],
                  ].map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
              </div>

              {/* Account number */}
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Account Number *</label>
                <div className="relative">
                  <input
                    type={showAcctNum ? 'text' : 'password'}
                    maxLength={10}
                    value={form.account_number}
                    onChange={e => setF('account_number', e.target.value.replace(/\D/g,'').slice(0,10))}
                    placeholder="10-digit account number"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none font-mono tracking-widest"
                  />
                  <button onClick={() => setShowAcctNum(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-all p-1">
                    {showAcctNum ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Verify button */}
              <button onClick={verifyAccount} disabled={verifying || !form.bank_code || form.account_number.length < 10}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${verified ? 'bg-teal-500/10 border border-teal-500/30 text-teal-400' : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50'}`}>
                {verifying
                  ? <><Loader2 size={13} className="animate-spin" /> Verifying…</>
                  : verified
                  ? <><CheckCircle2 size={13} /> Account Verified</>
                  : 'Verify Account Number'
                }
              </button>

              {verifyError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">
                  <AlertCircle size={12} className="flex-shrink-0 mt-0.5" /> {verifyError}
                </div>
              )}

              {/* Verified account display */}
              {verified && form.account_name && (
                <div className="p-4 rounded-2xl border border-teal-500/30 bg-teal-500/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-teal-400" />
                    <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest">Account Confirmed</p>
                  </div>
                  <p className="font-black text-lg text-white">{form.account_name}</p>
                  <p className="text-sm text-zinc-400">{form.bank_name}</p>
                  <p className="font-mono text-[10px] text-zinc-600">
                    {form.account_number.slice(0,3)} {form.account_number.slice(3,6)} {form.account_number.slice(6)}
                  </p>
                </div>
              )}

              {/* Currency */}
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Payout Currency</label>
                <div className="flex gap-2">
                  {['NGN','GHS','KES'].map(c => (
                    <button key={c} onClick={() => setF('currency', c)}
                      className={`px-5 py-2.5 rounded-xl border text-sm font-black transition-all ${form.currency === c ? 'border-teal-500/60 bg-teal-500/10 text-teal-400' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default toggle */}
              <button onClick={() => setF('set_as_default', !form.set_as_default)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${form.set_as_default ? 'border-teal-500/40 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-600'}`}>
                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${form.set_as_default ? 'bg-teal-500' : 'bg-zinc-800 border border-zinc-700'}`}>
                  {form.set_as_default && <Check size={12} className="text-black" strokeWidth={3} />}
                </div>
                <div>
                  <p className="font-bold text-sm text-white">Set as default payout account</p>
                  <p className="text-[9px] text-zinc-500">Rent from all properties goes here unless overridden per property</p>
                </div>
              </button>

              {saveError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">
                  {saveError}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-zinc-900 flex gap-2 flex-shrink-0">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl border border-zinc-800 text-zinc-500 font-bold text-[10px] uppercase tracking-widest hover:border-zinc-600 hover:text-zinc-300 transition-all">Cancel</button>
              <button onClick={saveAccount} disabled={saving || !verified}
                className="flex-1 py-3 rounded-xl bg-teal-500 text-black font-black text-[10px] uppercase tracking-widest hover:bg-teal-400 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Landmark size={13} />}
                {saving ? 'Saving…' : 'Save Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
