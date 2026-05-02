'use client';
export const dynamic = 'force-dynamic';
/**
 * /projects/[id]/page.tsx
 * Public project detail page — no auth required.
 * API: GET /api/projects/:projectId
 * Returns: { success, project: { ...all fields, documents[], milestones[], tags[],
 *            bid_count, investor_count, total_raised_usd, view_count, save_count,
 *            sponsor_name, sponsor_email } }
 *
 * Cold-start aware: retries once after 4s on 502/503 (Render free tier).
 * The error "Could not load project — server may be starting up" was caused by
 * the retry logic throwing before the backend woke up. Fixed: retry is now
 * handled by api.ts interceptor — this page just shows a clean error with retry button.
 */
import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import api from '@/lib/api';
import {
  MapPin, ShieldCheck, TrendingUp, Building2, Users,
  Briefcase, CheckCircle2, Clock, Loader2, AlertCircle,
  ArrowLeft, ArrowRight, FileText, Download, Lock,
  BarChart3, Star, Globe, Calendar, Eye, Bookmark,
  Share2, Copy, ExternalLink, ChevronRight,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();
const safeD = (v: any, d = 1): string => safeN(v).toFixed(d);
const fmtDate = (s: any) => s
  ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const MILESTONE_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  PENDING:     { label: 'Pending',     color: 'border-zinc-700 text-zinc-500',        icon: Clock },
  IN_PROGRESS: { label: 'In Progress', color: 'border-blue-500/40 text-blue-400',     icon: Loader2 },
  COMPLETED:   { label: 'Completed',   color: 'border-teal-500/40 text-teal-400',     icon: CheckCircle2 },
  DISPUTED:    { label: 'Disputed',    color: 'border-red-500/40 text-red-400',       icon: AlertCircle },
};

const OWNER_ICONS: Record<string, string> = {
  INDIVIDUAL:      '👤',
  CORPORATE:       '🏢',
  PRIVATE_BUSINESS:'💼',
  DEVELOPER:       '🏠',
  GOVERNMENT:      '🏛️',
};

const DOC_ICONS: Record<string, string> = {
  BLUEPRINT:'📐', RENDER_3D:'🏗️', PERMIT:'📋', ASSESSMENT:'📊',
  CONTRACT:'📄', CERTIFICATE:'🏆', PHOTO:'📷', OTHER:'📎',
};

// ── Main content ──────────────────────────────────────────────────────────────
function ProjectDetailContent() {
  const { id }     = useParams<{ id: string }>();
  const router     = useRouter();
  const { user }   = useAuth();
  const { format } = useCurrency();

  const [project,   setProject]   = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [copied,    setCopied]    = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'milestones' | 'documents'>('overview');

  const load = async () => {
    if (!id) return;
    // Guard: known non-UUID slugs that should redirect, not hit the project API
    const NON_PROJECT_SLUGS = ['my', 'my-projects', 'submit', 'search', 'saved'];
    if (NON_PROJECT_SLUGS.includes(id)) {
      router.replace('/projects/my');
      return;
    }
    setLoading(true); setError('');
    try {
      // api.ts interceptor handles 502/503 cold-start retry automatically
      const res = await api.get(`/api/projects/${id}`);
      setProject(res.data.project ?? res.data);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) {
        setError('Project not found. It may have been removed or the link is incorrect.');
      } else if (status === 500 || status === 502 || status === 503) {
        setError('The server is starting up. Please wait a moment and try again.');
      } else {
        setError(e?.response?.data?.error ?? 'Could not load project. Please try again.');
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); }
    catch { prompt('Copy this link:', window.location.href); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="flex items-center justify-center py-40">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-teal-500 mx-auto" size={32} />
          <p className="text-zinc-500 text-sm uppercase font-bold tracking-widest">Loading project…</p>
        </div>
      </div>
      <Footer />
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !project) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="max-w-xl mx-auto px-6 py-40 text-center space-y-6">
        <AlertCircle className="text-amber-400 mx-auto" size={48} />
        <div>
          <p className="text-white font-black text-lg uppercase tracking-tight">
            {error?.includes('not found') ? 'Project Not Found' : 'Could Not Load Project'}
          </p>
          <p className="text-zinc-500 text-sm mt-2 leading-relaxed">
            {error || 'An unexpected error occurred. Please try again.'}
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={load}
            className="px-6 py-3 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all">
            Try Again
          </button>
          <Link href="/projects"
            className="px-6 py-3 border border-zinc-700 text-zinc-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:text-white hover:border-zinc-500 transition-all">
            Return to Marketplace
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );

  // ── Derived data ──────────────────────────────────────────────────────────
  const milestones: any[]  = Array.isArray(project.milestones)  ? project.milestones  : [];
  const documents: any[]   = Array.isArray(project.documents)   ? project.documents   : [];
  const tags: string[]     = Array.isArray(project.tags)        ? project.tags        : [];
  const completedMs        = milestones.filter(m => m.status === 'COMPLETED').length;
  const progressPct        = milestones.length > 0
    ? Math.round((completedMs / milestones.length) * 100)
    : safeN(project.progress_percentage);
  const isOwner            = user && project.sponsor_id === user.id;
  const isAdmin            = user?.role === 'ADMIN';
  const canManage          = isOwner || isAdmin;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      {/* Hero */}
      <div className="relative border-b border-zinc-800">
        {project.hero_image_url ? (
          <div className="absolute inset-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={project.hero_image_url} alt={project.title}
              className="w-full h-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/60 via-[#050505]/80 to-[#050505]" />
          </div>
        ) : null}

        <div className="relative max-w-6xl mx-auto px-6 py-12 space-y-5">
          {/* Back */}
          <button onClick={() => router.back()}
            className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
            <ArrowLeft size={13} /> Back
          </button>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] text-teal-500 font-mono font-black bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded">
              {project.project_number}
            </span>
            {project.gov_verified && (
              <span className="flex items-center gap-1 text-[8px] text-teal-400 border border-teal-500/20 bg-teal-500/5 px-2 py-0.5 rounded font-bold">
                <ShieldCheck size={8} /> Gov Verified
              </span>
            )}
            <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${
              project.status === 'ACTIVE' ? 'border-teal-500/30 text-teal-500 bg-teal-500/5' :
              project.status === 'COMPLETED' ? 'border-zinc-600 text-zinc-400' :
              'border-zinc-700 text-zinc-500'}`}>
              {project.status}
            </span>
            {project.owner_type && (
              <span className="text-[8px] text-zinc-600 border border-zinc-800 px-2 py-0.5 rounded">
                {OWNER_ICONS[project.owner_type] ?? '📋'} {project.owner_type.replace(/_/g, ' ')}
              </span>
            )}
            {tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[8px] text-zinc-600 border border-zinc-800 px-2 py-0.5 rounded font-mono">
                {tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter leading-tight">
              {project.title}
            </h1>
            <div className="flex items-center gap-4 mt-3 flex-wrap text-[10px] text-zinc-500">
              <span className="flex items-center gap-1"><MapPin size={10} />{project.location}, {project.country}</span>
              <span>{project.category}</span>
              {project.timeline_months && <span><Calendar size={10} className="inline mr-1" />{project.timeline_months}mo timeline</span>}
              <span className="flex items-center gap-1"><Eye size={10} />{safeF(project.view_count)} views</span>
              <span className="flex items-center gap-1"><Bookmark size={10} />{safeF(project.save_count)} saves</span>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 flex-wrap pt-2">
            {canManage && (
              <Link href={`/projects/${project.id}/rental-management`}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-500 text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white transition-all">
                <Building2 size={11} /> Manage Property
              </Link>
            )}
            {canManage && (
              <Link href={`/projects/${project.id}/edit`}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-zinc-700 text-zinc-400 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:text-white hover:border-zinc-500 transition-all">
                Edit Project
              </Link>
            )}
            <button onClick={copyLink}
              className={`flex items-center gap-1.5 px-4 py-2.5 border rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${
                copied ? 'border-teal-500/30 text-teal-400' : 'border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500'}`}>
              {copied ? <CheckCircle2 size={11} /> : <Copy size={11} />}
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto px-6 py-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left: Main content ─────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-8">

            {/* Tab bar */}
            <div className="flex gap-1 p-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl w-fit">
              {([
                { key: 'overview',   label: 'Overview',   icon: BarChart3 },
                { key: 'milestones', label: 'Milestones', icon: CheckCircle2, badge: milestones.length },
                { key: 'documents',  label: 'Documents',  icon: FileText,    badge: documents.length  },
              ] as const).map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      activeTab === t.key ? 'bg-teal-500 text-black' : 'text-zinc-500 hover:text-white'}`}>
                    <Icon size={11} /> {t.label}
                    {'badge' in t && t.badge > 0 && (
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black ${activeTab === t.key ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                        {t.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── OVERVIEW ─────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Progress */}
                <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Project Progress</p>
                    <p className="text-teal-400 font-black text-sm">{progressPct}%</p>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(progressPct, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] text-zinc-600">
                    <span>{completedMs} of {milestones.length} milestones complete</span>
                    {project.lifecycle_stage && <span>{project.lifecycle_stage.replace(/_/g,' ')}</span>}
                  </div>
                </div>

                {/* Description */}
                {project.description && (
                  <div className="space-y-2">
                    <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">About This Project</p>
                    <p className="text-zinc-300 text-sm leading-relaxed">{project.description}</p>
                  </div>
                )}

                {/* Pitch summary */}
                {project.pitch_summary && (
                  <div className="p-5 rounded-2xl border border-teal-500/20 bg-teal-500/5">
                    <p className="text-[9px] text-teal-500 uppercase font-bold tracking-widest mb-2">Investor Pitch</p>
                    <p className="text-zinc-300 text-sm leading-relaxed italic">{project.pitch_summary}</p>
                  </div>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Total Budget',      value: format(safeN(project.budget)),         color: 'text-white'    },
                    { label: 'Expected ROI',       value: `${safeD(project.expected_roi)}% p.a.`, color: 'text-teal-400' },
                    { label: 'Total Raised',       value: format(safeN(project.total_raised_usd)), color: 'text-amber-400'},
                    { label: 'Investors',          value: safeF(project.investor_count),         color: 'text-white'    },
                    { label: 'Bids Received',      value: safeF(project.bid_count),              color: 'text-white'    },
                    { label: 'Risk Grade',         value: project.risk_grade || 'B+',            color: 'text-teal-400' },
                  ].map(s => (
                    <div key={s.label} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/20">
                      <p className={`text-lg font-black font-mono tabular-nums ${s.color}`}>{s.value}</p>
                      <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Project details */}
                <div className="space-y-2">
                  <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Project Details</p>
                  <div className="divide-y divide-zinc-800/60">
                    {[
                      ['Category',     project.category],
                      ['Project Type', project.project_type],
                      ['Project Mode', project.project_mode],
                      ['Location',     `${project.location}, ${project.country}`],
                      ['Owner Type',   project.owner_type?.replace(/_/g,' ')],
                      ['Owner',        project.owner_name ?? project.sponsor_name],
                      ['Submitted',    fmtDate(project.created_at)],
                      ['Last Updated', fmtDate(project.updated_at)],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label as string} className="flex items-center justify-between py-2.5 text-sm">
                        <span className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest">{label as string}</span>
                        <span className="text-zinc-300 font-medium text-right max-w-[60%]">{value as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── MILESTONES ───────────────────────────────────────────── */}
            {activeTab === 'milestones' && (
              <div className="space-y-4">
                {milestones.length === 0 ? (
                  <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl">
                    <CheckCircle2 className="text-zinc-700 mx-auto mb-3" size={36} />
                    <p className="text-zinc-500 font-bold">No milestones yet</p>
                  </div>
                ) : (
                  milestones.map((m: any, i: number) => {
                    const cfg = MILESTONE_STATUS[m.status] ?? MILESTONE_STATUS.PENDING;
                    const Icon = cfg.icon;
                    return (
                      <div key={m.id ?? i} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-[8px] text-zinc-600 font-mono border border-zinc-800 px-2 py-0.5 rounded">
                                M{m.milestone_number ?? (i + 1)}
                              </span>
                              <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${cfg.color}`}>
                                <Icon size={8} className="inline mr-1" />{cfg.label}
                              </span>
                              {m.required_trade && (
                                <span className="text-[8px] text-zinc-600 border border-zinc-800 px-2 py-0.5 rounded">
                                  {m.required_trade}
                                </span>
                              )}
                            </div>
                            <h3 className="font-bold text-sm">{m.title}</h3>
                            {m.description && (
                              <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed line-clamp-2">{m.description}</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-mono font-bold text-base">{safeD(m.budget_allocation, 0)}%</p>
                            <p className="text-[8px] text-zinc-600 uppercase font-bold">of budget</p>
                          </div>
                        </div>

                        {/* Progress bar */}
                        {safeN(m.progress_percentage) > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold uppercase">
                              <span className="text-zinc-500">Progress</span>
                              <span className="text-teal-500">{safeD(m.progress_percentage, 0)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-teal-500 transition-all"
                                style={{ width: `${Math.min(safeN(m.progress_percentage), 100)}%` }} />
                            </div>
                          </div>
                        )}

                        {/* Tri-layer verification */}
                        {(m.ai_status || m.human_status || m.drone_status) && (
                          <div className="flex gap-2 flex-wrap">
                            {[
                              { key: 'AI',    val: m.ai_status    },
                              { key: 'Human', val: m.human_status },
                              { key: 'Drone', val: m.drone_status },
                            ].map(v => (
                              <span key={v.key}
                                className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase flex items-center gap-1 ${
                                  v.val === 'APPROVED' ? 'border-teal-500/30 text-teal-400 bg-teal-500/5' :
                                  v.val === 'REJECTED' ? 'border-red-500/30 text-red-400 bg-red-500/5' :
                                  'border-zinc-700 text-zinc-600'}`}>
                                {v.val === 'APPROVED' ? <CheckCircle2 size={7} /> :
                                 v.val === 'REJECTED' ? <AlertCircle size={7} /> :
                                 <Clock size={7} />}
                                {v.key}: {v.val ?? 'PENDING'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── DOCUMENTS ────────────────────────────────────────────── */}
            {activeTab === 'documents' && (
              <div className="space-y-4">
                <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
                  {documents.length} document{documents.length !== 1 ? 's' : ''} on file
                </p>
                {documents.length === 0 ? (
                  <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl">
                    <FileText className="text-zinc-700 mx-auto mb-3" size={36} />
                    <p className="text-zinc-500 font-bold">No documents uploaded yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {documents.map((doc: any) => (
                      <div key={doc.id}
                        className="p-5 bg-zinc-900/30 border border-zinc-800 rounded-2xl flex items-center justify-between hover:border-zinc-700 transition-all group">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="p-2.5 bg-teal-500/10 rounded-xl flex-shrink-0">
                            <span className="text-lg">{DOC_ICONS[doc.doc_type] ?? '📎'}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate">{doc.title}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <p className="text-[8px] text-zinc-500 uppercase font-mono">{doc.doc_type?.replace(/_/g,' ')}</p>
                              {doc.is_public
                                ? <span className="text-[8px] text-teal-500 font-bold">Public</span>
                                : <span className="text-[8px] text-amber-400 font-bold flex items-center gap-0.5"><Lock size={7}/> KYC Required</span>
                              }
                            </div>
                          </div>
                        </div>
                        {doc.file_url && doc.is_public ? (
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                            className="p-2.5 hover:bg-zinc-800 rounded-full transition-all flex-shrink-0 text-zinc-600 group-hover:text-teal-400">
                            <Download size={14} />
                          </a>
                        ) : (
                          <Lock size={14} className="text-zinc-700 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* KYC notice if any locked docs */}
                {documents.some((d: any) => !d.is_public) && (
                  <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
                    <AlertCircle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-amber-400 text-xs font-bold">Some documents require KYC verification</p>
                      <Link href="/kyc" className="text-teal-500 text-xs font-bold hover:text-white transition-colors">
                        Complete KYC to unlock →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right: Sidebar ────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Budget & ROI card */}
            <div className="p-5 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-4">
              <div>
                <p className="text-[9px] text-teal-500 uppercase font-bold tracking-widest mb-1">Total Budget</p>
                <p className="text-3xl font-black font-mono text-white">
                  {format(safeN(project.budget))}
                </p>
                {project.currency && project.currency !== 'USD' && (
                  <p className="text-[9px] text-zinc-600 font-mono mt-0.5">{project.currency}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-black/30 rounded-xl border border-zinc-800">
                  <p className="text-teal-400 font-black text-lg">{safeD(project.expected_roi)}%</p>
                  <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">ROI p.a.</p>
                </div>
                <div className="p-3 bg-black/30 rounded-xl border border-zinc-800">
                  <p className="text-white font-black text-lg">{project.timeline_months ?? '—'}</p>
                  <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">Months</p>
                </div>
              </div>

              {/* Raised progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-[9px]">
                  <span className="text-zinc-500">Raised</span>
                  <span className="text-teal-400 font-bold">
                    {safeN(project.budget) > 0
                      ? `${safeD((safeN(project.total_raised_usd) / safeN(project.budget)) * 100, 0)}%`
                      : '0%'}
                  </span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full"
                    style={{ width: `${Math.min((safeN(project.total_raised_usd) / (safeN(project.budget) || 1)) * 100, 100)}%` }} />
                </div>
                <p className="text-[9px] text-zinc-600 font-mono">
                  {format(safeN(project.total_raised_usd))} of {format(safeN(project.budget))}
                </p>
              </div>

              {/* CTA */}
              {user && !canManage && (
                <Link href={`/investments/new?project=${project.id}`}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-teal-500 text-black rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white transition-all">
                  <TrendingUp size={13} /> Invest Now
                </Link>
              )}
              {!user && (
                <Link href={`/login?next=/projects/${project.id}`}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-teal-500 text-black rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white transition-all">
                  Sign In to Invest
                </Link>
              )}
              {canManage && (
                <Link href={`/projects/${project.id}/rental-management`}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-teal-500 text-black rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white transition-all">
                  <Building2 size={13} /> Manage Property
                </Link>
              )}
            </div>

            {/* Sponsor */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Project Sponsor</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
                  <Users size={14} className="text-teal-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{project.sponsor_name ?? 'Owner'}</p>
                  {project.sponsor_email && (
                    <p className="text-[9px] text-zinc-500 truncate">{project.sponsor_email}</p>
                  )}
                </div>
              </div>
              {project.gov_verified && (
                <div className="flex items-center gap-1.5 text-[9px] text-teal-400 font-bold">
                  <ShieldCheck size={11} /> Government Verified Sponsor
                </div>
              )}
            </div>

            {/* Trust badges */}
            <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/10 space-y-2">
              <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest mb-3">Platform Guarantees</p>
              {[
                { icon: ShieldCheck, label: 'Tri-Layer Verification',  sub: 'AI + Human + Drone' },
                { icon: Globe,       label: 'Immutable Ledger',         sub: 'SHA-256 hash chain'  },
                { icon: Star,        label: 'Paystack Escrow',          sub: 'Funds held safely'   },
              ].map(b => {
                const Icon = b.icon;
                return (
                  <div key={b.label} className="flex items-center gap-2.5">
                    <Icon size={12} className="text-teal-500 flex-shrink-0" />
                    <div>
                      <p className="text-[9px] text-white font-bold">{b.label}</p>
                      <p className="text-[8px] text-zinc-600">{b.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick links */}
            <div className="space-y-2">
              <Link href={`/projects/${project.id}/documents`}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white transition-all text-[10px] font-bold uppercase">
                <span className="flex items-center gap-2"><FileText size={11}/> Technical Archive</span>
                <ChevronRight size={12}/>
              </Link>
              {canManage && (
                <Link href={`/projects/${project.id}/milestones`}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white transition-all text-[10px] font-bold uppercase">
                  <span className="flex items-center gap-2"><BarChart3 size={11}/> Milestone Manager</span>
                  <ChevronRight size={12}/>
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    }>
      <ProjectDetailContent />
    </Suspense>
  );
}
