'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {

// ── Defensive numeric helpers — never crash on undefined/null/NaN ──────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any, fallback = '0'): string => safeN(v).toLocaleString();
const safeD = (v: any, d = 2): string => safeN(v).toFixed(d);

  Home, Plus, Users, DollarSign, TrendingUp, Key,
  Loader2, AlertCircle, ArrowLeft, ArrowRight,
  Building2, RefreshCw, X, Calendar, ShieldCheck,
  Wrench, Settings, CheckCircle2
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────
interface Unit {
  id: string; unit_name: string; unit_type: string; bedrooms: number;
  rent_amount: number; currency: string; status: string;
  tenant_name?: string; tenancy_id?: string; tenancy_status?: string;
}
interface Tenancy {
  id: string; unit_id: string; tenant_name: string; tenant_email: string;
  tenant_phone?: string; lease_start: string; lease_end?: string;
  rent_amount: number; currency: string; status: string;
}
interface Payment {
  id: string; amount_ngn: number; status: string;
  period_month: string; paid_at: string; distributed_at?: string;
}
interface Distribution {
  id: string; recipient_role: string; recipient_name: string;
  amount_ngn: number; share_pct: number; full_name?: string;
  distributed_at: string; period_month?: string;
}
interface Split {
  id?: string; role: string; share_pct: number;
  description?: string; user_id?: string;
}

const UNIT_ICONS: Record<string, string> = {
  APARTMENT: '🏠', STUDIO: '🛏️', ROOM: '🪟', SHOP: '🏪', OFFICE: '🏢', WAREHOUSE: '🏭',
};
const UNIT_TYPES = ['APARTMENT', 'STUDIO', 'ROOM', 'SHOP', 'OFFICE', 'WAREHOUSE'];
const ROLE_COLORS: Record<string, string> = {
  INVESTOR:            'border-teal-500/30 text-teal-400 bg-teal-500/5',
  OWNER:               'border-amber-500/30 text-amber-400 bg-amber-500/5',
  FACILITY_MANAGER:    'border-blue-500/30 text-blue-400 bg-blue-500/5',
  PLATFORM:            'border-purple-500/30 text-purple-400 bg-purple-500/5',
  MAINTENANCE_RESERVE: 'border-zinc-600 text-zinc-400 bg-zinc-800/30',
};
const STATUS_DOT: Record<string, string> = {
  OCCUPIED:    'bg-teal-500',
  VACANT:      'bg-zinc-600',
  MAINTENANCE: 'bg-amber-500',
};

export default function RentalDashboardPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { user } = useAuth();

  const [data,         setData]         = useState<any>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [tab,          setTab]          = useState<'units' | 'tenancies' | 'payments' | 'splits' | 'maintenance'>('units');
  const [saving,       setSaving]       = useState(false);
  const [saveErr,      setSaveErr]      = useState('');
  const [payLink,      setPayLink]      = useState('');

  // Modal state
  const [showAddUnit, setShowAddUnit]   = useState(false);
  const [showAddTen,  setShowAddTen]    = useState(false);
  const [showSplits,  setShowSplits]    = useState(false);
  const [selUnit,     setSelUnit]       = useState<Unit | null>(null);

  // Forms
  const blankUnit = { unit_name: '', unit_type: 'APARTMENT', bedrooms: '1', rent_amount: '', currency: 'NGN', description: '' };
  const blankTen  = { tenant_name: '', tenant_email: '', tenant_phone: '', lease_start: '', lease_end: '', rent_amount: '', payment_day: '1', notes: '' };
  const [unitForm, setUF] = useState(blankUnit);
  const [tenForm,  setTF] = useState(blankTen);
  const [splits,   setSplits] = useState<Split[]>([
    { role: 'INVESTOR', share_pct: 60 }, { role: 'OWNER', share_pct: 25 },
    { role: 'FACILITY_MANAGER', share_pct: 8 }, { role: 'PLATFORM', share_pct: 5 },
    { role: 'MAINTENANCE_RESERVE', share_pct: 2 },
  ]);

  // Maintenance form
  const blankMaint = { title: '', description: '', category: 'GENERAL', severity: 'LOW', cost_ngn: '' };
  const [maintForm, setMF] = useState(blankMaint);
  const [showMaint, setShowMaint] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true); setError('');
    try {
      const [dashRes, splitRes] = await Promise.all([
        api.get(`/api/rental/project/${id}`),
        api.get(`/api/rental/stakeholders/${id}`).catch(() => ({ data: { splits: [] } })),
      ]);
      setData(dashRes.data);
      if (splitRes.data.splits?.length > 0) setSplits(splitRes.data.splits);
    } catch (ex: any) {
      setError(ex?.response?.data?.error ?? 'Could not load rental data.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const addUnit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setSaveErr('');
    try {
      await api.post('/api/rental/units', { project_id: id, ...unitForm, rent_amount: parseFloat(unitForm.rent_amount), bedrooms: parseInt(unitForm.bedrooms) });
      setShowAddUnit(false); setUF(blankUnit); load();
    } catch (ex: any) { setSaveErr(ex?.response?.data?.error ?? 'Failed.'); }
    finally { setSaving(false); }
  };

  const addTenancy = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selUnit) return;
    setSaving(true); setSaveErr('');
    try {
      await api.post('/api/rental/tenancies', {
        unit_id: selUnit.id, ...tenForm,
        rent_amount: parseFloat(tenForm.rent_amount || String(selUnit.rent_amount)),
        currency: selUnit.currency,
        payment_day: parseInt(tenForm.payment_day),
      });
      setShowAddTen(false); setSelUnit(null); setTF(blankTen); load();
    } catch (ex: any) { setSaveErr(ex?.response?.data?.error ?? 'Failed.'); }
    finally { setSaving(false); }
  };

  const saveSplits = async () => {
    setSaving(true); setSaveErr('');
    const total = splits.reduce((s, r) => s + Number(r.share_pct), 0);
    if (Math.abs(total - 100) > 0.1) { setSaveErr(`Splits must total 100%. Current: ${safeD(total, 1)}%`); setSaving(false); return; }
    try {
      await api.post('/api/rental/stakeholders', { project_id: id, splits });
      setShowSplits(false); load();
    } catch (ex: any) { setSaveErr(ex?.response?.data?.error ?? 'Failed.'); }
    finally { setSaving(false); }
  };

  const collectRent = async (tenancyId: string) => {
    setSaving(true); setSaveErr(''); setPayLink('');
    try {
      const res = await api.post('/api/rental/payments/initialize', {
        tenancy_id: tenancyId,
        period_month: new Date().toISOString().slice(0, 7),
      });
      setPayLink(res.data.authorization_url);
    } catch (ex: any) { setSaveErr(ex?.response?.data?.error ?? 'Could not generate link.'); }
    finally { setSaving(false); }
  };

  const logMaintenance = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setSaveErr('');
    try {
      await api.post('/api/maintenance', { project_id: id, ...maintForm, cost_ngn: maintForm.cost_ngn ? parseFloat(maintForm.cost_ngn) : null });
      setShowMaint(false); setMF(blankMaint); load();
    } catch (ex: any) { setSaveErr(ex?.response?.data?.error ?? 'Failed.'); }
    finally { setSaving(false); }
  };

  const inp  = "w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors";
  const lbl  = "text-[9px] text-zinc-500 uppercase font-bold tracking-widest block mb-1.5";
  const sel  = inp + " cursor-pointer";

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="flex items-center justify-center py-40">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
      <Footer />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="max-w-xl mx-auto px-6 py-40 text-center space-y-4">
        <AlertCircle className="text-red-400 mx-auto" size={40} />
        <p className="text-white font-bold">{error || 'Rental data unavailable'}</p>
        <button onClick={load} className="px-6 py-3 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl">Retry</button>
      </div>
      <Footer />
    </div>
  );

  const { units, tenancies, payments, distributions, summary, config, project } = data;
  const splitTotal = splits.reduce((s, r) => s + Number(r.share_pct), 0);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-12">

        {/* Back */}
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-8">
          <ArrowLeft size={13} /> Back to Project
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-8 flex-wrap">
          <div className="border-l-2 border-teal-500 pl-5">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase">
                {project?.project_number}
              </p>
              <span className="text-[8px] px-2 py-0.5 rounded border border-teal-500/30 text-teal-400 font-bold uppercase">
                OPERATIONAL
              </span>
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Rental Command Centre</h1>
            <p className="text-zinc-500 text-xs mt-1">
              {project?.title} · units, tenants, yield distribution &amp; maintenance
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={load}
              className="flex items-center gap-1.5 px-4 py-2 border border-zinc-700 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all">
              <RefreshCw size={11} /> Refresh
            </button>
            <button onClick={() => setShowMaint(true)}
              className="flex items-center gap-1.5 px-4 py-2 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs font-bold uppercase tracking-widest rounded-xl transition-all">
              <Wrench size={11} /> Log Maintenance
            </button>
            <button onClick={() => setShowSplits(true)}
              className="flex items-center gap-1.5 px-4 py-2 border border-zinc-700 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all">
              <Settings size={11} /> Edit Splits
            </button>
            <button onClick={() => setShowAddUnit(true)}
              className="flex items-center gap-1.5 px-5 py-2 bg-teal-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all">
              <Plus size={11} /> Add Unit
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Units',        value: summary.total_units,           icon: Building2,  color: 'text-white' },
            { label: `Occupied (${summary.occupancy_rate}%)`, value: summary.occupied_units, icon: Key, color: 'text-teal-400' },
            { label: 'Monthly Potential',  value: `₦${safeF(summary.monthly_potential_ngn)}`, icon: TrendingUp, color: 'text-amber-400' },
            { label: 'Total Distributed',  value: `₦${safeF(summary.total_collected_ngn)}`,  icon: DollarSign, color: 'text-emerald-400' },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-2">
                <Icon size={14} className="text-zinc-600" />
                <p className={`text-2xl font-black font-mono tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s.label}</p>
              </div>
            );
          })}
        </div>

        {/* Split indicator */}
        <div className="mb-8 p-4 rounded-xl border border-zinc-800 bg-zinc-900/10 flex flex-wrap items-center gap-5">
          <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest flex-shrink-0">Yield split per payment:</span>
          {splits.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className={`text-sm font-black font-mono ${ROLE_COLORS[s.role]?.split(' ')[1] ?? 'text-zinc-400'}`}>
                {s.share_pct}%
              </span>
              <span className="text-[9px] text-zinc-600">{s.role.replace('_', ' ')}</span>
            </div>
          ))}
          <span className={`ml-auto text-[9px] font-bold font-mono ${Math.abs(splitTotal - 100) < 0.1 ? 'text-teal-400' : 'text-red-400'}`}>
            {safeD(splitTotal, 1)}% total
          </span>
        </div>

        {/* Alerts */}
        {saveErr && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-bold flex items-start gap-2 mb-6">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> {saveErr}
          </div>
        )}
        {payLink && (
          <div className="p-5 rounded-2xl border border-teal-500/30 bg-teal-500/5 mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-teal-400 text-sm font-bold flex items-center gap-2">
                <CheckCircle2 size={14} /> Payment link ready — share with tenant
              </p>
              <button onClick={() => setPayLink('')}><X size={14} className="text-zinc-500" /></button>
            </div>
            <div className="flex gap-3 flex-wrap">
              <a href={payLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all">
                Open Paystack <ArrowRight size={11} />
              </a>
              <button onClick={() => { navigator.clipboard.writeText(payLink); }}
                className="px-5 py-2.5 border border-zinc-700 text-zinc-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:border-teal-500 hover:text-white transition-all">
                Copy Link
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800 mb-8 overflow-x-auto">
          {[
            { key: 'units',       label: `Units (${units.length})` },
            { key: 'tenancies',   label: `Tenancies (${tenancies.length})` },
            { key: 'payments',    label: `Payments (${payments.length})` },
            { key: 'splits',      label: 'Yield Splits' },
            { key: 'maintenance', label: 'Maintenance' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-5 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                tab === t.key ? 'border-teal-500 text-teal-500' : 'border-transparent text-zinc-500 hover:text-white'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── UNITS ──────────────────────────────────────────────────────── */}
        {tab === 'units' && (
          <div>
            {units.length === 0 ? (
              <div className="py-24 text-center border border-dashed border-zinc-800 rounded-2xl space-y-5">
                <Home className="text-zinc-700 mx-auto" size={40} />
                <div>
                  <p className="text-zinc-400 font-bold">No rental units yet</p>
                  <p className="text-zinc-600 text-sm mt-1">Add the lettable spaces in this property</p>
                </div>
                <button onClick={() => setShowAddUnit(true)}
                  className="px-6 py-3 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all inline-flex items-center gap-2">
                  <Plus size={12} /> Add First Unit
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {units.map((unit: Unit) => (
                  <div key={unit.id} className={`p-6 rounded-2xl border transition-all ${
                    unit.tenancy_status === 'ACTIVE'
                      ? 'border-teal-500/25 bg-teal-500/5'
                      : 'border-zinc-800 bg-zinc-900/20'
                  }`}>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-2xl leading-none flex-shrink-0">
                          {UNIT_ICONS[unit.unit_type] ?? '🏗️'}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <p className="font-bold text-sm">{unit.unit_name}</p>
                            <span className="flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[unit.status] ?? 'bg-zinc-600'}`} />
                              <span className="text-[8px] text-zinc-500 uppercase font-bold">{unit.status}</span>
                            </span>
                          </div>
                          <p className="text-[9px] text-zinc-500">{unit.unit_type} · {unit.bedrooms} bed{unit.bedrooms !== 1 ? 's' : ''}</p>
                          {unit.tenant_name && (
                            <p className="text-[9px] text-teal-400 font-bold mt-1">
                              <Users size={9} className="inline mr-1" />{unit.tenant_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-mono font-bold text-xl text-teal-400">
                          ₦{safeF(unit.rent_amount)}
                        </p>
                        <p className="text-[8px] text-zinc-600 uppercase font-bold">/ month</p>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-zinc-800/50">
                      {unit.status === 'VACANT' ? (
                        <button
                          onClick={() => { setSelUnit(unit); setTF(f => ({...f, rent_amount: String(unit.rent_amount)})); setShowAddTen(true); }}
                          className="w-full py-2.5 bg-teal-500/10 border border-teal-500/30 text-teal-400 font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-teal-500 hover:text-black transition-all flex items-center justify-center gap-1.5">
                          <Users size={10} /> Assign Tenant
                        </button>
                      ) : (
                        <button
                          onClick={() => { if (unit.tenancy_id) collectRent(unit.tenancy_id); }}
                          disabled={saving}
                          className="w-full py-2.5 bg-white/5 border border-zinc-700 text-zinc-300 font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-teal-500 hover:text-black hover:border-teal-500 transition-all flex items-center justify-center gap-1.5">
                          {saving ? <Loader2 size={10} className="animate-spin" /> : <DollarSign size={10} />}
                          Collect Rent
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TENANCIES ──────────────────────────────────────────────────── */}
        {tab === 'tenancies' && (
          <div className="space-y-3">
            {tenancies.length === 0 ? (
              <div className="py-16 text-center text-zinc-600">
                No tenancies yet. Assign tenants from the Units tab.
              </div>
            ) : tenancies.map((t: Tenancy) => (
              <div key={t.id} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex items-center justify-between gap-4 flex-wrap">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm">{t.tenant_name}</p>
                    <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${
                      t.status === 'ACTIVE' ? 'border-teal-500/30 text-teal-400' : 'border-zinc-700 text-zinc-500'
                    }`}>{t.status}</span>
                  </div>
                  <p className="text-[9px] text-zinc-500 font-mono">{t.tenant_email}{t.tenant_phone ? ` · ${t.tenant_phone}` : ''}</p>
                  <p className="text-[9px] text-zinc-600 flex items-center gap-1">
                    <Calendar size={9} /> {t.lease_start}{t.lease_end ? ` → ${t.lease_end}` : ' (open-ended)'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-xl text-teal-400">₦{safeF(t.rent_amount)}</p>
                  <p className="text-[8px] text-zinc-600 uppercase font-bold">/ month</p>
                </div>
                <button onClick={() => collectRent(t.id)} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-500 text-black font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-white transition-all disabled:opacity-50">
                  {saving ? <Loader2 size={10} className="animate-spin" /> : <DollarSign size={10} />}
                  Collect Rent
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── PAYMENTS ───────────────────────────────────────────────────── */}
        {tab === 'payments' && (
          <div className="space-y-3">
            {payments.length === 0 ? (
              <div className="py-16 text-center text-zinc-600">No payments yet.</div>
            ) : payments.map((p: Payment) => (
              <div key={p.id} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${
                      p.status === 'DISTRIBUTED' ? 'border-emerald-500/30 text-emerald-400'
                      : p.status === 'SUCCESS'   ? 'border-teal-500/30 text-teal-400'
                      : p.status === 'PENDING'   ? 'border-amber-500/30 text-amber-400'
                      : 'border-red-500/30 text-red-400'
                    }`}>{p.status}</span>
                    <span className="text-[9px] text-zinc-500 font-mono">{p.period_month}</span>
                  </div>
                  {p.paid_at && <p className="text-[9px] text-zinc-600">{new Date(p.paid_at).toLocaleDateString()}</p>}
                  {p.distributed_at && (
                    <p className="text-[9px] text-teal-600 flex items-center gap-1">
                      <CheckCircle2 size={9} /> Yield distributed {new Date(p.distributed_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <p className="font-mono font-bold text-xl text-white">₦{safeF(p.amount_ngn)}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── SPLITS ─────────────────────────────────────────────────────── */}
        {tab === 'splits' && (
          <div className="space-y-4">
            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/20 space-y-3">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
                Current yield distribution — applied to every successful rent payment
              </p>
              {splits.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className={`text-[8px] px-2 py-1 rounded border font-bold uppercase flex-shrink-0 w-40 ${ROLE_COLORS[s.role] ?? 'border-zinc-700 text-zinc-400'}`}>
                    {s.role.replace(/_/g, ' ')}
                  </span>
                  <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${s.share_pct}%` }} />
                  </div>
                  <span className="font-mono font-bold text-white text-sm w-12 text-right">{s.share_pct}%</span>
                </div>
              ))}
              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-[9px] text-zinc-500">Total</span>
                <span className={`font-mono font-bold text-sm ${Math.abs(splitTotal - 100) < 0.1 ? 'text-teal-400' : 'text-red-400'}`}>
                  {safeD(splitTotal, 1)}%
                </span>
              </div>
            </div>
            <button onClick={() => setShowSplits(true)}
              className="flex items-center gap-2 px-5 py-3 border border-zinc-700 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all">
              <Settings size={12} /> Customise Splits
            </button>

            {/* Recent distributions */}
            {distributions?.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Recent distributions</p>
                {distributions.slice(0, 10).map((d: Distribution) => (
                  <div key={d.id} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${ROLE_COLORS[d.recipient_role] ?? 'border-zinc-700 text-zinc-400'}`}>
                        {d.recipient_role.replace(/_/g, ' ')}
                      </span>
                      <p className="text-xs text-zinc-300">{d.full_name || d.recipient_name}</p>
                    </div>
                    <p className="font-mono font-bold text-teal-400">₦{safeF(d.amount_ngn)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MAINTENANCE ────────────────────────────────────────────────── */}
        {tab === 'maintenance' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Asset Health Score</p>
                <p className={`text-4xl font-black font-mono mt-1 ${
                  (project?.asset_health_score ?? 100) >= 80 ? 'text-teal-400'
                  : (project?.asset_health_score ?? 100) >= 50 ? 'text-amber-400'
                  : 'text-red-400'
                }`}>{project?.asset_health_score ?? 100}<span className="text-lg text-zinc-600">/100</span></p>
              </div>
              <button onClick={() => setShowMaint(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-bold text-xs uppercase tracking-widest rounded-xl transition-all">
                <Plus size={11} /> Log Issue
              </button>
            </div>
            <p className="text-[9px] text-zinc-600 leading-relaxed">
              Asset health decreases with each maintenance issue logged. Resolved issues help restore the score.
              High scores signal a well-maintained property and can improve valuation.
            </p>
          </div>
        )}

      </main>

      {/* ── ADD UNIT MODAL ──────────────────────────────────────────────── */}
      {showAddUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-black uppercase tracking-tight text-lg">Add Rental Unit</h2>
              <button onClick={() => { setShowAddUnit(false); setSaveErr(''); }}><X size={18} className="text-zinc-500" /></button>
            </div>
            {saveErr && <p className="text-red-400 text-xs font-bold">{saveErr}</p>}
            <form onSubmit={addUnit} className="space-y-4">
              <div>
                <label className={lbl}>Unit Name *</label>
                <input required value={unitForm.unit_name} onChange={e => setUF(f => ({...f, unit_name: e.target.value}))}
                  placeholder="Flat 1A, Shop B, Studio 3…" className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Type</label>
                  <select value={unitForm.unit_type} onChange={e => setUF(f => ({...f, unit_type: e.target.value}))} className={sel}>
                    {UNIT_TYPES.map(t => <option key={t}>{UNIT_ICONS[t]} {t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Bedrooms</label>
                  <input type="number" min="0" max="20" value={unitForm.bedrooms}
                    onChange={e => setUF(f => ({...f, bedrooms: e.target.value}))} className={inp} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Monthly Rent *</label>
                  <input required type="number" min="0" placeholder="250000"
                    value={unitForm.rent_amount} onChange={e => setUF(f => ({...f, rent_amount: e.target.value}))} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Currency</label>
                  <select value={unitForm.currency} onChange={e => setUF(f => ({...f, currency: e.target.value}))} className={sel}>
                    {['NGN','USD','GBP','EUR'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>Description</label>
                <textarea rows={2} value={unitForm.description}
                  onChange={e => setUF(f => ({...f, description: e.target.value}))}
                  placeholder="Furnished, 2 bathrooms, balcony…" className={inp + " resize-none"} />
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-3.5 bg-teal-500 text-black font-black uppercase text-xs tracking-widest rounded-xl hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Add Unit
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD TENANCY MODAL ───────────────────────────────────────────── */}
      {showAddTen && selUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-black uppercase tracking-tight text-lg">Assign Tenant</h2>
                <p className="text-zinc-500 text-xs mt-0.5">{selUnit.unit_name}</p>
              </div>
              <button onClick={() => { setShowAddTen(false); setSaveErr(''); }}><X size={18} className="text-zinc-500" /></button>
            </div>
            {saveErr && <p className="text-red-400 text-xs font-bold">{saveErr}</p>}
            <form onSubmit={addTenancy} className="space-y-4">
              <div>
                <label className={lbl}>Tenant Full Name *</label>
                <input required value={tenForm.tenant_name}
                  onChange={e => setTF(f => ({...f, tenant_name: e.target.value}))}
                  placeholder="Legal name" className={inp} />
              </div>
              <div>
                <label className={lbl}>Email *</label>
                <input required type="email" value={tenForm.tenant_email}
                  onChange={e => setTF(f => ({...f, tenant_email: e.target.value}))}
                  placeholder="tenant@example.com" className={inp} />
              </div>
              <div>
                <label className={lbl}>Phone</label>
                <input value={tenForm.tenant_phone}
                  onChange={e => setTF(f => ({...f, tenant_phone: e.target.value}))}
                  placeholder="+234…" className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Lease Start *</label>
                  <input required type="date" value={tenForm.lease_start}
                    onChange={e => setTF(f => ({...f, lease_start: e.target.value}))} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Lease End</label>
                  <input type="date" value={tenForm.lease_end}
                    onChange={e => setTF(f => ({...f, lease_end: e.target.value}))} className={inp} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Monthly Rent *</label>
                  <input required type="number"
                    value={tenForm.rent_amount || selUnit.rent_amount}
                    onChange={e => setTF(f => ({...f, rent_amount: e.target.value}))} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Payment Day</label>
                  <input type="number" min="1" max="28" value={tenForm.payment_day}
                    onChange={e => setTF(f => ({...f, payment_day: e.target.value}))}
                    placeholder="1" className={inp} />
                </div>
              </div>
              <div>
                <label className={lbl}>Notes</label>
                <textarea rows={2} value={tenForm.notes}
                  onChange={e => setTF(f => ({...f, notes: e.target.value}))}
                  placeholder="Move-in condition, agreements…" className={inp + " resize-none"} />
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-3.5 bg-teal-500 text-black font-black uppercase text-xs tracking-widest rounded-xl hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Users size={14} />} Create Tenancy
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT SPLITS MODAL ───────────────────────────────────────────── */}
      {showSplits && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-black uppercase tracking-tight text-lg">Yield Split Config</h2>
              <button onClick={() => { setShowSplits(false); setSaveErr(''); }}><X size={18} className="text-zinc-500" /></button>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Percentages must total exactly 100%. Applied to every rent payment on this project.
            </p>
            {saveErr && <p className="text-red-400 text-xs font-bold">{saveErr}</p>}
            <div className="space-y-3">
              {splits.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className={`text-[8px] px-2 py-1 rounded border font-bold uppercase w-36 flex-shrink-0 text-center ${ROLE_COLORS[s.role] ?? 'border-zinc-700 text-zinc-400'}`}>
                    {s.role.replace(/_/g, ' ')}
                  </span>
                  <input type="number" min="0" max="100" step="0.5"
                    value={s.share_pct}
                    onChange={e => setSplits(prev => prev.map((x, j) => j === i ? {...x, share_pct: parseFloat(e.target.value)||0} : x))}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-teal-500 text-right font-mono" />
                  <span className="text-zinc-500 text-sm">%</span>
                </div>
              ))}
              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-[9px] text-zinc-500">Total</span>
                <span className={`font-mono font-bold text-sm ${Math.abs(splitTotal-100) < 0.1 ? 'text-teal-400' : 'text-red-400'}`}>
                  {safeD(splitTotal, 1)}%
                </span>
              </div>
            </div>
            <button onClick={saveSplits} disabled={saving || Math.abs(splitTotal-100) > 0.1}
              className="w-full py-3.5 bg-teal-500 text-black font-black uppercase text-xs tracking-widest rounded-xl hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />} Save Splits
            </button>
          </div>
        </div>
      )}

      {/* ── LOG MAINTENANCE MODAL ───────────────────────────────────────── */}
      {showMaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-black uppercase tracking-tight text-lg">Log Maintenance</h2>
              <button onClick={() => { setShowMaint(false); setSaveErr(''); }}><X size={18} className="text-zinc-500" /></button>
            </div>
            {saveErr && <p className="text-red-400 text-xs font-bold">{saveErr}</p>}
            <form onSubmit={logMaintenance} className="space-y-4">
              <div>
                <label className={lbl}>Title *</label>
                <input required value={maintForm.title}
                  onChange={e => setMF(f => ({...f, title: e.target.value}))}
                  placeholder="Roof leak in Flat 2B…" className={inp} />
              </div>
              <div>
                <label className={lbl}>Description</label>
                <textarea rows={2} value={maintForm.description}
                  onChange={e => setMF(f => ({...f, description: e.target.value}))}
                  className={inp + " resize-none"} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Category</label>
                  <select value={maintForm.category} onChange={e => setMF(f => ({...f, category: e.target.value}))} className={sel}>
                    {['GENERAL','ELECTRICAL','PLUMBING','STRUCTURAL','COSMETIC','SAFETY'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Severity</label>
                  <select value={maintForm.severity} onChange={e => setMF(f => ({...f, severity: e.target.value}))} className={sel}>
                    {['LOW','MEDIUM','HIGH','CRITICAL'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>Estimated Cost (NGN)</label>
                <input type="number" min="0" value={maintForm.cost_ngn}
                  onChange={e => setMF(f => ({...f, cost_ngn: e.target.value}))}
                  placeholder="50000" className={inp} />
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-3.5 bg-amber-500 text-black font-black uppercase text-xs tracking-widest rounded-xl hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Wrench size={14} />} Log Issue
              </button>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
