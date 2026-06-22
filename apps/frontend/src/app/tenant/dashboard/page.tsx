'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import Navbar  from '@/components/Navbar';
import Footer  from '@/components/Footer';
import {
  DollarSign, Calendar, ShieldCheck, Loader2, AlertCircle,
  TrendingUp, ArrowRight, Bell, CheckCircle2, Star,
  FileText, Building2, Gavel, Lock, Search, MapPin,
  Zap, Home, Wallet, ImageOff, ChevronRight, RefreshCw,
  Calculator, PiggyBank, Send, Target,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const API_BASE = '/api';
const safeN = (v: any) => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any) => safeN(v).toLocaleString();
const fmt   = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(n);

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

// ── TenantNav ─────────────────────────────────────────────────────────────────
function TenantNav() {
  const pathname = usePathname();
  const links = [
    { href: '/tenant/dashboard',     label: 'My Dashboard' },
    { href: '/tenant/vault',         label: 'My Vault'     },
    { href: '/tenant/pay',           label: 'Pay Rent'     },
    { href: '/tenant/contributions', label: 'History'      },
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
interface OnboardingStep {
  key: string; label: string; status: 'done' | 'skipped' | 'pending';
}
interface StandaloneVaultSummary {
  id: string; vault_balance: number; target_amount: number;
  installment_amount: number; funded_pct: number; frequency: string;
  status: string; total_contributed: number; contribution_count: number;
  landlord_name: string | null; landlord_email: string | null;
}
interface LinkedVaultSummary {
  id: string; vault_balance: number; target_amount: number;
  installment_amount: number; funded_pct: number; frequency: string;
  status: string; total_contributed: number;
  next_due_date?: string | null; currency?: string;
}

// ── PropertyImage ─────────────────────────────────────────────────────────────
// Shows cover_image (unit) → hero_image_url (project) → placeholder
function PropertyImage({
  coverImage, heroImage, altText, className = '',
}: { coverImage?: string | null; heroImage?: string | null; altText?: string; className?: string }) {
  const [src, setSrc]       = useState<string | null>(coverImage || heroImage || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(coverImage || heroImage || null);
    setFailed(false);
  }, [coverImage, heroImage]);

  if (failed || !src) {
    return (
      <div className={`flex flex-col items-center justify-center bg-zinc-900 border border-zinc-800 rounded-xl ${className}`}>
        <ImageOff size={24} className="text-zinc-700 mb-2" />
        <p className="text-[9px] text-zinc-700 uppercase font-bold tracking-widest">No Image</p>
      </div>
    );
  }
  return (
    <img src={src} alt={altText || 'Property'} onError={() => setFailed(true)}
      className={`object-cover rounded-xl ${className}`} />
  );
}

// ── PhotoGallery ──────────────────────────────────────────────────────────────
function PhotoGallery({ photos }: { photos: string[] }) {
  const [active, setActive] = useState(0);
  if (!photos.length) return null;
  return (
    <div className="space-y-2">
      <div className="aspect-video rounded-xl overflow-hidden bg-zinc-900">
        <img src={photos[active]} alt={`Photo ${active + 1}`}
          className="w-full h-full object-cover"
          onError={e => (e.currentTarget.style.display = 'none')} />
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {photos.map((p, i) => (
            <button key={i} onClick={() => setActive(i)}
              className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                active === i ? 'border-teal-500' : 'border-zinc-800 opacity-60 hover:opacity-100'
              }`}>
              <img src={p} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── EscrowRing ────────────────────────────────────────────────────────────────
function EscrowRing({ pct, balance, target, currency }: {
  pct: number; balance: number; target: number; currency: string;
}) {
  const r = 52, circ = 2 * Math.PI * r, dash = circ * (pct / 100);
  const col = pct >= 80 ? '#14b8a6' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-[130px] h-[130px]">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#18181b" strokeWidth="8"/>
          <circle cx="60" cy="60" r={r} fill="none" stroke={col} strokeWidth="8"
            strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
            style={{ transition: 'stroke-dasharray 1s ease' }}/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black font-mono" style={{ color: col }}>{pct}%</span>
          <span className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">funded</span>
        </div>
      </div>
      <div className="text-center">
        <p className="font-black font-mono text-base" style={{ color: col }}>{currency} {safeF(balance)}</p>
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
      ready ? 'border-teal-500/30 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/20'}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${ready ? 'bg-teal-500/20' : 'bg-zinc-800'}`}>
        <Lock size={14} className={ready ? 'text-teal-400' : 'text-zinc-500'}/>
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-300">
          {ready ? '🔓 Escrow Release Pending' : '🔒 Nest Vault Escrow Active'}
        </p>
        <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
          {ready ? 'Vault fully funded. Funds will be disbursed to your landlord via Paystack within 24 hours.'
                 : 'Funds locked in platform escrow. Auto-disbursed to your landlord when vault reaches 100%.'}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <ShieldCheck size={9} className="text-teal-500"/>
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
  const daysLeft = nextDue ? Math.max(0, Math.ceil((new Date(nextDue).getTime() - Date.now()) / 86400000)) : null;
  const urgency  = daysLeft != null && daysLeft <= 3;
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
          <p className="text-sm font-black font-mono text-teal-400">{vault.currency||'NGN'} {safeF(vault.installment_amount)}</p>
        </div>
      </div>
      {nextDue && (
        <div className={`flex items-center justify-between p-3 rounded-xl border ${
          urgency ? 'border-red-500/30 bg-red-500/5' : 'border-zinc-800 bg-zinc-900/40'}`}>
          <div className="flex items-center gap-2">
            <Calendar size={13} className={urgency ? 'text-red-400' : 'text-zinc-500'}/>
            <div>
              <p className="text-[8px] text-zinc-500 uppercase font-bold">Next Due</p>
              <p className={`text-xs font-black font-mono ${urgency ? 'text-red-400' : 'text-white'}`}>{nextDue}</p>
            </div>
          </div>
          {daysLeft != null && (
            <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border ${
              daysLeft === 0 ? 'border-red-500/40 text-red-400 bg-red-500/10'
              : urgency      ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
              :                'border-zinc-700 text-zinc-400 bg-zinc-900/40'}`}>
              {daysLeft === 0 ? 'Due Today' : `${daysLeft}d left`}
            </span>
          )}
        </div>
      )}
      <Link href="/tenant/pay"
        className="flex items-center justify-center gap-2 w-full py-3 bg-teal-500 text-black text-[10px] font-black uppercase rounded-xl hover:bg-teal-400 transition-all tracking-widest">
        <DollarSign size={13}/> Pay This Installment
      </Link>
    </div>
  );
}

// ── OnboardingProgress ────────────────────────────────────────────────────────
function OnboardingProgress({ steps }: { steps: OnboardingStep[] }) {
  const stepDesc: Record<string, (s: string) => string> = {
    account_created:      ()  => 'Your Nested Ark account is live and active.',
    payout_destination:   (s) => s === 'done' ? 'Landlord payout destination verified.' : 'Optional — add anytime before your vault is ready.',
    escrow_vault_profile: (s) => s === 'done' ? 'Your savings vault is active.' : 'Create your vault below to activate this.',
    link_to_property:     (s) => s === 'done' ? 'Linked to a property via tenancy.' : 'Optional — link now or anytime later.',
  };
  return (
    <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Account Setup Progress</p>
        <span className="flex items-center gap-1.5 text-[8px] text-zinc-600">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block"/>
          Background tasks running
        </span>
      </div>
      <div className="space-y-4">
        {steps.map(step => (
          <div key={step.key} className="flex items-start gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              step.status === 'done'    ? 'bg-teal-500/15 border border-teal-500/30'
              : step.status === 'skipped' ? 'bg-zinc-800 border border-zinc-700'
              :                             'bg-amber-500/10 border border-amber-500/20'}`}>
              {step.status === 'done'    ? <CheckCircle2 size={13} className="text-teal-400"/>
              : step.status === 'skipped' ? <span className="text-zinc-600 text-xs font-bold">—</span>
              :                             <span className="text-amber-400 text-xs">○</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <p className={`text-xs font-bold ${step.status === 'done' ? 'text-white' : 'text-zinc-500'}`}>{step.label}</p>
                <span className={`text-[7px] px-1.5 py-0.5 rounded border font-black uppercase tracking-widest ${
                  step.status === 'done'    ? 'border-teal-500/30 text-teal-500'
                  : step.status === 'skipped' ? 'border-zinc-700 text-zinc-600'
                  :                             'border-amber-500/30 text-amber-400'}`}>{step.status}</span>
              </div>
              <p className="text-[9px] text-zinc-600">{stepDesc[step.key]?.(step.status) ?? ''}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── RecentPayments ────────────────────────────────────────────────────────────
function RecentPayments({ payments }: { payments: any[] }) {
  if (!payments?.length) return null;
  return (
    <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Recent Contributions</p>
        <Link href="/tenant/contributions" className="text-[9px] text-teal-500 font-bold hover:underline flex items-center gap-0.5">
          View All <ChevronRight size={10}/>
        </Link>
      </div>
      <div className="space-y-3">
        {payments.slice(0, 5).map((p: any, i: number) => (
          <div key={p.id ?? i} className={`flex items-center justify-between gap-4 ${
            i < Math.min(payments.length, 5) - 1 ? 'pb-3 border-b border-zinc-800/60' : ''}`}>
            <div>
              <p className="font-mono font-bold text-sm text-white">{fmt(parseFloat(p.amount_ngn)||0)}</p>
              <p className="text-[9px] text-zinc-600 mt-0.5">
                {p.period_label||p.period_month||'—'} · {p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-NG') : '—'}
              </p>
            </div>
            <span className={`text-[8px] px-2 py-1 rounded border font-bold uppercase ${
              p.status==='SUCCESS' ? 'border-teal-500/30 text-teal-400' : 'border-amber-500/30 text-amber-400'}`}>
              {p.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── StandaloneVaultCard ───────────────────────────────────────────────────────
function StandaloneVaultCard({ vault, onPay }: { vault: StandaloneVaultSummary; onPay: () => void }) {
  const col = vault.status === 'FUNDED_READY' ? '#10b981' : '#14b8a6';
  const r = 40, circ = 2 * Math.PI * r, dash = (vault.funded_pct / 100) * circ;
  return (
    <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
      <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Independent Flex-Pay Vault</p>
      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* Mini ring */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          <div className="relative w-[100px] h-[100px]">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r={r} fill="none" stroke="#18181b" strokeWidth="8"/>
              <circle cx="50" cy="50" r={r} fill="none" stroke={col} strokeWidth="8"
                strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
                style={{ transition: 'stroke-dasharray 1s ease' }}/>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black font-mono" style={{ color: col }}>{vault.funded_pct}%</span>
              <span className="text-[7px] text-zinc-600 uppercase font-bold tracking-widest">funded</span>
            </div>
          </div>
          <p className="font-black font-mono text-sm text-center" style={{ color: col }}>{fmt(vault.vault_balance)}</p>
          <p className="text-[9px] text-zinc-600 font-bold">of {fmt(vault.target_amount)}</p>
        </div>
        {/* Stats */}
        <div className="flex-1 w-full space-y-3">
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${vault.funded_pct}%`, background: col }}/>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Contributed',  val: fmt(vault.total_contributed),   col: 'text-teal-400' },
              { label: 'Installment',  val: `${fmt(vault.installment_amount)} / ${vault.frequency.toLowerCase()}`, col: 'text-white' },
              { label: 'Payments',     val: String(vault.contribution_count), col: 'text-zinc-300' },
              { label: 'Status',       val: vault.status.replace('_',' '),
                col: vault.status==='FUNDED_READY'?'text-teal-400':'text-zinc-300' },
            ].map(s => (
              <div key={s.label} className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                <p className="text-zinc-600 uppercase font-bold text-[7px] mb-0.5">{s.label}</p>
                <p className={`font-black font-mono text-[10px] ${s.col}`}>{s.val}</p>
              </div>
            ))}
          </div>
          {vault.landlord_name && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-teal-500/20 bg-teal-500/5">
              <ShieldCheck size={9} className="text-teal-500 shrink-0"/>
              <span className="text-[9px] text-teal-400 font-mono font-bold">
                Payout → {vault.landlord_name}{vault.landlord_email ? ` · ${vault.landlord_email}` : ''}
              </span>
            </div>
          )}
        </div>
      </div>
      {vault.status !== 'FUNDED_READY' && (
        <button onClick={onPay}
          className="w-full py-3 bg-teal-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all flex items-center justify-center gap-2">
          <DollarSign size={13}/> Pay {fmt(vault.installment_amount)} Installment
        </button>
      )}
      <div className="flex items-center justify-center gap-6">
        <Link href="/tenant/contributions" className="text-[10px] text-teal-500 font-bold hover:underline flex items-center gap-1">
          View Contributions <ChevronRight size={10}/>
        </Link>
        <Link href="/tenant/vault" className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
          Vault Details <ChevronRight size={10}/>
        </Link>
      </div>
    </div>
  );
}

// ── STATE A: Full linked tenant dashboard ─────────────────────────────────────
function LinkedTenantDashboard({
  tenancy, vault, notices, nextDueDate, activeNoticeCount, recentPayments, name,
}: {
  tenancy: any; vault: LinkedVaultSummary | null; notices: any[];
  nextDueDate: string | null; activeNoticeCount: number; recentPayments: any[]; name: string;
}) {
  const router        = useRouter();
  const activeNotices = notices.filter((n: any) => n.status === 'ISSUED' || n.status === 'SERVED');
  const fundedPct     = vault
    ? Math.min(Math.round((safeN(vault.vault_balance) / (safeN(vault.target_amount)||1)) * 100), 100)
    : 0;

  // Parse photos
  const photos: string[] = (() => {
    const arr = tenancy.photo_urls_arr;
    if (Array.isArray(arr)) return arr.filter(Boolean);
    if (typeof arr === 'string') {
      try { return JSON.parse(arr).filter(Boolean); } catch { return []; }
    }
    return [];
  })();
  const coverImage   = tenancy.cover_image   || null;
  const heroImage    = tenancy.hero_image_url || null;
  const allPhotos    = [coverImage, ...photos].filter(Boolean) as string[];
  const hasImages    = allPhotos.length > 0 || !!heroImage;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar/>
      <TenantNav/>

      {/* Active notice red banner */}
      {activeNoticeCount > 0 && activeNotices[0] && (
        <div className="bg-red-500 px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-white flex-shrink-0"/>
            <p className="text-white text-xs font-black uppercase tracking-wide">
              {activeNotices[0].notice_type?.replace(/_/g,' ')} — {activeNotices[0].days_overdue ?? 0} days overdue. Please pay immediately.
            </p>
          </div>
          <Link href="/tenant/pay"
            className="px-4 py-1.5 bg-white text-red-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-100 transition-all flex-shrink-0">
            Pay Now
          </Link>
        </div>
      )}

      <main className="flex-1 max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6 w-full">

        {/* Header */}
        <div className="border-l-2 border-teal-500 pl-4">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-2xl font-black uppercase tracking-tighter">My Dashboard</h1>
          <p className="text-zinc-500 text-xs mt-1">Welcome back, {name}</p>
        </div>

        {/* Property / Unit Card with image */}
        <div className={`rounded-3xl border overflow-hidden ${
          activeNoticeCount > 0 ? 'border-red-500/30' : 'border-teal-500/20'}`}>

          {/* Property image / gallery */}
          {hasImages && (
            allPhotos.length > 1
              ? <PhotoGallery photos={allPhotos} />
              : <div className="relative aspect-video bg-zinc-900">
                  <PropertyImage
                    coverImage={coverImage}
                    heroImage={heroImage}
                    altText={tenancy.unit_name || 'Property'}
                    className="w-full h-full"
                  />
                  {/* Overlay badges */}
                  <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
                    {tenancy.unit_type && (
                      <span className="px-2 py-1 text-[8px] font-black uppercase tracking-widest bg-black/70 text-teal-400 rounded-lg backdrop-blur-sm border border-teal-500/20">
                        {tenancy.unit_type}
                      </span>
                    )}
                    {tenancy.bedrooms && (
                      <span className="px-2 py-1 text-[8px] font-black uppercase tracking-widest bg-black/70 text-white rounded-lg backdrop-blur-sm">
                        {tenancy.bedrooms} Bed{tenancy.bedrooms > 1 ? 's' : ''}
                        {tenancy.bathrooms ? ` · ${tenancy.bathrooms} Bath` : ''}
                      </span>
                    )}
                  </div>
                  {tenancy.project_number && (
                    <div className="absolute bottom-3 right-3">
                      <span className="px-2 py-1 text-[8px] font-black font-mono bg-black/80 text-teal-400 rounded-lg backdrop-blur-sm border border-teal-500/20">
                        {tenancy.project_number}
                      </span>
                    </div>
                  )}
                </div>
          )}

          {/* Unit details panel */}
          <div className={`p-5 ${activeNoticeCount > 0 ? 'bg-red-500/5' : 'bg-teal-500/5'}`}>
            <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest mb-2">Your Unit</p>
            <h2 className="text-xl font-black uppercase">{tenancy.unit_name || '—'}</h2>
            <p className="text-zinc-400 text-sm mt-0.5">{tenancy.project_title || ''}</p>

            <div className="flex items-center gap-3 mt-2 flex-wrap text-[10px] text-zinc-500">
              {tenancy.project_number && (
                <span className="flex items-center gap-1"><Building2 size={9}/>{tenancy.project_number}</span>
              )}
              {tenancy.location && (
                <span className="flex items-center gap-1"><MapPin size={9}/>{tenancy.location}</span>
              )}
              {tenancy.tenant_score && (
                <span className="flex items-center gap-1 text-amber-400 font-bold">
                  <Star size={9}/> Score: {tenancy.tenant_score}/100
                </span>
              )}
              {tenancy.bedrooms && (
                <span className="text-zinc-600">{tenancy.bedrooms} bed{tenancy.bedrooms > 1 ? 's' : ''}</span>
              )}
              {tenancy.size_sqm && (
                <span className="text-zinc-600">{tenancy.size_sqm} m²</span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <div className={`inline-flex items-center gap-1 text-[8px] font-black uppercase px-2 py-1 rounded border ${
                activeNoticeCount > 0
                  ? 'border-red-500/30 text-red-400 bg-red-500/10'
                  : 'border-teal-500/30 text-teal-400 bg-teal-500/10'}`}>
                {activeNoticeCount > 0 ? <AlertCircle size={8}/> : <CheckCircle2 size={8}/>}
                {activeNoticeCount > 0 ? 'NOTICE ISSUED' : 'ACTIVE'}
              </div>
              {tenancy.lease_start && tenancy.lease_end && (
                <span className="text-[9px] text-zinc-600 font-mono">
                  {new Date(tenancy.lease_start).toLocaleDateString('en-NG')} → {new Date(tenancy.lease_end).toLocaleDateString('en-NG')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Vault section */}
        {vault && (
          <div className="space-y-4">
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20">
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-5">Flex-Pay Vault</p>
              <div className="flex flex-col md:flex-row items-center gap-8">
                <EscrowRing
                  pct={fundedPct}
                  balance={safeN(vault.vault_balance)}
                  target={safeN(vault.target_amount)}
                  currency={vault.currency||'NGN'}
                />
                <div className="flex-1 w-full space-y-4">
                  <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${
                      fundedPct>=80?'bg-teal-500':fundedPct>=50?'bg-amber-500':'bg-red-500'}`}
                      style={{ width:`${fundedPct}%` }}/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label:'Vault Balance', val:`${vault.currency||'NGN'} ${safeF(vault.vault_balance)}`, col:'text-teal-400' },
                      { label:'Annual Target',  val:`${vault.currency||'NGN'} ${safeF(vault.target_amount)}`, col:'text-white' },
                      { label:'Remaining',      val:`${vault.currency||'NGN'} ${safeF(Math.max(0,safeN(vault.target_amount)-safeN(vault.vault_balance)))}`, col:'text-zinc-300' },
                      { label:'Vault Status',   val:vault.status||'ACTIVE',
                        col:vault.status==='FUNDED_READY'?'text-teal-400':vault.status==='OVERDUE'?'text-red-400':'text-zinc-300' },
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
            <EscrowSeal status={vault.status||'ACTIVE'}/>
            <RhythmCard vault={vault} nextDueDate={nextDueDate}/>
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label:'Vault Balance', value:vault?fmt(safeN(vault.vault_balance)):'—', color:'text-teal-400' },
            { label:'Active Notices', value:activeNoticeCount, color:activeNoticeCount>0?'text-red-400':'text-teal-400' },
          ].map(s => (
            <div key={s.label} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-1.5">
              <p className={`text-xl font-black font-mono tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Quick actions — 4 cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href:'/tenant/pay',          Icon:DollarSign, ic:'text-teal-400',  bd:'border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20', t:'Pay Installment', s:'Flex-Pay via Paystack' },
            { href:'/tenant/vault',         Icon:TrendingUp, ic:'text-amber-400', bd:'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700',    t:'My Vault',        s:'Flex-Pay balance'      },
            { href:'/tenant/notices',       Icon:Gavel,      ic:'text-red-400',   bd:'border-red-500/10 bg-red-500/5 hover:border-red-500/20',  t:'My Notices',      s:'Legal notices'         },
            { href:'/tenant/contributions', Icon:FileText,   ic:'text-teal-400',  bd:'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700',    t:'History',         s:'All contributions'     },
          ].map(a => (
            <Link key={a.href} href={a.href}
              className={`p-4 rounded-2xl border ${a.bd} transition-all flex items-center justify-between group`}>
              <div>
                <a.Icon size={18} className={`${a.ic} mb-2`}/>
                <p className="font-black text-xs uppercase tracking-tight">{a.t}</p>
                <p className="text-[9px] text-zinc-500 mt-0.5">{a.s}</p>
              </div>
              <ArrowRight size={14} className="text-zinc-600 group-hover:translate-x-1 transition-transform"/>
            </Link>
          ))}
        </div>

        {/* Recent contributions */}
        <RecentPayments payments={recentPayments}/>

        {/* Notices list */}
        {notices.length > 0 && (
          <div className="space-y-3">
            <p className="text-[9px] text-red-400 uppercase font-black tracking-widest">Legal Notices</p>
            {notices.map((n: any) => (
              <div key={n.id} className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-bold text-sm text-red-300">{n.notice_type?.replace(/_/g,' ')}</p>
                  <p className="text-[9px] text-zinc-500">
                    {n.notice_number} · Issued: {n.issued_at?.split('T')[0]}
                    {n.days_overdue ? ` · ${n.days_overdue} days overdue` : ''}
                  </p>
                </div>
                <span className={`text-[8px] px-2 py-1 rounded border font-bold uppercase ${
                  n.status==='SERVED' ? 'border-red-500/30 text-red-400'
                  : n.status==='ISSUED' ? 'border-amber-500/30 text-amber-400'
                  : 'border-zinc-700 text-zinc-500'}`}>{n.status}</span>
              </div>
            ))}
          </div>
        )}

      </main>
      <Footer/>
    </div>
  );
}

// ── STATE B: Independent tenant hub ──────────────────────────────────────────
function IndependentTenantHub({
  standaloneVault, onboardingSteps, recentPayments, name,
}: {
  standaloneVault: StandaloneVaultSummary | null;
  onboardingSteps: OnboardingStep[];
  recentPayments:  any[];
  name:            string;
}) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar/>
      <TenantNav/>
      <main className="flex-1 max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6 w-full">

        <div className="border-l-2 border-green-500 pl-4">
          <p className="text-[9px] text-green-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-2xl font-black uppercase tracking-tighter">My Dashboard</h1>
          <p className="text-zinc-500 text-xs mt-1">Welcome{name ? `, ${name}` : ''}! Your account is active and ready.</p>
        </div>

        {/* Onboarding steps */}
        {onboardingSteps?.length > 0 && <OnboardingProgress steps={onboardingSteps}/>}

        {/* B1: Has standalone vault */}
        {standaloneVault ? (
          <>
            <StandaloneVaultCard vault={standaloneVault} onPay={() => router.push('/tenant/pay')}/>
            <EscrowSeal status={standaloneVault.status}/>
            <RecentPayments payments={recentPayments}/>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { href:'/tenant/pay',          Icon:DollarSign, ic:'text-teal-400',  bd:'border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20', t:'Pay Installment', s:'Contribute to vault'     },
                { href:'/tenant/vault',         Icon:TrendingUp, ic:'text-amber-400', bd:'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700',    t:'My Vault',        s:'Vault details & history'  },
                { href:'/tenant/contributions', Icon:FileText,   ic:'text-teal-400',  bd:'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700',    t:'Contributions',   s:'All payments & receipts'  },
                { href:'/rent-vault/calculator',Icon:Calculator, ic:'text-purple-400',bd:'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700',    t:'Calculator',      s:'Recalculate your plan'    },
              ].map(a => (
                <Link key={a.href} href={a.href}
                  className={`p-4 rounded-2xl border ${a.bd} transition-all flex items-center justify-between group`}>
                  <div>
                    <a.Icon size={18} className={`${a.ic} mb-2`}/>
                    <p className="font-black text-xs uppercase tracking-tight">{a.t}</p>
                    <p className="text-[9px] text-zinc-500 mt-0.5">{a.s}</p>
                  </div>
                  <ArrowRight size={14} className="text-zinc-600 group-hover:translate-x-1 transition-transform"/>
                </Link>
              ))}
            </div>
          </>
        ) : (
          /* B2: No vault yet — conversion-focused hero */
          <div className="space-y-4">

            {/* Primary CTA — dominant, single focus */}
            <div className="p-6 rounded-2xl border border-teal-500/30 bg-gradient-to-br from-teal-500/10 to-teal-500/5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                  <PiggyBank size={20} className="text-teal-400"/>
                </div>
                <div>
                  <p className="font-black text-base tracking-tight">Start Saving for Your Rent Today</p>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    Set a target. Save daily, weekly or monthly. Your money stays in secure
                    escrow until you're ready — withdraw it yourself or send it straight to
                    your landlord when your target is reached.
                  </p>
                </div>
              </div>
              <Link href="/tenant/vault"
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-teal-500 text-black text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all">
                <PiggyBank size={14}/> Create My Rent Vault — Free
              </Link>
              <p className="text-[9px] text-zinc-600 text-center">
                Takes 30 seconds · No bank account required to start
              </p>
            </div>

            {/* Calculator — secondary but prominent, answers "how much?" */}
            <Link href="/rent-vault/calculator"
              className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-teal-500/30 hover:bg-teal-500/5 transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                  <Calculator size={16} className="text-amber-400"/>
                </div>
                <div>
                  <p className="font-black text-sm">Not sure how much to save?</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Calculate your daily, weekly or monthly target in seconds</p>
                </div>
              </div>
              <ArrowRight size={14} className="text-amber-400 group-hover:translate-x-1 transition-transform flex-shrink-0"/>
            </Link>

            {/* Secondary actions — equal, smaller weight */}
            <div className="grid grid-cols-2 gap-3">
              <Link href="/marketplace"
                className="flex items-center gap-2 p-3.5 rounded-xl border border-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-widest hover:border-zinc-600 hover:text-zinc-300 transition-all">
                <Search size={13}/> Browse Properties
              </Link>
              <Link href="/dashboard"
                className="flex items-center gap-2 p-3.5 rounded-xl border border-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-widest hover:border-zinc-600 hover:text-zinc-300 transition-all">
                <Building2 size={13}/> Platform Hub
              </Link>
            </div>

            {/* Reassurance note — moved here from the old card, condensed */}
            <p className="text-[9px] text-zinc-600 text-center leading-relaxed px-4">
              No landlord on Nested Ark yet? No problem — choose to withdraw to your own
              account or send directly to your landlord's bank when your vault is ready.
              If your landlord invites you later, your account links automatically.
            </p>
          </div>
        )}

        {/* Vault features panel */}
        <div className="p-5 rounded-2xl border border-green-500/20 bg-green-500/5 space-y-4">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-green-400"/>
            <p className="text-[9px] text-green-400 uppercase font-black tracking-widest">Your Escrow Savings Vault</p>
          </div>
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            {standaloneVault
              ? 'Keep contributing. When your target is reached, choose to withdraw to your own account or send directly to your landlord. Your vault history and tenant score carry across properties.'
              : 'Save toward any rent target — with or without a landlord on the platform. When you reach your target, choose to withdraw to your own account or send straight to your landlord.'}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[['🔒','Escrow-held'],['📅','Your rhythm'],['↗️','Withdraw or send'],['🧾','SHA-256 receipts']].map(([icon,label])=>(
              <div key={label} className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 text-center">
                <div className="text-lg mb-1">{icon}</div>
                <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">{label}</p>
              </div>
            ))}
          </div>
          {!standaloneVault && (
            <Link href="/rent-vault/calculator"
              className="flex items-center justify-center gap-2 w-full py-2.5 border border-zinc-700 text-zinc-300 text-[9px] font-black uppercase tracking-widest rounded-xl hover:border-amber-500/40 hover:text-amber-400 transition-all">
              <Calculator size={12}/> Calculate My Savings Plan
            </Link>
          )}
        </div>

        {/* Property browse shortcuts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Find a Property</p>
            <Link href="/marketplace" className="text-[9px] text-teal-500 font-bold hover:underline flex items-center gap-1">
              View All <ArrowRight size={10}/>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label:'For Rent', icon:Home,      href:'/marketplace?type=rent',   col:'text-teal-400'  },
              { label:'For Sale', icon:Building2, href:'/marketplace?type=sale',   col:'text-amber-400' },
              { label:'Near Me',  icon:MapPin,    href:'/marketplace?nearby=true', col:'text-blue-400'  },
            ].map(c=>(
              <Link key={c.label} href={c.href}
                className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 transition-all flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <c.icon size={16} className={c.col}/>
                  <p className="font-bold text-sm">{c.label}</p>
                </div>
                <ArrowRight size={13} className="text-zinc-600 group-hover:text-zinc-400 transition-all"/>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/marketplace"
            className="p-5 rounded-2xl border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 transition-all flex items-center justify-between group">
            <div>
              <Search size={18} className="text-teal-400 mb-2"/>
              <p className="font-black text-sm uppercase tracking-tight">Marketplace</p>
              <p className="text-[9px] text-zinc-500 mt-0.5">Find your next home</p>
            </div>
            <ArrowRight size={14} className="text-teal-500 group-hover:translate-x-1 transition-transform"/>
          </Link>
          <Link href="/dashboard"
            className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 transition-all flex items-center justify-between group">
            <div>
              <Zap size={18} className="text-amber-400 mb-2"/>
              <p className="font-black text-sm uppercase tracking-tight">Platform Hub</p>
              <p className="text-[9px] text-zinc-500 mt-0.5">Full overview</p>
            </div>
            <ArrowRight size={14} className="text-zinc-500 group-hover:translate-x-1 transition-transform"/>
          </Link>
        </div>

      </main>
      <Footer/>
    </div>
  );
}

// ── Orchestrator ──────────────────────────────────────────────────────────────
function TenantDashboardContent() {
  const router = useRouter();

  const [tenancy,           setTenancy]           = useState<any>(null);
  const [vault,             setVault]             = useState<LinkedVaultSummary | null>(null);
  const [standaloneVault,   setStandaloneVault]   = useState<StandaloneVaultSummary | null>(null);
  const [notices,           setNotices]           = useState<any[]>([]);
  const [recentPayments,    setRecentPayments]    = useState<any[]>([]);
  const [nextDueDate,       setNextDueDate]       = useState<string | null>(null);
  const [activeNoticeCount, setActiveNoticeCount] = useState(0);
  const [onboardingSteps,   setOnboardingSteps]   = useState<OnboardingStep[]>([]);
  const [hasTenancy,        setHasTenancy]        = useState<boolean | null>(null);
  const [displayName,       setDisplayName]       = useState('');
  const [loading,           setLoading]           = useState(true);

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) { router.push('/login'); return; }

      // 1. Tenancy — 404 is EXPECTED for independent tenants
      try {
        const d = await apiFetch('/api/tenant/my-tenancy', token);
        setTenancy(d);
        setHasTenancy(true);
        setDisplayName(d.tenant_name?.split(' ')[0] || 'Tenant');
      } catch (e: any) {
        if (e.status === 401) { router.push('/login'); return; }
        setHasTenancy(false);
      }

      // 2. Vault (handles both linked and standalone paths)
      try {
        const vd = await apiFetch('/api/tenant/my-vault', token);
        if (vd.hasActiveTenancy && vd.vault) {
          const v = vd.vault;
          if (!v.funded_pct && v.target_amount > 0) {
            v.funded_pct = Math.min(Math.round((v.vault_balance / v.target_amount) * 100), 100);
          }
          setVault(v);
          setNextDueDate(vd.next_due_date ?? null);
          if (vd.recent_payments?.length) setRecentPayments(vd.recent_payments);
        } else if (!vd.hasActiveTenancy) {
          if (vd.standalone_vault) {
            const sv = vd.standalone_vault;
            if (!sv.funded_pct && sv.target_amount > 0) {
              sv.funded_pct = Math.min(Math.round((sv.vault_balance / sv.target_amount) * 100), 100);
            }
            setStandaloneVault(sv);
          }
          const steps: OnboardingStep[] = [
            { key:'account_created',      label:'Account Created',           status:'done'    },
            { key:'payout_destination',   label:'Verify payout destination', status:'skipped' },
            { key:'escrow_vault_profile', label:'Escrow vault profile',      status: vd.standalone_vault ? 'done' : 'pending' },
            { key:'link_to_property',     label:'Link to a property',        status:'pending' },
          ];
          setOnboardingSteps(steps);
          if (vd.profile?.full_name) setDisplayName(vd.profile.full_name.split(' ')[0]);
          else if (vd.profile?.email) setDisplayName(vd.profile.email.split('@')[0]);
          if (vd.recent_payments?.length) setRecentPayments(vd.recent_payments);
        }
      } catch { /* vault unavailable — non-fatal */ }

      // 3. Notices
      try {
        const nd  = await apiFetch('/api/tenant/my-notices', token);
        const list = nd.notices ?? nd.data ?? [];
        setNotices(list);
        setActiveNoticeCount(list.filter((n: any) => n.status==='ISSUED'||n.status==='SERVED').length);
      } catch { /* non-fatal */ }

      // 4. Recent payments (only for linked tenants)
      try {
        const pd = await apiFetch('/api/tenant/rent-history?limit=5', token);
        if (pd.payments?.length) setRecentPayments(pd.payments);
      } catch { /* non-fatal */ }

      setLoading(false);
    })();
  }, [router]);

  // Loading
  if (loading || hasTenancy === null) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col">
        <Navbar/>
        <TenantNav/>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <Loader2 className="animate-spin text-teal-500" size={24}/>
            <span className="text-zinc-500 font-mono text-sm">Loading portal…</span>
          </div>
        </div>
        <Footer/>
      </div>
    );
  }

  // STATE A: Linked tenant
  if (hasTenancy && tenancy) {
    return (
      <LinkedTenantDashboard
        tenancy={tenancy} vault={vault} notices={notices}
        nextDueDate={nextDueDate} activeNoticeCount={activeNoticeCount}
        recentPayments={recentPayments} name={displayName}
      />
    );
  }

  // STATE B: Independent tenant
  return (
    <IndependentTenantHub
      standaloneVault={standaloneVault} onboardingSteps={onboardingSteps}
      recentPayments={recentPayments} name={displayName}
    />
  );
}

export default function TenantDashboardPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28}/>
      </div>
    }>
      <TenantDashboardContent/>
    </Suspense>
  );
}
