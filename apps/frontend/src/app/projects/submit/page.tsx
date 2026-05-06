'use client';
export const dynamic = 'force-dynamic';
/**
 * /projects/submit/page.tsx
 * NAP INFRASTRUCTURE LEDGER — Submit a real-world infrastructure asset
 * to the Nested Ark Global Ledger.
 *
 * This is SEPARATE from /onboard (Landlord Property Tool).
 * Use /projects/submit for: Roads, Housing Schemes, Solar, Industrial etc.
 * Use /onboard for: Registering rental property for tenant management.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import {
  Globe, Wallet, Building2, Loader2, ShieldCheck,
  ArrowLeft, CheckCircle2, AlertCircle, Home,
  HardHat, DollarSign, Calendar,
} from 'lucide-react';

const COMPLIANCE_MAP: Record<string, { label: string; placeholder: string }> = {
  'Nigeria':              { label: 'LASG / State Digital Permit',  placeholder: 'e.g. LASG-2026-XXXXX' },
  'United Kingdom':       { label: 'Planning Permission Reference', placeholder: 'e.g. 2026/00123/FUL' },
  'USA':                  { label: 'Building Permit / EIN',         placeholder: 'e.g. B-2026-012345' },
  'United Arab Emirates': { label: 'DLD Project Permit No.',        placeholder: 'e.g. DLD-2026-XXXXX' },
  'Kenya':                { label: 'NCA Registration Ref',          placeholder: 'e.g. NCA/2026/XXXXX' },
  'South Africa':         { label: 'NHBRC Enrolment Number',        placeholder: 'e.g. NHBRC-2026-XXXXX' },
  'Germany':              { label: 'Baugenehmigung Reference',      placeholder: 'e.g. BAU-2026-XXXXX' },
  'Singapore':            { label: 'BCA Permit Number',             placeholder: 'e.g. BCA/2026/XXXXX' },
  'Australia':            { label: 'DA Approval Reference',         placeholder: 'e.g. DA-2026-XXXXX' },
  'Canada':               { label: 'Building Permit Number',        placeholder: 'e.g. BP-2026-XXXXX' },
  'India':                { label: 'RERA Registration Number',      placeholder: 'e.g. RERA/2026/XXXXX' },
  'Brazil':               { label: 'Alvará de Construção',          placeholder: 'e.g. AC-2026-XXXXX' },
};

const COUNTRIES    = [...Object.keys(COMPLIANCE_MAP), 'Ghana', 'Ethiopia', 'Senegal', 'Other'].sort();
const CATEGORIES   = ['Residential', 'Commercial', 'Infrastructure', 'Energy / Solar', 'Mixed Use', 'Industrial', 'Agricultural', 'Healthcare', 'Education', 'Transportation'];
const CURRENCIES   = ['NGN', 'USD', 'GBP', 'AED', 'KES', 'ZAR', 'EUR', 'SGD', 'AUD', 'CAD', 'INR', 'BRL'];
const STATUSES     = [
  { value: 'PLANNING',     label: 'Planning Phase' },
  { value: 'CONSTRUCTION', label: 'Under Construction' },
  { value: 'OPERATIONAL',  label: 'Operational / Ready' },
];

interface FormState {
  title:            string;
  description:      string;
  mode:             'CROWDFUND' | 'PRIVATE';
  project_status:   string;
  country:          string;
  location:         string;
  category:         string;
  budget:           string;
  budget_currency:  string;
  timeline_months:  string;
  expected_roi:     string;
  regulatory_ref:   string;
}

export default function SubmitProjectPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [form, setForm] = useState<FormState>({
    title:           '',
    description:     '',
    mode:            'CROWDFUND',
    project_status:  'PLANNING',
    country:         'Nigeria',
    location:        '',
    category:        'Infrastructure',
    budget:          '',
    budget_currency: 'NGN',
    timeline_months: '',
    expected_roi:    '12',
    regulatory_ref:  '',
  });

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const compliance = COMPLIANCE_MAP[form.country] ?? {
    label: 'Local Regulatory Reference',
    placeholder: 'Reference number',
  };

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim())    { setError('Project title is required.'); return; }
    if (!form.location.trim()) { setError('Location / city is required.'); return; }

    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/api/projects', {
        ...form,
        budget:       Number(form.budget)       || 0,
        expected_roi: Number(form.expected_roi) || 0,
        timeline_months: Number(form.timeline_months) || null,
      });

      const id = res.data?.project?.id ?? res.data?.id;
      setSuccess('Node committed to Global Ledger! Generating NAP Project ID…');
      setTimeout(() => router.push(id ? `/projects/${id}` : '/projects/my'), 1800);
    } catch (ex: any) {
      setError(ex?.response?.data?.error ?? 'Ledger sync failed. Please verify your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-4 md:px-6 py-12 space-y-8 w-full">

        {/* Breadcrumb */}
        <div>
          <Link
            href="/projects/my"
            className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-6 w-fit"
          >
            <ArrowLeft size={12} /> My Projects
          </Link>

          <div className="flex items-center gap-2 mb-2">
            <Globe size={16} className="text-teal-500" />
            <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase">
              Global Infrastructure Registry · NAP Ledger
            </p>
          </div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter italic">
            Initialize New Node
          </h1>
          <p className="text-zinc-500 text-sm mt-2 leading-relaxed">
            Submit a real-world infrastructure asset to the Nested Ark ledger. Once committed, it receives a unique NAP Project ID.
          </p>

          {/* Distinguish from Property Tool */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <span className="text-[9px] font-bold uppercase text-blue-400 border border-blue-500/30 bg-blue-500/5 px-3 py-1.5 rounded-lg">
              NAP Infrastructure Ledger
            </span>
            <span className="text-[9px] text-zinc-600">
              To register a rental property for tenants →{' '}
              <Link href="/onboard" className="text-zinc-400 hover:text-teal-500 transition-colors font-bold">
                Property Tool
              </Link>
            </span>
          </div>
        </div>

        {/* Asset Mode */}
        <div>
          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-3">Asset Mode</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { mode: 'CROWDFUND', icon: Wallet,    title: 'Crowdfunded Asset',  sub: 'Open for global fractional investment from investors.',    accent: 'border-teal-500 bg-teal-500/5' },
              { mode: 'PRIVATE',   icon: Building2, title: 'Private Management', sub: 'Contractor bidding and private rent management only.',      accent: 'border-zinc-600 bg-zinc-900/30' },
            ].map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, mode: opt.mode as any }))}
                  className={`p-5 rounded-2xl border text-left transition-all ${form.mode === opt.mode ? opt.accent : 'border-zinc-800 bg-zinc-900/10 hover:border-zinc-700'}`}
                >
                  <Icon size={20} className={form.mode === opt.mode ? 'text-teal-500' : 'text-zinc-600'} />
                  <p className="font-black text-xs uppercase tracking-widest mt-3">{opt.title}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">{opt.sub}</p>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Location & Compliance */}
          <section className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/10 space-y-5">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Location &amp; Regulatory Compliance</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Country</label>
                <select value={form.country} onChange={set('country')}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors">
                  {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">City / Location *</label>
                <input value={form.location} onChange={set('location')}
                  placeholder="e.g. Lagos, Abuja, Dubai"
                  required
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">
                  {compliance.label}
                </label>
                <input value={form.regulatory_ref} onChange={set('regulatory_ref')}
                  placeholder={compliance.placeholder}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-teal-500 outline-none transition-colors" />
              </div>
            </div>
          </section>

          {/* Project Details */}
          <section className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/10 space-y-5">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Project Details</p>

            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Project Title *</label>
              <input value={form.title} onChange={set('title')}
                placeholder="e.g. Alagbado High-Rise Mixed Development"
                required
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Category</label>
                <select value={form.category} onChange={set('category')}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Project Status</label>
                <select value={form.project_status} onChange={set('project_status')}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors">
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Description</label>
              <textarea value={form.description} onChange={set('description')}
                placeholder="Describe the project scope, objectives, and expected impact…"
                rows={3}
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors resize-none" />
            </div>
          </section>

          {/* Financial */}
          <section className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/10 space-y-5">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Financial Parameters</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Budget / Valuation</label>
                <input value={form.budget} onChange={set('budget')}
                  type="number" min="0"
                  placeholder="0"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-teal-500 outline-none transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Currency</label>
                <select value={form.budget_currency} onChange={set('budget_currency')}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors">
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Expected ROI (%)</label>
                <input value={form.expected_roi} onChange={set('expected_roi')}
                  type="number" min="0" max="100"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-teal-500 outline-none transition-colors" />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Timeline (months)</label>
                <input value={form.timeline_months} onChange={set('timeline_months')}
                  type="number" min="1"
                  placeholder="e.g. 24"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-teal-500 outline-none transition-colors" />
              </div>
            </div>
          </section>

          {/* Trust */}
          <div className="p-4 rounded-2xl border border-zinc-800/50 bg-zinc-900/10 flex items-start gap-3">
            <ShieldCheck size={14} className="text-teal-500/70 shrink-0 mt-0.5" />
            <p className="text-[9px] text-zinc-500 leading-relaxed uppercase tracking-wider">
              Committing this node to the ledger generates a unique{' '}
              <span className="text-white font-black">NAP Project ID</span> and initiates Tri-Layer Verification.
              All project data is SHA-256 hashed and immutable.
            </p>
          </div>

          {/* Feedback */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 flex items-center gap-2 text-red-400 text-sm font-bold">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          {success && (
            <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center gap-2 text-teal-400 text-sm font-bold">
              <CheckCircle2 size={14} /> {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-teal-500 text-black font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="animate-spin" size={16} /> Syncing to Ledger…</>
              : <><Globe size={16} /> ⬡ Commit Node to Global Ledger</>
            }
          </button>
        </form>
      </main>
      <Footer />
    </div>
  );
}
