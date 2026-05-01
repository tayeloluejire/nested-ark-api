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
  Star, FileText, Building2, Gavel,
} from 'lucide-react';

const safeN = (v:any) => { const n=Number(v); return(v==null||isNaN(n))?0:n; };
const safeF = (v:any) => safeN(v).toLocaleString();

function TenantDashboardContent() {
  const { user } = useAuth();

  // Tenancy from /api/tenant/my-tenancy
  const [tenancy, setTenancy] = useState<any>(null);
  // Vault from /api/tenant/my-vault
  const [vault,   setVault]   = useState<any>(null);
  // Notices from /api/tenant/my-notices
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

  const activeNotices = notices.filter(n => n.status === 'SERVED' || n.status === 'PENDING');
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

        {/* Vault strip */}
        {vault && (
          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Flex-Pay Vault</p>
                <p className="text-2xl font-black font-mono text-teal-400 mt-1">
                  {vault.currency || 'NGN'} {safeF(vault.vault_balance)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-white">{fundedPct}%</p>
                <p className="text-[9px] text-zinc-600 uppercase font-bold">funded</p>
              </div>
            </div>
            <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${fundedPct >= 80 ? 'bg-teal-500' : fundedPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${fundedPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[9px] text-zinc-500">
              <span>Target: {vault.currency || 'NGN'} {safeF(vault.target_amount)}</span>
              <span>Installment: {vault.currency || 'NGN'} {safeF(vault.installment_amount)} ({vault.frequency})</span>
            </div>
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Vault Balance',     value: vault ? `${vault.currency||'NGN'} ${safeF(vault.vault_balance)}` : '—', color: 'text-teal-400' },
            { label: 'Active Notices',    value: activeNotices.length, color: activeNotices.length > 0 ? 'text-red-400' : 'text-teal-400' },
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
                <span className={`text-[8px] px-2 py-1 rounded border font-bold uppercase ${n.status === 'SERVED' ? 'border-red-500/30 text-red-400' : 'border-zinc-700 text-zinc-500'}`}>
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
