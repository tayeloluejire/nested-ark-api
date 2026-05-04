'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  Building2, Plus, Loader2, AlertCircle, UserPlus,
  ArrowLeft, RefreshCw, ShieldCheck, DollarSign,
  Users, Home, X, CheckCircle2
} from 'lucide-react';

const safeN = (v: any) => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any) => safeN(v).toLocaleString();

const STATUS_STYLE: Record<string, string> = {
  VACANT:   'bg-teal-500/10 text-teal-400 border-teal-500/30',
  OCCUPIED: 'bg-red-500/10 text-red-400 border-red-500/30',
  RESERVED: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  MAINTENANCE: 'bg-zinc-700/30 text-zinc-400 border-zinc-700',
};

interface Unit {
  id: string;
  unit_number: string;
  floor?: string;
  rent_amount: number;
  currency: string;
  status: string;
  tenant_name?: string;
  tenant_email?: string;
}

export default function RentalManagementPage() {
  const { id }    = useParams<{ id: string }>();
  const router    = useRouter();

  const [units,    setUnits]   = useState<Unit[]>([]);
  const [project,  setProject] = useState<any>(null);
  const [loading,  setLoading] = useState(true);
  const [error,    setError]   = useState('');
  const [showAdd,  setShowAdd] = useState(false);
  const [adding,   setAdding]  = useState(false);
  const [addError, setAddError]= useState('');
  const [addOk,    setAddOk]   = useState('');

  const [newUnit, setNewUnit] = useState({
    unit_number: '',
    floor: '',
    rent_amount: '',
    currency: 'NGN',
  });

  const load = async () => {
    if (!id) return;
    setLoading(true); setError('');
    try {
      const [pRes, uRes] = await Promise.allSettled([
        api.get(`/api/projects/${id}`),
        api.get(`/api/projects/${id}/units`),
      ]);
      if (pRes.status === 'fulfilled') {
        setProject(pRes.value.data.project ?? pRes.value.data);
      }
      if (uRes.status === 'fulfilled') {
        const d = uRes.value.data;
        setUnits(Array.isArray(d) ? d : (d.units ?? []));
      } else {
        const err = (uRes as any).reason;
        setError(err?.response?.data?.error ?? 'Could not load units.');
      }
    } catch (ex: any) {
      setError('Failed to load rental data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const handleAddUnit = async () => {
    if (!newUnit.unit_number.trim()) { setAddError('Unit number is required.'); return; }
    if (!newUnit.rent_amount || isNaN(Number(newUnit.rent_amount))) { setAddError('Valid rent amount is required.'); return; }
    setAdding(true); setAddError(''); setAddOk('');
    try {
      await api.post(`/api/projects/${id}/units`, {
        unit_number: newUnit.unit_number.trim(),
        floor: newUnit.floor.trim() || null,
        rent_amount: Number(newUnit.rent_amount),
        currency: newUnit.currency,
      });
      setAddOk('Unit committed to ledger!');
      setNewUnit({ unit_number: '', floor: '', rent_amount: '', currency: 'NGN' });
      setTimeout(() => { setShowAdd(false); setAddOk(''); load(); }, 1200);
    } catch (ex: any) {
      setAddError(ex?.response?.data?.error ?? 'Failed to add unit. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="flex items-center justify-center py-40">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-teal-500 mx-auto" size={32} />
          <p className="text-zinc-500 text-sm uppercase font-bold tracking-widest">Loading units…</p>
        </div>
      </div>
      <Footer />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 w-full space-y-8">

        {/* Back */}
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
          <ArrowLeft size={13} /> Back
        </button>

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="border-l-2 border-teal-500 pl-5">
            <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Landlord Command</p>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Unit Management</h1>
            {project && (
              <p className="text-zinc-500 text-xs mt-1">
                <span className="font-mono text-teal-500">{project.project_number}</span> · {project.title}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={load}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-zinc-800 text-zinc-500 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:text-white transition-all">
              <RefreshCw size={11} /> Refresh
            </button>
            <button
              onClick={() => { setShowAdd(true); setAddError(''); setAddOk(''); }}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-teal-500 text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white transition-all">
              <Plus size={12} /> Add Unit
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14} /> {error}
            <button onClick={load} className="ml-auto text-teal-500 text-xs font-black hover:text-white">Retry →</button>
          </div>
        )}

        {/* Stats */}
        {units.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Units', value: units.length, icon: Home, color: 'text-white' },
              { label: 'Occupied', value: units.filter(u => u.status === 'OCCUPIED').length, icon: Users, color: 'text-red-400' },
              { label: 'Vacant', value: units.filter(u => u.status === 'VACANT').length, icon: Building2, color: 'text-teal-400' },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-2">
                  <Icon size={13} className="text-zinc-600" />
                  <p className={`text-2xl font-black font-mono tabular-nums ${s.color}`}>{s.value}</p>
                  <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s.label}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Units grid */}
        {units.length === 0 && !error ? (
          <div className="py-24 text-center border border-dashed border-zinc-800 rounded-2xl space-y-5">
            <Building2 className="text-zinc-700 mx-auto" size={48} />
            <div>
              <p className="text-zinc-400 font-bold text-lg">No units registered</p>
              <p className="text-zinc-600 text-sm mt-1">Add individual units (apartments, floors, offices) to this property.</p>
            </div>
            <button
              onClick={() => { setShowAdd(true); setAddError(''); setAddOk(''); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all">
              <Plus size={11} /> Add First Unit
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {units.map((unit) => (
              <div key={unit.id} className="p-6 border border-zinc-800 bg-zinc-900/20 rounded-2xl space-y-4 hover:border-zinc-700 transition-all">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-teal-500/10 rounded-xl">
                    <Building2 className="text-teal-500" size={20} />
                  </div>
                  <span className={`text-[8px] px-2 py-1 rounded border font-bold uppercase ${STATUS_STYLE[unit.status] ?? 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
                    {unit.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black uppercase">Unit {unit.unit_number}</h3>
                  {unit.floor && <p className="text-zinc-500 text-xs">Floor {unit.floor}</p>}
                </div>

                <div className="flex items-center gap-1 text-teal-400 font-mono font-bold text-sm">
                  <DollarSign size={12} />
                  {unit.currency} {safeF(unit.rent_amount)}<span className="text-zinc-600 font-normal text-xs">/mo</span>
                </div>

                {unit.tenant_name && (
                  <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                    <p className="text-[9px] text-zinc-500 uppercase font-bold mb-1">Tenant</p>
                    <p className="text-xs font-bold text-white">{unit.tenant_name}</p>
                    {unit.tenant_email && <p className="text-[9px] text-zinc-600 font-mono">{unit.tenant_email}</p>}
                  </div>
                )}

                {unit.status !== 'OCCUPIED' && (
                  // ✅ CORRECT ROUTE: navigates to the onboard page for this specific unit
                  <Link
                    href={`/projects/${id}/rental-management/onboard?unit=${unit.id}&unit_number=${encodeURIComponent(unit.unit_number)}`}
                    className="w-full py-2.5 bg-white text-black text-[9px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 hover:bg-teal-500 transition-all">
                    <UserPlus size={12} /> Onboard Tenant
                  </Link>
                )}

                {unit.status === 'OCCUPIED' && (
                  <div className="flex items-center gap-1.5 text-[9px] text-teal-400 font-bold">
                    <ShieldCheck size={10} /> Ledger Active
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Add Unit Modal ─────────────────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-md w-full space-y-6 shadow-2xl">

            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] text-teal-500 font-mono font-black uppercase tracking-widest mb-0.5">Ledger Entry</p>
                <h3 className="text-xl font-black uppercase tracking-tighter">Register Unit</h3>
              </div>
              <button onClick={() => setShowAdd(false)} className="text-zinc-600 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">Unit Number *</label>
                <input
                  placeholder="e.g. Suite 201, Apt 4B, Floor 3"
                  value={newUnit.unit_number}
                  onChange={(e) => setNewUnit({ ...newUnit, unit_number: e.target.value })}
                  className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-sm outline-none focus:border-teal-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">Floor (optional)</label>
                <input
                  placeholder="e.g. 2, Ground, Penthouse"
                  value={newUnit.floor}
                  onChange={(e) => setNewUnit({ ...newUnit, floor: e.target.value })}
                  className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-sm outline-none focus:border-teal-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">Monthly Rent *</label>
                  <input
                    placeholder="e.g. 150000"
                    type="number"
                    value={newUnit.rent_amount}
                    onChange={(e) => setNewUnit({ ...newUnit, rent_amount: e.target.value })}
                    className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-sm font-mono outline-none focus:border-teal-500 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">Currency</label>
                  <select
                    value={newUnit.currency}
                    onChange={(e) => setNewUnit({ ...newUnit, currency: e.target.value })}
                    className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-sm outline-none focus:border-teal-500 transition-colors">
                    {['NGN', 'USD', 'GBP', 'AED', 'KES', 'ZAR', 'EUR'].map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {addError && (
              <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={12} /> {addError}
              </div>
            )}
            {addOk && (
              <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={12} /> {addOk}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-3 border border-zinc-700 text-zinc-400 text-[9px] font-black uppercase tracking-widest rounded-xl hover:text-white transition-all">
                Cancel
              </button>
              <button
                onClick={handleAddUnit}
                disabled={adding}
                className="flex-1 py-3 bg-teal-500 text-black text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-white transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {adding ? <Loader2 className="animate-spin" size={12} /> : <ShieldCheck size={12} />}
                {adding ? 'Committing…' : 'Commit Unit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
