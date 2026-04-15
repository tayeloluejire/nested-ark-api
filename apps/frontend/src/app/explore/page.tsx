'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCurrency } from '@/hooks/useCurrency';
import api from '@/lib/api';
import {
  Search, MapPin, ShieldCheck, TrendingUp, Loader2, ArrowRight,
  Building2, Users, X, RefreshCw, Hammer, Home, Wallet, Filter
} from 'lucide-react';

interface Project {
  id: string;
  project_number: string;
  title: string;
  location: string;
  country: string;
  budget: number;
  category: string;
  owner_type: string;
  project_type: string;
  status: string;
  project_status: string;
  gov_verified: boolean;
  expected_roi: number;
  timeline_months: number;
  milestone_count: number;
  bid_count: number;
  open_bids: number;
  funded_pct: number;
  has_rental: boolean;
  created_at: string;
  sponsor_name: string;
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:        'border-teal-500/30 text-teal-500',
  OPERATIONAL:   'border-green-500/30 text-green-400',
  CONSTRUCTION:  'border-amber-500/30 text-amber-400',
  PLANNING:      'border-blue-500/30 text-blue-400',
};

const ROLES = [
  { key: 'ALL',    label: 'All' },
  { key: 'INVEST', label: '💼 Invest' },
  { key: 'BID',    label: '🔨 Bid for Job' },
  { key: 'RENT',   label: '🏠 Rental' },
];

function ExplorerContent() {
  const params     = useSearchParams();
  const { format } = useCurrency();
  const initialQ   = params.get('q') || '';

  const [query,    setQuery]    = useState(initialQ);
  const [input,    setInput]    = useState(initialQ);
  const [role,     setRole]     = useState('ALL');
  const [results,  setResults]  = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);
  const [error,    setError]    = useState('');

  const doSearch = async (q: string) => {
    setLoading(true); setError(''); setSearched(true);
    try {
      const res = await api.get('/api/projects/search', { params: { q: q.trim() || undefined } });
      setResults(res.data.results ?? res.data ?? []);
    } catch (ex: any) {
      setError(ex?.response?.data?.error ?? 'Search failed.');
      setResults([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { doSearch(initialQ); }, []); // eslint-disable-line

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(input);
    doSearch(input);
  };

  const filtered = results.filter(p => {
    if (role === 'ALL')    return true;
    if (role === 'INVEST') return p.status === 'ACTIVE' || p.funded_pct < 100;
    if (role === 'BID')    return (p.open_bids ?? 0) > 0 || p.status === 'CONSTRUCTION';
    if (role === 'RENT')   return p.has_rental || p.project_status === 'OPERATIONAL';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      {/* Hero search */}
      <div className="border-b border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-transparent px-6 py-10">
        <div className="max-w-4xl mx-auto space-y-5">
          <div className="text-center">
            <p className="text-[9px] text-teal-500 uppercase font-bold tracking-[0.2em] mb-2">Global Infrastructure Marketplace</p>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">Explore &amp; Participate</h1>
            <p className="text-zinc-500 text-sm mt-2">Invest, bid for a job, or find rental income — all on the same project</p>
          </div>

          {/* Search */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="flex-1 flex items-center bg-zinc-900 border border-zinc-800 rounded-2xl px-4 focus-within:border-teal-500 transition-all">
              <Search size={16} className="text-zinc-600 flex-shrink-0 mr-3" />
              <input
                type="text"
                placeholder="NAP-2026-00041, Lagos, Residential, Solar, Plumbing…"
                value={input}
                onChange={e => setInput(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-sm py-4 placeholder:text-zinc-700"
              />
              {input && (
                <button type="button" onClick={() => { setInput(''); setQuery(''); doSearch(''); }}
                  className="text-zinc-600 hover:text-white ml-2 flex-shrink-0">
                  <X size={13} />
                </button>
              )}
            </div>
            <button type="submit" disabled={loading}
              className="bg-teal-500 text-black px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all flex items-center gap-1.5 disabled:opacity-60 flex-shrink-0">
              {loading ? <Loader2 className="animate-spin" size={12} /> : <><Search size={11} /> Search</>}
            </button>
          </form>

          {/* Role filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={11} className="text-zinc-600" />
            {ROLES.map(r => (
              <button key={r.key} onClick={() => setRole(r.key)}
                className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${role === r.key ? 'bg-teal-500 text-black border-teal-500' : 'border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600'}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-8 w-full space-y-4">

        {/* Results header */}
        {searched && !loading && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm font-bold">
              {filtered.length === 0 ? 'No results' : `${filtered.length} project${filtered.length !== 1 ? 's' : ''}`}
              {role !== 'ALL' && <span className="text-zinc-500"> · filtered by {role.toLowerCase()}</span>}
            </p>
            <button onClick={() => doSearch(query)} disabled={loading}
              className="flex items-center gap-1.5 text-[9px] text-zinc-500 hover:text-teal-500 font-bold uppercase transition-colors">
              <RefreshCw size={10} /> Refresh
            </button>
          </div>
        )}

        {loading && (
          <div className="py-20 text-center">
            <Loader2 className="animate-spin text-teal-500 mx-auto mb-4" size={28} />
            <p className="text-zinc-500 text-sm">Scanning marketplace…</p>
          </div>
        )}

        {error && !loading && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-sm font-bold text-center">{error}</div>
        )}

        {/* Project cards */}
        {!loading && filtered.map(p => {
          const statusStyle = STATUS_STYLES[p.status] ?? 'border-zinc-700 text-zinc-500';
          const funded = Number(p.funded_pct ?? 0);
          const canInvest = funded < 100;
          const canBid    = (p.open_bids ?? 0) > 0 || p.status === 'CONSTRUCTION';
          const canRent   = p.has_rental || p.project_status === 'OPERATIONAL';

          return (
            <div key={p.id} className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 transition-all space-y-4">
              {/* Top row */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-[9px] text-teal-500 font-mono font-black bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded">
                      {p.project_number}
                    </span>
                    {p.gov_verified && (
                      <span className="flex items-center gap-1 text-[8px] text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded font-bold">
                        <ShieldCheck size={8} /> Verified
                      </span>
                    )}
                    <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${statusStyle}`}>{p.status}</span>
                  </div>
                  <h3 className="font-bold uppercase tracking-tight text-base mb-1">{p.title}</h3>
                  <div className="flex items-center gap-3 text-[9px] text-zinc-500 flex-wrap">
                    <span className="flex items-center gap-1"><MapPin size={9} /> {p.location}, {p.country}</span>
                    <span>{p.category}</span>
                    {p.timeline_months && <span>{p.timeline_months}mo timeline</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono font-bold text-lg">{format(Number(p.budget))}</p>
                  <p className="text-[9px] text-teal-400 font-bold">{p.expected_roi ?? 12}% ROI p.a.</p>
                </div>
              </div>

              {/* Funding bar */}
              {funded > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] text-zinc-600">
                    <span>Funding progress</span>
                    <span>{funded}% funded</span>
                  </div>
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 transition-all" style={{ width: `${Math.min(funded, 100)}%` }} />
                  </div>
                </div>
              )}

              {/* Omni-action row — THE KEY FEATURE */}
              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-zinc-800/60">
                {canInvest && (
                  <Link href={`/projects/${p.id}?tab=invest`}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-500/10 border border-teal-500/30 text-teal-400 font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-teal-500 hover:text-black transition-all">
                    <Wallet size={10} /> Invest · {p.expected_roi ?? 12}% ROI
                  </Link>
                )}
                {canBid && (
                  <Link href={`/projects/${p.id}?tab=bid`}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-blue-500 hover:text-white transition-all">
                    <Hammer size={10} /> Bid for Job{(p.open_bids ?? 0) > 0 ? ` · ${p.open_bids} open` : ''}
                  </Link>
                )}
                {canRent && (
                  <Link href={`/projects/${p.id}?tab=rent`}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-amber-500 hover:text-black transition-all">
                    <Home size={10} /> Rental Info
                  </Link>
                )}
                <Link href={`/projects/${p.id}`}
                  className="ml-auto flex items-center gap-1.5 px-5 py-2.5 bg-white text-black font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-teal-500 transition-all">
                  Full Details <ArrowRight size={10} />
                </Link>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-[9px] text-zinc-600">
                <span className="flex items-center gap-1"><Building2 size={9} /> {p.milestone_count ?? 0} milestones</span>
                <span className="flex items-center gap-1"><Users size={9} /> {p.bid_count ?? 0} bids</span>
                <span className="text-zinc-700 font-mono ml-auto">by {p.sponsor_name ?? 'Owner'}</span>
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {searched && !loading && !error && filtered.length === 0 && (
          <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
            <Building2 className="text-zinc-700 mx-auto" size={40} />
            <div>
              <p className="text-zinc-400 font-bold">No projects match this search</p>
              <p className="text-zinc-600 text-sm mt-1">Try a different keyword, city, or role filter</p>
            </div>
            <Link href="/projects/submit"
              className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all">
              Submit a Project <ArrowRight size={11} />
            </Link>
          </div>
        )}

        {/* Post-search CTA */}
        {filtered.length > 0 && (
          <div className="pt-4 flex items-center justify-between text-[9px] text-zinc-600 border-t border-zinc-900">
            <span>Don't see your project?</span>
            <Link href="/projects/submit" className="text-teal-500 font-bold hover:text-white transition-colors">
              Post it to the marketplace →
            </Link>
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
    }>
      <ExplorerContent />
    </Suspense>
  );
}
