'use client';
export const dynamic = 'force-dynamic';
/**
 * /projects/[id]/rental-management
 *
 * FIX SUMMARY (was causing 404s):
 *  ❌ /api/rental/project/:id/units      → ✅ /api/rental/project/:id  (single endpoint)
 *  ❌ /api/rental/project/:id/tenancies  → ✅ /api/rental/project/:id  (single endpoint)
 *  ❌ /api/rental/project/:id/receipts   → ✅ /api/rental/project/:id  (single endpoint)
 *  ❌ /api/rental/project/:id/summary    → ✅ /api/rental/project/:id  (single endpoint)
 *  ❌ POST /api/rental/units { current_rent } → ✅ { rent_amount }
 *
 * The backend exposes ONE mega endpoint: GET /api/rental/project/:projectId
 * that returns { success, project, units, tenancies, payments, distributions, summary }
 * Use that everywhere — never hit sub-paths that don't exist.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  Building2, Users, Receipt, Gavel, Loader2, AlertCircle,
  Plus, X, ChevronRight, ShieldCheck, TrendingUp, DollarSign,
  Home, CheckCircle2, Clock, RefreshCw
} from 'lucide-react';

// ── Defensive numeric helpers ────────────────────────────────────────────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();

// ── Unit type options ────────────────────────────────────────────────────────
const UNIT_TYPES = [
  { value: 'SELF_CONTAIN',  label: 'Mini-flat' },
  { value: 'ONE_BEDROOM',   label: '1-Bedroom' },
  { value: 'TWO_BEDROOM',   label: '2-Bedroom Flat' },
  { value: 'THREE_BEDROOM', label: '3-Bedroom Flat' },
  { value: 'SHOP',          label: 'Shop/Commercial' },
];

// ── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'inventory',  label: 'Inventory',  icon: Building2 },
  { id: 'tenants',    label: 'Tenants',    icon: Users },
  { id: 'receipts',   label: 'Receipts',   icon: Receipt },
  { id: 'litigation', label: 'Litigation', icon: Gavel },
];

interface Unit {
  id: string; unit_name: string; unit_type: string; rent_amount: number;
  currency: string; status: string; tenant_name?: string; tenant_email?: string;
  tenancy_status?: string; tenancy_id?: string;
}
interface Tenancy {
  id: string; tenant_name: string; tenant_email: string; unit_name: string;
  rent_amount: number; status: string; lease_start?: string; lease_end?: string;
  tenant_score?: number; notice_count?: number;
}
interface Payment {
  id: string; amount_ngn: number; status: string; created_at: string;
  tenant_name?: string; unit_name?: string; reference?: string;
}
interface Notice {
  id: string; notice_type: string; status: string; issued_at: string;
  tenant_name?: string; unit_name?: string;
}
interface Summary {
  total_units: number; occupied_units: number; vacant_units: number;
  occupancy_rate: number; total_collected_ngn: number; monthly_potential_ngn: number;
}

export default function RentalManagementPage() {
  const { id }          = useParams<{ id: string }>();
  const searchParams    = useSearchParams();
  const router          = useRouter();
  const tabParam        = searchParams.get('tab') || 'inventory';

  const [activeTab,   setActiveTab]   = useState(tabParam);
  const [project,     setProject]     = useState<any>(null);
  const [units,       setUnits]       = useState<Unit[]>([]);
  const [tenancies,   setTenancies]   = useState<Tenancy[]>([]);
  const [payments,    setPayments]    = useState<Payment[]>([]);
  const [notices,     setNotices]     = useState<Notice[]>([]);
  const [summary,     setSummary]     = useState<Summary | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [showUnitForm, setShowUnitForm] = useState(false);

  // Register-unit form state
  const [unitForm, setUnitForm] = useState({
    unit_name: '', unit_type: 'ONE_BEDROOM', rent_amount: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState('');

  // ── Sync tab with URL param ────────────────────────────────────────────────
  useEffect(() => {
    setActiveTab(tabParam);
  }, [tabParam]);

  // ── Single fetch — correct endpoint ───────────────────────────────────────
  // GET /api/rental/project/:projectId returns everything in one shot:
  // { success, project, units, tenancies, payments, distributions, summary }
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError('');
    try {
      const res = await api.get(`/api/rental/project/${id}`);
      const d   = res.data;
      setProject(d.project   ?? null);
      setUnits(d.units       ?? []);
      setTenancies(d.tenancies ?? []);
      setPayments(d.payments  ?? []);
      setNotices(d.notices    ?? []);
      setSummary(d.summary    ?? null);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Could not load rental data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Tab change helper — keeps URL in sync ─────────────────────────────────
  const switchTab = (tab: string) => {
    setActiveTab(tab);
    router.replace(`/projects/${id}/rental-management?tab=${tab}`, { scroll: false });
  };

  // ── Register unit — correct fields: project_id, unit_name, rent_amount ────
  const submitUnit = async () => {
    if (!unitForm.unit_name.trim() || !unitForm.rent_amount) {
      setSubmitErr('Unit label and annual rent are required.');
      return;
    }
    setSubmitting(true); setSubmitErr('');
    try {
      await api.post('/api/rental/units', {
        project_id:  id,
        unit_name:   unitForm.unit_name.trim(),
        unit_type:   unitForm.unit_type,
        rent_amount: parseFloat(unitForm.rent_amount),
        currency:    'NGN',
      });
      setUnitForm({ unit_name: '', unit_type: 'ONE_BEDROOM', rent_amount: '' });
      setShowUnitForm(false);
      load();
    } catch (e: any) {
      setSubmitErr(e?.response?.data?.error ?? 'Failed to register unit.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="flex items-center justify-center py-40">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-teal-500 mx-auto" size={32} />
          <p className="text-zinc-500 text-sm uppercase font-bold tracking-widest">Loading Rental Command…</p>
        </div>
      </div>
      <Footer />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-6 py-10 w-full space-y-8">

        {/* Header */}
        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 uppercase font-black tracking-[0.25em] mb-1">Rental Node 0.3a</p>
          <h1 className="text-2xl font-black uppercase tracking-tight">Rental Command Centre</h1>
          {project && (
            <p className="text-zinc-500 text-xs mt-1">{project.project_number} · {project.title}</p>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 flex items-start gap-3">
            <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-400 text-sm font-bold">{error}</p>
              <button onClick={load} className="text-teal-500 text-xs font-bold mt-2 hover:text-white transition-colors flex items-center gap-1">
                <RefreshCw size={10} /> Retry
              </button>
            </div>
          </div>
        )}

        {/* KPI Row */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Global Inventory',   value: `${summary.total_units} UNITS`,     icon: Building2,   color: 'text-white' },
              { label: 'Projected Revenue',  value: `₦${safeF(summary.monthly_potential_ngn)}`, icon: TrendingUp, color: 'text-teal-400' },
              { label: 'Collected',          value: `₦${safeF(summary.total_collected_ngn)}`,   icon: DollarSign, color: 'text-amber-400' },
              { label: 'Occupancy',          value: `${summary.occupancy_rate ?? 0}%`,  icon: Home,        color: 'text-teal-400' },
            ].map(k => {
              const Icon = k.icon;
              return (
                <div key={k.label} className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-1">
                  <Icon size={13} className="text-zinc-600" />
                  <p className={`text-xl font-black font-mono tabular-nums ${k.color}`}>{k.value}</p>
                  <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{k.label}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => switchTab(t.id)}
                className={`flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all ${
                  active ? 'border-teal-500 text-teal-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}>
                <Icon size={12} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* ── TAB: INVENTORY ─────────────────────────────────────────────────── */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            {/* Register unit form toggle */}
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
                {units.length} unit{units.length !== 1 ? 's' : ''} registered
              </p>
              <button onClick={() => { setShowUnitForm(v => !v); setSubmitErr(''); }}
                className="flex items-center gap-1.5 text-[9px] text-teal-500 font-black uppercase hover:text-white transition-colors">
                {showUnitForm ? <><X size={11} /> Cancel</> : <><Plus size={11} /> Register New Unit</>}
              </button>
            </div>

            {/* Register unit form */}
            {showUnitForm && (
              <div className="p-5 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-4">
                <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest">Register Unit</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[8px] text-zinc-500 uppercase font-bold">Label / Identifier</label>
                    <input value={unitForm.unit_name}
                      onChange={e => setUnitForm(f => ({ ...f, unit_name: e.target.value }))}
                      placeholder="e.g. Flat 3B, Shop 2"
                      className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] text-zinc-500 uppercase font-bold">Architecture Type</label>
                    <select value={unitForm.unit_type}
                      onChange={e => setUnitForm(f => ({ ...f, unit_type: e.target.value }))}
                      className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none">
                      {UNIT_TYPES.map(u => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] text-zinc-500 uppercase font-bold">Annual Reserve (₦)</label>
                    <input type="number" value={unitForm.rent_amount}
                      onChange={e => setUnitForm(f => ({ ...f, rent_amount: e.target.value }))}
                      placeholder="e.g. 600000"
                      className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-teal-500 outline-none" />
                  </div>
                </div>
                {submitErr && (
                  <p className="text-red-400 text-xs font-bold">{submitErr}</p>
                )}
                <button onClick={submitUnit} disabled={submitting}
                  className="w-full py-3.5 bg-teal-500 text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-white transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="animate-spin" size={13} /> : <><ShieldCheck size={13} /> Deploy to Ledger</>}
                </button>
              </div>
            )}

            {/* Units list */}
            {units.length === 0 && !showUnitForm ? (
              <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
                <Building2 className="text-zinc-700 mx-auto" size={40} />
                <div>
                  <p className="text-zinc-400 font-bold">Infrastructure Empty</p>
                  <p className="text-zinc-600 text-sm mt-1">Register your first unit to activate the Rental Engine</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 text-[8px] text-zinc-600 uppercase font-bold">
                  {['Tri-Layer Secure Engine', 'Real-Time Yield Oracle'].map(b => (
                    <span key={b} className="flex items-center gap-1 border border-zinc-800 px-3 py-1.5 rounded-lg">
                      <ShieldCheck size={9} className="text-teal-500/50" /> {b}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {units.map(u => (
                  <div key={u.id}
                    className="flex items-center justify-between p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                        u.tenancy_status === 'ACTIVE' ? 'bg-teal-500/10 border-teal-500/30' : 'bg-zinc-800 border-zinc-700'
                      }`}>
                        <Home size={16} className={u.tenancy_status === 'ACTIVE' ? 'text-teal-400' : 'text-zinc-600'} />
                      </div>
                      <div>
                        <p className="font-bold text-sm uppercase tracking-tight">{u.unit_name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-[9px] text-zinc-500">{u.unit_type?.replace('_', ' ')}</p>
                          <span className="text-[9px] text-teal-400 font-mono">₦{safeF(u.rent_amount)}/yr</span>
                          {u.tenant_name && (
                            <span className="text-[8px] text-zinc-500">· {u.tenant_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${
                        u.tenancy_status === 'ACTIVE'
                          ? 'border-teal-500/40 text-teal-500'
                          : 'border-zinc-700 text-zinc-500'
                      }`}>
                        {u.tenancy_status === 'ACTIVE' ? 'Occupied' : 'Vacant'}
                      </span>
                      {u.tenancy_id && (
                        <Link href={`/tenant/flex-pay/${u.tenancy_id}`}
                          className="text-[8px] text-zinc-500 hover:text-teal-500 font-bold uppercase transition-colors flex items-center gap-1">
                          Vault <ChevronRight size={10} />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: TENANTS ───────────────────────────────────────────────────── */}
        {activeTab === 'tenants' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
                {tenancies.length} tenant{tenancies.length !== 1 ? 's' : ''} on ledger
              </p>
              <Link href={`/projects/${id}/rental-management/onboard`}
                className="flex items-center gap-1.5 text-[9px] text-teal-500 font-black uppercase hover:text-white transition-colors">
                <Plus size={11} /> Onboard Tenant
              </Link>
            </div>

            {tenancies.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
                <Users className="text-zinc-700 mx-auto" size={40} />
                <div>
                  <p className="text-zinc-400 font-bold">No tenants yet</p>
                  <p className="text-zinc-600 text-sm mt-1">Onboard your first tenant to activate Flex-Pay vaults</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {tenancies.map((t: Tenancy) => (
                  <div key={t.id}
                    className="flex items-center justify-between p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                        <Users size={16} className="text-teal-500" />
                      </div>
                      <div>
                        <p className="font-bold text-sm uppercase tracking-tight">{t.tenant_name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-[9px] text-zinc-500">{t.tenant_email}</p>
                          <span className="text-[9px] text-zinc-600">· {t.unit_name}</span>
                          <span className="text-[9px] text-teal-400 font-mono">₦{safeF(t.rent_amount)}/yr</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {t.tenant_score !== undefined && (
                        <span className={`text-[8px] px-2 py-0.5 rounded border font-bold ${
                          safeN(t.tenant_score) >= 80 ? 'border-teal-500/40 text-teal-500' :
                          safeN(t.tenant_score) >= 50 ? 'border-amber-500/40 text-amber-400' :
                          'border-red-500/40 text-red-400'
                        }`}>
                          Score {t.tenant_score}
                        </span>
                      )}
                      <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${
                        t.status === 'ACTIVE' ? 'border-teal-500/40 text-teal-500' : 'border-zinc-700 text-zinc-500'
                      }`}>{t.status}</span>
                      <Link href={`/tenant/flex-pay/${t.id}`}
                        className="flex items-center gap-1 text-[9px] text-zinc-500 hover:text-teal-500 font-bold uppercase transition-colors">
                        Vault <ChevronRight size={10} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: RECEIPTS ──────────────────────────────────────────────────── */}
        {activeTab === 'receipts' && (
          <div className="space-y-4">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
              {payments.filter(p => p.status === 'SUCCESS' || p.status === 'DISTRIBUTED').length} successful payments
            </p>

            {payments.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
                <Receipt className="text-zinc-700 mx-auto" size={40} />
                <div>
                  <p className="text-zinc-400 font-bold">No payments recorded yet</p>
                  <p className="text-zinc-600 text-sm mt-1">Receipts appear here when tenants pay through Flex-Pay vaults</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((p: Payment) => (
                  <div key={p.id}
                    className="flex items-center justify-between p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                        p.status === 'SUCCESS' || p.status === 'DISTRIBUTED'
                          ? 'bg-teal-500/10 border-teal-500/30'
                          : 'bg-zinc-800 border-zinc-700'
                      }`}>
                        {p.status === 'SUCCESS' || p.status === 'DISTRIBUTED'
                          ? <CheckCircle2 size={16} className="text-teal-400" />
                          : <Clock size={16} className="text-zinc-600" />
                        }
                      </div>
                      <div>
                        <p className="font-bold text-sm">{p.tenant_name ?? 'Tenant'}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {p.unit_name && <span className="text-[9px] text-zinc-500">{p.unit_name}</span>}
                          <span className="text-[9px] text-zinc-600 font-mono">
                            {new Date(p.created_at).toLocaleDateString()}
                          </span>
                          {p.reference && (
                            <span className="text-[8px] text-zinc-700 font-mono">{p.reference}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      <p className="font-mono font-bold text-lg text-teal-400">₦{safeF(p.amount_ngn)}</p>
                      <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${
                        p.status === 'SUCCESS' || p.status === 'DISTRIBUTED'
                          ? 'border-teal-500/30 text-teal-500'
                          : 'border-zinc-700 text-zinc-500'
                      }`}>{p.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: LITIGATION ────────────────────────────────────────────────── */}
        {activeTab === 'litigation' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
                {notices.length} notice{notices.length !== 1 ? 's' : ''} issued
              </p>
            </div>

            {notices.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
                <Gavel className="text-zinc-700 mx-auto" size={40} />
                <div>
                  <p className="text-zinc-400 font-bold">No legal notices issued</p>
                  <p className="text-zinc-600 text-sm mt-1">Notices are issued automatically when tenants breach payment terms</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {notices.map((n: Notice) => (
                  <div key={n.id}
                    className="flex items-center justify-between p-5 rounded-2xl border border-red-500/20 bg-red-500/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                        <Gavel size={16} className="text-red-400" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{n.tenant_name ?? 'Tenant'}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {n.unit_name && <span className="text-[9px] text-zinc-500">{n.unit_name}</span>}
                          <span className="text-[9px] text-red-400/80 font-mono uppercase">{n.notice_type?.replace('_', ' ')}</span>
                          <span className="text-[9px] text-zinc-600">
                            {new Date(n.issued_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase flex-shrink-0 ${
                      n.status === 'ISSUED' ? 'border-red-500/40 text-red-400' :
                      n.status === 'RESOLVED' ? 'border-teal-500/40 text-teal-500' :
                      'border-zinc-700 text-zinc-500'
                    }`}>{n.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}
