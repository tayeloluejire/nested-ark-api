'use client';
export const dynamic = 'force-dynamic';

/**
 * /projects/[id]/rental-management
 * * INFRASTRUCTURE LOG:
 * ✅ Unified fetch via GET /api/rental/project/:projectId
 * ✅ Payload: { project, units, tenancies, payments, notices, summary }
 * ✅ Form Schema: POST /api/rental/units -> { project_id, unit_name, unit_type, rent_amount }
 * ✅ Navigation: Tab state synced with URL params
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
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
  { value: 'SELF_CONTAIN',   label: 'Mini-flat' },
  { value: 'ONE_BEDROOM',    label: '1-Bedroom' },
  { value: 'TWO_BEDROOM',    label: '2-Bedroom Flat' },
  { value: 'THREE_BEDROOM',  label: '3-Bedroom Flat' },
  { value: 'SHOP',           label: 'Shop/Commercial' },
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
  tenant_score?: number;
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

function RentalManagementContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab') || 'inventory';

  const [activeTab, setActiveTab] = useState(tabParam);
  const [project, setProject] = useState<any>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUnitForm, setShowUnitForm] = useState(false);

  // Register-unit form state
  const [unitForm, setUnitForm] = useState({
    unit_name: '', unit_type: 'ONE_BEDROOM', rent_amount: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState('');

  useEffect(() => {
    setActiveTab(tabParam);
  }, [tabParam]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError('');
    try {
      const res = await api.get(`/api/rental/project/${id}`);
      const d = res.data;
      setProject(d.project ?? null);
      setUnits(d.units ?? []);
      setTenancies(d.tenancies ?? []);
      setPayments(d.payments ?? []);
      setNotices(d.notices ?? []);
      setSummary(d.summary ?? null);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Could not load rental infrastructure.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const switchTab = (tab: string) => {
    setActiveTab(tab);
    router.replace(`/projects/${id}/rental-management?tab=${tab}`, { scroll: false });
  };

  const submitUnit = async () => {
    if (!unitForm.unit_name.trim() || !unitForm.rent_amount) {
      setSubmitErr('Unit label and annual rent are required.');
      return;
    }
    setSubmitting(true); setSubmitErr('');
    try {
      await api.post('/api/rental/units', {
        project_id: id,
        unit_name: unitForm.unit_name.trim(),
        unit_type: unitForm.unit_type,
        rent_amount: parseFloat(unitForm.rent_amount),
        currency: 'NGN',
      });
      setUnitForm({ unit_name: '', unit_type: 'ONE_BEDROOM', rent_amount: '' });
      setShowUnitForm(false);
      load();
    } catch (e: any) {
      setSubmitErr(e?.response?.data?.error ?? 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <div className="text-center space-y-4">
        <Loader2 className="animate-spin text-teal-500 mx-auto" size={32} />
        <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Accessing Ledger...</p>
      </div>
    </div>
  );

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 w-full space-y-8">
      {/* Header */}
      <div className="border-l-2 border-teal-500 pl-5">
        <p className="text-[9px] text-teal-500 uppercase font-black tracking-[0.25em] mb-1">Rental Node 0.3a</p>
        <h1 className="text-2xl font-black uppercase tracking-tight">Rental Command Centre</h1>
        {project && <p className="text-zinc-500 text-xs mt-1">{project.project_number} · {project.title}</p>}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 flex items-start gap-3">
          <AlertCircle size={14} className="text-red-400 mt-0.5" />
          <div className="flex-1 text-sm font-bold text-red-400">
            {error}
            <button onClick={load} className="block text-teal-500 mt-2 hover:text-white transition-colors">Retry Connection</button>
          </div>
        </div>
      )}

      {/* KPI Display */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Inventory', value: `${summary.total_units} Units`, icon: Building2, color: 'text-white' },
            { label: 'Projected', value: `₦${safeF(summary.monthly_potential_ngn)}`, icon: TrendingUp, color: 'text-teal-400' },
            { label: 'Collected', value: `₦${safeF(summary.total_collected_ngn)}`, icon: DollarSign, color: 'text-amber-400' },
            { label: 'Occupancy', value: `${summary.occupancy_rate ?? 0}%`, icon: Home, color: 'text-teal-400' },
          ].map(k => (
            <div key={k.label} className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-1">
              <k.icon size={13} className="text-zinc-600" />
              <p className={`text-xl font-black font-mono ${k.color}`}>{k.value}</p>
              <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-zinc-800 overflow-x-auto scrollbar-hide">
        {TABS.map(t => (
          <button key={t.id} onClick={() => switchTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${
              activeTab === t.id ? 'border-teal-500 text-teal-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── INVENTORY ── */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{units.length} Assets Online</p>
            <button onClick={() => { setShowUnitForm(!showUnitForm); setSubmitErr(''); }}
              className="flex items-center gap-1.5 text-[9px] text-teal-500 font-black uppercase hover:text-white">
              {showUnitForm ? <><X size={11}/> Cancel</> : <><Plus size={11}/> New Unit</>}
            </button>
          </div>

          {showUnitForm && (
            <div className="p-6 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[8px] text-zinc-500 uppercase font-black">Unit Label</label>
                  <input value={unitForm.unit_name} onChange={e => setUnitForm({...unitForm, unit_name: e.target.value})}
                    placeholder="e.g. Unit 001" className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-teal-500 outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] text-zinc-500 uppercase font-black">Architecture</label>
                  <select value={unitForm.unit_type} onChange={e => setUnitForm({...unitForm, unit_type: e.target.value})}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-teal-500 outline-none">
                    {UNIT_TYPES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] text-zinc-500 uppercase font-black">Annual Rent (₦)</label>
                  <input type="number" value={unitForm.rent_amount} onChange={e => setUnitForm({...unitForm, rent_amount: e.target.value})}
                    placeholder="0.00" className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm font-mono focus:border-teal-500 outline-none" />
                </div>
              </div>
              {submitErr && <p className="text-red-400 text-xs font-bold">{submitErr}</p>}
              <button onClick={submitUnit} disabled={submitting}
                className="w-full py-3.5 bg-teal-500 text-black font-black text-[10px] uppercase rounded-xl hover:bg-white disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <Loader2 className="animate-spin" size={13}/> : <><ShieldCheck size={13}/> Deploy Unit</>}
              </button>
            </div>
          )}

          {units.length === 0 && !showUnitForm ? (
            <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl">
              <Building2 className="text-zinc-800 mx-auto mb-4" size={40} />
              <p className="text-zinc-500 text-sm font-bold">Empty Infrastructure</p>
            </div>
          ) : (
            <div className="space-y-3">
              {units.map(u => (
                <div key={u.id} className="flex items-center justify-between p-5 rounded-2xl border border-zinc-800 bg-zinc-900/10">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${u.tenancy_status === 'ACTIVE' ? 'bg-teal-500/10 border-teal-500/20' : 'bg-zinc-900 border-zinc-800'}`}>
                      <Home size={16} className={u.tenancy_status === 'ACTIVE' ? 'text-teal-400' : 'text-zinc-600'} />
                    </div>
                    <div>
                      <p className="font-bold text-sm uppercase">{u.unit_name}</p>
                      <p className="text-[9px] text-zinc-600">{u.unit_type?.replace('_', ' ')} · <span className="text-teal-500/70 font-mono">₦{safeF(u.rent_amount)}/yr</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${u.tenancy_status === 'ACTIVE' ? 'border-teal-500/30 text-teal-500' : 'border-zinc-800 text-zinc-600'}`}>
                      {u.tenancy_status === 'ACTIVE' ? 'Occupied' : 'Vacant'}
                    </span>
                    {u.tenancy_id && (
                      <Link href={`/tenant/flex-pay/${u.tenancy_id}`} className="text-[9px] text-zinc-500 hover:text-teal-400 font-bold flex items-center gap-1">
                        VAULT <ChevronRight size={10}/>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TENANTS ── */}
      {activeTab === 'tenants' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{tenancies.length} Active Tenancies</p>
            <Link href={`/onboard?projectId=${id}`} className="flex items-center gap-1.5 text-[9px] text-teal-500 font-black uppercase">
              <Plus size={11}/> Onboard New
            </Link>
          </div>

          {tenancies.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl">
              <Users className="text-zinc-800 mx-auto mb-4" size={40} />
              <p className="text-zinc-500 text-sm font-bold">No Records Found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tenancies.map(t => (
                <div key={t.id} className="flex items-center justify-between p-5 rounded-2xl border border-zinc-800 bg-zinc-900/10">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                      <Users size={16} className="text-teal-500" />
                    </div>
                    <div>
                      <p className="font-bold text-sm uppercase">{t.tenant_name}</p>
                      <p className="text-[9px] text-zinc-500">{t.unit_name} · <span className="text-teal-500/70 font-mono">₦{safeF(t.rent_amount)}/yr</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                     {t.tenant_score !== undefined && (
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded border ${safeN(t.tenant_score) >= 70 ? 'border-teal-500/20 text-teal-500' : 'border-red-500/20 text-red-400'}`}>
                           SCORE {t.tenant_score}
                        </span>
                     )}
                     <Link href={`/tenant/flex-pay/${t.id}`} className="text-[9px] text-zinc-500 hover:text-teal-400 font-bold flex items-center gap-1">
                        VIEW VAULT <ChevronRight size={10}/>
                     </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── RECEIPTS ── */}
      {activeTab === 'receipts' && (
        <div className="space-y-4">
          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{payments.length} Transactions</p>
          {payments.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl">
               <Receipt className="text-zinc-800 mx-auto mb-4" size={40} />
               <p className="text-zinc-500 text-sm font-bold">No Payments Logged</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map(p => (
                <div key={p.id} className="flex items-center justify-between p-5 rounded-2xl border border-zinc-800 bg-zinc-900/10">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${p.status === 'SUCCESS' ? 'bg-teal-500/10' : 'bg-zinc-900'}`}>
                      {p.status === 'SUCCESS' ? <CheckCircle2 size={16} className="text-teal-400" /> : <Clock size={16} className="text-zinc-600" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm uppercase">{p.tenant_name}</p>
                      <p className="text-[9px] text-zinc-500">{p.unit_name} · {new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-teal-400">₦{safeF(p.amount_ngn)}</p>
                    <p className="text-[7px] text-zinc-600 font-bold uppercase">{p.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── LITIGATION ── */}
      {activeTab === 'litigation' && (
        <div className="space-y-4">
          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{notices.length} Legal Records</p>
          {notices.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl">
               <Gavel className="text-zinc-800 mx-auto mb-4" size={40} />
               <p className="text-zinc-500 text-sm font-bold">Clear Ledger</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notices.map(n => (
                <div key={n.id} className="flex items-center justify-between p-5 rounded-2xl border border-red-500/20 bg-red-500/5">
                  <div className="flex items-center gap-4">
                    <Gavel size={16} className="text-red-400" />
                    <div>
                      <p className="font-bold text-sm uppercase">{n.tenant_name}</p>
                      <p className="text-[9px] text-red-400/60 uppercase">{n.notice_type?.replace('_', ' ')} · {new Date(n.issued_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded border border-red-500/30 text-red-400">{n.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

export default function RentalManagementPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" /></div>}>
        <RentalManagementContent />
      </Suspense>
      <Footer />
    </div>
  );
}