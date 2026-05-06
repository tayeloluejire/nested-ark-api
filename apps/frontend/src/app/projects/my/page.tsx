'use client';
export const dynamic = 'force-dynamic';
/**
 * /projects/my/page.tsx
 * NAP Infrastructure Ledger — projects submitted to the global ledger.
 * "Add Unit" links here go to /projects/[id]/rental-management.
 * "Onboard Tenant" links go to /landlord/onboard/[unitId].
 *
 * SEPARATE from /onboard which is the Landlord Property Tool entry.
 */
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  Plus, Home, Users, ArrowRight, Loader2, PlusCircle,
  Building2, RefreshCw, ChevronDown, ChevronUp,
  MapPin, Layers, Eye, FileText, Bell, AlertCircle,
} from 'lucide-react';

const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();

interface Unit {
  id: string;
  unit_name: string;
  rent_amount: number;
  currency?: string;
  status?: string;
  tenant_name?: string;
}

interface Project {
  id: string;
  title: string;
  location?: string;
  country?: string;
  status?: string;
  project_number?: string;
}

export default function MyPropertiesPage() {
  const [projects,     setProjects]     = useState<Project[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [expanded,     setExpanded]     = useState<string | null>(null);
  const [unitMap,      setUnitMap]      = useState<Record<string, Unit[]>>({});
  const [unitsLoading, setUnitsLoading] = useState<string | null>(null);
  const [error,        setError]        = useState('');

  const fetchProjects = useCallback(() => {
    setLoading(true); setError('');
    api.get('/api/projects/my')
      .then(res => {
        const data = res.data;
        setProjects(Array.isArray(data) ? data : (data.projects ?? []));
      })
      .catch(e => setError(e?.response?.data?.error ?? 'Could not load projects.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const toggleExpand = async (projectId: string) => {
    if (expanded === projectId) { setExpanded(null); return; }
    setExpanded(projectId);
    if (!unitMap[projectId]) {
      setUnitsLoading(projectId);
      try {
        const res = await api.get(`/api/rental/units?project_id=${projectId}`);
        const data = res.data;
        setUnitMap(prev => ({
          ...prev,
          [projectId]: Array.isArray(data) ? data : (data.units ?? []),
        }));
      } catch {
        setUnitMap(prev => ({ ...prev, [projectId]: [] }));
      } finally {
        setUnitsLoading(null);
      }
    }
  };

  const projectStatusStyle = (s?: string) => {
    const map: Record<string, string> = {
      active: 'bg-teal-500/10 text-teal-400', funded: 'bg-emerald-500/10 text-emerald-400',
      pending: 'bg-amber-500/10 text-amber-400', draft: 'bg-zinc-800 text-zinc-500',
      approved: 'bg-teal-500/10 text-teal-400', operational: 'bg-teal-500/10 text-teal-400',
    };
    return map[(s || '').toLowerCase()] ?? 'bg-zinc-800 text-zinc-400';
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
      <Footer />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto px-4 md:px-6 py-10 w-full space-y-8">

        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 border-b border-zinc-800 pb-6">
          <div>
            <p className="text-[10px] text-teal-500 uppercase font-black tracking-widest mb-1">
              NAP Infrastructure Ledger
            </p>
            <h1 className="text-3xl font-black uppercase italic">My Projects</h1>
            <p className="text-zinc-500 text-xs mt-1">
              Projects you have submitted to the Nested Ark global infrastructure ledger
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={fetchProjects}
              className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors" title="Refresh">
              <RefreshCw size={16} className="text-zinc-400" />
            </button>
            {/* Property Tool shortcut */}
            <Link href="/onboard"
              className="border border-zinc-700 text-zinc-400 px-4 py-3 rounded-xl font-black uppercase text-xs flex items-center gap-2 hover:border-zinc-500 hover:text-white transition-colors">
              <Home size={14} /> Add Property
            </Link>
            {/* NAP Ledger submit */}
            <Link href="/projects/submit"
              className="bg-white text-black px-5 py-3 rounded-xl font-black uppercase text-xs flex items-center gap-2 hover:bg-teal-500 transition-colors">
              <Plus size={16} /> Submit Project
            </Link>
          </div>
        </header>

        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14} /> {error}
            <button onClick={fetchProjects} className="ml-auto text-teal-500 text-xs uppercase font-black">Retry →</button>
          </div>
        )}

        {/* Empty State */}
        {!error && projects.length === 0 && (
          <div className="text-center py-20 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-3xl">
            <Building2 className="mx-auto text-zinc-700 mb-4" size={48} />
            <h2 className="text-xl font-bold uppercase">No projects yet</h2>
            <p className="text-zinc-500 text-sm mb-8 max-w-sm mx-auto">
              Submit your first infrastructure project to the NAP Global Ledger, or register a rental property.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/projects/submit"
                className="bg-teal-500 text-black font-black uppercase text-xs px-8 py-4 rounded-xl hover:bg-teal-400 transition-colors">
                Submit Infrastructure Project
              </Link>
              <Link href="/onboard"
                className="text-zinc-400 font-bold uppercase text-xs border border-zinc-700 px-8 py-4 rounded-xl hover:border-zinc-500 transition-colors">
                Register Rental Property
              </Link>
              <Link href="/projects"
                className="text-zinc-500 font-bold uppercase text-xs border border-zinc-800 px-8 py-4 rounded-xl hover:border-zinc-600 transition-colors">
                Browse Marketplace
              </Link>
            </div>
          </div>
        )}

        {/* Project Cards */}
        {projects.length > 0 && (
          <div className="space-y-6">
            {projects.map(project => {
              const units      = unitMap[project.id] ?? [];
              const isExpanded = expanded === project.id;
              const isLoadingU = unitsLoading === project.id;

              return (
                <div key={project.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden hover:border-zinc-700 transition-all">
                  <div className="p-6">
                    {/* Project header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-black uppercase italic truncate">{project.title}</h3>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {project.location && (
                            <p className="text-zinc-500 text-xs font-mono uppercase flex items-center gap-1">
                              <MapPin size={10} /> {project.location}{project.country ? `, ${project.country}` : ''}
                            </p>
                          )}
                          {project.project_number && (
                            <p className="text-zinc-600 text-xs font-mono">{project.project_number}</p>
                          )}
                        </div>
                      </div>
                      <span className={`text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider shrink-0 ${projectStatusStyle(project.status)}`}>
                        {project.status || 'Active'}
                      </span>
                    </div>

                    {/* Action grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                      <Link href={`/projects/${project.id}/rental-management`}
                        className="flex flex-col items-center justify-center p-4 bg-teal-500/10 rounded-2xl border border-teal-500/30 hover:bg-teal-500/20 hover:border-teal-500 transition-colors group">
                        <PlusCircle className="text-teal-500 mb-2 group-hover:scale-110 transition-transform" size={22} />
                        <span className="text-[10px] font-black uppercase text-teal-400">Add Unit</span>
                      </Link>
                      <Link href="/landlord/tenants"
                        className="flex flex-col items-center justify-center p-4 bg-black rounded-2xl border border-zinc-800 hover:border-zinc-600 transition-colors group">
                        <Users className="text-zinc-400 mb-2 group-hover:text-white transition-colors" size={22} />
                        <span className="text-[10px] font-black uppercase text-zinc-400 group-hover:text-white transition-colors">Tenants</span>
                      </Link>
                      <Link href="/landlord/notices"
                        className="flex flex-col items-center justify-center p-4 bg-black rounded-2xl border border-zinc-800 hover:border-zinc-600 transition-colors group">
                        <Bell className="text-zinc-400 mb-2 group-hover:text-white transition-colors" size={22} />
                        <span className="text-[10px] font-black uppercase text-zinc-400 group-hover:text-white transition-colors">Notices</span>
                      </Link>
                      <Link href={`/projects/${project.id}/documents`}
                        className="flex flex-col items-center justify-center p-4 bg-black rounded-2xl border border-zinc-800 hover:border-zinc-600 transition-colors group">
                        <FileText className="text-zinc-400 mb-2 group-hover:text-white transition-colors" size={22} />
                        <span className="text-[10px] font-black uppercase text-zinc-400 group-hover:text-white transition-colors">Docs</span>
                      </Link>
                    </div>

                    {/* Bottom row */}
                    <div className="flex gap-3">
                      <button onClick={() => toggleExpand(project.id)}
                        className="flex-1 py-3 bg-zinc-800 text-zinc-300 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-zinc-700 transition-all">
                        <Layers size={14} />
                        {isExpanded ? 'Hide Units' : 'View Units'}
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <Link href={`/projects/${project.id}`}
                        className="flex-1 py-3 bg-zinc-800 text-white rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-white hover:text-black transition-all">
                        <Eye size={14} /> Full View <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>

                  {/* Units panel */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800 bg-black/40 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
                          <Building2 size={14} className="text-teal-500" />
                          Units {units.length > 0 && `(${units.length})`}
                        </h4>
                        <Link href={`/projects/${project.id}/rental-management`}
                          className="text-[10px] font-black uppercase text-teal-500 border border-teal-500/30 px-3 py-1.5 rounded-lg hover:bg-teal-500/10 transition-colors flex items-center gap-1">
                          <Plus size={10} /> Add Unit
                        </Link>
                      </div>

                      {isLoadingU ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="animate-spin text-teal-500" size={20} />
                        </div>
                      ) : units.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-zinc-800 rounded-2xl">
                          <Building2 className="mx-auto text-zinc-700 mb-3" size={32} />
                          <p className="text-zinc-500 text-xs mb-4">No units added yet.</p>
                          <Link href={`/projects/${project.id}/rental-management`}
                            className="bg-teal-500 text-black font-black text-xs uppercase px-6 py-3 rounded-xl hover:bg-teal-400 transition-colors">
                            + Add First Unit
                          </Link>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {units.map(unit => (
                            <div key={unit.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-black uppercase text-sm truncate">{unit.unit_name}</p>
                                <p className="text-zinc-500 text-xs font-mono">
                                  {unit.currency || 'NGN'} {safeF(unit.rent_amount)} / mo
                                </p>
                                {unit.tenant_name && (
                                  <p className="text-teal-400 text-[10px] font-mono mt-0.5 truncate">
                                    👤 {unit.tenant_name}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${unit.status?.toLowerCase() === 'occupied' ? 'bg-teal-500/10 text-teal-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                  {unit.status || 'Vacant'}
                                </span>
                                {/* ALWAYS routes to landlord onboard — never public /onboard */}
                                <Link href={`/landlord/onboard/${unit.id}`}
                                  className="text-[9px] font-black uppercase text-teal-500 border border-teal-500/30 px-2 py-1 rounded hover:bg-teal-500/10 transition-colors whitespace-nowrap">
                                  Onboard Tenant
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
