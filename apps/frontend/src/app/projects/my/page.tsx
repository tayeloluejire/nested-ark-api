'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCurrency } from '@/hooks/useCurrency';
import api from '@/lib/api';
import {
  Plus, Eye, Briefcase, TrendingUp, Edit3, Trash2, Copy,
  Loader2, CheckCircle2, Wifi, ShieldCheck, FileText,
  Building2, BarChart3, Share2, X, Link2, MessageCircle, Linkedin
} from 'lucide-react';

// ── types ─────────────────────────────────────────────────────────────────────
interface MyProject {
  id: string; project_number: string; title: string; location: string; country: string;
  budget: number; category: string; status: string; gov_verified: boolean;
  owner_type: string; milestone_count: number; bid_count: number;
  investor_count: number; total_raised_usd: number; created_at: string;
  visibility: string; tags: string[];
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    'border-teal-500/40 text-teal-500',
  PENDING:   'border-amber-500/40 text-amber-400',
  PAUSED:    'border-zinc-700 text-zinc-500',
  COMPLETED: 'border-emerald-500/40 text-emerald-400',
};

// ── SharePanel ────────────────────────────────────────────────────────────────
function SharePanel({ project, onClose }: { project: MyProject; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Close when clicking outside the panel
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://nested-ark-frontend.vercel.app';

  const projectUrl = `${origin}/projects/${project.id}`;
  const pid        = project.project_number;
  const shortTitle = project.title.length > 60 ? project.title.slice(0, 57) + '…' : project.title;

  // Platform-specific copy strings
  const waTxt = encodeURIComponent(
    `🏗 *${shortTitle}*\n` +
    `📍 ${project.location}, ${project.country}\n` +
    `🆔 Project ID: *${pid}*\n\n` +
    `View plans, bid on milestones or invest:\n${projectUrl}\n\n` +
    `Search Nested Ark by ID: ${pid}`
  );

  const liUrl = encodeURIComponent(projectUrl);
  const liSummary = encodeURIComponent(
    `Infrastructure opportunity on Nested Ark OS: ${shortTitle} — ${project.location}, ${project.country}. ` +
    `Project ID: ${pid}. Contractors can bid on milestones; investors can fund from anywhere.`
  );

  const xTxt = encodeURIComponent(
    `🏗 New project on @NestedArkOS: ${shortTitle}\n` +
    `📍 ${project.location}, ${project.country}\n` +
    `🆔 ${pid}\n` +
    `Bid · Fund · Build 👇\n${projectUrl}`
  );

  const handleCopyLink = () => {
    navigator.clipboard.writeText(projectUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleNativeShare = () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: project.title,
        text:  `Project ID: ${pid} — ${project.location}, ${project.country}`,
        url:   projectUrl,
      }).catch(() => {});
    }
    onClose();
  };

  const hasNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const channels = [
    {
      id:    'whatsapp',
      label: 'WhatsApp',
      icon:  MessageCircle,
      href:  `https://wa.me/?text=${waTxt}`,
      ring:  'hover:bg-[#25D366]/10 hover:border-[#25D366]/40 hover:text-[#25D366]',
    },
    {
      id:    'linkedin',
      label: 'LinkedIn',
      icon:  Linkedin,
      href:  `https://www.linkedin.com/sharing/share-offsite/?url=${liUrl}&summary=${liSummary}`,
      ring:  'hover:bg-[#0A66C2]/10 hover:border-[#0A66C2]/40 hover:text-[#0A66C2]',
    },
    {
      id:    'x',
      label: 'X / Twitter',
      icon:  X,
      href:  `https://x.com/intent/tweet?text=${xTxt}`,
      ring:  'hover:bg-white/5 hover:border-white/20 hover:text-white',
    },
  ];

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 w-64 rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/70 z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-white">Share Project</p>
          <p className="text-[8px] text-teal-500 font-mono mt-0.5">{pid}</p>
        </div>
        <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors p-1 rounded">
          <X size={13} />
        </button>
      </div>

      {/* Social channels */}
      <div className="p-3 space-y-1.5">
        {channels.map(ch => (
          <a
            key={ch.id}
            href={ch.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border border-transparent text-zinc-400 font-bold text-[10px] uppercase tracking-wider transition-all ${ch.ring}`}
          >
            <ch.icon size={14} className="flex-shrink-0" />
            {ch.label}
          </a>
        ))}

        {/* Copy project link */}
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border border-transparent text-zinc-400 font-bold text-[10px] uppercase tracking-wider hover:bg-teal-500/10 hover:border-teal-500/30 hover:text-teal-500 transition-all"
        >
          {copied
            ? <CheckCircle2 size={14} className="text-teal-500 flex-shrink-0" />
            : <Link2 size={14} className="flex-shrink-0" />
          }
          {copied ? 'Link Copied!' : 'Copy Project Link'}
        </button>

        {/* Native Web Share — mobile only */}
        {hasNativeShare && (
          <button
            onClick={handleNativeShare}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border border-transparent text-zinc-400 font-bold text-[10px] uppercase tracking-wider hover:bg-zinc-800 hover:text-white transition-all"
          >
            <Share2 size={14} className="flex-shrink-0" />
            More options…
          </button>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2.5 border-t border-zinc-900 bg-zinc-900/40">
        <p className="text-[8px] text-zinc-600 leading-relaxed">
          Contractors and investors can search{' '}
          <span className="text-teal-500 font-mono font-bold">{pid}</span>{' '}
          on Nested Ark from anywhere in the world.
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MyProjectsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { format } = useCurrency();

  const [projects,    setProjects]    = useState<MyProject[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [deleting,    setDeleting]    = useState<string | null>(null);
  const [copiedId,    setCopiedId]    = useState<string | null>(null);
  const [activeShare, setActiveShare] = useState<string | null>(null);
  const [lastSync,    setLastSync]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/projects/my');
      setProjects(res.data.projects ?? []);
      setLastSync(new Date().toLocaleTimeString());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const handleDelete = async (p: MyProject) => {
    if (!confirm(
      `Delete "${p.title}" (${p.project_number})?\n\nThis cannot be undone.`
    )) return;
    setDeleting(p.id);
    try {
      await api.delete(`/api/projects/${p.id}`);
      setProjects(prev => prev.filter(x => x.id !== p.id));
    } catch (ex: any) {
      alert(ex?.response?.data?.error ?? 'Delete failed');
    } finally { setDeleting(null); }
  };

  const copyProjectId = (num: string) => {
    navigator.clipboard.writeText(num).then(() => {
      setCopiedId(num);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  if (authLoading || !user) return (
    <div className="h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={32} />
    </div>
  );

  const totalBudget = projects.reduce((s, p) => s + Number(p.budget), 0);
  const totalRaised = projects.reduce((s, p) => s + Number(p.total_raised_usd), 0);
  const totalBids   = projects.reduce((s, p) => s + Number(p.bid_count), 0);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      {/* Pulse bar */}
      <div className="border-b border-zinc-800 bg-black px-6 py-2 flex items-center gap-5 text-[9px] font-mono uppercase tracking-widest overflow-x-auto">
        <span className="flex items-center gap-1.5 text-teal-500 flex-shrink-0"><Wifi size={8} /> My Projects</span>
        {lastSync && <span className="text-zinc-600 flex-shrink-0">Synced {lastSync}</span>}
        <span className="text-zinc-400 flex-shrink-0">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full space-y-8">

        {/* Header */}
        <header className="border-l-2 border-teal-500 pl-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[9px] text-teal-500 uppercase font-bold tracking-[0.2em] mb-1">Project Owner Dashboard</p>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">My Projects</h1>
            <p className="text-zinc-500 text-sm mt-1">Manage submissions · track bids · share with contractors and investors worldwide</p>
          </div>
          <Link href="/projects/submit"
            className="flex items-center gap-2 px-5 py-3 bg-white text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-teal-500 transition-all">
            <Plus size={12} /> Post New Project
          </Link>
        </header>

        {/* Stats strip */}
        {projects.length > 0 && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Projects',  value: projects.length.toString(), icon: Building2,  color: 'text-white' },
              { label: 'Combined Budget', value: format(totalBudget),        icon: BarChart3,  color: 'text-white' },
              { label: 'Total Raised',    value: format(totalRaised),        icon: TrendingUp, color: 'text-teal-400' },
              { label: 'Total Bids',      value: totalBids.toString(),       icon: Briefcase,  color: 'text-white' },
            ].map(s => (
              <div key={s.label} className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/20">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{s.label}</p>
                  <s.icon size={12} className="text-teal-500" />
                </div>
                <p className={`text-xl font-black font-mono ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </section>
        )}

        {/* Loading */}
        {loading && (
          <div className="py-12 text-center">
            <Loader2 className="animate-spin text-teal-500 mx-auto" size={24} />
          </div>
        )}

        {/* Empty state */}
        {!loading && projects.length === 0 && (
          <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl space-y-5">
            <Building2 className="text-zinc-700 mx-auto" size={40} />
            <div>
              <p className="text-zinc-400 text-base font-bold">No projects submitted yet</p>
              <p className="text-zinc-600 text-sm mt-1">Post your first project to attract contractors and investors worldwide</p>
            </div>
            <Link href="/projects/submit"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-black uppercase text-xs tracking-[0.15em] rounded-xl hover:bg-teal-500 transition-all">
              <Plus size={14} /> Post Your First Project
            </Link>
          </div>
        )}

        {/* Project cards */}
        <div className="space-y-4">
          {projects.map(p => {
            const raised = Number(p.total_raised_usd) || 0;
            const budget = Number(p.budget) || 1;
            const pct    = Math.min((raised / budget) * 100, 100);

            return (
              <div key={p.id}
                className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 transition-all space-y-4">

                {/* Top row */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <button
                        onClick={() => copyProjectId(p.project_number)}
                        title="Click to copy Project ID"
                        className="flex items-center gap-1 text-[9px] text-teal-500 font-mono font-bold hover:text-white transition-colors"
                      >
                        {p.project_number}
                        {copiedId === p.project_number
                          ? <CheckCircle2 size={9} />
                          : <Copy size={9} />
                        }
                      </button>
                      <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${STATUS_COLORS[p.status] ?? 'border-zinc-700 text-zinc-500'}`}>
                        {p.status}
                      </span>
                      {p.gov_verified && (
                        <span className="flex items-center gap-1 text-[8px] text-teal-500 border border-teal-500/30 px-2 py-0.5 rounded">
                          <ShieldCheck size={8} /> Verified
                        </span>
                      )}
                      {p.visibility === 'PRIVATE' && (
                        <span className="text-[8px] border border-zinc-700 text-zinc-500 px-2 py-0.5 rounded">Private</span>
                      )}
                    </div>
                    <h3 className="font-bold uppercase tracking-tight text-base">{p.title}</h3>
                    <p className="text-zinc-500 text-xs mt-0.5">{p.location}, {p.country} · {p.category}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Budget</p>
                    <p className="font-mono text-lg font-bold">{format(Number(p.budget))}</p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Milestones',    value: Number(p.milestone_count) || 0, color: 'text-white' },
                    { label: 'Bids Received', value: Number(p.bid_count)       || 0, color: 'text-white' },
                    { label: 'Investors',     value: Number(p.investor_count)  || 0, color: 'text-teal-400' },
                  ].map(s => (
                    <div key={s.label} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
                      <p className="text-[8px] text-zinc-500 uppercase font-bold">{s.label}</p>
                      <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Funding bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold uppercase">
                    <span className="text-zinc-500">Capital Raised</span>
                    <span className="text-teal-500">{pct.toFixed(1)}% · {format(raised)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap pt-1">

                  <Link href={`/projects/${p.id}`}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white text-black font-bold text-[9px] uppercase rounded-lg hover:bg-teal-500 transition-all">
                    <Eye size={11} /> View
                  </Link>

                  <Link href={`/projects/${p.id}/edit`}
                    className="flex items-center gap-1.5 px-4 py-2 border border-zinc-700 text-zinc-400 font-bold text-[9px] uppercase rounded-lg hover:text-white transition-all">
                    <Edit3 size={11} /> Edit
                  </Link>

                  <Link href={`/projects/${p.id}/documents`}
                    className="flex items-center gap-1.5 px-4 py-2 border border-zinc-700 text-zinc-400 font-bold text-[9px] uppercase rounded-lg hover:text-teal-500 transition-all">
                    <FileText size={11} /> Docs
                  </Link>

                  {/* Share button + dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setActiveShare(activeShare === p.id ? null : p.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 border font-bold text-[9px] uppercase rounded-lg transition-all ${
                        activeShare === p.id
                          ? 'border-teal-500/50 bg-teal-500/10 text-teal-500'
                          : 'border-zinc-700 text-zinc-400 hover:text-teal-500 hover:border-teal-500/40'
                      }`}
                    >
                      <Share2 size={11} /> Share
                    </button>

                    {activeShare === p.id && (
                      <SharePanel
                        project={p}
                        onClose={() => setActiveShare(null)}
                      />
                    )}
                  </div>

                  {/* Delete — far right */}
                  <button
                    onClick={() => handleDelete(p)}
                    disabled={deleting === p.id}
                    className="flex items-center gap-1.5 px-4 py-2 border border-red-500/20 text-red-400 font-bold text-[9px] uppercase rounded-lg hover:bg-red-500/10 transition-all ml-auto disabled:opacity-40"
                  >
                    {deleting === p.id
                      ? <Loader2 className="animate-spin" size={11} />
                      : <Trash2 size={11} />
                    } Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
