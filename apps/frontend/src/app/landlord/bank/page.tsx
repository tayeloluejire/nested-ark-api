'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  Landmark, Plus, Trash2, ShieldCheck, AlertCircle,
  CheckCircle2, Loader2, RefreshCw, X, ArrowLeft,
  BadgeCheck, Banknote, Zap, Star, Eye, EyeOff, Wrench,
  Clock, Info,
} from 'lucide-react';

const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();
const maskAcct = (n: string) => n ? `****${n.slice(-4)}` : '****';

interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  bank_code: string;
  currency: string;
  is_default: boolean;
  payout_ready: boolean;
  paystack_recipient_code?: string;
  created_at: string;
}
interface BankOption { name: string; code: string; }

export default function LandlordBankPage() {
  const [accounts,       setAccounts]       = useState<BankAccount[]>([]);
  const [banks,          setBanks]          = useState<BankOption[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [showAdd,        setShowAdd]        = useState(false);
  const [showNums,       setShowNums]       = useState<Record<string, boolean>>({});

  // Paystack balance
  const [balanceNgn,     setBalanceNgn]     = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceNote,    setBalanceNote]    = useState('');

  // Repair state — per-account inline bank_code prompt
  const [repairId,       setRepairId]       = useState('');
  const [repairCode,     setRepairCode]     = useState('');
  const [repairBusy,     setRepairBusy]     = useState(false);
  const [repairMsg,      setRepairMsg]      = useState('');
  const [repairErr,      setRepairErr]      = useState('');

  // Add form
  const [form, setForm] = useState({
    account_number: '', bank_code: '', bank_name: '',
    account_name: '', currency: 'NGN', set_as_default: true,
  });
  const [resolving, setResolving] = useState(false);
  const [resolved,  setResolved]  = useState(false);
  const [adding,    setAdding]    = useState(false);
  const [addError,  setAddError]  = useState('');
  const [addOk,     setAddOk]     = useState('');

  // Payout
  const [payoutAcct, setPayoutAcct] = useState('');
  const [payoutAmt,  setPayoutAmt]  = useState('');
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutMsg,  setPayoutMsg]  = useState('');
  const [payoutErr,  setPayoutErr]  = useState('');
  const [t1Note,     setT1Note]     = useState('');

  const loadAccounts = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/api/landlord/bank-accounts');
      setAccounts(res.data.accounts ?? []);
    } catch (ex: any) {
      setError(ex?.response?.data?.error ?? 'Could not load bank accounts.');
    } finally { setLoading(false); }
  }, []);

  const loadBanks = useCallback(async () => {
    try {
      const res = await api.get('/api/paystack/banks');
      setBanks((res.data.banks ?? []).map((b: any) => ({ name: b.name, code: b.code })));
    } catch { /* non-fatal */ }
  }, []);

  const loadBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const res = await api.get('/api/landlord/paystack-balance');
      setBalanceNgn(res.data.available_ngn ?? 0);
      setBalanceNote(res.data.note ?? '');
    } catch { setBalanceNgn(null); }
    finally { setBalanceLoading(false); }
  }, []);

  useEffect(() => { loadAccounts(); loadBanks(); loadBalance(); }, [loadAccounts, loadBanks, loadBalance]);

  const resolveAccountName = async (acctNum: string, bCode: string) => {
    if (acctNum.length !== 10 || !bCode) return;
    setResolving(true); setResolved(false);
    setForm(f => ({ ...f, account_name: '' }));
    try {
      const res = await api.post('/api/paystack/resolve-account', { account_number: acctNum, bank_code: bCode });
      setForm(f => ({ ...f, account_name: res.data.account_name ?? '' }));
      setResolved(true);
    } catch (ex: any) {
      setAddError(ex?.response?.data?.error ?? 'Could not verify account.');
    } finally { setResolving(false); }
  };

  const handleAddAccount = async () => {
    if (!form.account_name) { setAddError('Resolve account name first.'); return; }
    if (!form.bank_code)    { setAddError('Select a bank.'); return; }
    setAdding(true); setAddError(''); setAddOk('');
    try {
      await api.post('/api/landlord/bank-accounts', {
        account_name: form.account_name, account_number: form.account_number,
        bank_code: form.bank_code, bank_name: form.bank_name,
        currency: form.currency, set_as_default: form.set_as_default,
      });
      setAddOk('Account saved & Paystack recipient created!');
      setForm({ account_number: '', bank_code: '', bank_name: '', account_name: '', currency: 'NGN', set_as_default: true });
      setResolved(false);
      setTimeout(() => { setShowAdd(false); setAddOk(''); loadAccounts(); }, 1500);
    } catch (ex: any) {
      setAddError(ex?.response?.data?.error ?? 'Failed to save account.');
    } finally { setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this bank account?')) return;
    try {
      await api.delete(`/api/landlord/bank-accounts/${id}`);
      setAccounts(a => a.filter(x => x.id !== id));
    } catch (ex: any) { setError(ex?.response?.data?.error ?? 'Delete failed.'); }
  };

  const handleRepair = async (id: string, bankCodeOverride?: string) => {
    setRepairBusy(true); setRepairErr(''); setRepairMsg('');
    try {
      const payload = bankCodeOverride ? { bank_code: bankCodeOverride } : {};
      const res = await api.post(`/api/landlord/bank-accounts/${id}/create-recipient`, payload);
      setRepairMsg(res.data.message ?? 'Account is now payout-ready!');
      setRepairId(''); setRepairCode('');
      setTimeout(() => { setRepairMsg(''); loadAccounts(); loadBalance(); }, 2000);
    } catch (ex: any) {
      const d = ex?.response?.data;
      if (d?.needs_bank_code) {
        setRepairId(id);
        setRepairErr('Select your bank below to complete the repair:');
      } else {
        setRepairErr(d?.error ?? 'Repair failed.');
      }
    } finally { setRepairBusy(false); }
  };

  const handlePayout = async () => {
    if (!payoutAcct || !payoutAmt) { setPayoutErr('Select account and enter amount.'); return; }
    setPayoutBusy(true); setPayoutErr(''); setPayoutMsg(''); setT1Note('');
    try {
      const res = await api.post('/api/landlord/payout', {
        bank_account_id: payoutAcct, amount_ngn: parseFloat(payoutAmt),
      });
      setPayoutMsg(res.data.message ?? `Transfer initiated successfully!`);
      setPayoutAmt('');
      loadBalance(); // refresh balance after successful transfer
    } catch (ex: any) {
      const d = ex?.response?.data;
      setPayoutErr(d?.error ?? 'Payout failed.');
      if (d?.t1_note) setT1Note(d.t1_note);
      if (d?.insufficient_balance) loadBalance(); // refresh to show current balance
    } finally { setPayoutBusy(false); }
  };

  const payoutReadyAccts  = accounts.filter(a => a.payout_ready);
  const grossAmt          = parseFloat(payoutAmt) || 0;
  const feeAmt            = Math.round(grossAmt * 0.02);
  const netAmt            = Math.round(grossAmt * 0.98);
  const balanceKnown      = balanceNgn !== null;
  const hasSufficientBal  = balanceKnown ? balanceNgn >= netAmt : true; // optimistic if unknown
  const canInitiatePayout = !!payoutAcct && grossAmt > 0 && !payoutBusy && hasSufficientBal;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">

        <Link href="/landlord/dashboard"
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
          <ArrowLeft size={12} /> Landlord Dashboard
        </Link>

        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Payout Engine</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Bank Accounts</h1>
          <p className="text-zinc-500 text-xs mt-1">Manage payout destinations. Rent collected flows here automatically.</p>
        </div>

        {/* Paystack Balance Card */}
        <div className={`p-5 rounded-2xl border flex items-center justify-between gap-4 ${
          balanceNgn === null ? 'border-zinc-800 bg-zinc-900/20'
          : balanceNgn > 0   ? 'border-teal-500/20 bg-teal-500/5'
                              : 'border-amber-500/20 bg-amber-500/5'
        }`}>
          <div className="space-y-1">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Paystack Available Balance</p>
            {balanceLoading ? (
              <Loader2 className="animate-spin text-zinc-500" size={16} />
            ) : balanceNgn === null ? (
              <p className="text-zinc-500 text-sm font-bold">—</p>
            ) : (
              <p className={`text-2xl font-black font-mono tabular-nums ${balanceNgn > 0 ? 'text-teal-400' : 'text-amber-400'}`}>
                ₦{safeF(balanceNgn)}
              </p>
            )}
            {balanceNote && (
              <div className="flex items-start gap-1.5 mt-1">
                <Clock size={9} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[9px] text-amber-400/80 leading-relaxed">{balanceNote}</p>
              </div>
            )}
          </div>
          <button
            onClick={loadBalance}
            className="flex items-center gap-1.5 px-3 py-2 border border-zinc-800 text-zinc-500 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:text-white transition-all flex-shrink-0">
            <RefreshCw size={10} /> Refresh
          </button>
        </div>

        {/* Status banner */}
        {!loading && accounts.length > 0 && (
          <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
            payoutReadyAccts.length > 0
              ? 'border-teal-500/20 bg-teal-500/5'
              : 'border-amber-500/20 bg-amber-500/5'
          }`}>
            {payoutReadyAccts.length > 0
              ? <><ShieldCheck size={14} className="text-teal-400 flex-shrink-0 mt-0.5" />
                  <p className="text-teal-400 text-xs font-bold">
                    {payoutReadyAccts.length} payout-ready account{payoutReadyAccts.length > 1 ? 's' : ''}.
                    Rent auto-transfers within 24h of collection.
                  </p></>
              : <><AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-400 text-xs font-bold mb-1">No accounts are payout-ready.</p>
                    <p className="text-amber-400/70 text-[10px]">
                      Click <strong>Repair →</strong> on your account and select your bank, or delete and re-add.
                    </p>
                  </div></>
            }
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14} /> {error}
            <button onClick={loadAccounts} className="ml-auto text-teal-500 text-xs font-black">Retry →</button>
          </div>
        )}

        {repairMsg && (
          <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/10 text-teal-400 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 size={13} /> {repairMsg}
          </div>
        )}

        {/* Account list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Saved Accounts</p>
            <div className="flex items-center gap-2">
              <button onClick={loadAccounts}
                className="flex items-center gap-1.5 px-3 py-2 border border-zinc-800 text-zinc-500 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:text-white transition-all">
                <RefreshCw size={10} /> Refresh
              </button>
              <button onClick={() => { setShowAdd(true); setAddError(''); setAddOk(''); setResolved(false); }}
                className="flex items-center gap-2 bg-teal-500 text-black px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white transition-all">
                <Plus size={12} /> Add Account
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-teal-500" size={28} />
            </div>
          ) : accounts.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl space-y-5">
              <Landmark className="text-zinc-700 mx-auto" size={48} />
              <div>
                <p className="text-zinc-400 font-bold">No bank accounts yet</p>
                <p className="text-zinc-600 text-sm mt-1">Add your account to receive automatic rent payouts.</p>
              </div>
              <button onClick={() => { setShowAdd(true); setAddError(''); setAddOk(''); }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all">
                <Plus size={11} /> Add Bank Account
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map(acct => (
                <div key={acct.id}
                  className={`p-5 rounded-2xl border space-y-4 transition-all ${
                    acct.is_default ? 'border-teal-500/40 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/20'
                  }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Landmark size={16} className={acct.payout_ready ? 'text-teal-500' : 'text-zinc-600'} />
                      {acct.is_default && (
                        <span className="text-[7px] bg-teal-500 text-black font-black uppercase px-1.5 py-0.5 rounded tracking-widest flex items-center gap-0.5">
                          <Star size={7} fill="currentColor" /> Default
                        </span>
                      )}
                      {acct.payout_ready
                        ? <span className="text-[7px] border border-teal-500/30 text-teal-400 px-1.5 py-0.5 rounded font-bold uppercase flex items-center gap-0.5">
                            <Zap size={7} /> Ready
                          </span>
                        : <span className="text-[7px] border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded font-bold uppercase">
                            No Recipient
                          </span>
                      }
                    </div>
                    <button onClick={() => handleDelete(acct.id)} className="text-zinc-700 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div>
                    <p className="font-bold text-sm">{acct.account_name}</p>
                    <p className="text-zinc-400 text-xs font-mono mt-0.5">
                      {showNums[acct.id] ? acct.account_number : maskAcct(acct.account_number)}
                    </p>
                    <p className="text-zinc-500 text-[10px] mt-0.5">{acct.bank_name}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <button onClick={() => setShowNums(n => ({ ...n, [acct.id]: !n[acct.id] }))}
                      className="text-zinc-600 hover:text-zinc-400 transition-colors">
                      {showNums[acct.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                    {acct.payout_ready
                      ? <div className="flex items-center gap-1 text-[8px] text-teal-400 font-bold">
                          <BadgeCheck size={9} /> Paystack Linked
                        </div>
                      : <button
                          onClick={() => handleRepair(acct.id)}
                          disabled={repairBusy}
                          className="text-[8px] text-amber-400 font-bold uppercase tracking-widest hover:text-amber-300 transition-colors flex items-center gap-1">
                          {repairBusy && repairId === '' ? <Loader2 size={9} className="animate-spin" /> : <Wrench size={9} />}
                          Repair →
                        </button>
                    }
                  </div>

                  {/* Inline bank_code repair panel */}
                  {repairId === acct.id && (
                    <div className="pt-3 border-t border-zinc-800 space-y-3">
                      <p className="text-[9px] text-amber-400 font-bold">{repairErr || 'Select your bank to complete repair:'}</p>
                      <select
                        value={repairCode}
                        onChange={e => setRepairCode(e.target.value)}
                        className="w-full bg-black border border-zinc-800 p-2.5 rounded-xl text-white text-xs outline-none focus:border-teal-500 transition-colors">
                        <option value="">— Select bank —</option>
                        {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button onClick={() => { setRepairId(''); setRepairCode(''); setRepairErr(''); }}
                          className="flex-1 py-2 border border-zinc-700 text-zinc-500 text-[9px] font-bold uppercase rounded-xl hover:text-white transition-all">
                          Cancel
                        </button>
                        <button
                          onClick={() => handleRepair(acct.id, repairCode)}
                          disabled={!repairCode || repairBusy}
                          className="flex-1 py-2 bg-teal-500 text-black text-[9px] font-black uppercase rounded-xl hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-1">
                          {repairBusy ? <Loader2 size={10} className="animate-spin" /> : <ShieldCheck size={10} />}
                          {repairBusy ? 'Patching…' : 'Patch & Repair'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manual payout panel */}
        {payoutReadyAccts.length > 0 && (
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-5">
            <div>
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Manual Payout</p>
              <p className="text-xs text-zinc-600">On-demand transfer from collected rent balance. 2% platform fee applies.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select value={payoutAcct} onChange={e => setPayoutAcct(e.target.value)}
                className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-sm outline-none focus:border-teal-500 transition-colors">
                <option value="">— Select account —</option>
                {payoutReadyAccts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.bank_name} · {maskAcct(a.account_number)} ({a.account_name})
                  </option>
                ))}
              </select>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-mono">₦</span>
                <input type="number" placeholder="Amount (NGN)" value={payoutAmt}
                  onChange={e => { setPayoutAmt(e.target.value); setPayoutErr(''); setT1Note(''); }}
                  className="w-full bg-black border border-zinc-800 p-3 pl-7 rounded-xl text-white text-sm font-mono outline-none focus:border-teal-500 transition-colors" />
              </div>
            </div>

            {/* Balance warning when entered amount exceeds available */}
            {balanceKnown && grossAmt > 0 && !hasSufficientBal && (
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-2">
                <Clock size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-400 text-xs font-bold">
                    Available: ₦{safeF(balanceNgn!)} · Required: ₦{safeF(netAmt)}
                  </p>
                  <p className="text-amber-400/70 text-[10px] mt-0.5 leading-relaxed">
                    Paystack settles collections the next business day (T+1).
                    Funds collected today will be available tomorrow.
                  </p>
                </div>
              </div>
            )}

            {grossAmt > 0 && (
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400 flex flex-wrap items-center gap-4">
                <span>Gross: <span className="text-white">₦{safeF(grossAmt)}</span></span>
                <span>Fee (2%): <span className="text-amber-400">-₦{safeF(feeAmt)}</span></span>
                <span>You receive: <span className={`font-black ${hasSufficientBal ? 'text-teal-400' : 'text-amber-400'}`}>₦{safeF(netAmt)}</span></span>
                {balanceKnown && (
                  <span className="ml-auto text-zinc-600">
                    Available: <span className={balanceNgn! >= netAmt ? 'text-teal-400' : 'text-amber-400'}>₦{safeF(balanceNgn!)}</span>
                  </span>
                )}
              </div>
            )}

            {payoutErr && (
              <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 space-y-1">
                <div className="flex items-center gap-2 text-red-400 text-xs font-bold">
                  <AlertCircle size={11} /> {payoutErr}
                </div>
                {t1Note && (
                  <div className="flex items-start gap-1.5 pl-5">
                    <Clock size={9} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-amber-400/80 text-[9px] leading-relaxed">{t1Note}</p>
                  </div>
                )}
              </div>
            )}
            {payoutMsg && (
              <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={11} /> {payoutMsg}
              </div>
            )}

            <button onClick={handlePayout} disabled={!canInitiatePayout}
              className={`flex items-center gap-2 px-6 py-3 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 ${
                !hasSufficientBal && grossAmt > 0
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-not-allowed'
                  : 'bg-teal-500 text-black hover:bg-white'
              }`}>
              {payoutBusy
                ? <><Loader2 className="animate-spin" size={12} /> Initiating Transfer…</>
                : !hasSufficientBal && grossAmt > 0
                ? <><Clock size={12} /> Insufficient Balance — Retry Tomorrow</>
                : <><Banknote size={12} /> Initiate Transfer</>
              }
            </button>
          </div>
        )}

        {/* How payouts work */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/10 space-y-4">
          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">How payouts work</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: '01', title: 'Tenant pays',    body: 'Rent collected via Paystack and held in your Paystack balance (T+1 settlement).' },
              { step: '02', title: 'T+1 clearing',   body: 'Paystack settles to your available balance the next business day after collection.' },
              { step: '03', title: '98% to you',     body: '2% platform fee deducted. Net transferred instantly once balance is available.' },
            ].map(s => (
              <div key={s.step} className="space-y-2">
                <p className="text-teal-500 font-mono font-black text-[9px] uppercase tracking-widest">{s.step}</p>
                <p className="text-white text-xs font-bold">{s.title}</p>
                <p className="text-zinc-500 text-[10px] leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="pt-3 border-t border-zinc-800 flex items-start gap-2">
            <Info size={10} className="text-zinc-600 flex-shrink-0 mt-0.5" />
            <p className="text-[9px] text-zinc-600 leading-relaxed">
              The auto-transfer cron runs every 30 minutes. It will automatically retry payouts once your Paystack balance clears.
              You don't need to trigger manual payouts — it's fully automated.
            </p>
          </div>
        </div>

      </main>

      {/* ── Add Account Modal ──────────────────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] text-teal-500 font-mono font-black uppercase tracking-widest mb-0.5">Payout Engine</p>
                <h3 className="text-xl font-black uppercase">Add Bank Account</h3>
              </div>
              <button onClick={() => setShowAdd(false)} className="text-zinc-600 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <select value={form.bank_code}
                className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-sm outline-none focus:border-teal-500 transition-colors"
                onChange={e => {
                  const opt = banks.find(b => b.code === e.target.value);
                  setForm(f => ({ ...f, bank_code: e.target.value, bank_name: opt?.name ?? '', account_name: '' }));
                  setResolved(false);
                  if (form.account_number.length === 10 && e.target.value) {
                    resolveAccountName(form.account_number, e.target.value);
                  }
                }}>
                <option value="">— Select bank —</option>
                {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>

              <div className="relative">
                <input placeholder="Account Number (10 digits)" maxLength={10} value={form.account_number}
                  className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-sm font-mono outline-none focus:border-teal-500 transition-colors pr-10"
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '');
                    setForm(f => ({ ...f, account_number: v, account_name: '' }));
                    setResolved(false);
                    if (v.length === 10 && form.bank_code) resolveAccountName(v, form.bank_code);
                  }} />
                {resolving && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-teal-500" size={13} />}
                {resolved && !resolving && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400" size={13} />}
              </div>

              <div className={`p-3 rounded-xl border transition-all ${resolved ? 'border-teal-500/30 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900'}`}>
                <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-0.5">Account Name (auto-resolved)</p>
                <p className={`text-sm font-bold ${resolved ? 'text-teal-400' : 'text-zinc-600'}`}>
                  {resolving ? 'Verifying with Paystack…' : form.account_name || 'Enter account number + bank above'}
                </p>
              </div>

              <select value={form.currency}
                className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-sm outline-none focus:border-teal-500 transition-colors"
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {['NGN', 'USD', 'GBP', 'AED'].map(c => <option key={c}>{c}</option>)}
              </select>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div onClick={() => setForm(f => ({ ...f, set_as_default: !f.set_as_default }))}
                  className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${form.set_as_default ? 'bg-teal-500' : 'bg-zinc-700'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.set_as_default ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className="text-xs text-zinc-400 font-bold">Set as default payout account</span>
              </label>
            </div>

            {addError && (
              <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={11} /> {addError}
              </div>
            )}
            {addOk && (
              <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={11} /> {addOk}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 py-3 border border-zinc-700 text-zinc-400 text-[9px] font-black uppercase tracking-widest rounded-xl hover:text-white transition-all">
                Cancel
              </button>
              <button onClick={handleAddAccount} disabled={adding || !resolved}
                className="flex-1 py-3 bg-teal-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-[9px]">
                {adding ? <Loader2 className="animate-spin" size={12} /> : <ShieldCheck size={12} />}
                {adding ? 'Saving…' : 'Save Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
