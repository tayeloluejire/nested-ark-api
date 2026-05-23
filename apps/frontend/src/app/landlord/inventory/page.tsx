'use client';
export const dynamic = 'force-dynamic';
/**
 * /landlord/inventory/page.tsx
 * Landlord Inventory Matrix — manage, advertise & onboard legacy units
 * API: GET /api/landlord/units  (all units across all properties)
 *      POST /api/landlord/marketplace/advertise-intent  (advertise a vacant unit)
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  Archive, Plus, Megaphone, Edit3, Loader2,
  ArrowLeft, Building2, Users, CheckCircle2,
  AlertCircle, Search, Filter, ShoppingBag,
} from 'lucide-react';

const safeF = (v: any) => Number(v ?? 0).toLocaleString();

export default function LandlordInventoryPage() {
  const [units,       setUnits]       = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [filter,      setFilter]      = useState<'ALL'|'OCCUPIED'|'VACANT'>('ALL');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback,    setFeedback]    = useState<{type:'ok'|'err'; msg:string} | null>(null);

  useEffect(() => { fetchUnits(); }, []);

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/landlord/units');
      setUnits(res.data?.units ?? res.data ?? []);
    } catch { setUnits([]); }
    finally  { setLoading(false); }
  };

  const handleAdvertise = async (unitId: string) => {
    setProcessingId(unitId);
    setFeedback(null);
    try {
      const res = await api.post('/api/landlord/marketplace/advertise-intent', { unit_id: unitId });
      if (res.data?.authorization_url) {
        window.location.href = res.data.authorization_url;
      } else {
        setFeedback({ type: 'ok', msg: 'Unit listed on marketplace successfully.' });
        fetchUnits();
      }
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error ?? 'Advertisement placement failed.' });
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = units.filter(u => {
    const matchSearch = !search ||
      u.unit_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.project_title?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'ALL' ||
      (filter === 'OCCUPIED' && u.tenant_name) ||
      (filter === 'VACANT'   && !u.tenant_name);
    return matchSearch && matchFilter;
  });

  const vacantCount   = units.filter(u => !u.tenant_name).length;
  const occupiedCount = units.filter(u =>  u.tenant_name).length;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-10 w-full space-y-6">

        {/* Header */}
        <div>
          <Link href="/projects/my"
            className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-6 w-fit">
            <ArrowLeft size={12} /> My Projects
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <Archive size={16} className="text-amber-400" />
            <p className="text-[9px] text-amber-400 font-mono font-black tracking-widest uppercase">
              Inventory Matrix
            </p>
          </div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter italic">
            Unit Inventory
          </h1>
          <p className="text-zinc-500 text-sm mt-2">
            Manage, advertise and onboard tenants across all deployed units.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Units',  value: units.length,   color: 'text-white' },
            { label: 'Occupied',     value: occupiedCount,  color: 'text-teal-400' },
            { label: 'Vacant',       value: vacantCount,    color: 'text-amber-400' },
            { label: 'Occupancy',    value: units.length ? `${Math.round((occupiedCount/units.length)*100)}%` : '0%', color: 'text-blue-400' },
          ].map(s => (
            <div key={s.label} className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{s.label}</p>
              <p className={`text-2xl font-black font-mono mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {(['ALL','OCCUPIED','VACANT'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                  filter === f
                    ? 'bg-teal-500 text-black border-teal-500'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'
                }`}>
                {f}
              </button>
            ))}
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search unit or property…"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-200 outline-none focus:border-teal-500 transition-colors" />
            </div>
            <Link href="/landlord/inventory/editor"
              className="flex items-center gap-1.5 px-4 py-2 bg-white text-black text-[10px] font-black uppercase rounded-xl hover:bg-teal-500 transition-all">
              <Plus size={12} /> Edit Unit
            </Link>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`p-4 rounded-xl border flex items-center gap-2 text-sm font-bold ${
            feedback.type === 'ok'
              ? 'bg-teal-500/10 border-teal-500/20 text-teal-400'
              : 'bg-red-500/5 border-red-500/20 text-red-400'
          }`}>
            {feedback.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {feedback.msg}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-24 gap-3 text-zinc-500">
            <Loader2 size={18} className="animate-spin text-teal-400" />
            <span className="text-xs uppercase font-bold tracking-widest">Loading inventory…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-zinc-800 rounded-2xl space-y-3">
            <Building2 className="text-zinc-700 mx-auto" size={40} />
            <p className="text-zinc-400 font-bold uppercase text-sm">No units found</p>
            <p className="text-zinc-600 text-xs">
              {units.length === 0
                ? 'Deploy units via your property\'s rental management page.'
                : 'Try adjusting your search or filter.'}
            </p>
            {units.length === 0 && (
              <Link href="/projects/my"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-black text-xs font-black uppercase rounded-xl hover:bg-teal-400 transition-all mt-2">
                <Building2 size={12} /> Go to My Projects
              </Link>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-6 px-5 py-3 bg-zinc-900/40 border-b border-zinc-800 text-[9px] text-zinc-500 font-black uppercase tracking-widest">
              <div className="col-span-2">Unit</div>
              <div>Annual Rent</div>
              <div>Status</div>
              <div>Advertise</div>
              <div className="text-right">Actions</div>
            </div>

            {filtered.map((unit, i) => (
              <div key={unit.id}
                className={`grid grid-cols-2 md:grid-cols-6 gap-3 px-5 py-4 items-center border-b border-zinc-900 hover:bg-zinc-900/20 transition-all ${i === filtered.length - 1 ? 'border-b-0' : ''}`}>

                {/* Unit info */}
                <div className="col-span-2 md:col-span-2">
                  <p className="text-sm font-black text-white uppercase tracking-tight">{unit.unit_name}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{unit.project_title}</p>
                  {unit.bedrooms > 0 && (
                    <p className="text-[9px] text-zinc-600 mt-0.5 font-mono">
                      {unit.bedrooms}BR · {unit.bathrooms}BTH
                      {unit.size_sqm ? ` · ${unit.size_sqm}m²` : ''}
                    </p>
                  )}
                </div>

                {/* Rent */}
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase font-bold md:hidden mb-0.5">Rent</p>
                  <p className="font-mono text-sm font-black text-white">
                    {unit.currency || 'NGN'} {safeF(unit.rent_amount)}
                  </p>
                  <p className="text-[9px] text-zinc-600">/{unit.payment_frequency?.toLowerCase() || 'yr'}</p>
                </div>

                {/* Status */}
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase font-bold md:hidden mb-0.5">Status</p>
                  {unit.tenant_name ? (
                    <div>
                      <span className="inline-flex items-center gap-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded text-[8px] font-black uppercase">
                        <Users size={8} /> Occupied
                      </span>
                      <p className="text-[9px] text-zinc-500 mt-0.5">{unit.tenant_name}</p>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[8px] font-black uppercase">
                      Vacant
                    </span>
                  )}
                </div>

                {/* Advertise */}
                <div>
                  {!unit.tenant_name ? (
                    unit.is_advertised ? (
                      <Link href="/marketplace"
                        className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-blue-500/20 transition-all">
                        <ShoppingBag size={10} /> Live
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleAdvertise(unit.id)}
                        disabled={processingId !== null}
                        className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black border border-amber-500/20 transition-all px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider disabled:opacity-50">
                        {processingId === unit.id
                          ? <Loader2 size={10} className="animate-spin" />
                          : <Megaphone size={10} />
                        }
                        Advertise
                      </button>
                    )
                  ) : (
                    <span className="text-[9px] text-zinc-700 font-mono">—</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                  <Link
                    href={`/landlord/inventory/editor?unitId=${unit.id}`}
                    className="p-2 border border-zinc-800 hover:border-teal-500/40 hover:text-teal-400 rounded-lg text-zinc-400 transition-all">
                    <Edit3 size={12} />
                  </Link>
                  {unit.project_id && (
                    <Link
                      href={`/projects/${unit.project_id}/rental-management`}
                      className="p-2 border border-zinc-800 hover:border-zinc-600 rounded-lg text-zinc-400 transition-all">
                      <Building2 size={12} />
                    </Link>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}
