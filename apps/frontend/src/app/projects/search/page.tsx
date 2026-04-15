'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCurrency } from '@/hooks/useCurrency';
import api from '@/lib/api';
import {
  Search, MapPin, ShieldCheck, TrendingUp, Briefcase,
  Loader2, ArrowRight, Building2, Eye, Users, X, RefreshCw
} from 'lucide-react';

interface SearchResult {
  id: string; project_number: string; title: string; location: string; country: string;
  budget: number; category: string; owner_type: string; project_type: string;
  status: string; gov_verified: boolean; expected_roi: number; timeline_months: number;
  milestone_count: number; bid_count: number; created_at: string; sponsor_name: string;
}

const OWNER_ICONS: Record<string, any> = {
  INDIVIDUAL: '👤', CORPORATE: '🏢', PRIVATE_BUSINESS: '💼',
  DEVELOPER: '🏠', GOVERNMENT: '🏛',
};

function SearchContent() {
  const params    = useSearchParams();
  const router    = useRouter();
  const { format } = useCurrency();
  const initialQ  = params.get('q') || '';

  const [query,    setQuery]    = useState(initialQ);
  const [input,    setInput]    = useState(initialQ);
  const [results,  setResults]  = useState<SearchResult[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);
  const [error,    setError]    = useState('');

  const doSearch = async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setError('Enter at least 2 characters to search.');
      return;
    }
    setLoading(true); setError(''); setSearched(true);
    try {
      const res = await api.get('/api/projects/search', { params: { q: q.trim() } });
      setResults(res.data.results ?? []);
      // Update URL without navigation
      const url = new URL(window.location.href);
      url.searchParams.set('q', q.trim());
      window.history.replaceState({}, '', url.toString());
    } catch (ex: any) {
      setError(ex?.response?.data?.error ?? 'Search failed. Please try again.');
      setResults([]);
    } finally { setLoading(false); }
  };

  // Run on mount if query param present
  useEffect(() => {
    if (initialQ.trim().length >= 2) doSearch(initialQ);
  }, []); // eslint-disable-line

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(input);
    doSearch(input);
  };

  const isNapId = (s: string) => /^NAP-\d{4}-\d{5}$/i.test(s.trim());

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      {/* Search hero */}
      <div className="border-b border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-transparent px-6 py-12">
        <div className="max-w-3xl mx-auto space-y-5 text-center">
          <div>
            <p className="text-[9px] text-teal-500 uppercase font-bold tracking-[0.2em] mb-2">Global Project Search</p>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic">Find Any Project</h1>
            <p className="text-zinc-500 text-sm mt-2">Search by Project ID (NAP-2026-00042), keyword, city or category</p>
          </div>

          <form onSubmit={handleSubmit} className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-teal-500/20 to-emerald-500/10 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition" />
            <div className="relative flex items-center bg-zinc-900 border border-zinc-800 rounded-2xl p-2 focus-within:border-teal-500 transition-all">
              <div className="pl-3 pr-2 text-zinc-600 flex-shrink-0"><Search size={18} /></div>
              <input
                type="text"
                placeholder="NAP-2026-00042, Lagos bridge, residential, contractor…"
                value={input}
                onChange={e => setInput(e.target.value.toUpperCase())}
                autoFocus
                className="flex-1 bg-transparent border-none outline-none text-sm font-mono py-3 tracking-wide placeholder:text-zinc-700 placeholder:font-sans placeholder:tracking-normal placeholder:normal-case"
              />
              {input && (
                <button type="button" onClick={() => { setInput(''); setQuery(''); setResults([]); setSearched(false); }}
                  className="text-zinc-600 hover:text-white mr-1 flex-shrink-0"><X size={14} /></button>
              )}
              <button type="submit" disabled={loading}
                className="bg-teal-500 text-black px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all flex items-center gap-1.5 disabled:opacity-60 flex-shrink-0">
                {loading ? <Loader2 className="animate-spin" size={12} /> : <><Search size={11} /> Search</>}
              </button>
            </div>
          </form>

          {/* Smart hint */}
          {input && isNapId(input) && (
            <p className="text-[9px] text-teal-500 font-mono font-bold">
              ✓ Valid Project ID format detected — searching exact match
            </p>
          )}
        </div>
      </div>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-10 w-full space-y-6">

        {/* State: idle */}
        {!searched && !loading && (
          <div className="py-20 text-center space-y-6">
            <Building2 className="text-zinc-800 mx-auto" size={48} />
            <div className="space-y-2">
              <p className="text-zinc-500 text-base font-bold">Search the infrastructure marketplace</p>
              <p className="text-zinc-700 text-sm">Enter a Project ID, city, category or keyword above</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {['NAP-2026-00001', 'Lagos', 'Residential', 'Bridge', 'Solar', 'Kano'].map(hint => (
                <button key={hint} onClick={() => { setInput(hint); setQuery(hint); doSearch(hint); }}
                  className="px-3 py-1.5 border border-zinc-800 text-zinc-500 font-mono text-[10px] rounded-lg hover:border-teal-500/40 hover:text-teal-500 transition-all">
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* State: loading */}
        {loading && (
          <div className="py-20 text-center">
            <Loader2 className="animate-spin text-teal-500 mx-auto mb-4" size={32} />
            <p className="text-zinc-500 text-sm">Scanning marketplace for <span className="text-white font-mono">{query}</span>…</p>
          </div>
        )}

        {/* State: error */}
        {error && !loading && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-sm font-bold text-center">
            {error}
          </div>
        )}

        {/* State: results */}
        {searched && !loading && !error && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-bold text-white">
                  {results.length === 0
                    ? 'No results found'
                    : `${results.length} project${results.length !== 1 ? 's' : ''} found`
                  }
                </p>
                <p className="text-[9px] text-zinc-600 mt-0.5 font-mono">
                  Search: <span className="text-teal-500">{query}</span>
                  {isNapId(query) && results.length === 1 && ' · Exact Project ID match'}
                </p>
              </div>
              <button onClick={() => doSearch(query)} disabled={loading}
                className="flex items-center gap-1.5 text-[9px] text-zinc-500 hover:text-teal-500 font-bold uppercase transition-colors">
                <RefreshCw size={10} /> Refresh
              </button>
            </div>

            {results.length === 0 && (
              <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
                <Search className="text-zinc-700 mx-auto" size={36} />
                <div>
                  <p className="text-zinc-400 font-bold">No projects match "{query}"</p>
                  <p className="text-zinc-600 text-sm mt-1">Check the Project ID format (NAP-YYYY-NNNNN) or try a different keyword</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {['Lagos', 'Abuja', 'Residential', 'Energy', 'Roads'].map(s => (
                    <button key={s} onClick={() => { setInput(s); setQuery(s); doSearch(s); }}
                      className="px-3 py-1.5 border border-zinc-800 text-zinc-600 text-[10px] rounded-lg hover:text-teal-500 hover:border-teal-500/30 transition-all">
                      Try "{s}"
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {results.map(p => (
                <div key={p.id}
                  className={`p-6 rounded-2xl border transition-all hover:border-zinc-700 ${
                    isNapId(query) && results.length === 1
                      ? 'border-teal-500/30 bg-teal-500/5'
                      : 'border-zinc-800 bg-zinc-900/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      {/* Project ID badge */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-[9px] text-teal-500 font-mono font-black bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded">
                          {p.project_number}
                        </span>
                        {p.gov_verified && (
                          <span className="flex items-center gap-1 text-[8px] text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded font-bold">
                            <ShieldCheck size={8} /> Gov Verified
                          </span>
                        )}
                        <span className="text-[8px] text-zinc-600 border border-zinc-800 px-2 py-0.5 rounded">
                          {OWNER_ICONS[p.owner_type] ?? '📋'} {p.owner_type?.replace('_', ' ')}
                        </span>
                        <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${
                          p.status === 'ACTIVE' ? 'border-teal-500/30 text-teal-500' : 'border-zinc-700 text-zinc-500'
                        }`}>{p.status}</span>
                      </div>

                      <h3 className="font-bold uppercase tracking-tight text-base mb-1">{p.title}</h3>
                      <div className="flex items-center gap-3 text-[9px] text-zinc-500 flex-wrap">
                        <span className="flex items-center gap-1"><MapPin size={9} /> {p.location}, {p.country}</span>
                        <span>{p.category}</span>
                        {p.timeline_months && <span>{p.timeline_months}mo timeline</span>}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 space-y-1">
                      <p className="font-mono font-bold text-lg">{format(Number(p.budget))}</p>
                      <p className="text-[9px] text-teal-400 font-bold">{p.expected_roi ?? 12}% ROI p.a.</p>
                    </div>
                  </div>

                  {/* Stats + action */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800/60">
                    <div className="flex items-center gap-4 text-[9px] text-zinc-600">
                      <span className="flex items-center gap-1"><Briefcase size={9} /> {Number(p.milestone_count) || 0} milestones</span>
                      <span className="flex items-center gap-1"><Users size={9} /> {Number(p.bid_count) || 0} bids</span>
                      <span className="text-zinc-700 font-mono">Submitted by {p.sponsor_name ?? 'Owner'}</span>
                    </div>
                    <Link href={`/projects/${p.id}`}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-white text-black font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-teal-500 transition-all">
                      View & Bid <ArrowRight size={10} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Post-search CTA */}
            {results.length > 0 && (
              <div className="pt-4 flex items-center justify-between text-[9px] text-zinc-600 border-t border-zinc-900">
                <span>Can't find your project?</span>
                <Link href="/projects/submit" className="text-teal-500 font-bold hover:text-white transition-colors">
                  Post it to the marketplace →
                </Link>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
