'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCurrency } from '@/hooks/useCurrency';
import api from '@/lib/api';
import {
  Search, Filter, MapPin, Calendar, TrendingUp, ShieldCheck,
  Loader2, Plus, Eye, Heart, Briefcase, Star, Globe, Building2,
  User, RefreshCw, ChevronRight, X, Bookmark, Tag, LayoutGrid, List
} from 'lucide-react';

const CATEGORIES   = ['All','Roads','Bridges','Water','Energy','Technology','Housing','Healthcare','Education','Agriculture','Telecommunications','Industrial','Commercial','Residential','Landscape','Renovation','Other'];
const OWNER_TYPES  = [{ value: '', label: 'All Owners' },{ value: 'INDIVIDUAL', label: 'Individual' },{ value: 'CORPORATE', label: 'Corporate' },{ value: 'PRIVATE_BUSINESS', label: 'Private Business' },{ value: 'DEVELOPER', label: 'Developer' },{ value: 'GOVERNMENT', label: 'Government' }];
const SORT_OPTIONS = [{ value: 'newest', label: 'Newest First' },{ value: 'budget_high', label: 'Highest Budget' },{ value: 'budget_low', label: 'Lowest Budget' },{ value: 'most_viewed', label: 'Most Viewed' }];
const OWNER_ICONS: Record<string, any> = { INDIVIDUAL: User, CORPORATE: Building2, PRIVATE_BUSINESS: Briefcase, DEVELOPER: Globe, GOVERNMENT: ShieldCheck };

function fmtBudget(n: number, fmtFn: (v: number) => string): string {
  if (!n) return '—';
  return fmtFn(n);
}

interface Project {
  id: string; project_number: string; title: string; location: string; country: string;
  budget: number; category: string; status: string; gov_verified: boolean;
  expected_roi: number; timeline_months: number; owner_type: string; project_type: string;
  description: string; hero_image_url: string; milestone_count: number; bid_count: number;
  investor_count: number; total_raised_usd: number; view_count: number; save_count: number;
  tags: string[]; created_at: string; sponsor_name: string;
}

export default function MarketplacePage() {
  const { user } = useAuth();
  const { format } = useCurrency();

  const [projects,    setProjects]    = useState<Project[]>([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [viewMode,    setViewMode]    = useState<'grid'|'list'>('grid');
  const [saved,       setSaved]       = useState<Set<string>>(new Set());

  // Search state
  const [search,     setSearch]     = useState('');
  const [category,   setCategory]   = useState('All');
  const [ownerType,  setOwnerType]  = useState('');
  const [country,    setCountry]    = useState('');
  const [sort,       setSort]       = useState('newest');
  const [page,       setPage]       = useState(0);
  const [showFilters,setShowFilters]= useState(false);
  const LIMIT = 12;

  // Project number quick search
  const [projNumQuery, setProjNumQuery] = useState('');
  const [projNumResult, setProjNumResult] = useState<any[] | null>(null);
  const [searchingNum, setSearchingNum] = useState(false);

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        limit: LIMIT, offset: reset ? 0 : page * LIMIT, sort,
      };
      if (search)    params.search    = search;
      if (category !== 'All') params.category = category;
      if (ownerType) params.owner_type = ownerType;
      if (country)   params.country   = country;

      const res = await api.get('/api/projects', { params });
      if (reset) { setProjects(res.data.projects); setPage(0); }
      else       setProjects(p => [...p, ...res.data.projects]);
      setTotal(res.data.total);
    } finally { setLoading(false); }
  }, [search, category, ownerType, country, sort, page]);

  useEffect(() => { load(true); }, [search, category, ownerType, country, sort]);

  const searchByNumber = async () => {
    if (!projNumQuery.trim()) return;
    setSearchingNum(true); setProjNumResult(null);
    try {
      const res = await api.get('/api/projects/search', { params: { q: projNumQuery.trim() } });
      setProjNumResult(res.data.results);
    } catch { setProjNumResult([]); }
    finally { setSearchingNum(false); }
  };

  const toggleSave = async (projectId: string) => {
    if (!user) return;
    const isSaved = saved.has(projectId);
    try {
      if (isSaved) { await api.delete(`/api/projects/${projectId}/save`); setSaved(s => { const n = new Set(s); n.delete(projectId); return n; }); }
      else         { await api.post(`/api/projects/${projectId}/save`);   setSaved(s => new Set(s).add(projectId)); }
    } catch {}
  };

  const OI = ({ type }: { type: string }) => { const Icon = OWNER_ICONS[type] || Briefcase; return <Icon size={11} className="text-zinc-500" />; };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      {/* Hero search bar */}
      <div className="border-b border-zinc-800 bg-zinc-900/40 px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter italic">Project Marketplace</h1>
            <p className="text-zinc-500 text-sm">Search by Project ID · Browse by category · Bid or invest from anywhere in the world</p>
          </div>

          {/* Project Number Search */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={projNumQuery} onChange={e => setProjNumQuery(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && searchByNumber()}
                placeholder="Search by Project ID (e.g. NAP-2026-00042) or keyword…"
                className="w-full bg-black border border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors font-mono" />
            </div>
            <button onClick={searchByNumber} disabled={searchingNum}
              className="px-6 py-3 bg-teal-500 text-black font-bold rounded-xl text-sm hover:bg-teal-400 transition-all flex items-center gap-2 disabled:opacity-50">
              {searchingNum ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />} Search
            </button>
          </div>

          {/* Quick search results */}
          {projNumResult !== null && (
            <div className="rounded-2xl border border-zinc-800 bg-black overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{projNumResult.length} result{projNumResult.length !== 1 ? 's' : ''} for "{projNumQuery}"</p>
                <button onClick={() => { setProjNumResult(null); setProjNumQuery(''); }} className="text-zinc-600 hover:text-white"><X size={14} /></button>
              </div>
              {projNumResult.length === 0
                ? <p className="px-4 py-6 text-center text-zinc-600 text-sm">No projects found. Check the ID and try again.</p>
                : projNumResult.map(p => (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className="flex items-center justify-between px-4 py-4 hover:bg-zinc-900/40 transition-colors border-b border-zinc-900 last:border-0">
                    <div>
                      <p className="font-bold uppercase text-sm">{p.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-[9px] text-zinc-500 font-mono">
                        <span className="text-teal-500">{p.project_number}</span>
                        <span>{p.location}, {p.country}</span>
                        <span>{p.category}</span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-zinc-600" />
                  </Link>
                ))
              }
            </div>
          )}
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full space-y-6">

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Text search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filter by title, location…"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-4 py-2.5 text-white text-xs outline-none focus:border-teal-500 transition-colors" />
          </div>

          {/* Category */}
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-teal-500 cursor-pointer">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Owner type */}
          <select value={ownerType} onChange={e => setOwnerType(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-teal-500 cursor-pointer">
            {OWNER_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Country */}
          <input value={country} onChange={e => setCountry(e.target.value)}
            placeholder="Country…"
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-teal-500 w-32" />

          {/* Sort */}
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-teal-500 cursor-pointer">
            {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          {/* View toggle */}
          <div className="flex gap-1 border border-zinc-800 rounded-xl p-1">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-teal-500 text-black' : 'text-zinc-500 hover:text-white'}`}><LayoutGrid size={14} /></button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-teal-500 text-black' : 'text-zinc-500 hover:text-white'}`}><List size={14} /></button>
          </div>

          {/* Submit CTA */}
          <Link href="/projects/submit"
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-black font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-teal-500 transition-all ml-auto">
            <Plus size={11} /> Post Project
          </Link>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
          <span>{total.toLocaleString()} project{total !== 1 ? 's' : ''}</span>
          <span className="text-zinc-700">·</span>
          <button onClick={() => load(true)} className="hover:text-teal-500 flex items-center gap-1 transition-colors">
            <RefreshCw size={9} /> Refresh
          </button>
        </div>

        {/* Grid */}
        {loading && projects.length === 0 ? (
          <div className="py-20 text-center"><Loader2 className="animate-spin text-teal-500 mx-auto" size={28} /></div>
        ) : projects.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl space-y-3">
            <Search className="text-zinc-700 mx-auto" size={32} />
            <p className="text-zinc-500 text-sm">No projects match your search</p>
            <button onClick={() => { setSearch(''); setCategory('All'); setOwnerType(''); setCountry(''); }}
              className="text-teal-500 text-xs font-bold uppercase hover:text-white transition-colors">Clear filters</button>
          </div>
        ) : (
          <div className={viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'
            : 'flex flex-col gap-3'
          }>
            {projects.map(p => (
              viewMode === 'grid'
                ? <ProjectCard key={p.id} p={p} format={format} saved={saved.has(p.id)} onSave={() => toggleSave(p.id)} />
                : <ProjectRow  key={p.id} p={p} format={format} saved={saved.has(p.id)} onSave={() => toggleSave(p.id)} />
            ))}
          </div>
        )}

        {/* Load more */}
        {projects.length < total && (
          <div className="text-center pt-4">
            <button onClick={() => { setPage(p => p + 1); load(false); }} disabled={loading}
              className="px-8 py-3 border border-zinc-700 text-zinc-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:text-white hover:border-zinc-500 transition-all disabled:opacity-50 flex items-center gap-2 mx-auto">
              {loading ? <Loader2 className="animate-spin" size={12} /> : null}
              Load More ({total - projects.length} remaining)
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

// ── Project card (grid view) ──────────────────────────────────────────────────
function ProjectCard({ p, format, saved, onSave }: { p: Project; format: (n: number) => string; saved: boolean; onSave: () => void }) {
  const raised = Number(p.total_raised_usd) || 0;
  const budget = Number(p.budget)            || 1;
  const pct    = Math.min((raised / budget) * 100, 100);
  const OIcon  = OWNER_ICONS[p.owner_type] || Briefcase;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 transition-all overflow-hidden group flex flex-col">
      {/* Image */}
      <div className="relative h-44 bg-zinc-900 overflow-hidden">
        {p.hero_image_url
          ? <img src={p.hero_image_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center"><Building2 className="text-zinc-700" size={40} /></div>
        }
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span className="text-[8px] bg-black/70 text-teal-500 font-mono font-bold px-2 py-1 rounded border border-teal-500/30">{p.project_number}</span>
          {p.gov_verified && <span className="text-[8px] bg-teal-500/20 text-teal-500 font-bold px-2 py-1 rounded border border-teal-500/40 flex items-center gap-1"><ShieldCheck size={8} /> Verified</span>}
        </div>
        <button onClick={onSave} className={`absolute top-3 right-3 p-1.5 rounded-lg border transition-all ${saved ? 'bg-teal-500 border-teal-400 text-black' : 'bg-black/60 border-zinc-700 text-zinc-400 hover:text-white'}`}>
          <Bookmark size={12} />
        </button>
      </div>

      <div className="p-5 flex flex-col flex-1 space-y-3">
        <div>
          <div className="flex items-start gap-2 mb-1">
            <OIcon size={11} className="text-zinc-500 mt-1 flex-shrink-0" />
            <h3 className="font-bold uppercase tracking-tight text-sm line-clamp-2 flex-1">{p.title}</h3>
          </div>
          <div className="flex items-center gap-2 text-[9px] text-zinc-500">
            <MapPin size={9} /> {p.location}, {p.country}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
            <p className="text-[8px] text-zinc-600 uppercase font-bold">Budget</p>
            <p className="text-sm font-mono font-bold text-white">{format(budget)}</p>
          </div>
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
            <p className="text-[8px] text-zinc-600 uppercase font-bold">ROI / yr</p>
            <p className="text-sm font-mono font-bold text-teal-400">{p.expected_roi ?? 12}%</p>
          </div>
        </div>

        {/* Funding bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[8px] text-zinc-500 font-bold uppercase">
            <span>Funding</span><span className="text-teal-500">{pct.toFixed(0)}%</span>
          </div>
          <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-teal-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Tags */}
        {p.tags?.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {p.tags.slice(0, 3).map(t => (
              <span key={t} className="text-[8px] bg-zinc-900 border border-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-[8px] text-zinc-600 pt-1">
          <span className="flex items-center gap-1"><Eye size={8} /> {Number(p.view_count) || 0}</span>
          <span className="flex items-center gap-1"><Briefcase size={8} /> {Number(p.bid_count) || 0} bids</span>
          <span className="flex items-center gap-1"><TrendingUp size={8} /> {Number(p.investor_count) || 0} investors</span>
        </div>

        <Link href={`/projects/${p.id}`}
          className="mt-auto flex items-center justify-center gap-2 py-3 bg-white text-black font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-teal-500 transition-all">
          View & Bid <ChevronRight size={11} />
        </Link>
      </div>
    </div>
  );
}

// ── Project row (list view) ───────────────────────────────────────────────────
function ProjectRow({ p, format, saved, onSave }: { p: Project; format: (n: number) => string; saved: boolean; onSave: () => void }) {
  const OIcon = OWNER_ICONS[p.owner_type] || Briefcase;
  return (
    <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 transition-all flex items-center gap-5">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[8px] text-teal-500 font-mono font-bold">{p.project_number}</span>
          <h3 className="font-bold uppercase tracking-tight text-sm">{p.title}</h3>
          {p.gov_verified && <ShieldCheck size={11} className="text-teal-500" />}
        </div>
        <div className="flex items-center gap-3 text-[9px] text-zinc-500">
          <span className="flex items-center gap-1"><MapPin size={8} /> {p.location}, {p.country}</span>
          <span className="flex items-center gap-1"><OIcon size={8} /> {p.owner_type?.replace('_', ' ')}</span>
          <span>{p.category}</span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-mono font-bold text-white">{format(Number(p.budget))}</p>
        <p className="text-[9px] text-teal-400">{p.expected_roi ?? 12}% ROI</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onSave} className={`p-1.5 rounded-lg border transition-all ${saved ? 'bg-teal-500 border-teal-400 text-black' : 'border-zinc-700 text-zinc-500 hover:text-teal-500'}`}>
          <Bookmark size={12} />
        </button>
        <Link href={`/projects/${p.id}`}
          className="flex items-center gap-1 px-4 py-2 bg-white text-black font-bold text-[9px] uppercase tracking-widest rounded-lg hover:bg-teal-500 transition-all">
          View <ChevronRight size={10} />
        </Link>
      </div>
    </div>
  );
}
