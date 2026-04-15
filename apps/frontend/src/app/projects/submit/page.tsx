'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import {
  Globe, Wallet, Building2, Loader2, ShieldCheck,
  ArrowLeft, CheckCircle2, AlertCircle
} from 'lucide-react';

// ── Modular Compliance Engine ─────────────────────────────────────────────────
// Add any country here — the form label and hint auto-update.
const COMPLIANCE_MAP: Record<string, { label: string; placeholder: string; hint: string }> = {
  'Nigeria':               { label: 'LASG / State Digital Permit',   placeholder: 'e.g. LASG-2026-XXXXX',       hint: 'Lagos State Government or relevant state authority permit reference.' },
  'United Kingdom':        { label: 'Planning Permission Reference',  placeholder: 'e.g. 2026/00123/FUL',        hint: 'Local planning authority approval reference number.' },
  'USA':                   { label: 'Building Permit / EIN',          placeholder: 'e.g. B-2026-012345',         hint: 'City or county building department permit number.' },
  'United Arab Emirates':  { label: 'DLD Project Permit No.',         placeholder: 'e.g. DLD-2026-XXXXX',        hint: 'Dubai Land Department or RERA registration reference.' },
  'Kenya':                 { label: 'NCA Registration Ref',           placeholder: 'e.g. NCA/2026/XXXXX',        hint: 'National Construction Authority project registration.' },
  'South Africa':          { label: 'NHBRC Enrolment Number',         placeholder: 'e.g. NHBRC-2026-XXXXX',      hint: 'National Home Builders Registration Council enrolment.' },
  'Germany':               { label: 'Baugenehmigung Reference',       placeholder: 'e.g. BAU-2026-XXXXX',        hint: 'Municipal building permit (Baugenehmigung) reference.' },
  'Singapore':             { label: 'BCA Permit Number',              placeholder: 'e.g. BCA/2026/XXXXX',        hint: 'Building and Construction Authority permit reference.' },
  'Australia':             { label: 'DA Approval Reference',          placeholder: 'e.g. DA-2026-XXXXX',         hint: 'Development Application approval from local council.' },
  'Canada':                { label: 'Building Permit Number',         placeholder: 'e.g. BP-2026-XXXXX',         hint: 'Municipal building permit reference number.' },
  'India':                 { label: 'RERA Registration Number',       placeholder: 'e.g. RERA/2026/XXXXX',       hint: 'Real Estate Regulatory Authority project registration.' },
  'Brazil':                { label: 'Alvará de Construção',           placeholder: 'e.g. AC-2026-XXXXX',         hint: 'Municipal construction permit (Alvará de Construção).' },
};

const COUNTRIES = Object.keys(COMPLIANCE_MAP).sort();

const CATEGORIES = [
  'Residential', 'Commercial', 'Infrastructure', 'Energy / Solar',
  'Mixed Use', 'Industrial', 'Agricultural', 'Healthcare', 'Education', 'Transportation',
];

const CURRENCIES = ['NGN', 'USD', 'GBP', 'AED', 'KES', 'ZAR', 'EUR', 'SGD', 'AUD', 'CAD', 'INR', 'BRL'];

interface FormState {
  title: string;
  description: string;
  mode: 'CROWDFUND' | 'PRIVATE';
  project_status: string;
  country: string;
  location: string;
  category: string;
  budget: string;
  budget_currency: string;
  timeline_months: string;
  expected_roi: string;
  regulatory_ref: string;
}

export default function SubmitProjectPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [form, setForm] = useState<FormState>({
    title: '', description: '', mode: 'CROWDFUND',
    project_status: 'PLANNING', country: 'Nigeria', location: '',
    category: 'Residential', budget: '', budget_currency: 'NGN',
    timeline_months: '', expected_roi: '12', regulatory_ref: '',
  });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const compliance = COMPLIANCE_MAP[form.country] ?? {
    label: 'Local Regulatory Reference',
    placeholder: 'Reference number',
    hint: 'Enter the relevant local regulatory or permit reference.',
  };

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Project title is required.'); return; }
    if (!form.budget || isNaN(Number(form.budget))) { setError('Valid budget amount is required.'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/api/projects', {
        ...form,
        budget: Number(form.budget),
        timeline_months: form.timeline_months ? Number(form.timeline_months) : null,
        expected_roi: Number(form.expected_roi),
      });
      const id = res.data?.project?.id ?? res.data?.id;
      setSuccess(`Node committed! Project ID assigned. Redirecting…`);
      setTimeout(() => router.push(id ? `/projects/${id}` : '/projects/my'), 1800);
    } catch (ex: any) {
      setError(ex?.response?.data?.error ?? 'Ledger sync failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">

        {/* Header */}
        <div>
          <Link href="/projects" className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-6 w-fit">
            <ArrowLeft size={12} /> Back
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <Globe size={18} className="text-teal-500" />
            <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase">Global Infrastructure Registry</p>
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter italic">Initialize New Node</h1>
          <p className="text-zinc-500 text-sm mt-2">
            Submit a real-world asset to the Nested Ark ledger. Once committed, it receives a unique
            <span className="text-teal-400 font-mono"> NAP-YYYY-NNNNN</span> Project ID and becomes globally searchable.
          </p>
        </div>

        {/* Mode selection */}
        <div>
          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-3">Asset Mode</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([
              {
                mode: 'CROWDFUND' as const,
                icon: Wallet,
                title: 'Crowdfunded Asset',
                sub: 'Open for global fractional investment. Investors receive ROI yield.',
              },
              {
                mode: 'PRIVATE' as const,
                icon: Building2,
                title: 'Private Management',
                sub: 'Contractor bidding and rent management only. No public fundraise.',
              },
            ] as const).map(opt => {
              const Icon = opt.icon;
              const active = form.mode === opt.mode;
              return (
                <button key={opt.mode} type="button"
                  onClick={() => setForm(f => ({ ...f, mode: opt.mode }))}
                  className={`p-6 rounded-2xl border text-left transition-all space-y-3 ${active ? 'border-teal-500 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700'}`}>
                  <Icon size={20} className={active ? 'text-teal-500' : 'text-zinc-600'} />
                  <div>
                    <p className="font-black text-xs uppercase tracking-widest">{opt.title}</p>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{opt.sub}</p>
                  </div>
                  {active && <div className="flex items-center gap-1.5 text-[9px] text-teal-500 font-bold"><CheckCircle2 size={10} /> Selected</div>}
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Location & Compliance */}
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/10 space-y-5">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Location &amp; Regulatory Compliance</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">Region / Country</label>
                <select value={form.country} onChange={set('country')}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors">
                  {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">{compliance.label}</label>
                <input value={form.regulatory_ref} onChange={set('regulatory_ref')}
                  placeholder={compliance.placeholder}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors font-mono" />
                <p className="text-[9px] text-zinc-600 leading-relaxed">{compliance.hint}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">City / Location</label>
                <input value={form.location} onChange={set('location')} placeholder="Lagos Island, Lekki Phase 1…" required
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">Category</label>
                <select value={form.category} onChange={set('category')}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Project Details */}
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/10 space-y-5">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Project Details</p>
            <div className="space-y-2">
              <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">Project Title</label>
              <input value={form.title} onChange={set('title')} placeholder="Alagbado High-Rise Phase 2" required
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">Description</label>
              <textarea value={form.description} onChange={set('description')} rows={3}
                placeholder="Describe the project, its purpose, target tenants/buyers, and why it's a strong investment…"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors resize-none" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">Budget</label>
                <input value={form.budget} onChange={set('budget')} type="number" placeholder="5000000" required
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors font-mono" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">Currency</label>
                <select value={form.budget_currency} onChange={set('budget_currency')}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors">
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">Expected ROI %</label>
                <input value={form.expected_roi} onChange={set('expected_roi')} type="number" placeholder="12"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">Project Phase</label>
                <select value={form.project_status} onChange={set('project_status')}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors">
                  <option value="PLANNING">Planning</option>
                  <option value="CONSTRUCTION">Construction</option>
                  <option value="RENOVATION">Renovation</option>
                  <option value="OPERATIONAL">Operational</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">Timeline (months)</label>
                <input value={form.timeline_months} onChange={set('timeline_months')} type="number" placeholder="18"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors font-mono" />
              </div>
            </div>
          </div>

          {/* Ledger notice */}
          <div className="p-4 rounded-2xl border border-zinc-800/50 bg-zinc-900/10 flex items-start gap-3">
            <ShieldCheck size={14} className="text-teal-500/70 flex-shrink-0 mt-0.5" />
            <p className="text-[9px] text-zinc-500 leading-relaxed">
              On submission, a unique <strong className="text-white font-mono">NAP-YYYY-NNNNN</strong> Project ID is assigned and the node is SHA-256 hashed into the immutable ledger. The project becomes globally searchable. Investors can begin committing capital immediately if CROWDFUND mode is selected.
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

          <button type="submit" disabled={loading}
            className="w-full py-5 bg-teal-500 text-black font-black text-xs uppercase tracking-[0.3em] rounded-2xl hover:bg-white transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="animate-spin" size={16} /> : '⬡ Commit Node to Global Ledger'}
          </button>
        </form>

      </main>
      <Footer />
    </div>
  );
}
