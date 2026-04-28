'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCurrency } from '@/hooks/useCurrency';
import api from '@/lib/api';
import {
  MapPin, Calendar, DollarSign, Building2, ShieldCheck,
  CheckCircle2, Clock, AlertCircle, Loader2, ArrowLeft,
  FileText, TrendingUp, Users, Image as ImageIcon,
  Globe, Cpu, Zap, CreditCard, ChevronDown, ChevronUp,
  BarChart3, Target, Award, Hash, Home, Plus
} from 'lucide-react';

// ── Defensive numeric helpers ──────────────────────────────────────────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();
const safeD = (v: any, d = 2): string => safeN(v).toFixed(d);
const safeNsafeF = (v: any): string => safeF(v); // Legacy fix for combined calls

const CAT_ICON: Record<string, string> = {
  Roads: '🛣️', Energy: '⚡', Water: '💧', Bridges: '🌉', Technology: '💻', Railways: '🚆', Ports: '⚓', Healthcare: '🏥'
};

const FALLBACK_IMAGES = [
  { label: 'Site Master Plan', src: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=600&q=80' },
  { label: '3D Elevation View', src: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&q=80' },
];

const RISK_GRADES = ['AAA', 'AA', 'A', 'BBB'];

export default function ProjectPitchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { format } = useCurrency();

  // ── Existing State ───────────────────────────────────────────────────────
  const [project, setProject] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState('');
  const [tab, setTab] = useState<'overview' | 'financials' | 'documents' | 'team' | 'units'>('overview');
  const [expandedMs, setExpandedMs] = useState<string | null>(null);

  // ── New State for Rental Management ──────────────────────────────────────
  const [units, setUnits] = useState<any[]>([]);
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [unitForm, setUnitForm] = useState({ name: '', type: 'Mini-flat', rent: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const loadProjectData = async () => {
    if (!id) return;
    setLoading(true);
    setFetchErr('');
    try {
      const [p, m, inv, u] = await Promise.allSettled([
        api.get(`/api/projects/${id}`),
        api.get(`/api/milestones/project/${id}`),
        api.get(`/api/investments?project_id=${id}`),
        api.get(`/api/rental/project/${id}/units`), // New Rental Endpoint
      ]);

      if (p.status === 'fulfilled') {
        const proj = p.value.data.project ?? p.value.data;
        if (!proj || !proj.id) setFetchErr('Project not found');
        else setProject(proj);
      } else {
        setFetchErr('Could not load project — server may be starting up.');
      }

      if (m.status === 'fulfilled') setMilestones(m.value.data.milestones ?? []);
      if (inv.status === 'fulfilled') setInvestments(inv.value.data.investments ?? []);
      if (u.status === 'fulfilled') setUnits(u.value.data ?? []);

    } catch (err) {
      setFetchErr('Critical error loading project data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjectData(); }, [id]);

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post(`/api/rental/project/${id}/units`, {
        unit_name: unitForm.name,
        unit_type: unitForm.type,
        current_rent: Number(unitForm.rent)
      });
      setShowAddUnitModal(false);
      setUnitForm({ name: '', type: 'Mini-flat', rent: '' });
      loadProjectData(); // Refresh list
    } catch (err) {
      alert("Failed to add unit. Please check backend routes.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || loading) return (
    <div className="h-screen bg-[#050505] flex flex-col items-center justify-center gap-3">
      <Loader2 className="animate-spin text-teal-500" size={32} />
      <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">Syncing with Ledger…</p>
    </div>
  );

  if (fetchErr || !project) return (
    <div className="h-screen bg-[#050505] flex flex-col items-center justify-center px-6 text-center">
      <AlertCircle className="text-amber-400 mb-4" size={36} />
      <p className="text-white font-bold">{fetchErr || 'Project not found'}</p>
      <Link href="/projects" className="mt-4 text-teal-500 text-xs uppercase font-bold tracking-widest">Return to Marketplace</Link>
    </div>
  );

  const budget = Number(project.budget);
  const raised = investments.filter((i: any) => i.status === 'COMMITTED').reduce((s: any, i: any) => s + Number(i.amount), 0);
  const fillPct = budget > 0 ? Math.min(Math.round((raised / budget) * 100), 100) : 0;
  const riskGrade = RISK_GRADES[Math.floor(Math.random() * RISK_GRADES.length)];

  // Navigation Config
  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'financials', label: 'Financials' },
    { id: 'units', label: 'Units & Property' }, // New Tab
    { id: 'documents', label: 'Documents' },
    { id: 'team', label: 'Principals' }
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full">

        <Link href="/investments" className="inline-flex items-center gap-2 text-[10px] text-zinc-500 hover:text-white uppercase font-bold tracking-widest mb-6 transition-colors">
          <ArrowLeft size={12} /> Investment Nodes
        </Link>

        {/* ── Hero Section ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 p-8 rounded-3xl border border-zinc-800 bg-zinc-900/30 space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-2xl flex-shrink-0">
                {CAT_ICON[project.category] ?? '🏗️'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h1 className="text-2xl font-black tracking-tight uppercase">{project.title}</h1>
                  {project.gov_verified && (
                    <span className="flex items-center gap-1 text-[8px] px-2 py-0.5 rounded border border-teal-500/40 bg-teal-500/10 text-teal-500 font-bold uppercase">
                      <ShieldCheck size={9} /> GOV VERIFIED
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500 flex-wrap">
                  <span className="flex items-center gap-1"><MapPin size={11} /> {project.location}</span>
                  <span className="flex items-center gap-1"><Building2 size={11} /> {project.category}</span>
                </div>
              </div>
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed">{project.description}</p>
          </div>

          {/* Budget Summary Card */}
          <div className="p-6 rounded-3xl border border-zinc-700 bg-zinc-900/50 space-y-5">
            <div>
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Project Budget</p>
              <p className="text-3xl font-black font-mono text-white">{format(budget)}</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest">
                <span className="text-zinc-500">Secured</span>
                <span className="text-teal-500">{fillPct}%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 transition-all shadow-[0_0_10px_rgba(20,184,166,0.3)]" style={{ width: `${fillPct}%` }} />
              </div>
            </div>
            <Link href={`/investments`} className="w-full py-4 bg-teal-500 text-black font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-teal-400 transition-all flex items-center justify-center gap-2">
              <CreditCard size={14} /> Fund Project
            </Link>
          </div>
        </div>

        {/* ── Tab Navigation ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 border-b border-zinc-800 mb-6 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`px-5 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${tab === t.id ? 'border-teal-500 text-teal-500' : 'border-transparent text-zinc-500 hover:text-white'
                }`}>{t.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content: OVERVIEW ─────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Site Visuals</h3>
              <div className="grid grid-cols-2 gap-3">
                {project.hero_image_url ? (
                  <div className="col-span-2 rounded-xl overflow-hidden border border-zinc-800 aspect-video">
                    <img src={project.hero_image_url} alt={project.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  FALLBACK_IMAGES.map((g, i) => (
                    <div key={i} className="rounded-xl overflow-hidden border border-zinc-800 aspect-video">
                      <img src={g.src} alt={g.label} className="w-full h-full object-cover" />
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Milestones</h3>
              {milestones.map(m => (
                <div key={m.id} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/20 flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold uppercase">{m.title}</p>
                    <p className="text-[10px] text-zinc-500">{m.progress_percentage}% Complete</p>
                  </div>
                  <div className={`h-2 w-2 rounded-full ${m.status === 'PAID' ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab Content: UNITS (The New Professional UI) ───────────────────── */}
        {tab === 'units' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Apartment Inventory</h3>
              <button
                onClick={() => setShowAddUnitModal(true)}
                className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2"
              >
                <Plus size={14} /> Add Apartment
              </button>
            </div>

            {units.length === 0 ? (
              <div className="border border-dashed border-zinc-800 rounded-3xl p-16 text-center bg-zinc-900/10">
                <div className="h-16 w-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Home size={24} className="text-zinc-600"/>
                </div>
                <p className="text-zinc-500 mb-4 text-sm">No apartments have been registered for this property yet.</p>
                <button onClick={() => setShowAddUnitModal(true)} className="text-teal-500 hover:text-white font-bold text-xs uppercase tracking-widest transition-all">
                  Onboard your first unit →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {units.map((unit) => (
                  <div key={unit.id} className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between hover:border-teal-500/30 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-white font-black uppercase text-sm group-hover:text-teal-400 transition-colors">{unit.unit_name}</h4>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mt-1">{unit.unit_type}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${unit.status === 'vacant' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                        {unit.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-end border-t border-zinc-800/50 pt-4">
                       <div className="font-mono">
                          <p className="text-[8px] text-zinc-600 uppercase font-bold">Annual Rent</p>
                          <p className="text-sm font-bold text-white">₦{safeNsafeF(unit.current_rent)}</p>
                       </div>
                       <button className="text-[10px] text-zinc-400 hover:text-white font-bold uppercase tracking-widest">Edit</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Standard Tabs: FINANCIALS, DOCUMENTS, TEAM ─────────────────────── */}
        {tab === 'financials' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Yield Projections</h3>
              <div className="flex justify-between py-2 border-b border-zinc-800">
                 <span className="text-xs text-zinc-500 uppercase">Annual ROI</span>
                 <span className="text-xs font-bold text-teal-400">12% - 15%</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'documents' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['Site Survey', 'Gov Approval', 'EIA Report'].map(doc => (
              <div key={doc} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/20 flex items-center gap-3">
                <FileText size={16} className="text-teal-500" />
                <span className="text-xs font-bold uppercase tracking-tight">{doc}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'team' && (
           <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">Lead Contractor</h3>
              <p className="text-white font-bold uppercase">{project.primary_supplier ?? 'Verification in Progress'}</p>
           </div>
        )}

      </main>
      <Footer />

      {/* ── Add Unit Modal ────────────────────────────────────────────────── */}
      {showAddUnitModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2">Register Unit</h2>
            <p className="text-xs text-zinc-500 mb-6 font-bold uppercase tracking-widest">Build your property inventory</p>
            
            <form onSubmit={handleAddUnit} className="space-y-4">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2 block">Unit Name (e.g., Flat 101)</label>
                <input 
                  required
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-teal-500 outline-none transition-all"
                  placeholder="Apartment name..."
                  value={unitForm.name}
                  onChange={e => setUnitForm({...unitForm, name: e.target.value})}
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2 block">Apartment Category</label>
                <select 
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-teal-500 outline-none transition-all appearance-none"
                  value={unitForm.type}
                  onChange={e => setUnitForm({...unitForm, type: e.target.value})}
                >
                  <option>Mini-flat</option>
                  <option>1-Bedroom</option>
                  <option>2-Bedroom Flat</option>
                  <option>3-Bedroom Flat</option>
                  <option>Shop/Commercial</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2 block">Annual Rent (₦)</label>
                <input 
                  required
                  type="number"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-teal-500 outline-none transition-all"
                  placeholder="0.00"
                  value={unitForm.rent}
                  onChange={e => setUnitForm({...unitForm, rent: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddUnitModal(false)} className="flex-1 px-4 py-3 border border-zinc-800 text-zinc-500 text-xs font-bold uppercase tracking-widest rounded-xl">Cancel</button>
                <button disabled={isSubmitting} type="submit" className="flex-1 px-4 py-3 bg-teal-500 text-black text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-white transition-all disabled:opacity-50">
                  {isSubmitting ? 'Syncing...' : 'Save Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}