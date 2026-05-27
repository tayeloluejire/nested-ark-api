'use client';
export const dynamic = 'force-dynamic';

/**
 * /tenant/dashboard/page.tsx
 *
 * TWO STATES handled here:
 *
 * STATE A — LINKED TENANT (has active tenancy)
 *   Normal dashboard: unit card, escrow ring, vault, rhythm, notices, quick actions.
 *   API: GET /api/tenant/my-tenancy  → 200 with tenancy data
 *
 * STATE B — INDEPENDENT TENANT (no tenancy yet)
 *   Self-registered. No unit linked. No invite consumed.
 *   Shows: setup hub with background draft pickup + bank verification + marketplace CTA.
 *   On first load, reads localStorage "nested_ark_bank_draft" and:
 *     1. Resolves account via POST /api/paystack/resolve-account  (if bank_code present)
 *     2. Saves to /api/landlord/bank-accounts  (creates Paystack recipient + subaccount)
 *     3. Clears draft from localStorage
 *   All background steps are non-fatal — failure shows a "Complete setup" prompt.
 *
 * NOTE: /api/tenant/my-tenancy returning 404 is EXPECTED for independent tenants.
 *       It is NOT an error — it means the tenant has no linked unit yet (STATE B).
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import {
  Home, DollarSign, Calendar, ShieldCheck, Loader2,
  AlertCircle, TrendingUp, ArrowRight, Bell, CheckCircle2,
  Star, FileText, Building2, Gavel, Wallet, Lock,
  Search, MapPin, Zap, Clock, RefreshCw,
} from 'lucide-react';

const safeN = (v: any) => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any) => safeN(v).toLocaleString();
const BANK_DRAFT_KEY = 'nested_ark_bank_draft';

type SetupStatus = 'done' | 'running' | 'pending' | 'skipped' | 'error';
type SetupStep   = { id: string; label: string; status: SetupStatus; detail: string };

// ── Escrow ring ───────────────────────────────────────────────────────────────
function EscrowRing({ pct, balance, target, currency }: {
  pct: number; balance: number; target: number; currency: string;
}) {
  const r    = 52;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  const col  = pct >= 80 ? '#14b8a6' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-[140px] h-[140px]">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#18181b" strokeWidth="8" />
          <circle cx="60" cy="60" r={r} fill="none" stroke={col} strokeWidth="8"
            strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
            style={{ transition: 'stroke-dasharray 1s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black font-mono" style={{ color: col }}>{pct}%</span>
          <span className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">funded</span>
        </div>
      </div>
      <div className="text-center">
        <p className="font-black font-mono text-lg" style={{ color: col }}>{currency} {safeF(balance)}</p>
        <p className="text-[9px] text-zinc-600 font-bold">of {currency} {safeF(target)} target</p>
      </div>
    </div>
  );
}

// ── Escrow seal ───────────────────────────────────────────────────────────────
function EscrowSeal({ status }: { status: string }) {
  const ready = status === 'FUNDED_READY';
  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl border ${ready ? 'border-teal-500/30 bg-teal-500/5' : 'border-zinc-700/60 bg-zinc-900/30'}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${ready ? 'bg-teal-500/20' : 'bg-zinc-800'}`}>
        <Lock size={14} className={ready ? 'text-teal-400' : 'text-zinc-500'} />
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-300">
          {ready ? '🔓 Escrow Release Pending' : '🔒 Nest Vault Escrow Active'}
        </p>
        <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
          {ready
            ? 'Your vault is fully funded. Funds will be automatically disbursed to your landlord via Paystack within 24 hours.'
            : 'Funds are locked in platform escrow and will be automatically disbursed to your landlord via Paystack once your vault reaches 100%.'}
        </p>
        <div className="flex items-center gap-1.5 mt-2">
          <ShieldCheck size={9} className="text-teal-500" />
          <span className="text-[8px] text-teal-500 font-bold uppercase tracking-widest">
            Paystack-secured · SHA-256 receipts · Court-admissible
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Rhythm card ───────────────────────────────────────────────────────────────
function RhythmCard({ vault }: { vault: any }) {
  const nextDue  = vault.next_due_date ? vault.next_due_date.split('T')[0] : null;
  const daysLeft = nextDue
    ? Math.max(0, Math.ceil((new Date(nextDue).getTime() - Date.now()) / 86400000))
    : null;
  const urgency = daysLeft != null && daysLeft <= 3;
  return (
    <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
      <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Payment Rhythm</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[8px] text-zinc-600 uppercase font-bold mb-1">Frequency</p>
          <p className="text-sm font-black uppercase text-white">{vault.frequency || '—'}</p>
        </div>
        <div>
          <p className="text-[8px] text-zinc-600 uppercase font-bold mb-1">Installment</p>
          <p className="text-sm font-black font-mono text-teal-400">{vault.currency || 'NGN'} {safeF(vault.installment_amount)}</p>
        </div>
      </div>
      {nextDue && (
        <div className={`flex items-center justify-between p-3 rounded-xl border ${urgency ? 'border-red-500/30 bg-red-500/5' : 'border-zinc-800 bg-zinc-900/40'}`}>
          <div className="flex items-center gap-2">
            <Calendar size={13} className={urgency ? 'text-red-400' : 'text-zinc-500'} />
            <div>
              <p className="text-[8px] text-zinc-500 uppercase font-bold">Next Due</p>
              <p className={`text-xs font-black font-mono ${urgency ? 'text-red-400' : 'text-white'}`}>{nextDue}</p>
            </div>
          </div>
          {daysLeft != null && (
            <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border ${
              daysLeft === 0  ? 'border-red-500/40 text-red-400 bg-red-500/10'
              : urgency       ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
              :                 'border-zinc-700 text-zinc-400 bg-zinc-900/40'
            }`}>
              {daysLeft === 0 ? 'Due Today' : `${daysLeft}d left`}
            </span>
          )}
        </div>
      )}
      <Link href="/tenant/pay"
        className="flex items-center justify-center gap-2 w-full py-3 bg-teal-500 text-black text-[10px] font-black uppercase rounded-xl hover:bg-teal-400 transition-all tracking-widest">
        <DollarSign size={13} /> Pay This Installment
      </Link>
    </div>
  );
}

// ── STATE B: Independent Tenant Setup Hub ─────────────────────────────────────
function IndependentTenantHub({ userName }: { userName?: string }) {
  const [steps, setSteps] = useState<SetupStep[]>([
    { id: 'account',  label: 'Account Created',             status: 'done',    detail: 'Your Nested Ark account is live and active.'                    },
    { id: 'bank',     label: 'Verify payout destination',   status: 'pending', detail: 'Checking for landlord bank details from registration…'          },
    { id: 'vault',    label: 'Escrow vault profile',        status: 'pending', detail: 'Activated automatically when you link to a property.'           },
    { id: 'property', label: 'Link to a property',          status: 'pending', detail: 'Browse the marketplace or await a landlord invite link.'        },
  ]);
  const [bankDetail,     setBankDetail]     = useState<{ name: string; bank: string; number: string } | null>(null);
  const [draftProcessed, setDraftProcessed] = useState(false);

  const setStep = useCallback((id: string, patch: Partial<SetupStep>) =>
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s)), []);

  // ── Background draft pickup ────────────────────────────────────────────────
  useEffect(() => {
    if (draftProcessed) return;
    const run = async () => {
      let draft: any = null;
      try {
        const raw = localStorage.getItem(BANK_DRAFT_KEY);
        if (raw) draft = JSON.parse(raw);
      } catch { /* localStorage unavailable — non-fatal */ }

      if (!draft || (!draft.landlord_account_number && !draft.landlord_bank_name)) {
        setStep('bank', { status: 'skipped', detail: 'No bank details provided at registration. Add from your dashboard settings anytime.' });
        setDraftProcessed(true);
        return;
      }

      setStep('bank', { status: 'running', detail: 'Verifying landlord bank account via Paystack…' });

      try {
        // Step 1: Resolve account name if bank_code present (non-fatal)
        let resolvedName = (draft.landlord_account_name || '').trim();
        if (!resolvedName && draft.landlord_bank_code && draft.landlord_account_number) {
          try {
            const res = await api.post('/api/paystack/resolve-account', {
              account_number: draft.landlord_account_number,
              bank_code:      draft.landlord_bank_code,
            });
            resolvedName = res.data?.account_name ?? '';
          } catch { /* non-fatal — proceed without resolved name */ }
        }

        // Step 2: Save to landlord_bank_accounts — creates Paystack recipient + subaccount
        if (draft.landlord_account_number && draft.landlord_bank_name) {
          await api.post('/api/landlord/bank-accounts', {
            account_name:   resolvedName || draft.landlord_account_name || 'Landlord Account',
            account_number: draft.landlord_account_number,
            bank_code:      draft.landlord_bank_code  || '000',
            bank_name:      draft.landlord_bank_name,
            currency:       'NGN',
            set_as_default: true,
          });
          const displayName = resolvedName || draft.landlord_account_name || '—';
          setBankDetail({ name: displayName, bank: draft.landlord_bank_name, number: draft.landlord_account_number });
          setStep('bank', {
            status: 'done',
            detail: `${displayName} · ${draft.landlord_bank_name} · ${draft.landlord_account_number} — saved & Paystack-verified.`,
          });
          try { localStorage.removeItem(BANK_DRAFT_KEY); } catch {}
        } else {
          setStep('bank', { status: 'skipped', detail: 'Incomplete bank details. Add your landlord\'s bank from settings.' });
        }
      } catch (err: any) {
        setStep('bank', {
          status: 'error',
          detail: err?.response?.data?.error ?? 'Bank verification failed. You can add payout details from settings.',
        });
      }
      setDraftProcessed(true);
    };
    const t = setTimeout(run, 900); // slight delay to let auth token settle
    return () => clearTimeout(t);
  }, [draftProcessed, setStep]);

  const stepIcon = (s: SetupStatus) => {
    if (s === 'done')    return <CheckCircle2 size={14} className="text-teal-400 shrink-0 mt-0.5" />;
    if (s === 'running') return <Loader2 size={14} className="animate-spin text-amber-400 shrink-0 mt-0.5" />;
    if (s === 'error')   return <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />;
    if (s === 'skipped') return <Clock size={14} className="text-zinc-600 shrink-0 mt-0.5" />;
    return <div className="w-3.5 h-3.5 rounded-full border-2 border-zinc-700 shrink-0 mt-1" />;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-6 py-10 space-y-8 w-full">

        {/* Header */}
        <div className="border-l-2 border-green-500 pl-5">
          <p className="text-[9px] text-green-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">My Dashboard</h1>
          <p className="text-zinc-500 text-xs mt-1">
            Welcome{userName ? `, ${userName.split(' ')[0]}` : ''}! Your account is active and ready.
          </p>
        </div>

        {/* Setup progress */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Account Setup Progress</p>
            <span className="flex items-center gap-1 text-[8px] text-zinc-600">
              <RefreshCw size={8} /> Background tasks running
            </span>
          </div>
          <div className="space-y-4">
            {steps.map(s => (
              <div key={s.id} className="flex items-start gap-3">
                {stepIcon(s.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className={`text-xs font-bold ${
                      s.status === 'done'    ? 'text-white'
                      : s.status === 'running' ? 'text-amber-400'
                      : s.status === 'error'   ? 'text-red-400'
                      : 'text-zinc-600'}`}>
                      {s.label}
                    </p>
                    <span className={`text-[7px] px-1.5 py-0.5 rounded border font-black uppercase tracking-widest ${
                      s.status === 'done'    ? 'border-teal-500/30 text-teal-500'
                      : s.status === 'running' ? 'border-amber-500/30 text-amber-400'
                      : s.status === 'error'   ? 'border-red-500/30 text-red-400'
                      : s.status === 'skipped' ? 'border-zinc-700 text-zinc-600'
                      : 'border-zinc-800 text-zinc-700'}`}>
                      {s.status === 'running' ? 'In progress' : s.status}
                    </span>
                  </div>
                  <p className="text-[9px] text-zinc-600">{s.detail}</p>
                  {s.id === 'bank' && bankDetail && (
                    <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-teal-500/20 bg-teal-500/5">
                      <ShieldCheck size={9} className="text-teal-500 shrink-0" />
                      <span className="text-[9px] text-teal-400 font-mono font-bold">
                        {bankDetail.name} · {bankDetail.bank} · {bankDetail.number}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* No unit explanation */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/10 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
            <Home size={18} className="text-zinc-500" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">No unit linked yet</p>
            <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
              Your account is an independent savings profile. Browse the marketplace to find
              and apply for a property, or ask your landlord to send you an invite link.
              Once linked, your escrow vault activates automatically and tracks your rent target.
            </p>
            <div className="flex gap-3 mt-3 flex-wrap">
              <Link href="/marketplace"
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 text-black text-[9px] font-black uppercase rounded-xl hover:bg-teal-400 transition-all tracking-widest">
                <Search size={11} /> Browse Properties
              </Link>
              <Link href="/dashboard"
                className="flex items-center gap-1.5 px-4 py-2 border border-zinc-700 text-zinc-400 text-[9px] font-black uppercase rounded-xl hover:border-zinc-600 transition-all tracking-widest">
                <Building2 size={11} /> Full Platform Hub
              </Link>
            </div>
          </div>
        </div>

        {/* Vault capability */}
        <div className="p-5 rounded-2xl border border-green-500/20 bg-green-500/5 space-y-4">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-green-400" />
            <p className="text-[9px] text-green-400 uppercase font-black tracking-widest">Your Escrow Savings Vault</p>
          </div>
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            Once you link to a property, your Flex-Pay vault activates automatically. Contributions
            accumulate in Paystack escrow and auto-disburse to your landlord when the target is reached.
            You carry your vault history and tenant score across properties.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: '🔒', label: 'Escrow-held'       },
              { icon: '📅', label: 'Your rhythm'        },
              { icon: '⚡', label: 'Auto-disburse'      },
              { icon: '🧾', label: 'SHA-256 receipts'   },
            ].map(f => (
              <div key={f.label} className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 text-center">
                <div className="text-lg mb-1">{f.icon}</div>
                <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">{f.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Property browse shortcuts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Find a Property</p>
            <Link href="/marketplace" className="text-[9px] text-teal-500 font-bold hover:underline flex items-center gap-1">
              View All <ArrowRight size={10} />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'For Rent', icon: Home,      href: '/marketplace?type=rent',   iconColor: 'text-teal-400'  },
              { label: 'For Sale', icon: Building2, href: '/marketplace?type=sale',   iconColor: 'text-amber-400' },
              { label: 'Near Me',  icon: MapPin,    href: '/marketplace?nearby=true', iconColor: 'text-blue-400'  },
            ].map(c => (
              <Link key={c.label} href={c.href}
                className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 transition-all flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <c.icon size={18} className={c.iconColor} />
                  <p className="font-bold text-sm">{c.label}</p>
                </div>
                <ArrowRight size={14} className="text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/marketplace"
            className="p-5 rounded-2xl border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 transition-all flex items-center justify-between group">
            <div>
              <Search size={20} className="text-teal-400 mb-2" />
              <p className="font-black text-sm uppercase tracking-tight">Marketplace</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Find your next home</p>
            </div>
            <ArrowRight size={16} className="text-teal-500 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link href="/dashboard"
            className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 transition-all flex items-center justify-between group">
            <div>
              <Zap size={20} className="text-amber-400 mb-2" />
              <p className="font-black text-sm uppercase tracking-tight">Platform Hub</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Full overview</p>
            </div>
            <ArrowRight size={16} className="text-zinc-500 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

      </main>
      <Footer />
    </div>
  );
}

// ── STATE A: Linked tenant — full dashboard ───────────────────────────────────
function LinkedTenantDashboard({ user, tenancy, vault, notices }: {
  user: any; tenancy: any; vault: any; notices: any[];
}) {
  const activeNotices = notices.filter(n => n.status === 'ISSUED' || n.status === 'SERVED');
  const fundedPct = vault
    ? Math.min(Math.round((safeN(vault.vault_balance) / (safeN(vault.target_amount) || 1)) * 100), 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      {activeNotices.length > 0 && (
        <div className="bg-red-500 px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-white flex-shrink-0" />
            <p className="text-white text-xs font-black uppercase tracking-wide">
              {activeNotices[0].notice_type?.replace(/_/g, ' ')} — {activeNotices[0].days_overdue ?? 0} days overdue. Please pay immediately.
            </p>
          </div>
          <Link href="/tenant/pay"
            className="px-4 py-1.5 bg-white text-red-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-100 transition-all flex-shrink-0">
            Pay Now
          </Link>
        </div>
      )}

      <main className="flex-1 max-w-4xl mx-auto px-6 py-10 space-y-8 w-full">

        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">My Dashboard</h1>
          <p className="text-zinc-500 text-xs mt-1">
            Welcome back, {user?.full_name?.split(' ')[0] ?? tenancy.tenant_name?.split(' ')[0] ?? 'Tenant'}
          </p>
        </div>

        {/* Unit card */}
        <div className={`p-6 rounded-3xl border ${activeNotices.length > 0 ? 'border-red-500/30 bg-red-500/5' : 'border-teal-500/20 bg-teal-500/5'}`}>
          <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest mb-2">Your Unit</p>
          <h2 className="text-xl font-black uppercase">{tenancy.unit_name}</h2>
          <p className="text-zinc-400 text-sm mt-0.5">{tenancy.project_title}</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap text-[10px] text-zinc-500">
            <span className="flex items-center gap-1"><Building2 size={9} />{tenancy.project_number}</span>
            {tenancy.tenant_score && (
              <span className="flex items-center gap-1 text-amber-400 font-bold"><Star size={9} /> Score: {tenancy.tenant_score}/100</span>
            )}
          </div>
          <div className={`mt-2 inline-flex items-center gap-1 text-[8px] font-black uppercase px-2 py-1 rounded border ${
            activeNotices.length > 0 ? 'border-red-500/30 text-red-400 bg-red-500/10' : 'border-teal-500/30 text-teal-400 bg-teal-500/10'
          }`}>
            {activeNotices.length > 0 ? <AlertCircle size={8} /> : <CheckCircle2 size={8} />}
            {activeNotices.length > 0 ? 'NOTICE ISSUED' : 'ACTIVE'}
          </div>
        </div>

        {/* Vault */}
        {vault && (
          <div className="space-y-4">
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20">
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-5">Flex-Pay Vault</p>
              <div className="flex flex-col md:flex-row items-center gap-8">
                <EscrowRing pct={fundedPct} balance={safeN(vault.vault_balance)} target={safeN(vault.target_amount)} currency={vault.currency || 'NGN'} />
                <div className="flex-1 w-full space-y-4">
                  <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${fundedPct >= 80 ? 'bg-teal-500' : fundedPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${fundedPct}%` }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Vault Balance', val: `${vault.currency||'NGN'} ${safeF(vault.vault_balance)}`,                                                          col: 'text-teal-400'  },
                      { label: 'Annual Target',  val: `${vault.currency||'NGN'} ${safeF(vault.target_amount)}`,                                                          col: 'text-white'     },
                      { label: 'Remaining',      val: `${vault.currency||'NGN'} ${safeF(Math.max(0,safeN(vault.target_amount)-safeN(vault.vault_balance)))}`,           col: 'text-zinc-300'  },
                      { label: 'Vault Status',   val: vault.status||'ACTIVE', col: vault.status==='FUNDED_READY'?'text-teal-400':vault.status==='OVERDUE'?'text-red-400':'text-zinc-300' },
                    ].map(s => (
                      <div key={s.label} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                        <p className="text-zinc-600 uppercase font-bold text-[8px] mb-0.5">{s.label}</p>
                        <p className={`font-black font-mono text-[10px] ${s.col}`}>{s.val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <EscrowSeal status={vault.status} />
            <RhythmCard vault={vault} />
          </div>
        )}

        {/* KPI */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Vault Balance',  value: vault ? `${vault.currency||'NGN'} ${safeF(vault.vault_balance)}` : '—', color: 'text-teal-400' },
            { label: 'Active Notices', value: activeNotices.length, color: activeNotices.length > 0 ? 'text-red-400' : 'text-teal-400' },
          ].map(s => (
            <div key={s.label} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-1.5">
              <p className={`text-xl font-black font-mono tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { href:'/tenant/pay',          Icon:DollarSign, ic:'text-teal-400',  bd:'border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20', ac:'text-teal-500',  t:'Pay Installment', s:'Flex-Pay via Paystack'  },
            { href:'/tenant/vault',         Icon:TrendingUp, ic:'text-amber-400', bd:'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700',    ac:'text-zinc-500',  t:'My Vault',        s:'Flex-Pay balance'       },
            { href:'/tenant/notices',       Icon:Gavel,      ic:'text-red-400',   bd:'border-red-500/10 bg-red-500/5 hover:border-red-500/20',  ac:'text-red-400',   t:'My Notices',      s:'Legal notices'          },
            { href:'/tenant/contributions', Icon:FileText,   ic:'text-teal-400',  bd:'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700',    ac:'text-zinc-500',  t:'History',         s:'All contributions'      },
          ].map(a => (
            <Link key={a.href} href={a.href}
              className={`p-5 rounded-2xl border ${a.bd} transition-all flex items-center justify-between group`}>
              <div>
                <a.Icon size={20} className={`${a.ic} mb-2`} />
                <p className="font-black text-sm uppercase tracking-tight">{a.t}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{a.s}</p>
              </div>
              <ArrowRight size={16} className={`${a.ac} group-hover:translate-x-1 transition-transform`} />
            </Link>
          ))}
        </div>

        {/* Notices */}
        {notices.length > 0 && (
          <div className="space-y-3">
            <p className="text-[9px] text-red-400 uppercase font-black tracking-widest">Legal Notices</p>
            {notices.map(n => (
              <div key={n.id} className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-bold text-sm text-red-300">{n.notice_type?.replace(/_/g,' ')}</p>
                  <p className="text-[9px] text-zinc-500">
                    {n.notice_number} · Issued: {n.issued_at?.split('T')[0]}
                    {n.days_overdue ? ` · ${n.days_overdue} days overdue` : ''}
                  </p>
                </div>
                <span className={`text-[8px] px-2 py-1 rounded border font-bold uppercase ${
                  n.status==='SERVED'?'border-red-500/30 text-red-400':n.status==='ISSUED'?'border-amber-500/30 text-amber-400':'border-zinc-700 text-zinc-500'
                }`}>{n.status}</span>
              </div>
            ))}
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}

// ── Orchestrator ──────────────────────────────────────────────────────────────
function TenantDashboardContent() {
  const { user } = useAuth();
  const [tenancy,    setTenancy]    = useState<any>(null);
  const [vault,      setVault]      = useState<any>(null);
  const [notices,    setNotices]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [hasTenancy, setHasTenancy] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const [tRes, vRes, nRes] = await Promise.allSettled([
        api.get('/api/tenant/my-tenancy'),
        api.get('/api/tenant/my-vault'),
        api.get('/api/tenant/my-notices'),
      ]);
      // 404 on my-tenancy = independent tenant — expected, not an error
      if (tRes.status === 'fulfilled') { setTenancy(tRes.value.data); setHasTenancy(true); }
      else                              { setHasTenancy(false); }
      if (vRes.status === 'fulfilled') setVault(vRes.value.data.vault);
      if (nRes.status === 'fulfilled') setNotices(nRes.value.data.notices ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading || hasTenancy === null) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="flex items-center justify-center py-40">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
      <Footer />
    </div>
  );

  if (!hasTenancy) return <IndependentTenantHub userName={user?.full_name} />;

  return <LinkedTenantDashboard user={user} tenancy={tenancy} vault={vault} notices={notices} />;
}

export default function TenantDashboardPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={28} /></div>}>
      <TenantDashboardContent />
    </Suspense>
  );
}
