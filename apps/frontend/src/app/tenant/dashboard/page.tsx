'use client';
export const dynamic = 'force-dynamic';

/**
 * /tenant/dashboard/page.tsx
 *
 * TWO STATES handled here:
 *
 * STATE A — LINKED TENANT (hasTenancy: true)
 *   Active notice banner, unit card (score, project number, location),
 *   EscrowRing + vault stats + EscrowSeal + RhythmCard, KPI strip,
 *   4-card quick actions, recent payments, notices list.
 *   APIs: GET /api/tenant/my-tenancy  → tenancy data
 *         GET /api/tenant/my-vault    → vault data  (hasActiveTenancy: true path)
 *         GET /api/tenant/my-notices  → notices
 *
 * STATE B — INDEPENDENT TENANT (hasTenancy: false)
 *   B1 — Has standalone_vault  → VaultCard + RecentPayments + onboarding steps
 *   B2 — No vault yet          → Setup hub, property browse, init CTA
 *   APIs: GET /api/tenant/my-vault    → hasActiveTenancy: false, standalone_vault
 *         GET /api/tenant/my-notices  → [] (graceful)
 *
 * AUTH: uses getToken() raw fetch — same proven pattern as /tenant/vault page.
 *       Does NOT use axios api instance to avoid auth mismatch.
 *
 * NOTE: /api/tenant/my-tenancy returning 404 is EXPECTED for independent tenants.
 *       It is NOT an error — it means the tenant has no linked unit yet (STATE B).
 */

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar  from '@/components/Navbar';
import Footer  from '@/components/Footer';
import {
  DollarSign, Calendar, ShieldCheck, Loader2, AlertCircle,
  TrendingUp, ArrowRight, Bell, CheckCircle2, Star,
  FileText, Building2, Gavel, Lock, Search, MapPin,
  Zap, Home, Wallet,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const safeN = (v: any) => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any) => safeN(v).toLocaleString();
const fmt   = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(n);

// ── Auth: proven getToken pattern (same as working vault page) ────────────────
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

async function apiFetch(path: string, token: string) {
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
  });
  if (!res.ok) throw Object.assign(new Error(res.statusText), { status: res.status });
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface OnboardingStep {
  key:    string;
  label:  string;
  status: 'done' | 'skipped' | 'pending';
}

interface StandaloneVaultSummary {
  id:                   string;
  vault_balance:        number;
  target_amount:        number;
  installment_amount:   number;
  funded_pct:           number;
  frequency:            string;
  status:               string;
  total_contributed:    number;
  contribution_count:   number;
  landlord_name:        string | null;
  landlord_email:       string | null;
  landlord_bank_name:   string | null;
  landlord_account_name: string | null;
  created_at:           string;
}

interface LinkedVaultSummary {
  id:                 string;
  vault_balance:      number;
  target_amount:      number;
  installment_amount: number;
  funded_pct:         number;
  frequency:          string;
  status:             string;
  total_contributed:  number;
  next_due_date?:     string | null;
  currency?:          string;
  cashout_mode?:      string;
}

// ── EscrowRing ────────────────────────────────────────────────────────────────
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

// ── EscrowSeal ────────────────────────────────────────────────────────────────
function EscrowSeal({ status }: { status: string }) {
  const ready = status === 'FUNDED_READY';
  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl border ${
      ready ? 'border-teal-500/30 bg-teal-500/5' : 'border-zinc-700/60 bg-zinc-900/30'
    }`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
        ready ? 'bg-teal-500/20' : 'bg-zinc-800'
      }`}>
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

// ── RhythmCard ────────────────────────────────────────────────────────────────
function RhythmCard({ vault, nextDueDate }: { vault: LinkedVaultSummary; nextDueDate: string | null }) {
  const nextDue  = (nextDueDate || vault.next_due_date || '').split('T')[0] || null;
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
          <p className="text-sm font-black font-mono text-teal-400">
            {vault.currency || 'NGN'} {safeF(vault.installment_amount)}
          </p>
        </div>
      </div>
      {nextDue && (
        <div className={`flex items-center justify-between p-3 rounded-xl border ${
          urgency ? 'border-red-500/30 bg-red-500/5' : 'border-zinc-800 bg-zinc-900/40'
        }`}>
          <div className="flex items-center gap-2">
            <Calendar size={13} className={urgency ? 'text-red-400' : 'text-zinc-500'} />
            <div>
              <p className="text-[8px] text-zinc-500 uppercase font-bold">Next Due</p>
              <p className={`text-xs font-black font-mono ${urgency ? 'text-red-400' : 'text-white'}`}>{nextDue}</p>
            </div>
          </div>
          {daysLeft != null && (
            <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border ${
              daysLeft === 0 ? 'border-red-500/40 text-red-400 bg-red-500/10'
              : urgency      ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
              :                'border-zinc-700 text-zinc-400 bg-zinc-900/40'
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

// ── OnboardingProgress (server-driven steps from my-vault API) ────────────────
function OnboardingProgress({ steps }: { steps: OnboardingStep[] }) {
  const stepDesc: Record<string, (s: string) => string> = {
    account_created:      ()  => 'Your Nested Ark account is live and active.',
    payout_destination:   (s) => s === 'done'
      ? 'Landlord payout destination saved and Paystack-verified.'
      : 'No bank details provided at registration. Add from your dashboard settings anytime.',
    escrow_vault_profile: (s) => s === 'done'
      ? 'Your savings vault is active and accumulating contributions.'
      : 'Activated automatically when you initialize your vault.',
    link_to_property:     (s) => s === 'done'
      ? 'Linked to a property via tenancy.'
      : 'Browse the marketplace or await a landlord invite link.',
  };
  return (
    <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Account Setup Progress</p>
        <span className="flex items-center gap-1.5 text-[8px] text-zinc-600">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
          Background tasks running
        </span>
      </div>
      <div className="space-y-4">
        {steps.map(step => (
          <div key={step.key} className="flex items-start gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              step.status === 'done'    ? 'bg-teal-500/15 border border-teal-500/30'
              : step.status === 'skipped' ? 'bg-zinc-800 border border-zinc-700'
              :                             'bg-amber-500/10 border border-amber-500/20'
            }`}>
              {step.status === 'done'    ? <CheckCircle2 size={13} className="text-teal-400" />
              : step.status === 'skipped' ? <span className="text-zinc-600 text-xs font-bold">—</span>
              :                             <span className="text-amber-400 text-xs">○</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <p className={`text-xs font-bold ${step.status === 'done' ? 'text-white' : 'text-zinc-500'}`}>
                  {step.label}
                </p>
                <span className={`text-[7px] px-1.5 py-0.5 rounded border font-black uppercase tracking-widest ${
                  step.status === 'done'    ? 'border-teal-500/30 text-teal-500'
                  : step.status === 'skipped' ? 'border-zinc-700 text-zinc-600'
                  :                             'border-amber-500/30 text-amber-400'
                }`}>{step.status}</span>
              </div>
              <p className="text-[9px] text-zinc-600">
                {stepDesc[step.key]?.(step.status) ?? ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── VaultCard — used for both linked vault and standalone vault ───────────────
function VaultCard({
  vault, isStandalone, onPay,
}: {
  vault: LinkedVaultSummary | StandaloneVaultSummary;
  isStandalone: boolean;
  onPay: () => void;
}) {
  const pct      = safeN(vault.funded_pct);
  const currency = (vault as LinkedVaultSummary).currency || 'NGN';
  return (
    <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-5">
      <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">
        {isStandalone ? 'Independent Flex-Pay Vault' : 'Flex-Pay Vault'}
      </p>
      <div className="flex flex-col md:flex-row items-center gap-8">
        <EscrowRing
          pct={pct}
          balance={safeN(vault.vault_balance)}
          target={safeN(vault.target_amount)}
          currency={currency}
        />
        <div className="flex-1 w-full space-y-4">
          <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                pct >= 80 ? 'bg-teal-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Vault Balance', val: fmt(safeN(vault.vault_balance)),          col: 'text-teal-400'  },
              { label: 'Annual Target', val: fmt(safeN(vault.target_amount)),           col: 'text-white'     },
              { label: 'Contributed',   val: fmt(safeN(vault.total_contributed)),       col: 'text-zinc-300'  },
              { label: 'Installment',   val: `${currency} ${safeF(vault.installment_amount)}`, col: 'text-amber-400' },
            ].map(s => (
              <div key={s.label} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <p className="text-zinc-600 uppercase font-bold text-[8px] mb-0.5">{s.label}</p>
                <p className={`font-black font-mono text-[10px] ${s.col}`}>{s.val}</p>
              </div>
            ))}
          </div>
          {/* Standalone-only: landlord payout destination */}
          {isStandalone && (vault as StandaloneVaultSummary).landlord_name && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-teal-500/20 bg-teal-500/5">
              <ShieldCheck size={11} className="text-teal-500 shrink-0" />
              <span className="text-[9px] text-teal-400 font-mono font-bold">
                Payout → {(vault as StandaloneVaultSummary).landlord_name}
                {(vault as StandaloneVaultSummary).landlord_email &&
                  ` · ${(vault as StandaloneVaultSummary).landlord_email}`}
              </span>
            </div>
          )}
          {/* Standalone-only: no landlord configured yet */}
          {isStandalone && !(vault as StandaloneVaultSummary).landlord_name && (
            <div className="px-3 py-2 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <p className="text-[9px] text-amber-400">
                ⚠️ No landlord payout details yet. Add them from{' '}
                <Link href="/tenant/vault" className="underline hover:text-amber-300">My Vault</Link>
                {' '}to pre-configure escrow release.
              </p>
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onPay}
        className="w-full py-3 bg-teal-500 text-black text-[10px] font-black uppercase rounded-xl hover:bg-teal-400 transition-all tracking-widest flex items-center justify-center gap-2"
      >
        <DollarSign size={13} /> Pay {fmt(safeN(vault.installment_amount))}
      </button>
    </div>
  );
}

// ── RecentPayments ────────────────────────────────────────────────────────────
function RecentPayments({ payments }: { payments: any[] }) {
  if (!payments?.length) return null;
  return (
    <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
      <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Recent Contributions</p>
      <div className="space-y-3">
        {payments.map((p: any, i: number) => (
          <div key={p.id ?? i}
            className={`flex items-center justify-between gap-4 ${
              i < payments.length - 1 ? 'pb-3 border-b border-zinc-800/60' : ''
            }`}
          >
            <div>
              <p className="font-mono font-bold text-sm text-white">{fmt(parseFloat(p.amount_ngn) || 0)}</p>
              <p className="text-[9px] text-zinc-600 mt-0.5">
                {p.period_label || p.period_month || '—'} · {p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-NG') : '—'}
              </p>
            </div>
            <span className={`text-[8px] px-2 py-1 rounded border font-bold uppercase ${
              p.status === 'SUCCESS' ? 'border-teal-500/30 text-teal-400' : 'border-amber-500/30 text-amber-400'
            }`}>{p.status}</span>
          </div>
        ))}
      </div>
      <Link href="/tenant/contributions"
        className="flex items-center justify-center gap-1.5 text-[9px] text-teal-500 font-bold hover:underline pt-1">
        View all contributions <ArrowRight size={10} />
      </Link>
    </div>
  );
}

// ── STATE A: Full linked tenant dashboard ─────────────────────────────────────
function LinkedTenantDashboard({
  tenancy, vault, notices, nextDueDate, activeNoticeCount, recentPayments, name,
}: {
  tenancy: any;
  vault: LinkedVaultSummary | null;
  notices: any[];
  nextDueDate: string | null;
  activeNoticeCount: number;
  recentPayments: any[];
  name: string;
}) {
  const router        = useRouter();
  const activeNotices = notices.filter((n: any) => n.status === 'ISSUED' || n.status === 'SERVED');
  const fundedPct     = vault
    ? Math.min(Math.round((safeN(vault.vault_balance) / (safeN(vault.target_amount) || 1)) * 100), 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      {/* Active notice red banner */}
      {activeNoticeCount > 0 && activeNotices[0] && (
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

        {/* Header */}
        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">My Dashboard</h1>
          <p className="text-zinc-500 text-xs mt-1">Welcome back, {name}</p>
        </div>

        {/* Unit card */}
        <div className={`p-6 rounded-3xl border ${
          activeNoticeCount > 0 ? 'border-red-500/30 bg-red-500/5' : 'border-teal-500/20 bg-teal-500/5'
        }`}>
          <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest mb-2">Your Unit</p>
          <h2 className="text-xl font-black uppercase">{tenancy.unit_name || '—'}</h2>
          <p className="text-zinc-400 text-sm mt-0.5">{tenancy.project_title || ''}</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap text-[10px] text-zinc-500">
            {tenancy.project_number && (
              <span className="flex items-center gap-1"><Building2 size={9} />{tenancy.project_number}</span>
            )}
            {tenancy.tenant_score && (
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Star size={9} /> Score: {tenancy.tenant_score}/100
              </span>
            )}
            {tenancy.location && (
              <span className="flex items-center gap-1"><MapPin size={9} />{tenancy.location}</span>
            )}
          </div>
          <div className={`mt-2 inline-flex items-center gap-1 text-[8px] font-black uppercase px-2 py-1 rounded border ${
            activeNoticeCount > 0
              ? 'border-red-500/30 text-red-400 bg-red-500/10'
              : 'border-teal-500/30 text-teal-400 bg-teal-500/10'
          }`}>
            {activeNoticeCount > 0 ? <AlertCircle size={8} /> : <CheckCircle2 size={8} />}
            {activeNoticeCount > 0 ? 'NOTICE ISSUED' : 'ACTIVE'}
          </div>
        </div>

        {/* Vault — ring + stats + seal + rhythm */}
        {vault && (
          <div className="space-y-4">
            <VaultCard vault={vault} isStandalone={false} onPay={() => router.push('/tenant/pay')} />
            <EscrowSeal status={vault.status} />
            <RhythmCard vault={vault} nextDueDate={nextDueDate} />
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              label: 'Vault Balance',
              value: vault ? fmt(safeN(vault.vault_balance)) : '—',
              color: 'text-teal-400',
            },
            {
              label: 'Active Notices',
              value: activeNoticeCount,
              color: activeNoticeCount > 0 ? 'text-red-400' : 'text-teal-400',
            },
          ].map(s => (
            <div key={s.label} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-1.5">
              <p className={`text-xl font-black font-mono tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Quick actions — 4 cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { href: '/tenant/pay',          Icon: DollarSign, ic: 'text-teal-400',  bd: 'border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20', ac: 'text-teal-500',  t: 'Pay Installment', s: 'Flex-Pay via Paystack' },
            { href: '/tenant/vault',         Icon: TrendingUp, ic: 'text-amber-400', bd: 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700',    ac: 'text-zinc-500',  t: 'My Vault',        s: 'Flex-Pay balance'     },
            { href: '/tenant/notices',       Icon: Gavel,      ic: 'text-red-400',   bd: 'border-red-500/10 bg-red-500/5 hover:border-red-500/20',  ac: 'text-red-400',   t: 'My Notices',      s: 'Legal notices'        },
            { href: '/tenant/contributions', Icon: FileText,   ic: 'text-teal-400',  bd: 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700',    ac: 'text-zinc-500',  t: 'History',         s: 'All contributions'    },
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

        {/* Recent contributions */}
        <RecentPayments payments={recentPayments} />

        {/* Notices list */}
        {notices.length > 0 && (
          <div className="space-y-3">
            <p className="text-[9px] text-red-400 uppercase font-black tracking-widest">Legal Notices</p>
            {notices.map((n: any) => (
              <div key={n.id}
                className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-bold text-sm text-red-300">{n.notice_type?.replace(/_/g, ' ')}</p>
                  <p className="text-[9px] text-zinc-500">
                    {n.notice_number} · Issued: {n.issued_at?.split('T')[0]}
                    {n.days_overdue ? ` · ${n.days_overdue} days overdue` : ''}
                  </p>
                </div>
                <span className={`text-[8px] px-2 py-1 rounded border font-bold uppercase ${
                  n.status === 'SERVED'  ? 'border-red-500/30 text-red-400'
                  : n.status === 'ISSUED' ? 'border-amber-500/30 text-amber-400'
                  :                         'border-zinc-700 text-zinc-500'
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

// ── STATE B: Independent tenant hub ──────────────────────────────────────────
function IndependentTenantHub({
  standaloneVault, onboardingSteps, recentPayments, name,
}: {
  standaloneVault:  StandaloneVaultSummary | null;
  onboardingSteps:  OnboardingStep[];
  recentPayments:   any[];
  name:             string;
}) {
  const router = useRouter();
  const sv     = standaloneVault;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-6 py-10 space-y-8 w-full">

        {/* Header */}
        <div className="border-l-2 border-green-500 pl-5">
          <p className="text-[9px] text-green-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">My Dashboard</h1>
          <p className="text-zinc-500 text-xs mt-1">
            Welcome{name ? `, ${name}` : ''}! Your account is active and ready.
          </p>
        </div>

        {/* Onboarding steps */}
        {onboardingSteps?.length > 0 && (
          <OnboardingProgress steps={onboardingSteps} />
        )}

        {/* B1: Has standalone vault */}
        {sv ? (
          <>
            <VaultCard vault={sv} isStandalone={true} onPay={() => router.push('/tenant/pay')} />
            <EscrowSeal status={sv.status} />
            <RecentPayments payments={recentPayments} />

            {/* Quick actions for B1 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { href: '/tenant/pay',          Icon: DollarSign, ic: 'text-teal-400',  bd: 'border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20', t: 'Pay Installment', s: 'Contribute to vault'    },
                { href: '/tenant/vault',         Icon: TrendingUp, ic: 'text-amber-400', bd: 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700',    t: 'My Vault',        s: 'Vault details & history' },
                { href: '/tenant/contributions', Icon: FileText,   ic: 'text-teal-400',  bd: 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700',    t: 'Contributions',   s: 'All payments'            },
              ].map(a => (
                <Link key={a.href} href={a.href}
                  className={`p-5 rounded-2xl border ${a.bd} transition-all flex items-center justify-between group`}>
                  <div>
                    <a.Icon size={20} className={`${a.ic} mb-2`} />
                    <p className="font-black text-sm uppercase tracking-tight">{a.t}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{a.s}</p>
                  </div>
                  <ArrowRight size={16} className="text-zinc-500 group-hover:translate-x-1 transition-transform" />
                </Link>
              ))}
            </div>
          </>
        ) : (
          /* B2: No vault yet */
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex items-start gap-4">
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
                <Link href="/tenant/vault"
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 text-black text-[9px] font-black uppercase rounded-xl hover:bg-teal-400 transition-all tracking-widest">
                  🚀 Initialize Savings Vault
                </Link>
                <Link href="/marketplace"
                  className="flex items-center gap-1.5 px-4 py-2 border border-zinc-700 text-zinc-400 text-[9px] font-black uppercase rounded-xl hover:border-zinc-600 transition-all tracking-widest">
                  <Search size={11} /> Browse Properties
                </Link>
                <Link href="/dashboard"
                  className="flex items-center gap-1.5 px-4 py-2 border border-zinc-700 text-zinc-400 text-[9px] font-black uppercase rounded-xl hover:border-zinc-600 transition-all tracking-widest">
                  <Building2 size={11} /> Full Platform Hub
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Vault capability panel */}
        <div className="p-5 rounded-2xl border border-green-500/20 bg-green-500/5 space-y-4">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-green-400" />
            <p className="text-[9px] text-green-400 uppercase font-black tracking-widest">Your Escrow Savings Vault</p>
          </div>
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            {sv
              ? 'Keep contributing. When your target is reached, funds auto-disburse to your landlord. You carry your vault history and tenant score across properties.'
              : 'Once you link to a property, your Flex-Pay vault activates automatically. Contributions accumulate in Paystack escrow and auto-disburse to your landlord when the target is reached.'}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: '🔒', label: 'Escrow-held'     },
              { icon: '📅', label: 'Your rhythm'      },
              { icon: '⚡', label: 'Auto-disburse'    },
              { icon: '🧾', label: 'SHA-256 receipts' },
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
                <ArrowRight size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-all" />
              </Link>
            ))}
          </div>
        </div>

        {/* Quick links */}
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

// ── Orchestrator ──────────────────────────────────────────────────────────────
function TenantDashboardContent() {
  const router = useRouter();

  // All state
  const [tenancy,           setTenancy]           = useState<any>(null);
  const [vault,             setVault]             = useState<LinkedVaultSummary | null>(null);
  const [standaloneVault,   setStandaloneVault]   = useState<StandaloneVaultSummary | null>(null);
  const [notices,           setNotices]           = useState<any[]>([]);
  const [recentPayments,    setRecentPayments]    = useState<any[]>([]);
  const [nextDueDate,       setNextDueDate]       = useState<string | null>(null);
  const [activeNoticeCount, setActiveNoticeCount] = useState(0);
  const [onboardingSteps,   setOnboardingSteps]   = useState<OnboardingStep[]>([]);
  const [hasTenancy,        setHasTenancy]        = useState<boolean | null>(null);
  const [displayName,       setDisplayName]       = useState('Tenant');
  const [loading,           setLoading]           = useState(true);

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) { router.push('/login'); return; }

      // ── 1. Tenancy (proven working — 404 = independent tenant, not an error) ──
      let tenancyData: any = null;
      try {
        const d = await apiFetch('/api/tenant/my-tenancy', token);
        tenancyData = d;
        setTenancy(d);
        setHasTenancy(true);
        setDisplayName(
          d.tenant_name?.split(' ')[0] ||
          d.unit_name?.split(' ')[0]   ||
          'Tenant'
        );
      } catch (e: any) {
        if (e.status === 401) { router.push('/login'); return; }
        // 404 is EXPECTED for independent tenants — not an error
        setHasTenancy(false);
      }

      // ── 2. Vault (returns hasActiveTenancy + standalone_vault for independents) ──
      try {
        const vd = await apiFetch('/api/tenant/my-vault', token);
        if (vd.hasActiveTenancy && vd.vault) {
          // Build funded_pct if not supplied by API
          const v = vd.vault;
          if (!v.funded_pct && v.target_amount > 0) {
            v.funded_pct = Math.min(Math.round((v.vault_balance / v.target_amount) * 100), 100);
          }
          setVault(v);
          setNextDueDate(vd.next_due_date ?? null);
          // Pull recent payments from vault response if present
          if (vd.recent_payments?.length) setRecentPayments(vd.recent_payments);
        } else if (!vd.hasActiveTenancy) {
          // Independent tenant
          if (vd.standalone_vault) {
            const sv = vd.standalone_vault;
            if (!sv.funded_pct && sv.target_amount > 0) {
              sv.funded_pct = Math.min(Math.round((sv.vault_balance / sv.target_amount) * 100), 100);
            }
            setStandaloneVault(sv);
          }
          // Build onboarding steps from vault response
          const steps: OnboardingStep[] = [
            { key: 'account_created',     label: 'Account Created',           status: 'done'    },
            { key: 'payout_destination',  label: 'Verify payout destination', status: 'skipped' },
            { key: 'escrow_vault_profile', label: 'Escrow vault profile',     status: vd.standalone_vault ? 'done' : 'pending' },
            { key: 'link_to_property',    label: 'Link to a property',        status: 'pending' },
          ];
          setOnboardingSteps(steps);
          // Set display name from profile if available
          if (vd.profile?.full_name) {
            setDisplayName(vd.profile.full_name.split(' ')[0]);
          } else if (vd.profile?.email) {
            setDisplayName(vd.profile.email.split('@')[0]);
          }
          if (vd.recent_payments?.length) setRecentPayments(vd.recent_payments);
        }
      } catch { /* vault unavailable — non-fatal */ }

      // ── 3. Notices (non-fatal — independents get [] gracefully) ──────────────
      try {
        const nd = await apiFetch('/api/tenant/my-notices', token);
        const list = nd.notices ?? nd.data ?? [];
        setNotices(list);
        setActiveNoticeCount(list.filter((n: any) => n.status === 'ISSUED' || n.status === 'SERVED').length);
      } catch { /* no notices — non-fatal */ }

      // ── 4. Recent payments (non-fatal) ────────────────────────────────────────
      if (tenancyData) {
        try {
          const pd = await apiFetch('/api/tenant/rent-history?limit=5', token);
          if (pd.payments?.length) setRecentPayments(pd.payments);
        } catch { /* non-fatal */ }
      }

      setLoading(false);
    })();
  }, [router]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading || hasTenancy === null) {
    return (
      <div className="min-h-screen bg-[#050505] text-white">
        <Navbar />
        <div className="flex items-center justify-center py-40">
          <Loader2 className="animate-spin text-teal-500" size={28} />
        </div>
        <Footer />
      </div>
    );
  }

  // ── STATE A: Linked tenant ────────────────────────────────────────────────
  if (hasTenancy && tenancy) {
    return (
      <LinkedTenantDashboard
        tenancy={tenancy}
        vault={vault}
        notices={notices}
        nextDueDate={nextDueDate}
        activeNoticeCount={activeNoticeCount}
        recentPayments={recentPayments}
        name={displayName}
      />
    );
  }

  // ── STATE B: Independent tenant ───────────────────────────────────────────
  return (
    <IndependentTenantHub
      standaloneVault={standaloneVault}
      onboardingSteps={onboardingSteps}
      recentPayments={recentPayments}
      name={displayName}
    />
  );
}

export default function TenantDashboardPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
    }>
      <TenantDashboardContent />
    </Suspense>
  );
}
