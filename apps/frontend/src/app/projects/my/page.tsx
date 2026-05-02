'use client';
export const dynamic = 'force-dynamic';
/**
 * /projects/my/page.tsx
 * DEVELOPER/LANDLORD — their submitted projects.
 * API: GET /api/projects/my → { success, projects: [...] }
 * This page must exist at /projects/my so it is matched BEFORE
 * /projects/[id] — Next.js App Router static segments win over dynamic.
 */
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import api from '@/lib/api';
import {
  Building2, Plus, Loader2, AlertCircle, MapPin,
  ShieldCheck, TrendingUp, Users, Briefcase, ArrowRight,
  RefreshCw, CheckCircle2, Clock, Eye,
} from 'lucide-react';

const safeN = (v:any) => { const n=Number(v); return(v==null||isNaN(n))?0:n; };
const safeF = (v:any) => safeN(v).toLocaleString();
const safeD = (v:any,d=1) => safeN(v).toFixed(d);

const STATUS_STYLE: Record<string,string> = {
  ACTIVE:    'border-teal-500/30 text-teal-500 bg-teal-500/5',
  DRAFT:     'border-zinc-700 text-zinc-500',
  COMPLETED: 'border-zinc-600 text-zinc-400',
  PAUSED:    'border-amber-500/30 text-amber-400',
  CANCELLED: 'border-red-500/30 text-red-400',
};

function MyProjectsContent() {
  const { user }   = useAuth();
  const { format } = useCurrency();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/api/projects/my');
      setProjects(res.data.projects ?? []);
    } catch(e:any) {
      setError(e?.response?.data?.error ?? 'Could not load your projects.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar/>
      <div className="flex items-center justify-center py-40">
        <Loader2 className="animate-spin text-teal-500" size={28}/>
      </div>
      <Footer/>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar/>
      <main className="flex-1 max-w-6xl mx-auto px-6 py-10 space-y-8 w-full">

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="border-l-2 border-teal-500 pl-5">
            <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">
              {user?.role === 'DEVELOPER' ? 'Landlord · Developer' : 'My Account'}
            </p>
            <h1 className="text-3xl font-black uppercase tracking-tighter">My Properties</h1>
            <p className="text-zinc-500 text-xs mt-1">Projects and properties you have submitted to the marketplace</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-zinc-800 text-zinc-500 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:text-white transition-all">
              <RefreshCw size={11}/> Refresh
            </button>
            <Link href="/projects/submit"
              className="flex items-center gap-1.5 px-5 py-2.5 bg-teal-500 text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white transition-all">
              <Plus size={12}/> Submit Project
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14}/> {error}
            <button onClick={load} className="ml-auto text-teal-500 text-xs font-black hover:text-white">Retry →</button>
          </div>
        )}

        {projects.length === 0 && !error ? (
          <div className="py-24 text-center border border-dashed border-zinc-800 rounded-2xl space-y-5">
            <Building2 className="text-zinc-700 mx-auto" size={48}/>
            <div>
              <p className="text-zinc-400 font-bold text-lg">No projects yet</p>
              <p className="text-zinc-600 text-sm mt-1">
                Submit your first infrastructure project or property to the marketplace.
              </p>
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link href="/projects/submit"
                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all">
                <Plus size={11}/> Submit a Project
              </Link>
              <Link href="/projects"
                className="inline-flex items-center gap-2 px-6 py-3 border border-zinc-700 text-zinc-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:text-white transition-all">
                Browse Marketplace
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((p:any) => {
              const tags: string[] = Array.isArray(p.tags) ? p.tags : [];
              return (
                <div key={p.id}
                  className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 transition-all">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] text-teal-500 font-mono font-black bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded">
                          {p.project_number}
                        </span>
                        <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${STATUS_STYLE[p.status] ?? 'border-zinc-700 text-zinc-500'}`}>
                          {p.status}
                        </span>
                        {p.gov_verified && (
                          <span className="flex items-center gap-1 text-[8px] text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded font-bold">
                            <ShieldCheck size={8}/> Gov Verified
                          </span>
                        )}
                        {tags.slice(0,2).map(tag => (
                          <span key={tag} className="text-[8px] text-zinc-600 border border-zinc-800 px-1.5 py-0.5 rounded font-mono">{tag}</span>
                        ))}
                      </div>
                      <h3 className="font-bold text-base uppercase tracking-tight">{p.title}</h3>
                      <div className="flex items-center gap-3 text-[9px] text-zinc-500 flex-wrap">
                        <span className="flex items-center gap-1"><MapPin size={8}/>{p.location}, {p.country}</span>
                        <span>{p.category}</span>
                        {p.timeline_months && <span>{p.timeline_months}mo</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      <p className="font-mono font-bold text-xl text-white">{format(safeN(p.budget))}</p>
                      <p className="text-[9px] text-teal-400 font-bold">{safeD(p.expected_roi)}% ROI</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {safeN(p.progress_percentage) > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[9px] text-zinc-600 mb-1">
                        <span>Progress</span>
                        <span>{safeD(p.progress_percentage, 0)}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full" style={{width:`${Math.min(safeN(p.progress_percentage),100)}%`}}/>
                      </div>
                    </div>
                  )}

                  {/* Stats + actions */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800/60 flex-wrap gap-3">
                    <div className="flex items-center gap-4 text-[9px] text-zinc-600 flex-wrap">
                      <span className="flex items-center gap-1"><Briefcase size={9}/>{safeF(p.milestone_count)} milestones</span>
                      <span className="flex items-center gap-1"><Users size={9}/>{safeF(p.investor_count)} investors</span>
                      <span className="flex items-center gap-1"><TrendingUp size={9}/>{format(safeN(p.total_raised_usd))} raised</span>
                      <span className="flex items-center gap-1"><Eye size={9}/>{safeF(p.view_count ?? 0)} views</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/projects/${p.id}/rental-management`}
                        className="flex items-center gap-1.5 px-3 py-2 border border-teal-500/30 text-teal-400 rounded-xl text-[9px] font-bold uppercase hover:bg-teal-500/10 transition-all">
                        <Building2 size={10}/> Manage
                      </Link>
                      <Link href={`/projects/${p.id}`}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-teal-500 transition-all">
                        View <ArrowRight size={10}/>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer/>
    </div>
  );
}

export default function MyProjectsPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={28}/></div>}>
      <MyProjectsContent/>
    </Suspense>
  );
}
