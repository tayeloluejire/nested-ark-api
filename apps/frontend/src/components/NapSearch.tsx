'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Search, Loader2, ShieldCheck, MapPin, X, ArrowRight } from 'lucide-react';

interface SearchHit {
  id: string; project_number: string; title: string;
  location: string; country: string; category: string;
  gov_verified: boolean; bid_count: number;
}

interface Props {
  /** 'inline' = floats below field; 'page' = navigate to /projects/search */
  mode?: 'inline' | 'page';
  placeholder?: string;
  compact?: boolean; // narrow pill style for navbar
}

export default function NapSearch({
  mode = 'inline',
  placeholder = 'Search by Project ID — NAP-2026-00042',
  compact = false,
}: Props) {
  const router = useRouter();
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState<SearchHit[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [open,     setOpen]     = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced live search
  useEffect(() => {
    if (mode !== 'inline' || query.trim().length < 2) {
      setResults([]); setOpen(false); return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/projects/search', { params: { q: query.trim() } });
        setResults(res.data.results?.slice(0, 6) ?? []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 320);
    return () => clearTimeout(timer);
  }, [query, mode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (mode === 'page' || q.length < 2) {
      router.push(`/projects/search?q=${encodeURIComponent(q)}`);
    }
  };

  const handleSelect = (p: SearchHit) => {
    setQuery(''); setOpen(false);
    router.push(`/projects/${p.id}`);
  };

  const clear = () => { setQuery(''); setResults([]); setOpen(false); };

  return (
    <div ref={containerRef} className={`relative ${compact ? 'w-52' : 'w-full max-w-md'}`}>
      <form onSubmit={handleSubmit}>
        <div className={`flex items-center bg-zinc-900 border transition-all rounded-xl ${
          open ? 'border-teal-500' : 'border-zinc-800 hover:border-zinc-700'
        } ${compact ? 'px-3 py-1.5 gap-2' : 'px-4 py-2.5 gap-2'}`}>
          {loading
            ? <Loader2 size={compact ? 12 : 14} className="text-zinc-600 animate-spin flex-shrink-0" />
            : <Search size={compact ? 12 : 14} className="text-zinc-600 flex-shrink-0" />
          }
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value.toUpperCase())}
            placeholder={compact ? 'NAP-2026-…' : placeholder}
            className={`flex-1 bg-transparent outline-none font-mono text-white placeholder:text-zinc-700 placeholder:font-sans placeholder:normal-case ${
              compact ? 'text-[10px]' : 'text-xs'
            }`}
          />
          {query && (
            <button type="button" onClick={clear} className="text-zinc-600 hover:text-white transition-colors flex-shrink-0">
              <X size={12} />
            </button>
          )}
          {!compact && (
            <button type="submit"
              className="bg-teal-500 text-black px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-white transition-all flex-shrink-0">
              Find
            </button>
          )}
        </div>
      </form>

      {/* Inline dropdown results */}
      {open && results.length > 0 && mode === 'inline' && (
        <div className="absolute top-full left-0 right-0 mt-1.5 rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/60 z-[200] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
              {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
            </p>
            <Link href={`/projects/search?q=${encodeURIComponent(query)}`}
              className="text-[8px] text-teal-500 font-bold uppercase hover:text-white transition-colors flex items-center gap-1">
              All results <ArrowRight size={8} />
            </Link>
          </div>
          {results.map(p => (
            <button key={p.id} onClick={() => handleSelect(p)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-zinc-900/60 transition-colors border-b border-zinc-900 last:border-0 text-left group">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[8px] text-teal-500 font-mono font-black">{p.project_number}</span>
                  {p.gov_verified && <ShieldCheck size={9} className="text-teal-500 flex-shrink-0" />}
                </div>
                <p className="text-xs font-bold text-white truncate group-hover:text-teal-500 transition-colors">{p.title}</p>
                <p className="text-[9px] text-zinc-600 flex items-center gap-1 mt-0.5">
                  <MapPin size={8} /> {p.location}, {p.country} · {p.category}
                </p>
              </div>
              <ArrowRight size={12} className="text-zinc-700 group-hover:text-teal-500 transition-colors flex-shrink-0 ml-3" />
            </button>
          ))}
          {/* Empty state within dropdown */}
        </div>
      )}

      {/* No results */}
      {open && results.length === 0 && !loading && query.trim().length >= 2 && mode === 'inline' && (
        <div className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl z-[200] px-4 py-4 text-center">
          <p className="text-zinc-500 text-xs">No projects found for "{query}"</p>
          <Link href={`/projects/search?q=${encodeURIComponent(query)}`}
            className="text-[9px] text-teal-500 font-bold hover:text-white transition-colors mt-1 block">
            Search full marketplace →
          </Link>
        </div>
      )}
    </div>
  );
}
