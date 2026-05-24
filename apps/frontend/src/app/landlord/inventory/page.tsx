'use client';
export const dynamic = 'force-dynamic';
/**
 * /landlord/inventory/page.tsx
 * Inventory Matrix — all units across all landlord properties.
 *
 * Changes from previous version:
 *  - BrandLogo replaces CSS NA placeholder
 *  - World-class card grid redesign (cover photo, gradient overlay, metrics)
 *  - Advertise button links to editor with unitId (not directly to Paystack)
 *  - Edit button links to /landlord/inventory/editor?unitId=<id>
 *  - BarChart3 + TrendingUp added to imports for KPI row
 *  - Rent roll KPI is now real (sum of rent_amount across occupied units)
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BrandLogo from '@/components/BrandLogo';
import api from '@/lib/api';
import {
  Archive, Megaphone, Loader2, Building2,
  AlertCircle, Search, BedDouble, Bath,
  MapPin, BarChart3, TrendingUp, Home,
  Edit3, CheckCircle2, X, RefreshCw,
  ShieldCheck, Wallet,
} from 'lucide-react';

const safeF = (v: any) => Number(v ?? 0).toLocaleString();

interface Unit {
  id: string;
  unit_name: string;
  unit_type?: string;
  status: string;
  rent_amount: number;
  currency: string;
  payment_frequency?: string;
  bedrooms: number;
  bathrooms: number;
  size_sqm?: number;
  furnished?: boolean;
  parking?: boolean;
  is_advertised: boolean;
  advertised_at?: string;
  cover_image?: string;
  marketing_description?: string;
  project_id: string;
  project_title: string;
  location: string;
  country: string;
  tenant_name?: string;
  tenant_email?: string;
  tenancy_status?: string;
  tenancy_id?: string;
  notice_count?: number;
  security_deposit?: number;
  agency_fee?: number;
  caution_fee?: number;
}

type FilterTab = 'ALL' | 'OCCUPIED' | 'VACANT' | 'ADVERTISED';

export default function InventoryPage() {
  const [units,       setUnits]       = useState<Unit[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [search,      setSearch]      = useState('');
  const [activeTab,   setActiveTab]   = useState<FilterTab>('ALL');
  const [dismissErr,  setDismissErr]  = useState(false);

  const loadUnits = async () => {
    setLoading(true); setError(''); setDismissErr(false);
    try {
      const res = await api.get('/api/landlord/units');
      setUnits(res.data?.units ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to load units. Please refresh.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadUnits(); }, []);

  // ── Derived counts ─────────────────────────────────────────────────────────
  const total      = units.length;
  const occupied   = units.filter(u => !!u.tenant_name).length;
  const vacant     = units.filter(u => !u.tenant_name).length;
  const advertised = units.filter(u => u.is_advertised).length;
  const occupancyPct = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const rentRoll   = units
    .filter(u => !!u.tenant_name)
    .reduce((sum, u) => sum + Number(u.rent_amount ?? 0), 0);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = units.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      u.unit_name?.toLowerCase().includes(q) ||
      u.project_title?.toLowerCase().includes(q) ||
      u.tenant_name?.toLowerCase().includes(q) ||
      u.location?.toLowerCase().includes(q);

    const matchTab =
      activeTab === 'ALL'        ? true :
      activeTab === 'OCCUPIED'   ? !!u.tenant_name :
      activeTab === 'VACANT'     ? !u.tenant_name :
      activeTab === 'ADVERTISED' ? u.is_advertised :
      true;

    return matchSearch && matchTab;
  });

  // ── Status helpers ─────────────────────────────────────────────────────────
  const statusLabel = (u: Unit) =>
    u.is_advertised ? 'ADVERTISED' :
    u.tenant_name   ? 'OCCUPIED'   : 'VACANT';

  const statusStyle = (u: Unit) =>
    u.is_advertised                ? 'bg-blue-500/10  border-blue-500/25  text-blue-400'  :
    u.tenant_name                  ? 'bg-teal-500/10  border-teal-500/25  text-teal-400'  :
                                     'bg-amber-500/10 border-amber-500/25 text-amber-400';

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      {/* ── Sticky page header ────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 border-b border-zinc-900 bg-[#050505]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">

            {/* Brand + breadcrumb */}
            <div className="flex items-center gap-3">
              <BrandLogo size={24} showText={false} noLink />
              <div className="h-4 w-px bg-zinc-800" />
              <div>
                <div className="flex items-center gap-2 text-[9px] text-zinc-600 uppercase font-bold tracking-widest">
                  <Link href="/projects/my" className="hover:text-teal-400 transition-colors">My Projects</Link>
                  <span>·</span>
                  <span className="text-zinc-400">Inventory Matrix</span>
                </div>
                <h1 className="text-sm font-black uppercase tracking-tight flex items-center gap-2 mt-0.5">
                  <Archive size={13} className="text-amber-400" />
                  Unit Inventory
                </h1>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button onClick={loadUnits}
                className="p-2 border border-zinc-800 text-zinc-600 hover:text-white hover:border-zinc-600 rounded-xl transition-all">
                <RefreshCw size={13} />
              </button>
              <Link href="/landlord/inventory/editor"
                className="flex items-center gap-1.5 px-4 py-2 bg-white text-black text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-teal-500 transition-all">
                <Edit3 size={11} /> Edit / Upload Unit
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full space-y-8">

        {/* ── KPI Row ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Units',    val: total,       sub: 'deployed',         color: 'text-white',       icon: Building2  },
            { label: 'Occupied',       val: occupied,    sub: 'active tenants',   color: 'text-teal-400',    icon: Home       },
            { label: 'Vacant',         val: vacant,      sub: 'available',        color: 'text-amber-400',   icon: Archive    },
            { label: 'Advertised',     val: advertised,  sub: 'on marketplace',   color: 'text-blue-400',    icon: Megaphone  },
            { label: 'Occupancy Rate', val: `${occupancyPct}%`, sub: '', color: occupancyPct >= 80 ? 'text-teal-400' : 'text-amber-400', icon: BarChart3 },
            { label: 'Rent Roll',      val: `₦${safeF(rentRoll)}`, sub: '',    color: 'text-teal-400',    icon: Wallet     },
          ].map(({ label, val, sub, color, icon: Icon }) => (
            <div key={label} className="p-4 rounded-2xl border border-zinc-900 bg-zinc-900/20 space-y-2">
              <Icon size={12} className="text-zinc-600" />
              <p className={`text-2xl font-black font-mono tabular-nums ${color}`}>{val}</p>
              <div>
                <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">{label}</p>
                {sub && <p className="text-[8px] text-zinc-700">{sub}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* ── Marketplace listing fee notice ────────────────────────────────── */}
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-500/15 bg-amber-500/5">
          <Megaphone size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-400">Marketplace Listing Fee — ₦5,000 per unit</p>
            <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
              Advertising a vacant unit on the Nested Ark Property Marketplace requires a one-time ₦5,000 fee paid via Paystack.
              Your unit is instantly visible to thousands of prospective tenants once payment is confirmed.
            </p>
          </div>
          <Link href="/marketplace" target="_blank"
            className="shrink-0 text-[9px] font-black text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg hover:bg-amber-500/10 transition-all uppercase tracking-wider">
            View Market
          </Link>
        </div>

        {/* ── Error banner ─────────────────────────────────────────────────── */}
        {error && !dismissErr && (
          <div className="flex items-center justify-between p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-bold">
            <div className="flex items-center gap-2">
              <AlertCircle size={13} /> {error}
            </div>
            <button onClick={() => setDismissErr(true)} className="ml-4 text-red-600 hover:text-red-400">
              <X size={12} />
            </button>
          </div>
        )}

        {/* ── Search + Tab filter ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 w-full">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search unit, property, tenant…"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-teal-500/50 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 self-start shrink-0">
            {(['ALL','OCCUPIED','VACANT','ADVERTISED'] as FilterTab[]).map(tab => {
              const count =
                tab === 'ALL'        ? total :
                tab === 'OCCUPIED'   ? occupied :
                tab === 'VACANT'     ? vacant :
                advertised;
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    activeTab === tab
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}>
                  {tab}({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Unit grid ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-zinc-500">
            <Loader2 className="animate-spin text-teal-400" size={20} />
            <span className="text-xs uppercase font-bold tracking-widest">Loading inventory…</span>
          </div>

        ) : filtered.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
            <Building2 className="text-zinc-700 mx-auto" size={40} />
            <p className="text-zinc-400 font-bold text-sm uppercase">
              {search ? 'No units match your search' : 'No units deployed yet'}
            </p>
            <p className="text-zinc-600 text-xs">
              {search
                ? 'Try clearing the search or changing the filter tab.'
                : 'Deploy units from your property rental management pages.'}
            </p>
            {!search && (
              <Link href="/projects/my"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-xs font-bold uppercase tracking-widest rounded-xl transition-all">
                Go to My Projects
              </Link>
            )}
          </div>

        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map(unit => {
              const isOccupied  = !!unit.tenant_name;
              const isAdvertised = unit.is_advertised;
              const isVacant    = !isOccupied;

              return (
                <div key={unit.id}
                  className="group flex flex-col bg-zinc-900/30 border border-zinc-800 hover:border-zinc-700 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-black/30">

                  {/* ── Cover image ── */}
                  <div className="relative aspect-video bg-zinc-900 border-b border-zinc-800 overflow-hidden">
                    {unit.cover_image ? (
                      <img
                        src={unit.cover_image}
                        alt={unit.unit_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <Building2 size={24} className="text-zinc-700" />
                        <p className="text-[8px] text-zinc-700 uppercase font-bold">No image</p>
                      </div>
                    )}

                    {/* Status badge */}
                    <div className="absolute top-2.5 left-2.5">
                      <span className={`text-[8px] px-2 py-0.5 rounded border font-black uppercase backdrop-blur-sm ${statusStyle(unit)}`}>
                        {statusLabel(unit)}
                      </span>
                    </div>

                    {/* Rent pill */}
                    <div className="absolute bottom-2.5 right-2.5">
                      <span className="bg-black/80 backdrop-blur-sm text-white text-[9px] px-2 py-1 rounded-lg font-mono font-bold">
                        {unit.currency || 'NGN'} {safeF(unit.rent_amount)}/{(unit.payment_frequency || 'mo').slice(0,2).toLowerCase()}
                      </span>
                    </div>

                    {/* Notices badge */}
                    {(unit.notice_count ?? 0) > 0 && (
                      <div className="absolute top-2.5 right-2.5">
                        <span className="bg-orange-500/90 backdrop-blur-sm text-white text-[8px] px-1.5 py-0.5 rounded font-black">
                          ⚠ {unit.notice_count}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ── Card body ── */}
                  <div className="p-4 flex-1 flex flex-col gap-3">

                    {/* Name + property */}
                    <div className="min-w-0">
                      <p className="font-black text-sm text-white truncate">{unit.unit_name}</p>
                      <p className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5 truncate">
                        <MapPin size={9} className="shrink-0" />
                        {unit.project_title} · {unit.location}
                      </p>
                    </div>

                    {/* Specs row */}
                    <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono">
                      {unit.bedrooms > 0 && (
                        <span className="flex items-center gap-1">
                          <BedDouble size={10} className="text-zinc-600" /> {unit.bedrooms} BR
                        </span>
                      )}
                      {unit.bathrooms > 0 && (
                        <span className="flex items-center gap-1">
                          <Bath size={10} className="text-zinc-600" /> {unit.bathrooms} BTH
                        </span>
                      )}
                      {(unit.size_sqm ?? 0) > 0 && (
                        <span>{Number(unit.size_sqm).toFixed(0)}m²</span>
                      )}
                      {unit.furnished && (
                        <span className="text-teal-600">Furn</span>
                      )}
                    </div>

                    {/* Tenant or vacant */}
                    <div className="flex-1">
                      {isOccupied ? (
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-zinc-300 truncate">{unit.tenant_name}</p>
                          <p className="text-[9px] text-zinc-600 truncate font-mono">{unit.tenant_email}</p>
                          {(unit.notice_count ?? 0) > 0 && (
                            <p className="text-[8px] text-orange-400 font-bold">
                              ⚠ {unit.notice_count} legal notice{(unit.notice_count ?? 0) > 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[10px] text-zinc-600 italic">No tenant assigned</p>
                      )}
                    </div>

                    {/* ── Action row ── */}
                    <div className="flex gap-2 pt-2 border-t border-zinc-800/60">
                      {/* Edit always available */}
                      <Link
                        href={`/landlord/inventory/editor?unitId=${unit.id}`}
                        className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white text-[9px] font-black uppercase rounded-lg transition-all flex-1 justify-center">
                        <Edit3 size={10} /> Edit
                      </Link>

                      {/* Advertise — only for vacant, non-listed */}
                      {isVacant && !isAdvertised && (
                        <Link
                          href={`/landlord/inventory/editor?unitId=${unit.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-[9px] font-black uppercase rounded-lg transition-all flex-1 justify-center">
                          <Megaphone size={10} /> Advertise
                        </Link>
                      )}

                      {/* View listing — for advertised units */}
                      {isAdvertised && (
                        <Link href="/marketplace" target="_blank"
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase rounded-lg transition-all flex-1 justify-center">
                          <ShieldCheck size={10} /> Listed
                        </Link>
                      )}

                      {/* Onboard tenant — for vacant, not advertised */}
                      {isVacant && !isAdvertised && (
                        <Link
                          href={`/landlord/onboard/${unit.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 text-teal-400 text-[9px] font-black uppercase rounded-lg transition-all">
                          +
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
