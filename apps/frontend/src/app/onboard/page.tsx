'use client';
export const dynamic = 'force-dynamic';
/**
 * /onboard/page.tsx
 * LANDLORD PROPERTY TOOL entry point.
 * This is SEPARATE from /projects/submit (NAP Infrastructure Ledger).
 *
 * Flow:
 *   /onboard  →  register property  →  POST /api/properties
 *             →  redirect to /projects/[id]/rental-management
 *             →  Add units, bank details, fees
 *             →  /landlord/onboard/[unitId]  →  invite tenant
 *             →  tenant opens /tenant/onboard/[unitId]  →  KYC + pay
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import {
  Home, MapPin, Key, Loader2, ShieldCheck,
  ArrowLeft, CheckCircle2, AlertCircle, Building2,
  ChevronRight,
} from 'lucide-react';

const PROPERTY_TYPES = [
  'Apartment / Flat', 'Self-Contain', 'Mini-Flat', 'Duplex',
  'Bungalow', 'Terraced House', 'Office Space',
  'Warehouse', 'Shop / Retail', 'Short-Let',
];

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
  'Yobe','Zamfara',
];

export default function OnboardPropertyPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [form, setForm] = useState({
    name:            '',
    address:         '',
    city:            'Lagos',
    state:           'Lagos',
    country:         'Nigeria',
    property_type:   'Apartment / Flat',
    total_units:     '1',
    description:     '',
    management_mode: 'PRIVATE',
  });

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const set = (key: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim())    { setError('Property name is required.'); return; }
    if (!form.address.trim()) { setError('Street address is required.'); return; }

    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/api/properties', {
        ...form,
        total_units: Number(form.total_units) || 1,
      });

      // Backend returns { id, project_id, ... }
      // We redirect to the rental-management page to add units
      const projectId = res.data?.project_id ?? res.data?.id;
      setSuccess('Property registered! Setting up unit management…');
      setTimeout(() => {
        router.push(`/projects/${projectId}/rental-management`);
      }, 1400);
    } catch (ex: any) {
      setError(ex?.response?.data?.error ?? 'Registration failed. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto px-4 md:px-6 py-12 space-y-8 w-full">

        {/* Breadcrumb */}
        <div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-6 w-fit"
          >
            <ArrowLeft size={12} /> Dashboard
          </Link>

          <div className="flex items-center gap-2 mb-2">
            <Key size={16} className="text-teal-500" />
            <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase">
              Landlord Property Tool
            </p>
          </div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter italic">
            Register New Property
          </h1>
          <p className="text-zinc-500 text-sm mt-2 leading-relaxed">
            Add a building or unit to your portfolio for tenant onboarding, rent tracking, and Flex-Pay automation.
          </p>

          {/* Distinguish from NAP Ledger */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <span className="text-[9px] font-bold uppercase text-teal-500 border border-teal-500/30 bg-teal-500/5 px-3 py-1.5 rounded-lg">
              Property Tool
            </span>
            <span className="text-[9px] text-zinc-600">
              For submitting infrastructure projects to the NAP Global Ledger →{' '}
              <Link href="/projects/submit" className="text-zinc-400 hover:text-teal-500 transition-colors font-bold">
                Submit Project
              </Link>
            </span>
          </div>
        </div>

        {/* Flow Steps */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { n: '01', label: 'Register Property',   active: true },
            { n: '02', label: 'Add Units & Fees',     active: false },
            { n: '03', label: 'Onboard Tenants',      active: false },
          ].map(step => (
            <div key={step.n} className={`p-3 rounded-2xl border text-center ${step.active ? 'border-teal-500/40 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/10'}`}>
              <p className={`text-[9px] font-mono font-black uppercase tracking-widest ${step.active ? 'text-teal-500' : 'text-zinc-600'}`}>{step.n}</p>
              <p className={`text-[10px] font-black uppercase mt-0.5 ${step.active ? 'text-white' : 'text-zinc-600'}`}>{step.label}</p>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Property Identity */}
          <section className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/10 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Home size={14} className="text-teal-500" />
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Property Identity</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">
                Property Name / Alias *
              </label>
              <input
                value={form.name}
                onChange={set('name')}
                placeholder="e.g. Hassan Court Annex, Green Estate Block B"
                required
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Property Type</label>
                <select
                  value={form.property_type}
                  onChange={set('property_type')}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors"
                >
                  {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Total Units</label>
                <input
                  type="number"
                  value={form.total_units}
                  onChange={set('total_units')}
                  min="1"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Description (optional)</label>
              <textarea
                value={form.description}
                onChange={set('description')}
                placeholder="Brief description of the property…"
                rows={2}
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors resize-none"
              />
            </div>
          </section>

          {/* Location */}
          <section className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/10 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={14} className="text-zinc-500" />
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Physical Address</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Street Address *</label>
              <input
                value={form.address}
                onChange={set('address')}
                placeholder="e.g. 14 Adeniyi Jones Avenue, Ikeja"
                required
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">City / LGA</label>
                <input
                  value={form.city}
                  onChange={set('city')}
                  placeholder="Lagos"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">State</label>
                <select
                  value={form.state}
                  onChange={set('state')}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors"
                >
                  {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Country</label>
                <input
                  value={form.country}
                  onChange={set('country')}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors"
                />
              </div>
            </div>
          </section>

          {/* Trust badge */}
          <div className="p-4 rounded-2xl border border-zinc-800/50 bg-zinc-900/10 flex items-start gap-3">
            <ShieldCheck size={14} className="text-teal-500/70 shrink-0 mt-0.5" />
            <p className="text-[9px] text-zinc-500 leading-relaxed uppercase tracking-wider">
              Tri-Layer Verification (AI + Human + Drone) activates on this property once a unit is added.
              All lease agreements are SHA-256 hashed and court-admissible.
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
              ? <><Loader2 className="animate-spin" size={16} /> Registering…</>
              : <><Building2 size={16} /> Register Property &amp; Continue to Units <ChevronRight size={16} /></>
            }
          </button>
        </form>
      </main>
      <Footer />
    </div>
  );
}
