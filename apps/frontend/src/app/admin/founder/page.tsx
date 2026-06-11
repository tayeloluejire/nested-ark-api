'use client';
export const dynamic = 'force-dynamic';

/**
 * /admin/founder/page.tsx
 * Founder / Platform Admin Command Center.
 * Accessible to roles: ADMIN, FOUNDER, DEVELOPER
 * Auth guard checks localStorage token + role (client-side).
 * Middleware handles server-side route protection.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, Building2, TrendingUp, Zap, ShieldCheck,
  RefreshCw, AlertCircle, CreditCard, Activity,
  ArrowUpRight, DollarSign, Clock, CheckCircle2,
} from 'lucide-react';

const API_BASE = '/api';

// Roles allowed on this page — must match middleware
const FOUNDER_ROLES = ['ADMIN', 'FOUNDER', 'DEVELOPER'];

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

function getRole(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('ark_role') ||
    sessionStorage.getItem('ark_role') ||
    ''
  ).toUpperCase();
}

const fmt = (n: number | string) =>
  `₦${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtNum = (n: number | string) =>
  Number(n).toLocaleString('en-NG');

interface DashboardData {
  // Today
  signups_today:         number;
  vaults_created_today:  number;
  contributions_today:   number;
  revenue_today:         number;
  // Users
  total_tenants:         number;
  total_landlords:       number;
  total_investors:       number;
  total_users:           number;
  total_government:      number;
  total_verifiers:       number;
  total_admins:          number;
  total_contractors:     number;
  // Vaults
  active_vaults:         number;
  funded_vaults:         number;
  standalone_vaults:     number;
  // Financial
  total_contributions:   number;
  total_platform_revenue:number;
  total_payouts_released:number;
  pending_payouts:       number;
  // Banking
  linked_bank_accounts:  number;
  autopay_enabled:       number;
  autopay_waitlist:      number;
  // Alerts
  failed_payments:       number;
  failed_payouts:        number;
  pending_kyc:           number;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, color = 'text-white', alert = false,
}: {
  label: string; value: string | number; sub?: string;
  color?: string; alert?: boolean;
}) {
  return (
    <div className={`p-4 rounded-2xl border ${alert ? 'border-red-500/30 bg-red-500/5' : 'border-zinc-800 bg-zinc-900/20'}`}>
      <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest mb-1">{label}</p>
      <p className={`text-xl font-black font-mono ${alert ? 'text-red-400' : color}`}>{value}</p>
      {sub && <p className="text-[9px] text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, color = 'text-amber-400' }: {
  icon: any; title: string; color?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={14} className={color} />
      <p className={`text-[9px] uppercase font-black tracking-widest ${color}`}>{title}</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FounderDashboardPage() {
  const router  = useRouter();
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [userName, setUserName] = useState('Founder');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    const token = getToken();
    const role  = getRole();

    // Client-side role guard — accepts DEVELOPER, FOUNDER, ADMIN
    if (!token || !FOUNDER_ROLES.includes(role)) {
      // Ensure cookies are written before redirecting
      if (token && role) {
        document.cookie = `ark_token=${token}; path=/; SameSite=Lax`;
        document.cookie = `ark_role=${role}; path=/; SameSite=Lax`;
      }
      router.replace('/founder/login');
      return;
    }

    // Always refresh cookies via server-side route so middleware
    // never sees stale/missing cookies on refresh or navigation
    fetch('/api/set-auth-cookies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token, role }),
    }).catch(() => {
      // Fallback: write client-side cookies if API route fails
      document.cookie = `ark_token=${token}; path=/; SameSite=Lax`;
      document.cookie = `ark_role=${role}; path=/; SameSite=Lax`;
    });

    try {
      const res  = await fetch(`${API_BASE}/admin/founder-dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || 'Failed to load dashboard');

      setData(json.stats || json);

      // Try to get user name
      const stored = localStorage.getItem('ark_user');
      if (stored) {
        try {
          const u = JSON.parse(stored);
          setUserName(u.full_name?.split(' ')[0] || 'Founder');
        } catch {}
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
      <RefreshCw className="animate-spin text-amber-500 mr-3" size={20} />
      <span className="text-zinc-500 font-mono text-sm">Loading command center…</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white">

      {/* Top bar */}
      <div className="border-b border-zinc-800 bg-[#050505]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
              <ShieldCheck size={14} className="text-amber-400" />
            </div>
            <div>
              <p className="text-[9px] text-amber-500 font-mono font-black tracking-widest uppercase">
                Nested Ark OS · Founder
              </p>
              <p className="text-xs font-black">Command Center</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-[10px] text-zinc-500 hidden md:block">
              Welcome, {userName}
            </p>
            <button
              onClick={load}
              className="p-2 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors">
              <RefreshCw size={12} className="text-zinc-500" />
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                document.cookie = 'ark_token=; path=/; max-age=0';
                document.cookie = 'ark_role=; path=/; max-age=0';
                window.location.href = '/founder/login';
              }}
              className="px-3 py-1.5 rounded-lg border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-red-400 hover:border-red-500/30 transition-colors">
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* Error */}
        {error && (
          <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 flex items-center gap-3">
            <AlertCircle size={14} className="text-red-400 shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={load} className="ml-auto text-[9px] text-red-400 font-black uppercase tracking-widest hover:underline">Retry</button>
          </div>
        )}

        {/* Header */}
        <div className="border-l-2 border-amber-500 pl-4">
          <p className="text-[9px] text-amber-500 font-mono font-black tracking-widest uppercase mb-1">
            Platform Administration
          </p>
          <h1 className="text-2xl font-black uppercase tracking-tighter">Founder Dashboard</h1>
          <p className="text-zinc-500 text-xs mt-1">
            {new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {data && (
          <>
            {/* TODAY */}
            <div>
              <SectionHeader icon={Activity} title="Today's Activity" color="text-teal-400" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Signups Today"       value={fmtNum(data.signups_today)}        color="text-teal-400" />
                <StatCard label="Vaults Created"      value={fmtNum(data.vaults_created_today)} color="text-teal-400" />
                <StatCard label="Contributions"       value={fmtNum(data.contributions_today)}  color="text-amber-400" />
                <StatCard label="Revenue Today"       value={fmt(data.revenue_today)}            color="text-green-400" />
              </div>
            </div>

            {/* USERS */}
            <div>
              <SectionHeader icon={Users} title="User Metrics" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Total Users"    value={fmtNum(data.total_users)}        color="text-white" />
                <StatCard label="Tenants"        value={fmtNum(data.total_tenants)}      color="text-teal-400" />
                <StatCard label="Landlords"      value={fmtNum(data.total_landlords)}    color="text-amber-400" />
                <StatCard label="Investors"      value={fmtNum(data.total_investors)}    color="text-purple-400" />
                <StatCard label="Government"     value={fmtNum(data.total_government)}   color="text-blue-400" />
                <StatCard label="Verifiers"      value={fmtNum(data.total_verifiers)}    color="text-zinc-400" />
                <StatCard label="Contractors"    value={fmtNum(data.total_contractors)}  color="text-orange-400" />
                <StatCard label="Admins"         value={fmtNum(data.total_admins)}       color="text-red-400" />
              </div>
            </div>

            {/* VAULTS */}
            <div>
              <SectionHeader icon={Building2} title="Vault Metrics" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard label="Active Vaults"     value={fmtNum(data.active_vaults)}     color="text-teal-400" />
                <StatCard label="Funded Vaults"     value={fmtNum(data.funded_vaults)}     color="text-green-400" />
                <StatCard label="Standalone Vaults" value={fmtNum(data.standalone_vaults)} color="text-zinc-400" />
              </div>
            </div>

            {/* FINANCIAL */}
            <div>
              <SectionHeader icon={DollarSign} title="Financial Snapshot" color="text-green-400" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Total Contributions" value={fmt(data.total_contributions)}    color="text-white" />
                <StatCard label="Platform Revenue"    value={fmt(data.total_platform_revenue)} color="text-green-400" />
                <StatCard label="Payouts Released"    value={fmt(data.total_payouts_released)} color="text-teal-400" />
                <StatCard label="Pending Payouts"     value={fmt(data.pending_payouts)}        color="text-amber-400" />
              </div>
            </div>

            {/* BANKING */}
            <div>
              <SectionHeader icon={CreditCard} title="Banking Metrics" color="text-purple-400" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard label="Linked Accounts"  value={fmtNum(data.linked_bank_accounts)} color="text-purple-400" />
                <StatCard label="AutoPay Enabled"  value={fmtNum(data.autopay_enabled)}      color="text-teal-400" />
                <StatCard label="AutoPay Waitlist" value={fmtNum(data.autopay_waitlist)}      color="text-zinc-400" />
              </div>
            </div>

            {/* ALERTS */}
            <div>
              <SectionHeader icon={AlertCircle} title="Alerts" color="text-red-400" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard label="Failed Payments" value={fmtNum(data.failed_payments)} alert={data.failed_payments > 0} />
                <StatCard label="Failed Payouts"  value={fmtNum(data.failed_payouts)}  alert={data.failed_payouts > 0} />
                <StatCard label="Pending KYC"     value={fmtNum(data.pending_kyc)}     alert={data.pending_kyc > 0} />
              </div>
            </div>

            {/* QUICK ACTIONS */}
            <div>
              <SectionHeader icon={Zap} title="Quick Actions" color="text-amber-400" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'View Users',        href: '/admin/users'       },
                  { label: 'View Vaults',       href: '/admin/overview'    },
                  { label: 'View Revenue',      href: '/admin/revenue'     },
                  { label: 'View Ledger',       href: '/admin/ledger'      },
                  { label: 'View Projects',     href: '/admin/projects'    },
                  { label: 'View Market',       href: '/admin/market'      },
                  { label: 'View News',         href: '/admin/news'        },
                  { label: 'View Audit Logs',   href: '/ledger'            },
                ].map(a => (
                  <Link key={a.href} href={a.href}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/20 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all group">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-amber-400 transition-colors">{a.label}</span>
                    <ArrowUpRight size={11} className="text-zinc-700 group-hover:text-amber-400 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>

            {/* PLATFORM INFO */}
            <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/10 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={12} className="text-green-400" />
                <p className="text-[9px] text-zinc-500 font-mono">
                  Nested Ark OS · Impressions &amp; Impacts Ltd · Lagos · London · Dubai
                </p>
              </div>
              <p className="text-[9px] text-zinc-700 font-mono">
                © {new Date().getFullYear()} · All rights reserved
              </p>
            </div>
          </>
        )}

        {!data && !loading && !error && (
          <div className="text-center py-20 text-zinc-600">
            <p className="font-mono text-sm">No dashboard data available.</p>
            <button onClick={load} className="mt-4 text-amber-400 text-xs font-black uppercase tracking-widest hover:underline">
              Retry
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
