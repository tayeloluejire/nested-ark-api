'use client';
export const dynamic = 'force-dynamic';
/**
 * src/app/marketplace/page.tsx
 * PUBLIC — no auth required.
 * Displays all advertised vacant units across all landlords.
 * API: GET /api/marketplace/discover
 */
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  Search, Home, ShieldCheck, MapPin, Loader2,
  BedDouble, Bath, Building2, DollarSign, ChevronRight, Filter, X,
} from 'lucide-react';

const safeF = (v: any) => Number(v ?? 0).toLocaleString();

function MarketplaceContent() {
  const [listings,  setListings]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [total,     setTotal]     = useState(0);
  const [search,    setSearch]    = useState('');
  const [minPrice,  setMinPrice]  = useState('');
  const [maxPrice,  setMaxPrice]  = useState('');
  const [bedrooms,  setBedrooms]  = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const fetchListings = async (q?: {search?:string; minPrice?:string; maxPrice?:string; bedrooms?:string}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q?.search   || search)   params.set('search',   q?.search   ?? search);
      if (q?.minPrice || minPrice) params.set('minPrice', q?.minPrice ?? minPrice);
      if (q?.maxPrice || maxPrice) params.set('maxPrice', q?.maxPrice ?? maxPrice);
      if (q?.bedrooms || bedrooms) params.set('bedrooms', q?.bedrooms ?? bedrooms);
      params.set('limit', '24');

      const res = await fetch(`/api/marketplace/discover?${params.toString()}`);
      const data = await res.json();
      setListings(data.listings ?? []);
      setTotal(data.total ?? 0);
    } catch { setListings([]); }
    finally  { setLoading(false); }
  };

  useEffect(() => { fetchListings(); }, []);

  const clearFilters = () => {
    setSearch(''); setMinPrice(''); setMaxPrice(''); setBedrooms('');
    fetchListings({ search: '', minPrice: '', maxPrice: '', bedrooms: '' });
  };

  const hasFilters = search || minPrice || maxPrice || bedrooms;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      {/* Sticky header */}
      <div className="sticky top-0 z-50 border-b border-zinc-900 bg-[#050505]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-5 h-5 bg-teal-500 rounded flex items-center justify-center">
                  <span className="text-black font-black text-[8px]">NA</span>
                </div>
                <span className="text-[9px] text-teal-500 uppercase font-black tracking-widest">Nested Ark</span>
              </div>
              <h1 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                <Home size={16} className="text-teal-400" /> Property Marketplace
              </h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                {total > 0 ? `${total} verified listing${total > 1 ? 's' : ''} available` : 'Verified rental properties across Nigeria'}
              </p>
            </div>

            {/* Search bar */}
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchListings()}
                  placeholder="Location, unit name…"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-zinc-200 outline-none focus:border-teal-500 transition-colors"
                />
              </div>
              <button onClick={() => fetchListings()}
                className="px-5 py-2.5 bg-teal-500 text-black text-xs font-black uppercase rounded-xl tracking-widest hover:bg-teal-400 transition-all">
                Search
              </button>
              <button onClick={() => setShowFilter(!showFilter)}
                className={`px-3 py-2.5 border rounded-xl text-xs font-black transition-all ${showFilter ? 'border-teal-500 text-teal-400 bg-teal-500/10' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}>
                <Filter size={14} />
              </button>
            </div>
          </div>

          {/* Filters panel */}
          {showFilter && (
            <div className="mt-4 pt-4 border-t border-zinc-900 flex flex-wrap gap-3 items-end">
              <div>
                <p className="text-[9px] text-zinc-500 uppercase font-bold mb-1">Min Rent (NGN)</p>
                <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)}
                  placeholder="e.g. 100000"
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-500 w-36" />
              </div>
              <div>
                <p className="text-[9px] text-zinc-500 uppercase font-bold mb-1">Max Rent (NGN)</p>
                <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)}
                  placeholder="e.g. 5000000"
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-500 w-36" />
              </div>
              <div>
                <p className="text-[9px] text-zinc-500 uppercase font-bold mb-1">Bedrooms</p>
                <select value={bedrooms} onChange={e => setBedrooms(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-500 w-28">
                  <option value="">Any</option>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} BR</option>)}
                </select>
              </div>
              <button onClick={() => fetchListings()}
                className="px-5 py-2 bg-teal-500 text-black text-[10px] font-black uppercase rounded-xl hover:bg-teal-400 transition-all">
                Apply Filters
              </button>
              {hasFilters && (
                <button onClick={clearFilters}
                  className="flex items-center gap-1.5 px-4 py-2 border border-zinc-700 text-zinc-400 text-[10px] font-bold uppercase rounded-xl hover:border-red-500/30 hover:text-red-400 transition-all">
                  <X size={11} /> Clear
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Listings grid */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        {loading ? (
          <div className="flex justify-center items-center py-32 gap-3 text-zinc-500">
            <Loader2 size={18} className="animate-spin text-teal-400" />
            <span className="text-xs uppercase font-bold tracking-widest">Searching verified infrastructure logs…</span>
          </div>
        ) : listings.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
            <Building2 className="text-zinc-700 mx-auto" size={40} />
            <p className="text-zinc-400 font-bold uppercase text-sm">No listings found</p>
            <p className="text-zinc-600 text-xs">
              {hasFilters ? 'Try adjusting your filters.' : 'No properties are currently advertised on the marketplace.'}
            </p>
            {hasFilters && (
              <button onClick={clearFilters}
                className="px-6 py-2.5 border border-zinc-700 text-zinc-400 text-xs font-bold uppercase rounded-xl hover:border-teal-500/30 hover:text-teal-400 transition-all">
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest mb-6">
              Showing {listings.length} of {total} listing{total !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map(unit => (
                <div key={unit.id}
                  className="group bg-zinc-900/30 border border-zinc-800 hover:border-teal-500/30 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col">

                  {/* Cover image */}
                  <div className="relative aspect-video bg-zinc-900 border-b border-zinc-800 overflow-hidden">
                    {unit.cover_image ? (
                      <img src={unit.cover_image} alt={unit.unit_name}
                        className="object-cover w-full h-full group-hover:scale-105 transition-all duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Building2 size={32} className="text-zinc-700" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className="flex items-center gap-1 bg-teal-500/10 border border-teal-500/30 text-teal-400 text-[8px] px-2 py-0.5 rounded font-black uppercase backdrop-blur-sm">
                        <ShieldCheck size={9} /> Ark Verified
                      </span>
                      {unit.furnished && (
                        <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[8px] px-2 py-0.5 rounded font-black uppercase">Furnished</span>
                      )}
                    </div>
                    <div className="absolute bottom-3 right-3">
                      <span className="bg-black/80 text-white text-[9px] px-2 py-1 rounded font-mono font-bold">
                        {unit.currency || 'NGN'} {safeF(unit.rent_amount)} / {(unit.payment_frequency || 'yr').toLowerCase()}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-black text-sm uppercase tracking-tight text-white truncate">{unit.unit_name}</h3>
                    <p className="text-[10px] text-zinc-500 font-mono mt-1 flex items-center gap-1">
                      <MapPin size={9} /> {unit.project_title}
                      {unit.location && ` · ${unit.location}`}
                      {unit.country && `, ${unit.country}`}
                    </p>

                    {/* Specs row */}
                    <div className="flex items-center gap-4 mt-3 text-[10px] text-zinc-400 font-mono">
                      {unit.bedrooms > 0 && (
                        <span className="flex items-center gap-1"><BedDouble size={11} className="text-zinc-600" /> {unit.bedrooms} BR</span>
                      )}
                      {unit.bathrooms > 0 && (
                        <span className="flex items-center gap-1"><Bath size={11} className="text-zinc-600" /> {unit.bathrooms} BTH</span>
                      )}
                      {unit.size_sqm > 0 && (
                        <span>{unit.size_sqm} m²</span>
                      )}
                      {unit.parking && (
                        <span className="text-teal-500">Parking</span>
                      )}
                    </div>

                    {/* Fees row */}
                    {(unit.security_deposit > 0 || unit.agency_fee > 0 || unit.caution_fee > 0) && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {unit.security_deposit > 0 && (
                          <span className="text-[8px] px-2 py-0.5 rounded border border-zinc-700 text-zinc-500 font-mono">
                            Deposit: ₦{safeF(unit.security_deposit)}
                          </span>
                        )}
                        {unit.agency_fee > 0 && (
                          <span className="text-[8px] px-2 py-0.5 rounded border border-zinc-700 text-zinc-500 font-mono">
                            Agency: ₦{safeF(unit.agency_fee)}
                          </span>
                        )}
                        {unit.caution_fee > 0 && (
                          <span className="text-[8px] px-2 py-0.5 rounded border border-zinc-700 text-zinc-500 font-mono">
                            Caution: ₦{safeF(unit.caution_fee)}
                          </span>
                        )}
                      </div>
                    )}

                    {unit.marketing_description && (
                      <p className="text-[11px] text-zinc-500 mt-3 line-clamp-2 leading-relaxed font-sans flex-1">
                        {unit.marketing_description}
                      </p>
                    )}

                    {/* Amenities */}
                    {unit.amenities && unit.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {(Array.isArray(unit.amenities) ? unit.amenities : []).slice(0, 3).map((a: string) => (
                          <span key={a} className="text-[8px] px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-bold uppercase">
                            {a}
                          </span>
                        ))}
                        {unit.amenities.length > 3 && (
                          <span className="text-[8px] px-2 py-0.5 rounded border border-zinc-700 text-zinc-500">
                            +{unit.amenities.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-5 pb-5">
                    <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                      <div>
                        <p className="text-[8px] text-zinc-600 uppercase font-bold">Annual Rent</p>
                        <p className="font-mono font-black text-teal-400 text-base">{unit.currency || 'NGN'} {safeF(unit.rent_amount)}</p>
                      </div>
                      <Link
                        href={`/marketplace/${unit.id}`}
                        className="flex items-center gap-1.5 px-5 py-2.5 bg-white text-black text-[10px] font-black uppercase rounded-xl hover:bg-teal-500 transition-all">
                        View Details <ChevronRight size={12} />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Footer strip */}
      <div className="border-t border-zinc-900 px-6 py-6 text-center">
        <p className="text-[9px] text-zinc-700 uppercase tracking-widest">
          Nested Ark OS · Impressions & Impacts Ltd · Lagos · London · Dubai
        </p>
        <p className="text-[8px] text-zinc-800 mt-1">All listings verified. Payments secured via Paystack escrow. SHA-256 immutable ledger.</p>
      </div>
      <Footer />
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    }>
      <MarketplaceContent />
    </Suspense>
  );
}
