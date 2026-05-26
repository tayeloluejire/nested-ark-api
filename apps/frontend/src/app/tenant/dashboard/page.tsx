'use client';
export const dynamic = 'force-dynamic';
/**
 * /tenant/dashboard/page.tsx
 * TENANT-ONLY. Real API: GET /api/tenant/my-tenancy
 * Returns: tenancy_id, unit_name, project_title, project_number,
 *          tenant_score, guarantor_json, digital_signature_url,
 *          litigation_history, former_landlord_contact, reason_for_quit
 */
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import {
  Home, DollarSign, Calendar, ShieldCheck, Loader2,
  AlertCircle, TrendingUp, ArrowRight, Bell, CheckCircle2,
  Star, FileText, Building2, Gavel, Wallet, Lock,
} from 'lucide-react';

const safeN = (v:any) => { const n=Number(v); return(v==null||isNaN(n))?0:n; };
const safeF = (v:any) => safeN(v).toLocaleString();

// ── Escrow progress ring — SVG circle ────────────────────────────────────────
function EscrowRing({ pct, balance, target, currency }: {
  pct: number; balance: number; target: number; currency: string;
}) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  const color = pct >= 80 ? '#14b8a6' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-[140px] h-[140px]">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          {/* Track */}
          <circle cx="60" cy="60" r={r} fill="none" stroke="#18181b" strokeWidth="8" />
          {/* Progress */}
          <circle
            cx="60" cy="60" r={r} fill="none"
            stroke={color} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black font-mono" style={{ color }}>{pct}%</span>
          <span className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">funded</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-teal-400 font-black font-mono text-lg">{currency} {safeF(balance)}</p>
        <p className="text-[9px] text-zinc-600 font-bold">of {currency} {safeF(target)} target</p>
      </div>
    </div>
  );
}

// ── Escrow seal badge ─────────────────────────────────────────────────────────
function EscrowSeal({ status }: { status: string }) {
  const ready = status === 'FUNDED_READY';
  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl border ${
      ready
        ? 'border-teal-500/30 bg-teal-500/5'
        : 'border-zinc-700/60 bg-zinc-900/30'
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
            : 'Funds are locked in platform escrow custody and will be automatically disbursed to your landlord via Paystack once your vault reaches 100%.'}
        </p>
        <div className="flex items-center gap-1.5 mt-2">
          <ShieldCheck size={9} className="text-teal-500" />
          <span className="text-[8px] text-teal-500 font-bold uppercase tracking-widest">Paystack-secured · SHA-256 receipts · Court-admissible</span>
        </div>
      </div>
    </div>
  );
}

// ── Rhythm card — installment schedule ───────────────────────────────────────
function RhythmCard({ vault }: { vault: any }) {
  const nextDue = vault.next_due_date ? vault.next_due_date.split('T')[0] : null;
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
              daysLeft === 0 ? 'border-red-500/40 text-red-400 bg-red-500/10'
              : urgency ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
              : 'border-zinc-700 text-zinc-400 bg-zinc-900/40'
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

function TenantDashboardContent() {
  const { user } = useAuth();

  const [tenancy, setTenancy] = useState<any>(null);
  const [vault,   setVault]   = useState<any>(null);
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [tRes, vRes, nRes] = await Promise.allSettled([
          api.get('/api/tenant/my-tenancy'),
          api.get('/api/tenant/my-vault'),
          api.get('/api/tenant/my-notices'),
        ]);
        if (tRes.status === 'fulfilled') setTenancy(tRes.value.data);
        if (vRes.status === 'fulfilled') setVault(vRes.value.data.vault);
        if (nRes.status === 'fulfilled') setNotices(nRes.value.data.notices ?? []);
      } catch(e:any) {
        setError(e?.response?.data?.error ?? 'Could not load your tenancy.');
      } finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="flex items-center justify-center py-40">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
      <Footer />
    </div>
  );

  if (error || !tenancy) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="max-w-xl mx-auto px-6 py-40 text-center space-y-4">
        <AlertCircle className="text-amber-400 mx-auto" size={36} />
        <p className="text-white font-bold">{error || 'No active tenancy found.'}</p>
        <p className="text-zinc-500 text-sm">Contact your landlord if you believe this is an error.</p>
      </div>
      <Footer />
    </div>
  );

  // FIX: backend status values are 'ISSUED' and 'SERVED' — 'PENDING' does not exist.
  const activeNotices = notices.filter(n => n.status === 'ISSUED' || n.status === 'SERVED');
  const fundedPct = vault
    ? Math.min(Math.round((safeN(vault.vault_balance) / (safeN(vault.target_amount) || 1)) * 100), 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      {/* Active notice banner */}
      {activeNotices.length > 0 && (
        <div className="bg-red-500 px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-white flex-shrink-0" />
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
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Star size={9} /> Score: {tenancy.tenant_score}/100
              </span>
            )}
          </div>
          <div className={`mt-2 inline-flex items-center gap-1 text-[8px] font-black uppercase px-2 py-1 rounded border ${activeNotices.length > 0 ? 'border-red-500/30 text-red-400 bg-red-500/10' : 'border-teal-500/30 text-teal-400 bg-teal-500/10'}`}>
            {activeNotices.length > 0 ? <AlertCircle size={8}/> : <CheckCircle2 size={8}/>}
            {activeNotices.length > 0 ? 'NOTICE ISSUED' : 'ACTIVE'}
          </div>
        </div>

        {/* Vault section — ring + seal + rhythm */}
        {vault && (
          <div className="space-y-4">
            {/* Ring + balance — hero visual */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20">
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-5">Flex-Pay Vault</p>
              <div className="flex flex-col md:flex-row items-center gap-8">
                {/* Escrow ring */}
                <EscrowRing
                  pct={fundedPct}
                  balance={safeN(vault.vault_balance)}
                  target={safeN(vault.target_amount)}
                  currency={vault.currency || 'NGN'}
                />
                {/* Progress bar + stats */}
                <div className="flex-1 w-full space-y-4">
                  <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${fundedPct >= 80 ? 'bg-teal-500' : fundedPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${fundedPct}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[10px]">
                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                      <p className="text-zinc-600 uppercase font-bold text-[8px] mb-0.5">Vault Balance</p>
                      <p className="font-black font-mono text-teal-400">{vault.currency || 'NGN'} {safeF(vault.vault_balance)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                      <p className="text-zinc-600 uppercase font-bold text-[8px] mb-0.5">Annual Target</p>
                      <p className="font-black font-mono text-white">{vault.currency || 'NGN'} {safeF(vault.target_amount)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                      <p className="text-zinc-600 uppercase font-bold text-[8px] mb-0.5">Remaining</p>
                      <p className="font-black font-mono text-zinc-300">
                        {vault.currency || 'NGN'} {safeF(Math.max(0, safeN(vault.target_amount) - safeN(vault.vault_balance)))}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                      <p className="text-zinc-600 uppercase font-bold text-[8px] mb-0.5">Vault Status</p>
                      <p className={`font-black uppercase text-[10px] ${vault.status === 'FUNDED_READY' ? 'text-teal-400' : vault.status === 'OVERDUE' ? 'text-red-400' : 'text-zinc-300'}`}>
                        {vault.status || 'ACTIVE'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Escrow seal */}
            <EscrowSeal status={vault.status} />

            {/* Rhythm card */}
            <RhythmCard vault={vault} />
          </div>
        )}

        {/* KPI strip */}
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
          <Link href="/tenant/pay"
            className="p-5 rounded-2xl border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 transition-all flex items-center justify-between group">
            <div>
              <DollarSign size={20} className="text-teal-400 mb-2" />
              <p className="font-black text-sm uppercase tracking-tight">Pay Installment</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Flex-Pay via Paystack</p>
            </div>
            <ArrowRight size={16} className="text-teal-500 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link href="/tenant/vault"
            className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 transition-all flex items-center justify-between group">
            <div>
              <TrendingUp size={20} className="text-amber-400 mb-2" />
              <p className="font-black text-sm uppercase tracking-tight">My Vault</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Flex-Pay balance</p>
            </div>
            <ArrowRight size={16} className="text-zinc-500 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link href="/tenant/notices"
            className="p-5 rounded-2xl border border-red-500/10 bg-red-500/5 hover:border-red-500/20 transition-all flex items-center justify-between group">
            <div>
              <Gavel size={20} className="text-red-400 mb-2" />
              <p className="font-black text-sm uppercase tracking-tight">My Notices</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Legal notices</p>
            </div>
            <ArrowRight size={16} className="text-red-400 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link href="/tenant/contributions"
            className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 transition-all flex items-center justify-between group">
            <div>
              <FileText size={20} className="text-teal-400 mb-2" />
              <p className="font-black text-sm uppercase tracking-tight">History</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">All contributions</p>
            </div>
            <ArrowRight size={16} className="text-zinc-500 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Notices — FIX: was filtering 'SERVED'||'PENDING'; backend only uses 'ISSUED' and 'SERVED' */}
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
                <span className={`text-[8px] px-2 py-1 rounded border font-bold uppercase ${n.status === 'SERVED' ? 'border-red-500/30 text-red-400' : n.status === 'ISSUED' ? 'border-amber-500/30 text-amber-400' : 'border-zinc-700 text-zinc-500'}`}>
                  {n.status}
                </span>
              </div>
            ))}
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}

export default function TenantDashboardPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={28} /></div>}>
      <TenantDashboardContent />
    </Suspense>
  );
}
