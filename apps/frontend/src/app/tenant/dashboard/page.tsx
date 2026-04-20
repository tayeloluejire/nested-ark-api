'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import {
  Wallet, CreditCard, Clock, CheckCircle2, AlertTriangle,
  FileText, Receipt, Download, RefreshCw, Loader2,
  Home, TrendingUp, Bell, ShieldCheck, User, ChevronRight,
  Gavel, Calendar, DollarSign, Lock, LogOut,
} from 'lucide-react';

// ── Defensive numeric helpers ─────────────────────────────────────────────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();

const API = process.env.NEXT_PUBLIC_API_URL || 'https://nested-ark-api.onrender.com';

interface Tenancy {
  tenancy_id: string; unit_id: string; project_id: string;
  tenant_name: string; tenant_email: string; unit_name: string;
  project_title: string; project_number: string;
  guarantor_json?: any; digital_signature_url?: string | null;
  tenant_score?: number | null; former_landlord_contact?: string | null;
  reason_for_quit?: string | null; litigation_history?: any[] | null;
}
interface Vault {
  id: string; vault_balance: number; target_amount: number;
  frequency: string; installment_amount: number; currency: string;
  next_due_date: string; status: string;
}
interface Contribution {
  id: string; amount: number; currency: string; period_label: string;
  paid_at: string; status: string; receipt_id?: string;
}
interface Notice {
  id: string; notice_number: string; notice_type: string;
  amount_overdue: number; days_overdue: number; issued_at: string;
  response_deadline: string; status: string;
}

const NOTICE_COLORS: Record<string, string> = {
  ISSUED:   'text-amber-400 bg-amber-950 border-amber-800',
  SERVED:   'text-red-400 bg-red-950 border-red-800',
  RESOLVED: 'text-teal-400 bg-teal-950 border-teal-800',
  EXPIRED:  'text-zinc-400 bg-zinc-900 border-zinc-700',
};

const SCORE_COLOR = (s: number) =>
  s >= 80 ? 'text-teal-400' : s >= 60 ? 'text-amber-400' : 'text-red-400';

export default function TenantDashboardPage() {
  const router = useRouter();
  const [tenancy,       setTenancy]       = useState<Tenancy | null>(null);
  const [vault,         setVault]         = useState<Vault | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [notices,       setNotices]       = useState<Notice[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [payLoading,    setPayLoading]    = useState(false);
  const [tab,           setTab]           = useState<'vault' | 'history' | 'profile' | 'notices'>('vault');

  const token = typeof window !== 'undefined' ? localStorage.getItem('ark_token') : null;

  const load = async () => {
    if (!token) { router.replace('/login'); return; }
    setLoading(true); setError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [tRes, vRes, cRes, nRes] = await Promise.all([
        fetch(`${API}/api/tenant/my-tenancy`,           { headers }),
        fetch(`${API}/api/tenant/my-vault`,             { headers }),
        fetch(`${API}/api/tenant/my-contributions`,     { headers }),
        fetch(`${API}/api/tenant/my-notices`,           { headers }),
      ]);
      if (!tRes.ok) { setError('Could not load your tenancy.'); return; }
      const [td, vd, cd, nd] = await Promise.all([tRes.json(), vRes.json(), cRes.json(), nRes.json()]);
      setTenancy(td.tenancy ?? td);
      setVault(vd.vault ?? null);
      setContributions(cd.contributions ?? []);
      setNotices(nd.notices ?? []);
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handlePay = async () => {
    if (!vault || !token) return;
    setPayLoading(true);
    try {
      const res = await fetch(`${API}/api/tenant/pay-installment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vault_id: vault.id }),
      });
      const data = await res.json();
      if (data.authorization_url) { window.location.href = data.authorization_url; return; }
      if (data.message) { alert(data.message); load(); }
      else { alert(data.error ?? 'Payment failed'); }
    } catch { alert('Payment failed. Try again.'); }
    finally { setPayLoading(false); }
  };

  const downloadReceipt = async (receiptId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/tenant/receipt/${receiptId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `receipt-${receiptId}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Receipt download failed'); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="animate-spin text-teal-500 mx-auto" size={28} />
        <p className="text-zinc-500 text-xs uppercase tracking-widest">Loading your tenancy…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
      <div className="text-center space-y-4 px-6">
        <AlertTriangle className="text-amber-400 mx-auto" size={32} />
        <p className="font-bold">{error}</p>
        <button onClick={load} className="px-6 py-3 bg-teal-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all">
          Retry
        </button>
      </div>
    </div>
  );

  if (!tenancy) return null;

  const hasActiveNotices = notices.some(n => n.status === 'ISSUED' || n.status === 'SERVED');
  const vaultPct = vault ? Math.min(Math.round((safeN(vault.vault_balance) / (safeN(vault.target_amount) || 1)) * 100), 100) : 0;

  return (
    <div className="min-h-screen bg-[#050505] text-white">

      {/* ── Branded top bar ── */}
      <div className="sticky top-0 z-50 border-b border-zinc-900 bg-[#050505]/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between">
        <BrandLogo size={26} />
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-teal-500 font-black uppercase tracking-[0.2em] hidden sm:block">
            Tenant Portal
          </span>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              router.replace('/login');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-500/30 text-[9px] font-bold uppercase tracking-widest transition-all"
          >
            <LogOut size={11} /> Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* ── HEADER ────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-teal-500/30 bg-teal-500/5 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              <span className="text-[8px] font-black uppercase tracking-widest text-teal-400">Tenant Portal</span>
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">
              {tenancy.tenant_name.split(' ')[0]}'s Tenancy
            </h1>
            <p className="text-zinc-500 text-xs mt-1">{tenancy.unit_name} · {tenancy.project_title}</p>
          </div>
          <button onClick={load} className="p-2 border border-zinc-800 rounded-xl text-zinc-500 hover:text-teal-500 transition-all">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* ── ACTIVE NOTICE ALERT ───────────────────────────────────────── */}
        {hasActiveNotices && (
          <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/5 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-red-500/15 flex-shrink-0"><Gavel size={16} className="text-red-400" /></div>
            <div className="flex-1">
              <p className="font-black text-sm text-red-400">Legal Notice Issued</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">You have an active legal notice from your landlord. Please review and respond before the deadline.</p>
            </div>
            <button onClick={() => setTab('notices')}
              className="flex-shrink-0 px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-[8px] uppercase tracking-widest rounded-lg hover:bg-red-500/30 transition-all">
              View
            </button>
          </div>
        )}

        {/* ── VAULT HERO CARD ───────────────────────────────────────────── */}
        {vault && (
          <div className="p-6 rounded-3xl border border-teal-500/25 bg-gradient-to-br from-teal-500/5 via-zinc-950 to-zinc-950 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-teal-400" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-teal-400">Flex-Pay Vault</span>
              </div>
              <span className={`text-[8px] px-2.5 py-1 rounded-full border font-bold uppercase ${
                vault.status === 'FUNDED_READY' ? 'border-teal-500/40 bg-teal-500/10 text-teal-400' :
                vault.status === 'ACTIVE'       ? 'border-blue-500/40 bg-blue-500/10 text-blue-400' :
                'border-zinc-700 bg-zinc-900 text-zinc-500'
              }`}>{vault.status.replace(/_/g, ' ')}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest mb-1">Vault Balance</p>
                <p className="text-3xl font-black font-mono text-teal-400">{vault.currency} {safeF(vault.vault_balance)}</p>
              </div>
              <div>
                <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest mb-1">Target</p>
                <p className="text-3xl font-black font-mono text-zinc-400">{vault.currency} {safeF(vault.target_amount)}</p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[8px] text-zinc-600 mb-2">
                <span>Vault funded</span><span className="font-bold text-teal-400">{vaultPct}%</span>
              </div>
              <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all" style={{ width: `${vaultPct}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                <p className="text-[8px] text-zinc-600 uppercase font-bold mb-1">Frequency</p>
                <p className="text-xs font-black text-white uppercase">{vault.frequency}</p>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                <p className="text-[8px] text-zinc-600 uppercase font-bold mb-1">Installment</p>
                <p className="text-xs font-black text-white font-mono">{vault.currency} {safeF(vault.installment_amount)}</p>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                <p className="text-[8px] text-zinc-600 uppercase font-bold mb-1">Next Due</p>
                <p className="text-xs font-black text-amber-400">{vault.next_due_date ? new Date(vault.next_due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</p>
              </div>
            </div>

            <button onClick={handlePay} disabled={payLoading}
              className="w-full flex items-center justify-center gap-3 py-4 bg-teal-500 text-black font-black text-sm uppercase tracking-[0.15em] rounded-2xl hover:bg-teal-400 transition-all disabled:opacity-60">
              {payLoading ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
              {payLoading ? 'Initializing…' : `Pay ${vault.currency} ${safeF(vault.installment_amount)} Now`}
            </button>
          </div>
        )}

        {/* ── TENANT SCORE ──────────────────────────────────────────────── */}
        {tenancy.tenant_score != null && (
          <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-zinc-800"><TrendingUp size={15} className="text-zinc-400" /></div>
              <div>
                <p className="font-bold text-sm">Tenant Score</p>
                <p className="text-[9px] text-zinc-500">Based on payment history & compliance</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-3xl font-black font-mono ${SCORE_COLOR(tenancy.tenant_score)}`}>{tenancy.tenant_score}</p>
              <p className="text-[8px] text-zinc-600">/100</p>
            </div>
          </div>
        )}

        {/* ── TABS ──────────────────────────────────────────────────────── */}
        <div className="flex border-b border-zinc-800 overflow-x-auto">
          {([
            { key: 'vault',   label: 'My Vault',      icon: Wallet },
            { key: 'history', label: 'Receipts',       icon: Receipt },
            { key: 'notices', label: 'Legal Notices',  icon: Gavel,   badge: notices.filter(n => n.status === 'ISSUED' || n.status === 'SERVED').length },
            { key: 'profile', label: 'My Profile',     icon: User },
          ] as const).map(({ key, label, icon: Icon, badge }: any) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                tab === key ? 'text-teal-400 border-teal-500' : 'text-zinc-500 border-transparent hover:text-white'
              }`}>
              <Icon size={11} /> {label}
              {badge > 0 && <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded">{badge}</span>}
            </button>
          ))}
        </div>

        {/* ── VAULT TAB ─────────────────────────────────────────────────── */}
        {tab === 'vault' && (
          <div className="space-y-3">
            {contributions.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-zinc-800 rounded-2xl">
                <Wallet className="text-zinc-700 mx-auto mb-3" size={24} />
                <p className="text-zinc-500 text-sm font-bold">No vault contributions yet</p>
                <p className="text-zinc-700 text-xs mt-1">Your first payment will appear here</p>
              </div>
            ) : (
              contributions.slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${c.status === 'CONFIRMED' ? 'bg-teal-500/10' : 'bg-amber-500/10'}`}>
                      <CheckCircle2 size={14} className={c.status === 'CONFIRMED' ? 'text-teal-400' : 'text-amber-400'} />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{c.period_label}</p>
                      <p className="text-[9px] text-zinc-500">{new Date(c.paid_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm">{c.currency} {safeF(c.amount)}</span>
                    {c.receipt_id && (
                      <button onClick={() => downloadReceipt(c.receipt_id!)}
                        className="p-2 border border-zinc-700 rounded-xl text-zinc-500 hover:text-teal-400 hover:border-teal-500/40 transition-all">
                        <Download size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
            {contributions.length > 5 && (
              <button onClick={() => setTab('history')}
                className="w-full py-3 border border-zinc-800 rounded-xl text-zinc-500 text-xs font-bold uppercase tracking-widest hover:border-zinc-600 hover:text-zinc-300 transition-all">
                View all {contributions.length} payments →
              </button>
            )}
          </div>
        )}

        {/* ── RECEIPT HISTORY TAB ───────────────────────────────────────── */}
        {tab === 'history' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Payment & Receipt History</p>
              <div className="flex items-center gap-1.5 text-[8px] text-zinc-600">
                <Lock size={8} className="text-teal-500/40" /> Ledger-backed
              </div>
            </div>
            {contributions.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-zinc-800 rounded-2xl">
                <Receipt className="text-zinc-700 mx-auto mb-3" size={24} />
                <p className="text-zinc-500 text-sm font-bold">No payments yet</p>
              </div>
            ) : (
              contributions.map(c => (
                <div key={c.id} className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${c.status === 'CONFIRMED' ? 'bg-teal-500/10' : 'bg-amber-500/10'}`}>
                      <Receipt size={14} className={c.status === 'CONFIRMED' ? 'text-teal-400' : 'text-amber-400'} />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{c.period_label}</p>
                      <p className="text-[9px] text-zinc-500">{new Date(c.paid_at).toLocaleDateString()} · {c.status}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm">{c.currency} {safeF(c.amount)}</span>
                    {c.receipt_id ? (
                      <button onClick={() => downloadReceipt(c.receipt_id!)}
                        className="flex items-center gap-1 px-3 py-1.5 border border-zinc-700 text-zinc-400 hover:text-teal-400 hover:border-teal-500/40 font-bold text-[8px] uppercase tracking-widest rounded-lg transition-all">
                        <Download size={9} /> PDF
                      </button>
                    ) : (
                      <span className="text-[8px] text-zinc-700 uppercase">No receipt</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── LEGAL NOTICES TAB ─────────────────────────────────────────── */}
        {tab === 'notices' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Legal Notices from Landlord</p>
              <div className="flex items-center gap-1.5 text-[8px] text-zinc-600">
                <Lock size={8} className="text-teal-500/40" /> SHA-256 immutable
              </div>
            </div>

            {notices.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-zinc-800 rounded-2xl">
                <ShieldCheck className="text-zinc-700 mx-auto mb-3" size={24} />
                <p className="text-zinc-500 text-sm font-bold">No legal notices on record</p>
                <p className="text-zinc-700 text-xs mt-1">Good standing — keep payments on time</p>
              </div>
            ) : (
              notices.map(n => (
                <div key={n.id} className={`p-4 rounded-2xl border ${
                  n.status === 'ISSUED' || n.status === 'SERVED' ? 'border-red-500/30 bg-red-500/5' : 'border-zinc-800 bg-zinc-900/20'
                } space-y-3`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-xl ${n.status === 'RESOLVED' ? 'bg-teal-500/10' : 'bg-red-500/10'}`}>
                        <Gavel size={14} className={n.status === 'RESOLVED' ? 'text-teal-400' : 'text-red-400'} />
                      </div>
                      <div>
                        <p className="font-mono text-[9px] text-teal-500">{n.notice_number}</p>
                        <p className="font-bold text-sm">{n.notice_type.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                    <span className={`text-[8px] px-2 py-1 rounded border font-bold uppercase ${NOTICE_COLORS[n.status] ?? NOTICE_COLORS.ISSUED}`}>
                      {n.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[9px]">
                    <div>
                      <p className="text-zinc-600 uppercase font-bold mb-0.5">Amount Overdue</p>
                      <p className="text-red-400 font-mono font-bold">₦{safeF(n.amount_overdue)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-600 uppercase font-bold mb-0.5">Response Deadline</p>
                      <p className="text-amber-400 font-bold">{n.response_deadline ? new Date(n.response_deadline).toLocaleDateString() : '—'}</p>
                    </div>
                    <div>
                      <p className="text-zinc-600 uppercase font-bold mb-0.5">Days Overdue</p>
                      <p className="text-zinc-300">{safeN(n.days_overdue)} days</p>
                    </div>
                    <div>
                      <p className="text-zinc-600 uppercase font-bold mb-0.5">Issued</p>
                      <p className="text-zinc-300">{new Date(n.issued_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {(n.status === 'ISSUED' || n.status === 'SERVED') && (
                    <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-[9px] text-zinc-400 leading-relaxed">
                      ⚠️ This is a formal legal notice. Please ensure payment of ₦{safeF(n.amount_overdue)} before the response deadline to avoid further proceedings.
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── PROFILE TAB ───────────────────────────────────────────────── */}
        {tab === 'profile' && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Tenancy Details</p>
              <div className="grid grid-cols-2 gap-3 text-[10px]">
                {[
                  { label: 'Full Name',  value: tenancy.tenant_name },
                  { label: 'Email',      value: tenancy.tenant_email },
                  { label: 'Unit',       value: tenancy.unit_name },
                  { label: 'Property',   value: tenancy.project_title },
                  { label: 'Project ID', value: tenancy.project_number },
                ].map(f => (
                  <div key={f.label}>
                    <p className="text-zinc-600 uppercase font-bold tracking-widest mb-0.5">{f.label}</p>
                    <p className="text-white font-medium truncate">{f.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {tenancy.guarantor_json && (
              <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
                <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Guarantor on File</p>
                <div className="grid grid-cols-2 gap-3 text-[10px]">
                  {[
                    { label: 'Name',          value: tenancy.guarantor_json.name },
                    { label: 'Phone',         value: tenancy.guarantor_json.phone },
                    { label: 'Relationship',  value: tenancy.guarantor_json.relationship ?? '—' },
                    { label: 'Work ID',       value: tenancy.guarantor_json.work_id ?? '—' },
                  ].map(f => (
                    <div key={f.label}>
                      <p className="text-zinc-600 uppercase font-bold tracking-widest mb-0.5">{f.label}</p>
                      <p className="text-white">{f.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tenancy.litigation_history && tenancy.litigation_history.length > 0 && (
              <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-3">
                <p className="text-[9px] text-amber-400 uppercase font-bold tracking-widest flex items-center gap-2">
                  <Gavel size={9} /> Litigation History
                </p>
                {tenancy.litigation_history.map((l: any, i: number) => (
                  <div key={i} className="text-[10px] text-zinc-400 pb-2 border-b border-zinc-800 last:border-0">
                    <p className="font-bold text-white">{l.case_ref ?? `Case ${i + 1}`}</p>
                    <p>{l.description ?? 'No description'}</p>
                    {l.date && <p className="text-zinc-600 mt-0.5">{new Date(l.date).toLocaleDateString()}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer trust badge */}
        <div className="flex items-center justify-center gap-4 py-4 text-[8px] text-zinc-700">
          <span className="flex items-center gap-1"><Lock size={7} className="text-teal-500/40" /> Paystack Secured</span>
          <span className="flex items-center gap-1"><ShieldCheck size={7} className="text-teal-500/40" /> SHA-256 Ledger</span>
          <span className="flex items-center gap-1"><CheckCircle2 size={7} className="text-teal-500/40" /> Nested Ark OS</span>
        </div>
      </div>
    </div>
  );
}
