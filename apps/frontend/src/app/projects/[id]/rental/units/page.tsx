'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  Plus, Building, UserPlus, Loader2, AlertCircle,
  ArrowLeft, RefreshCw, X, ShieldCheck, CheckCircle2, DollarSign
} from 'lucide-react';

const safeN = (v: any) => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any) => safeN(v).toLocaleString();

const STATUS_STYLE: Record<string, string> = {
  VACANT:      'bg-teal-500/10 text-teal-400 border-teal-500/30',
  OCCUPIED:    'bg-red-500/10 text-red-400 border-red-500/30',
  RESERVED:    'bg-amber-500/10 text-amber-400 border-amber-500/30',
  MAINTENANCE: 'bg-zinc-700/30 text-zinc-400 border-zinc-700',
};

export default function UnitManagement() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();

  const [units,    setUnits]   = useState<any[]>([]);
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

  const loadUnits = async () => {
    if (!id) return;
    setLoading(true); setError('');
    try {
      const res = await api.get(`/api/projects/${id}/units`);
      const d = res.data;
      setUnits(Array.isArray(d) ? d : (d.units ?? []));
    } catch (ex: any) {
      setError(ex?.response?.data?.error ?? 'Could not load units.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUnits(); }, [id]); // eslint-disable-line

  const handleAddUnit = async () => {
    if (!newUnit.unit_number.trim()) { setAddError('Unit number is required.'); return; }
    if (!newUnit.rent_amount || isNaN(Number(newUnit.rent_amount))) {
      setAddError('Valid rent amount is required.'); return;
    }
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
      setTimeout(() => { setShowAdd(false); setAddOk(''); loadUnits(); }, 1200);
    } catch (ex: any) {
      setAddError(ex?.response?.data?.error ?? 'Failed to add unit.');
    } finally {
      setAdding(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="flex items-center justify-center py-40">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
      <Footer />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 p-8 max-w-5xl mx-auto w-full space-y-8">

        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
          <ArrowLeft size={13} /> Back
        </button>

        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="border-l-2 border-teal-500 pl-5">
            <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Landlord Command</p>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">Unit Inventory</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadUnits}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-zinc-800 text-zinc-500 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:text-white transition-all">
              <RefreshCw size={11} /> Refresh
            </button>
            <button
              onClick={() => { setShowAdd(true); setAddError(''); setAddOk(''); }}
              className="flex items-center gap-2 bg-teal-500 text-black px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white transition-all">
              <Plus size={14} /> Add Unit
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14} /> {error}
            <button onClick={loadUnits} className="ml-auto text-teal-500 text-xs font-black">Retry →</button>
          </div>
        )}

        {units.length === 0 && !error ? (
          <div className="py-24 text-center border border-dashed border-zinc-800 rounded-2xl space-y-5">
            <Building className="text-zinc-700 mx-auto" size={48} />
            <div>
              <p className="text-zinc-400 font-bold text-lg">No units registered</p>
              <p className="text-zinc-600 text-sm mt-1">Register the first unit to start onboarding tenants.</p>
            </div>
            <button
              onClick={() => { setShowAdd(true); setAddError(''); setAddOk(''); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all">
              <Plus size={11} /> Add First Unit
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {units.map((unit: any) => (
              <div key={unit.id} className="border border-zinc-800 p-6 rounded-2xl bg-zinc-900/20 space-y-4 hover:border-zinc-700 transition-all">
                <div className="flex justify-between items-start">
                  <Building className="text-teal-500" size={24} />
                  <span className={`text-[8px] px-2 py-1 rounded border font-bold uppercase ${STATUS_STYLE[unit.status] ?? 'bg-zinc-800/50 text-zinc-500 border-zinc-700'}`}>
                    {unit.status ?? 'VACANT'}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold">Unit {unit.unit_number}</h3>
                  {unit.floor && <p className="text-zinc-500 text-xs">Floor {unit.floor}</p>}
                </div>
                <p className="text-sm text-zinc-500 flex items-center gap-1">
                  <DollarSign size={11} className="text-teal-500/70" />
                  {unit.currency ?? 'NGN'} {safeF(unit.rent_amount)}/mo
                </p>
                {unit.status !== 'OCCUPIED' && (
                  // ✅ CORRECT ROUTE — passes unit id and number as query params
                  <Link
                    href={`/projects/${id}/rental-management/onboard?unit=${unit.id}&unit_number=${encodeURIComponent(unit.unit_number)}`}
                    className="w-full py-2.5 bg-white text-black text-[9px] font-black uppercase rounded-xl flex items-center justify-center gap-2 hover:bg-teal-500 transition-all">
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
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] text-teal-500 font-mono font-black uppercase tracking-widest mb-0.5">Ledger Entry</p>
                <h3 className="text-xl font-black uppercase">Register Unit</h3>
              </div>
              <button onClick={() => setShowAdd(false)} className="text-zinc-600 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <input
                placeholder="Unit Number (e.g. Suite 201, Apt 4B)"
                value={newUnit.unit_number}
                className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-sm outline-none focus:border-teal-500 transition-colors"
                onChange={(e) => setNewUnit({ ...newUnit, unit_number: e.target.value })}
              />
              <input
                placeholder="Floor (optional)"
                value={newUnit.floor}
                className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-sm outline-none focus:border-teal-500 transition-colors"
                onChange={(e) => setNewUnit({ ...newUnit, floor: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Monthly Rent"
                  type="number"
                  value={newUnit.rent_amount}
                  className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-sm font-mono outline-none focus:border-teal-500 transition-colors"
                  onChange={(e) => setNewUnit({ ...newUnit, rent_amount: e.target.value })}
                />
                <select
                  value={newUnit.currency}
                  className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white text-sm outline-none focus:border-teal-500 transition-colors"
                  onChange={(e) => setNewUnit({ ...newUnit, currency: e.target.value })}>
                  {['NGN', 'USD', 'GBP', 'AED', 'KES', 'ZAR', 'EUR'].map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {addError && (
              <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={11} /> {addError}
              </div>
            )}
            {addOk && (
              <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={11} /> {addOk}
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
                className="flex-1 py-3 bg-teal-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-white transition-all disabled:opacity-60 flex items-center justify-center gap-2 text-[9px]">
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
