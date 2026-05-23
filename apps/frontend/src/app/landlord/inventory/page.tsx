'use client';
export const dynamic = 'force-dynamic';
/**
 * /landlord/inventory/page.tsx
 * Landlord Inventory Matrix — all units across all properties
 * API: GET  /api/landlord/units           — all units (new endpoint)
 *      POST /api/rental/marketplace/advertise — pay ₦5,000 to list
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  Archive, Plus, Megaphone, Edit3, Loader2,
  ArrowLeft, Building2, Users, CheckCircle2,
  AlertCircle, Search, ShoppingBag, TrendingUp,
  BedDouble, Bath, MapPin, Tag,
} from 'lucide-react';

const safeF = (v: any) => Number(v ?? 0).toLocaleString();

export default function LandlordInventoryPage() {
  const [units,        setUnits]        = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [filter,       setFilter]       = useState<'ALL'|'OCCUPIED'|'VACANT'|'ADVERTISED'>('ALL');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback,     setFeedback]     = useState<{type:'ok'|'err'; msg:string} | null>(null);
  const [confirmId,    setConfirmId]    = useState<string | null>(null);

  useEffect(() => { fetchUnits(); }, []);

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/landlord/units');
      setUnits(res.data?.units ?? []);
    } catch {
      setFeedback({ type: 'err', msg: 'Failed to load units. Please refresh.' });
    } finally {
      setLoading(false);
    }
  };

  // ── Advertise — landlord pays ₦5,000 to list on marketplace ──────────────
  const handleAdvertise = async (unitId: string) => {
    setProcessingId(unitId);
    setConfirmId(null);
    setFeedback(null);
    try {
      const res = await api.post('/api/rental/marketplace/advertise', { unit_id: unitId });
      if (res.data?.authorization_url) {
        // Redirect to Paystack payment page
        window.location.href = res.data.authorization_url;
      } else {
        setFeedback({ type: 'ok', msg: res.data?.message ?? 'Unit listed on marketplace.' });
        fetchUnits();
      }
    } catch (err: any) {
      setFeedback({
        type: 'err',
        msg: err?.response?.data?.error ?? 'Advertisement placement failed. Try again.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = units.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      u.unit_name?.toLowerCase().includes(q) ||
      u.project_title?.toLowerCase().includes(q) ||
      u.location?.toLowerCase().includes(q) ||
      u.tenant_name?.toLowerCase().includes(q);
    const matchFilter =
      filter === 'ALL'        ? true :
      filter === 'OCCUPIED'   ? !!u.tenant_name :
      filter === 'VACANT'     ? (!u.tenant_name && !u.is_advertised) :
      filter === 'ADVERTISED' ? u.is_advertised : true;
    return matchSearch && matchFilter;
  });

  const totalCount      = units.length;
  const occupiedCount   = units.filter(u => !!u.tenant_name).length;
  const vacantCount     = units.filter(u => !u.tenant_name && !u.is_advertised).length;
  const advertisedCount = units.filter(u => u.is_advertised).length;
  const occupancyRate   = totalCount ? Math.round((occupiedCount / totalCount) * 100) : 0;
  const monthlyRoll     = units.reduce((s, u) => s + (u.tenant_name ? Number(u.rent_amount || 0) : 0), 0);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-10 w-full space-y-8">

        {/* ── Header ──────────────────────────────────────────────────── */}
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
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter italic">
                Unit Inventory
              </h1>
              <p className="text-zinc-500 text-sm mt-2">
                All deployed units across every property. Manage occupancy, edit specs, advertise vacancies.
              </p>
            </div>
            <Link href="/landlord/inventory/editor"
              className="flex items-center gap-2 px-5 py-3 bg-white text-black text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-teal-500 transition-all shrink-0">
              <Edit3 size={12} /> Edit / Upload Unit
            </Link>
          </div>
        </div>

        {/* ── KPI Stats ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Units',    value: totalCount,      color: 'text-white',      sub: 'deployed' },
            { label: 'Occupied',       value: occupiedCount,   color: 'text-teal-400',   sub: 'active tenants' },
            { label: 'Vacant',         value: vacantCount,     color: 'text-amber-400',  sub: 'available' },
            { label: 'Advertised',     value: advertisedCount, color: 'text-blue-400',   sub: 'on marketplace' },
            { label: 'Occupancy Rate', value: `${occupancyRate}%`, color: 'text-teal-400', sub: `₦${safeF(monthlyRoll)} roll` },
          ].map(s => (
            <div key={s.label} className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-1">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{s.label}</p>
              <p className={`text-2xl font-black font-mono ${s.color}`}>{s.value}</p>
              <p className="text-[9px] text-zinc-600">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Marketplace Ad Fee Notice ────────────────────────────────── */}
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
          <Tag size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] text-amber-400 font-black uppercase tracking-wider">
              Marketplace Listing Fee — ₦5,000 per unit
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Advertising a vacant unit on the Nested Ark Property Marketplace requires a one-time ₦5,000 fee paid via Paystack.
              Your unit is instantly visible to thousands of prospective tenants once payment is confirmed.
            </p>
          </div>
        </div>

        {/* ── Controls ────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {(['ALL','OCCUPIED','VACANT','ADVERTISED'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                  filter === f
                    ? 'bg-teal-500 text-black border-teal-500'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'
                }`}>
                {f}
                <span className="ml-1.5 opacity-60">
                  ({f === 'ALL' ? totalCount : f === 'OCCUPIED' ? occupiedCount : f === 'VACANT' ? vacantCount : advertisedCount})
                </span>
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-64">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search unit, property, tenant…"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-200 outline-none focus:border-teal-500 transition-colors" />
          </div>
        </div>

        {/* ── Feedback ────────────────────────────────────────────────── */}
        {feedback && (
          <div className={`p-4 rounded-xl border flex items-center gap-2 text-sm font-bold ${
            feedback.type === 'ok'
              ? 'bg-teal-500/10 border-teal-500/20 text-teal-400'
              : 'bg-red-500/5 border-red-500/20 text-red-400'
          }`}>
            {feedback.type === 'ok' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
            {feedback.msg}
            <button onClick={() => setFeedback(null)} className="ml-auto text-zinc-500 hover:text-white text-xs">✕</button>
          </div>
        )}

        {/* ── Unit Grid ───────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-24 gap-3 text-zinc-500">
            <Loader2 size={18} className="animate-spin text-teal-400" />
            <span className="text-xs uppercase font-bold tracking-widest">Loading inventory…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
            <Building2 className="text-zinc-700 mx-auto" size={40} />
            <p className="text-zinc-400 font-bold uppercase text-sm">
              {units.length === 0 ? 'No units deployed yet' : 'No units match your filter'}
            </p>
            <p className="text-zinc-600 text-xs">
              {units.length === 0
                ? 'Deploy units from your property rental management pages.'
                : 'Try a different filter or search term.'}
            </p>
            {units.length === 0 && (
              <Link href="/projects/my"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-black text-xs font-black uppercase rounded-xl hover:bg-teal-400 transition-all mt-2">
                <Building2 size={12} /> Go to My Projects
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(unit => (
              <div key={unit.id}
                className="group bg-zinc-900/20 border border-zinc-800 hover:border-zinc-700 rounded-2xl overflow-hidden transition-all duration-200 flex flex-col">

                {/* Cover image */}
                <div className="relative aspect-video bg-zinc-900 border-b border-zinc-800 overflow-hidden">
                  {unit.cover_image ? (
                    <img src={unit.cover_image} alt={unit.unit_name}
                      className="object-cover w-full h-full group-hover:scale-105 transition-all duration-500" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <Building2 size={24} className="text-zinc-700" />
                      <p className="text-[9px] text-zinc-700 uppercase font-mono">No image</p>
                    </div>
                  )}
                  {/* Status badge */}
                  <div className="absolute top-3 left-3">
                    {unit.tenant_name ? (
                      <span className="flex items-center gap-1 bg-teal-500/20 border border-teal-500/40 text-teal-400 text-[8px] px-2 py-0.5 rounded font-black uppercase backdrop-blur-sm">
                        <Users size={8} /> Occupied
                      </span>
                    ) : unit.is_advertised ? (
                      <span className="flex items-center gap-1 bg-blue-500/20 border border-blue-500/40 text-blue-400 text-[8px] px-2 py-0.5 rounded font-black uppercase backdrop-blur-sm">
                        <ShoppingBag size={8} /> Listed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[8px] px-2 py-0.5 rounded font-black uppercase backdrop-blur-sm">
                        Vacant
                      </span>
                    )}
                  </div>
                  {/* Rent badge */}
                  <div className="absolute bottom-3 right-3">
                    <span className="bg-black/80 text-white text-[9px] px-2 py-1 rounded font-mono font-bold">
                      {unit.currency || 'NGN'} {safeF(unit.rent_amount)}
                      /{unit.payment_frequency?.toLowerCase().slice(0,2) || 'yr'}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-tight text-white truncate">
                      {unit.unit_name}
                    </h3>
                    <p className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-1">
                      <MapPin size={9} className="text-zinc-600" />
                      {unit.project_title}
                      {unit.location ? ` · ${unit.location}` : ''}
                    </p>
                  </div>

                  {/* Specs */}
                  {(unit.bedrooms > 0 || unit.bathrooms > 0) && (
                    <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-mono">
                      {unit.bedrooms > 0 && (
                        <span className="flex items-center gap-1"><BedDouble size={10} className="text-zinc-600"/> {unit.bedrooms} BR</span>
                      )}
                      {unit.bathrooms > 0 && (
                        <span className="flex items-center gap-1"><Bath size={10} className="text-zinc-600"/> {unit.bathrooms} BTH</span>
                      )}
                      {unit.size_sqm > 0 && <span>{unit.size_sqm}m²</span>}
                    </div>
                  )}

                  {/* Tenant */}
                  {unit.tenant_name && (
                    <div className="flex items-center gap-1.5 p-2 rounded-xl bg-teal-500/5 border border-teal-500/10">
                      <Users size={10} className="text-teal-400 shrink-0" />
                      <div>
                        <p className="text-[10px] text-teal-400 font-bold">{unit.tenant_name}</p>
                        <p className="text-[9px] text-zinc-600">{unit.tenant_email}</p>
                      </div>
                    </div>
                  )}

                  {/* Notice count */}
                  {Number(unit.notice_count) > 0 && (
                    <p className="text-[9px] text-red-400 font-bold uppercase tracking-wider">
                      ⚠ {unit.notice_count} legal notice{Number(unit.notice_count) > 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Actions footer */}
                <div className="px-4 pb-4 pt-2 border-t border-zinc-900 flex gap-2">

                  {/* Edit button */}
                  <Link href={`/landlord/inventory/editor?unitId=${unit.id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-zinc-800 hover:border-teal-500/40 hover:text-teal-400 rounded-xl text-zinc-400 text-[9px] font-black uppercase tracking-wider transition-all">
                    <Edit3 size={10} /> Edit
                  </Link>

                  {/* Rental management */}
                  {unit.project_id && (
                    <Link href={`/projects/${unit.project_id}/rental-management`}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 border border-zinc-800 hover:border-zinc-600 rounded-xl text-zinc-400 text-[9px] font-black uppercase tracking-wider transition-all">
                      <Building2 size={10} />
                    </Link>
                  )}

                  {/* Advertise — only for vacant units */}
                  {!unit.tenant_name && (
                    unit.is_advertised ? (
                      <Link href="/marketplace"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all">
                        <ShoppingBag size={10} /> View Live
                      </Link>
                    ) : confirmId === unit.id ? (
                      /* Confirm advertise — show fee */
                      <div className="flex-1 flex flex-col gap-1">
                        <p className="text-[8px] text-amber-400 font-bold text-center">₦5,000 listing fee applies</p>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleAdvertise(unit.id)}
                            disabled={processingId !== null}
                            className="flex-1 flex items-center justify-center gap-1 py-2 bg-amber-500 text-black rounded-xl text-[9px] font-black uppercase transition-all disabled:opacity-50">
                            {processingId === unit.id ? <Loader2 size={9} className="animate-spin"/> : <Megaphone size={9}/>}
                            Pay & List
                          </button>
                          <button onClick={() => setConfirmId(null)}
                            className="px-3 py-2 border border-zinc-700 text-zinc-500 rounded-xl text-[9px] font-bold transition-all hover:border-zinc-500">
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(unit.id)}
                        disabled={processingId !== null}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all disabled:opacity-50">
                        <Megaphone size={10} /> Advertise
                      </button>
                    )
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
