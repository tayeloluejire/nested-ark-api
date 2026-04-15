'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import {
  Wallet, ShieldCheck, Download, Bell, Clock,
  CheckCircle2, AlertCircle, Loader2, RefreshCw,
  TrendingUp, FileText, Calendar, MessageCircle,
  ChevronRight, Home, Lock, Activity
} from 'lucide-react';

interface VaultData {
  id: string;
  vault_balance: number;
  target_amount: number;
  frequency: string;
  installment_amount: number;
  next_due_date: string;
  cashout_mode: string;
  status: string;
  funded_periods: number;
  total_contributed: number;
  contribution_count: number;
  tenant_name: string;
  tenant_email: string;
  unit_name: string;
  rent_amount: number;
  funded_pct: number;
}

interface Contribution {
  id: string;
  amount_ngn: number;
  period_label: string;
  paid_at: string;
  ledger_hash: string;
  status: string;
  paystack_ref: string;
}

interface Notice {
  id: string;
  notice_number: string;
  notice_type: string;
  amount_overdue: number;
  days_overdue: number;
  issued_at: string;
  status: string;
  response_deadline: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const FREQ_COLOR: Record<string, string> = {
  WEEKLY: 'text-blue-400', MONTHLY: 'text-teal-400', QUARTERLY: 'text-amber-400',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE:       { label: 'Active',         color: 'text-teal-400',  bg: 'bg-teal-500/10 border-teal-500/20' },
  FUNDED_READY: { label: 'Fully Funded ✓', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  PAUSED:       { label: 'Paused',          color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  DEFAULTED:    { label: 'Defaulted',       color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20' },
  COMPLETED:    { label: 'Completed',       color: 'text-zinc-400',  bg: 'bg-zinc-800 border-zinc-700' },
};

function daysUntil(dateStr: string): number {
  if (!dateStr) return 0;
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000));
}

export default function TenantDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [vault,          setVault]         = useState<VaultData | null>(null);
  const [contributions,  setContributions]  = useState<Contribution[]>([]);
  const [notices,        setNotices]        = useState<Notice[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [tenancyId,      setTenancyId]      = useState('');
  const [payAmount,      setPayAmount]      = useState('');
  const [paying,         setPaying]         = useState(false);
  const [payResult,      setPayResult]      = useState<any>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  // Resolve tenancy from authenticated user
  const resolveAndLoad = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      // Get the user's tenancy
      const tenRes = await api.get('/api/tenant/my-tenancy');
      const tid    = tenRes.data.tenancy_id;
      setTenancyId(tid);

      const [vaultRes, contribRes, noticeRes] = await Promise.allSettled([
        api.get(`/api/flex-pay/vault/${tid}`),
        api.get(`/api/flex-pay/contributions/${tid}`),
        api.get(`/api/tenant/notices/${tid}`),
      ]);

      if (vaultRes.status === 'fulfilled') {
        setVault(vaultRes.value.data.vault);
        setPayAmount(String(vaultRes.value.data.vault.installment_amount));
      }
      if (contribRes.status === 'fulfilled') {
        setContributions(contribRes.value.data.contributions ?? []);
      }
      if (noticeRes.status === 'fulfilled') {
        setNotices(noticeRes.value.data.notices ?? []);
      }
    } catch (ex: any) {
      setError(ex?.response?.data?.error ?? 'Could not load your vault data.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) resolveAndLoad();
  }, [authLoading, resolveAndLoad]);

  const makeContribution = async () => {
    if (!payAmount || !tenancyId || !vault) return;
    setPaying(true); setPayResult(null);
    try {
      // In production: init Paystack first, then call on callback
      const res = await api.post('/api/flex-pay/contribute', {
        vault_id:   vault.id,
        amount_ngn: parseFloat(payAmount),
      });
      setPayResult({ success: true, ...res.data });
      resolveAndLoad();
    } catch (ex: any) {
      setPayResult({ success: false, error: ex?.response?.data?.error ?? 'Payment failed' });
    } finally {
      setPaying(false);
    }
  };

  const downloadReceipt = async (contributionId: string) => {
    setDownloadingPdf(contributionId);
    try {
      const res = await api.get(`/api/flex-pay/receipt/${contributionId}`, { responseType: 'blob' });
      const mime = res.headers['content-type'] || 'application/pdf';
      const ext  = mime.includes('pdf') ? 'pdf' : 'html';
      const url  = URL.createObjectURL(new Blob([res.data], { type: mime }));
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `ARK-RECEIPT-${contributionId.slice(0, 8).toUpperCase()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Receipt download failed. Try again.'); }
    finally   { setDownloadingPdf(null); }
  };

  if (authLoading || loading) return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="animate-spin text-teal-500 mx-auto" size={28} />
        <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Loading your vault…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm px-6">
        <AlertCircle className="text-amber-400 mx-auto" size={32} />
        <p className="font-bold text-sm">{error}</p>
        <p className="text-zinc-600 text-xs">If you haven't onboarded yet, ask your landlord for your invite link.</p>
        <button onClick={resolveAndLoad}
          className="text-teal-500 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">
          Retry →
        </button>
      </div>
    </div>
  );

  if (!vault) return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm px-6">
        <Wallet className="text-zinc-700 mx-auto" size={40} />
        <p className="font-bold text-sm">No active vault found</p>
        <p className="text-zinc-600 text-xs leading-relaxed">Your landlord needs to invite you first via WhatsApp or email. Contact them to get your onboarding link.</p>
      </div>
    </div>
  );

  const statusCfg    = STATUS_CONFIG[vault.status] ?? STATUS_CONFIG.ACTIVE;
  const daysLeft     = daysUntil(vault.next_due_date);
  const isUrgent     = daysLeft <= 7;
  const shortfall    = Math.max(0, vault.target_amount - vault.vault_balance);
  const openNotices  = notices.filter(n => n.status !== 'RESOLVED');

  return (
    <div className="min-h-screen bg-[#050505] text-white">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
            <Home size={13} className="text-teal-500" />
          </div>
          <div>
            <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase">Nested Ark OS</p>
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Tenant Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {openNotices.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle size={10} className="text-red-400" />
              <span className="text-[9px] text-red-400 font-bold uppercase tracking-widest">{openNotices.length} notice{openNotices.length > 1 ? 's' : ''}</span>
            </div>
          )}
          <button onClick={resolveAndLoad}
            className="p-2 border border-zinc-800 rounded-lg text-zinc-600 hover:text-teal-500 transition-all">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic">The Vault</h1>
            <p className="text-zinc-500 text-xs mt-1 uppercase tracking-widest">
              {vault.unit_name} · {vault.frequency} pattern
            </p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest ${statusCfg.bg} ${statusCfg.color}`}>
            <Activity size={9} />
            {statusCfg.label}
          </div>
        </div>

        {/* ── Open legal notices alert ─────────────────────────────────── */}
        {openNotices.length > 0 && (
          <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-red-400" />
              <p className="text-sm font-black text-red-400 uppercase tracking-tight">
                {openNotices.length} Unresolved Legal Notice{openNotices.length > 1 ? 's' : ''}
              </p>
            </div>
            {openNotices.map(n => (
              <div key={n.id} className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-mono text-[9px] text-red-400">{n.notice_number}</p>
                  <p className="text-xs text-zinc-400">{n.notice_type.replace(/_/g, ' ')} · ₦{Number(n.amount_overdue).toLocaleString()} · Respond by {new Date(n.response_deadline).toLocaleDateString()}</p>
                </div>
                <button onClick={() => downloadReceipt(n.id)}
                  disabled={downloadingPdf === n.id}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-red-500/30 transition-all disabled:opacity-50">
                  {downloadingPdf === n.id ? <Loader2 size={9} className="animate-spin" /> : <Download size={9} />}
                  Download Notice
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── THE VAULT HERO ───────────────────────────────────────────── */}
        <div className="relative p-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden space-y-6">
          {/* Background watermark */}
          <Wallet className="absolute -bottom-10 -right-8 text-zinc-800/15 pointer-events-none" size={280} />

          <div className="relative z-10 space-y-6">
            {/* Balance */}
            <div>
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-2">
                Vault Balance
              </p>
              <div className="flex items-end gap-4 flex-wrap">
                <p className="text-5xl font-black font-mono tabular-nums text-teal-400">
                  ₦{Number(vault.vault_balance).toLocaleString()}
                </p>
                <div className="pb-2 space-y-0.5">
                  <p className="text-[9px] text-zinc-500">of ₦{Number(vault.target_amount).toLocaleString()} target</p>
                  <p className={`text-[9px] font-bold ${FREQ_COLOR[vault.frequency]}`}>
                    ₦{Number(vault.installment_amount).toLocaleString()} {vault.frequency.toLowerCase()} installment
                  </p>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-[9px]">
                <span className="text-zinc-500">{vault.funded_pct.toFixed(0)}% of annual rent secured</span>
                <span className={`font-bold font-mono ${isUrgent ? 'text-amber-400' : 'text-zinc-500'}`}>
                  {daysLeft === 0 ? 'Due today' : `${daysLeft}d until due`}
                </span>
              </div>
              <div className="w-full h-4 bg-black rounded-full border border-zinc-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    vault.funded_pct >= 100 ? 'bg-green-500' :
                    vault.funded_pct >= 75  ? 'bg-teal-500'  :
                    vault.funded_pct >= 50  ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(vault.funded_pct, 100)}%` }}
                />
              </div>
              {shortfall > 0 && (
                <p className="text-[9px] text-zinc-600 font-mono">
                  Shortfall: ₦{shortfall.toLocaleString()} · {Math.ceil(shortfall / vault.installment_amount)} installment{Math.ceil(shortfall / vault.installment_amount) !== 1 ? 's' : ''} remaining
                </p>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Contributions',   value: vault.contribution_count,                              color: 'text-teal-400' },
                { label: 'Total Paid',      value: `₦${Number(vault.total_contributed).toLocaleString()}`, color: 'text-white' },
                { label: 'Periods Funded',  value: vault.funded_periods,                                  color: 'text-amber-400' },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-center space-y-1">
                  <p className={`font-mono font-black text-base ${s.color}`}>{s.value}</p>
                  <p className="text-[8px] text-zinc-600 uppercase tracking-widest">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── PAY NOW ─────────────────────────────────────────────────── */}
        {vault.status === 'ACTIVE' && (
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Make a Contribution</p>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm">₦</span>
                <input
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded-xl pl-8 pr-4 py-3 text-sm text-white font-mono focus:border-teal-500 outline-none transition-colors"
                />
              </div>
              <button onClick={makeContribution} disabled={paying || !payAmount}
                className="px-6 py-3 bg-teal-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white transition-all disabled:opacity-60 flex items-center gap-2">
                {paying ? <Loader2 className="animate-spin" size={12} /> : <Wallet size={12} />}
                Pay
              </button>
            </div>

            {/* Quick amounts */}
            <div className="flex flex-wrap gap-2">
              {[
                vault.installment_amount,
                vault.installment_amount * 2,
                Math.ceil(shortfall),
              ].filter(a => a > 0).map(amt => (
                <button key={amt} onClick={() => setPayAmount(String(amt))}
                  className="px-3 py-1.5 border border-zinc-800 text-zinc-500 hover:text-teal-400 hover:border-teal-500/30 font-mono text-[9px] rounded-lg transition-all">
                  ₦{amt.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Payment result */}
            {payResult && (
              <div className={`p-4 rounded-xl border text-sm font-bold flex items-center gap-3 ${
                payResult.success
                  ? 'bg-teal-500/10 border-teal-500/20 text-teal-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                {payResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <div>
                  <p>{payResult.success ? payResult.message : payResult.error}</p>
                  {payResult.success && (
                    <p className="text-[9px] font-normal mt-1 opacity-70">
                      New balance: ₦{Number(payResult.new_balance).toLocaleString()} · {payResult.funded_pct}% funded
                    </p>
                  )}
                </div>
              </div>
            )}

            <p className="text-[9px] text-zinc-700 leading-relaxed">
              In production: clicking Pay will initiate a Paystack checkout. Your digital receipt
              will be emailed and sent via WhatsApp immediately on confirmation.
            </p>
          </div>
        )}

        {vault.status === 'FUNDED_READY' && (
          <div className="p-6 rounded-2xl border border-green-500/30 bg-green-500/5 text-center space-y-3">
            <CheckCircle2 className="text-green-400 mx-auto" size={28} />
            <p className="font-black text-sm uppercase">Vault Fully Funded!</p>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Your annual rent is fully secured. Your landlord has been notified and can now
              initiate cashout. You'll receive confirmation when funds are released.
            </p>
          </div>
        )}

        {/* ── QUICK ACTIONS ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <a
            href="/assets/Nested_Ark_Tenancy_Handbook.pdf"
            download
            className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between hover:border-teal-500/40 hover:bg-teal-500/5 transition-all group">
            <div>
              <p className="text-xs font-black uppercase tracking-tight">Tenancy Handbook</p>
              <p className="text-[9px] text-zinc-500 mt-0.5">Rights, rules &amp; Flex-Pay protocol</p>
            </div>
            <Download size={16} className="text-teal-500 group-hover:translate-y-0.5 transition-transform" />
          </a>
          <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-tight">Status</p>
              <p className="text-[9px] text-zinc-500 mt-0.5">Ledger verified · Protected</p>
            </div>
            <ShieldCheck size={16} className="text-teal-500" />
          </div>
          <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-tight">Next Due</p>
              <p className={`text-[9px] mt-0.5 font-mono font-bold ${isUrgent ? 'text-amber-400' : 'text-zinc-500'}`}>
                {vault.next_due_date ? new Date(vault.next_due_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
              </p>
            </div>
            <Calendar size={16} className={isUrgent ? 'text-amber-400' : 'text-zinc-600'} />
          </div>
        </div>

        {/* ── CONTRIBUTION HISTORY ─────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
            Contribution History
          </p>

          {contributions.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-zinc-800 rounded-2xl space-y-2">
              <Clock className="text-zinc-700 mx-auto" size={24} />
              <p className="text-zinc-600 text-sm font-bold">No contributions yet</p>
              <p className="text-zinc-700 text-xs">Make your first payment above to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {contributions.map(c => (
                <div key={c.id}
                  className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/20 flex items-center justify-between gap-4 flex-wrap hover:border-zinc-700 transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`text-[8px] px-2 py-0.5 rounded font-bold uppercase ${
                        c.status === 'SUCCESS' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {c.status === 'SUCCESS' ? '✓ Confirmed' : c.status}
                      </span>
                      <span className="text-[8px] text-zinc-600 font-mono">{c.period_label}</span>
                    </div>
                    <p className="font-mono font-bold text-sm text-teal-400">
                      ₦{Number(c.amount_ngn).toLocaleString()}
                    </p>
                    <p className="text-[9px] text-zinc-600 font-mono mt-0.5 truncate">
                      {c.paid_at ? new Date(c.paid_at).toLocaleString() : '—'}
                      {c.paystack_ref && ` · ${c.paystack_ref}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Ledger hash */}
                    <div className="text-right hidden md:block">
                      <p className="text-[8px] text-zinc-700 font-mono truncate max-w-[120px]">
                        {c.ledger_hash?.slice(0, 14)}…
                      </p>
                      <p className="text-[7px] text-zinc-800 uppercase">SHA-256</p>
                    </div>
                    <button
                      onClick={() => downloadReceipt(c.id)}
                      disabled={downloadingPdf === c.id}
                      title="Download digital receipt"
                      className="p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-teal-400 hover:border-teal-500/30 transition-all disabled:opacity-50">
                      {downloadingPdf === c.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <Download size={13} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── LEDGER TRUST FOOTER ─────────────────────────────────── */}
        <div className="p-4 rounded-2xl border border-zinc-800/50 bg-zinc-900/10 flex items-start gap-3">
          <Lock size={12} className="text-teal-500/70 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-[9px] text-zinc-500 leading-relaxed">
              Every contribution is SHA-256 hashed and written to the immutable Nested Ark ledger.
              Your landlord cannot alter, delete, or dispute any payment record.
              Download any receipt at any time as your legal proof of payment.
            </p>
            <p className="text-[8px] text-zinc-700 font-mono">
              Vault ID: {vault.id?.slice(0, 16)}… · Secured by Paystack · Impressions &amp; Impacts Ltd
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}
