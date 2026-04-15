'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FileUploader from '@/components/FileUploader';
import api from '@/lib/api';
import {
  Loader2, Save, ArrowLeft, AlertCircle, CheckCircle2,
  MapPin, Building2, Calendar, ShieldCheck, Image as ImageIcon
} from 'lucide-react';

const OWNER_TYPES    = ['INDIVIDUAL','CORPORATE','PRIVATE_BUSINESS','DEVELOPER','GOVERNMENT'];
const STATUS_OPTIONS = ['ACTIVE','PENDING','PAUSED','COMPLETED','CANCELLED'];
const RISK_GRADES    = ['A','B','C','D'];
const VISIBILITY     = ['PUBLIC','PRIVATE','INVITE_ONLY'];

const CAT_ICON: Record<string, string> = {
  Roads:'🛣️', Energy:'⚡', Water:'💧', Bridges:'🌉', Technology:'💻',
  Railways:'🚆', Ports:'⚓', Healthcare:'🏥', Housing:'🏘️',
  Education:'🎓', Agriculture:'🌱', Industrial:'🏭', Commercial:'🏢',
  Residential:'🏠', Landscape:'🌳', Renovation:'🔨', Other:'🏗️',
};

const STATUS_COLORS: Record<string,string> = {
  ACTIVE:    'text-teal-400 border-teal-500/30 bg-teal-500/10',
  PENDING:   'text-amber-400 border-amber-500/30 bg-amber-500/10',
  COMPLETED: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  PAUSED:    'text-zinc-400 border-zinc-700 bg-zinc-800/30',
  CANCELLED: 'text-red-400 border-red-500/30 bg-red-500/10',
};

export default function EditProjectPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { user } = useAuth();

  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState(false);
  const [project,    setProject]    = useState<any>(null);

  const [form, setForm] = useState({
    title:               '',
    description:         '',
    pitch_summary:       '',
    status:              'ACTIVE',
    progress_percentage: 0,
    expected_roi:        12,
    risk_grade:          'B',
    visibility:          'PUBLIC',
    owner_type:          'INDIVIDUAL',
    owner_name:          '',
    owner_phone:         '',
    owner_company:       '',
    hero_image_url:      '',
    assigned_bank:       '',
    primary_supplier:    '',
  });

  useEffect(() => {
    if (!id) return;
    api.get(`/api/projects/${id}`)
      .then(res => {
        const p = res.data.project ?? res.data;
        setProject(p);
        setForm({
          title:               p.title               ?? '',
          description:         p.description         ?? '',
          pitch_summary:       p.pitch_summary        ?? '',
          status:              p.status               ?? 'ACTIVE',
          progress_percentage: p.progress_percentage  ?? 0,
          expected_roi:        p.expected_roi         ?? 12,
          risk_grade:          p.risk_grade           ?? 'B',
          visibility:          p.visibility           ?? 'PUBLIC',
          owner_type:          p.owner_type           ?? 'INDIVIDUAL',
          owner_name:          p.owner_name           ?? '',
          owner_phone:         p.owner_phone          ?? '',
          owner_company:       p.owner_company        ?? '',
          hero_image_url:      p.hero_image_url       ?? '',
          assigned_bank:       p.assigned_bank        ?? '',
          primary_supplier:    p.primary_supplier     ?? '',
        });
      })
      .catch(ex => { setError(ex?.response?.data?.error ?? 'Failed to load project.'); })
      .finally(() => setLoading(false));
  }, [id]);

  const f = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Project title is required.'); return; }
    setSubmitting(true); setError(''); setSuccess(false);
    try {
      await api.put(`/api/projects/${id}`, form);
      setSuccess(true);
      setTimeout(() => router.push('/projects/my'), 1500);
    } catch (ex: any) {
      setError(ex?.response?.data?.error ?? 'Update failed. Please try again.');
    } finally { setSubmitting(false); }
  };

  const inputClass  = "w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-white text-sm outline-none focus:border-teal-500 transition-colors";
  const labelClass  = "text-[9px] text-zinc-500 uppercase font-bold tracking-widest block mb-2";
  const selectClass = inputClass + " cursor-pointer";

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

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 py-12">

        {/* Back */}
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-8">
          <ArrowLeft size={13} /> Back
        </button>

        {/* ── PROJECT PREVIEW CARD (hero image + key details) ─────────────── */}
        {project && (
          <div className="mb-8 rounded-3xl border border-zinc-800 overflow-hidden bg-zinc-900/30">
            {/* Hero image */}
            <div className="relative aspect-[16/6] bg-zinc-900 overflow-hidden">
              {form.hero_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.hero_image_url}
                  alt={form.title}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <span className="text-5xl">{CAT_ICON[project.category] ?? '🏗️'}</span>
                    <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">No hero image — upload below</p>
                  </div>
                </div>
              )}
              {/* Status badge overlay */}
              <div className="absolute top-4 left-4">
                <span className={`text-[8px] px-2.5 py-1 rounded-full border font-bold uppercase ${STATUS_COLORS[form.status] ?? STATUS_COLORS.PENDING}`}>
                  {form.status}
                </span>
              </div>
              {/* NAP ID overlay */}
              {project.project_number && (
                <div className="absolute top-4 right-4">
                  <span className="text-[9px] text-teal-400 font-mono font-black bg-black/60 backdrop-blur-sm border border-teal-500/30 px-2.5 py-1 rounded-full">
                    {project.project_number}
                  </span>
                </div>
              )}
            </div>

            {/* Project identity row */}
            <div className="p-6 space-y-2">
              <h2 className="text-xl font-black uppercase tracking-tight">
                {form.title || 'Project Title'}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-500">
                {project.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={10} /> {project.location}, {project.country}
                  </span>
                )}
                {project.category && (
                  <span className="flex items-center gap-1">
                    <Building2 size={10} /> {project.category}
                  </span>
                )}
                {project.timeline_months && (
                  <span className="flex items-center gap-1">
                    <Calendar size={10} /> {project.timeline_months}mo
                  </span>
                )}
              </div>
              <p className="text-[9px] text-zinc-600 leading-relaxed line-clamp-2">
                {form.description || 'Project description will appear here…'}
              </p>
              {/* Progress bar */}
              <div className="pt-2">
                <div className="flex justify-between text-[8px] text-zinc-600 mb-1">
                  <span>Progress</span>
                  <span className="text-teal-400 font-bold">{form.progress_percentage}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${form.progress_percentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="border-l-2 border-teal-500 pl-5 mb-8">
          <h1 className="text-2xl font-black uppercase tracking-tighter">Edit Project</h1>
          <p className="text-zinc-500 text-xs mt-1">Changes are reflected live in the preview above.</p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-bold flex items-start gap-2 mb-6">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> {error}
          </div>
        )}
        {success && (
          <div className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/20 text-teal-400 text-xs font-bold flex items-center gap-2 mb-6">
            <CheckCircle2 size={14} /> Project updated! Redirecting…
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Hero Image ───────────────────────────────────────────────── */}
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest border-b border-zinc-800 pb-3 flex items-center gap-2">
              <ImageIcon size={11} className="text-teal-500" /> Hero Image
            </p>
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              Upload a site photo, architectural render, or drone shot. Shown prominently on your project page and marketplace listing.
            </p>
            <FileUploader
              label="Hero Image"
              hint="Tap to select from gallery or take a photo — best: 16:9 landscape image"
              accept="image"
              folder="project-hero-images"
              value={form.hero_image_url}
              onUpload={url => f('hero_image_url', url)}
              disabled={submitting}
            />
            {/* URL fallback */}
            <div>
              <label className={labelClass}>Or paste a hosted image URL</label>
              <input
                type="url"
                value={form.hero_image_url}
                onChange={e => f('hero_image_url', e.target.value)}
                placeholder="https://your-image-host.com/project.jpg"
                className={inputClass + " font-mono text-xs"}
              />
              <p className="text-[9px] text-zinc-700 mt-1">
                The upload above sets this automatically. Use this only if you already have a hosted image URL.
              </p>
            </div>
          </div>

          {/* ── Core Info ────────────────────────────────────────────────── */}
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-5">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest border-b border-zinc-800 pb-3">Core Information</p>
            <div>
              <label className={labelClass}>Project Title *</label>
              <input required value={form.title} onChange={e => f('title', e.target.value)}
                placeholder="Enter project title" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea value={form.description} onChange={e => f('description', e.target.value)}
                rows={4} placeholder="Full project description" className={inputClass + " resize-none"} />
            </div>
            <div>
              <label className={labelClass}>Investor Pitch / Summary</label>
              <textarea value={form.pitch_summary} onChange={e => f('pitch_summary', e.target.value)}
                rows={3} placeholder="Short pitch for investors" className={inputClass + " resize-none"} />
            </div>
          </div>

          {/* ── Status & Progress ────────────────────────────────────────── */}
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-5">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest border-b border-zinc-800 pb-3">Status &amp; Progress</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Project Status</label>
                <select value={form.status} onChange={e => f('status', e.target.value)} className={selectClass}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Visibility</label>
                <select value={form.visibility} onChange={e => f('visibility', e.target.value)} className={selectClass}>
                  {VISIBILITY.map(v => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Progress ({form.progress_percentage}%)</label>
              <input type="range" min={0} max={100} value={form.progress_percentage}
                onChange={e => f('progress_percentage', Number(e.target.value))}
                className="w-full accent-teal-500 cursor-pointer" />
              <div className="flex justify-between text-[8px] text-zinc-600 font-mono mt-1">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>
          </div>

          {/* ── Financial ────────────────────────────────────────────────── */}
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-5">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest border-b border-zinc-800 pb-3">Financial &amp; Risk</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Expected ROI % p.a.</label>
                <input type="number" min={0} max={100} step={0.5} value={form.expected_roi}
                  onChange={e => f('expected_roi', Number(e.target.value))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Risk Grade</label>
                <select value={form.risk_grade} onChange={e => f('risk_grade', e.target.value)} className={selectClass}>
                  {RISK_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Assigned Bank</label>
                <input value={form.assigned_bank} onChange={e => f('assigned_bank', e.target.value)}
                  placeholder="Bank name (optional)" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Primary Supplier</label>
                <input value={form.primary_supplier} onChange={e => f('primary_supplier', e.target.value)}
                  placeholder="Supplier name (optional)" className={inputClass} />
              </div>
            </div>
          </div>

          {/* ── Owner Info ───────────────────────────────────────────────── */}
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-5">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest border-b border-zinc-800 pb-3">Owner Information</p>
            <div>
              <label className={labelClass}>Owner Type</label>
              <select value={form.owner_type} onChange={e => f('owner_type', e.target.value)} className={selectClass}>
                {OWNER_TYPES.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Owner Name</label>
                <input value={form.owner_name} onChange={e => f('owner_name', e.target.value)}
                  placeholder="Full name" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Owner Phone</label>
                <input value={form.owner_phone} onChange={e => f('owner_phone', e.target.value)}
                  placeholder="+234..." className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Company / Organisation</label>
              <input value={form.owner_company} onChange={e => f('owner_company', e.target.value)}
                placeholder="Company name (optional)" className={inputClass} />
            </div>
          </div>

          {/* ── Submit ───────────────────────────────────────────────────── */}
          <div className="flex gap-3">
            <button type="submit" disabled={submitting || success}
              className="flex-1 py-4 bg-white text-black font-black uppercase text-xs tracking-widest rounded-xl hover:bg-teal-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting
                ? <><Loader2 className="animate-spin" size={14} /> Saving…</>
                : success
                ? <><CheckCircle2 size={14} /> Saved!</>
                : <><Save size={14} /> Save Changes</>}
            </button>
            <button type="button" onClick={() => router.back()}
              className="px-6 py-4 border border-zinc-700 text-zinc-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:border-zinc-500 hover:text-white transition-all">
              Cancel
            </button>
          </div>

        </form>
      </main>
      <Footer />
    </div>
  );
}
