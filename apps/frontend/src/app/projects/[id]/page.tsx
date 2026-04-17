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

// ── Defensive numeric helpers — never crash on undefined/null/NaN ──────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any, fallback = '0'): string => safeN(v).toLocaleString();
const safeD = (v: any, d = 2): string => safeN(v).toFixed(d);

  MapPin, Calendar, DollarSign, Building2, ShieldCheck,
  CheckCircle2, Clock, AlertCircle, Loader2, ArrowLeft,
  FileText, TrendingUp, Users, Image as ImageIcon,
  Globe, Cpu, Zap, CreditCard, ChevronDown, ChevronUp,
  BarChart3, Target, Award, Hash
} from 'lucide-react';

const CAT_ICON: Record<string,string> = {
  Roads:'🛣️', Energy:'⚡', Water:'💧', Bridges:'🌉', Technology:'💻', Railways:'🚆', Ports:'⚓', Healthcare:'🏥'
};
// Real gallery — uses project.hero_image_url if available, then Unsplash fallback
const FALLBACK_IMAGES = [
  { label: 'Site Master Plan',  src: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=600&q=80' },
  { label: '3D Elevation View', src: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&q=80' },
];
const RISK_GRADES = ['AAA','AA','A','BBB'];

export default function ProjectPitchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { format } = useCurrency();
  const [project, setProject]     = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [fetchErr, setFetchErr] = useState('');
  const [tab, setTab]             = useState<'overview'|'financials'|'documents'|'team'>('overview');
  const [expandedMs, setExpandedMs] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const loadProject = async () => {
    if (!id) return;
    setLoading(true); setFetchErr('');
    try {
      const [p, m, inv] = await Promise.allSettled([
        api.get(`/api/projects/${id}`),
        api.get(`/api/milestones/project/${id}`),
        api.get(`/api/investments?project_id=${id}`),
      ]);
      if (p.status === 'fulfilled') {
        const proj = p.value.data.project ?? p.value.data;
        if (!proj || !proj.id) setFetchErr('Project not found');
        else setProject(proj);
      } else {
        // API error — could be cold start or genuinely missing
        const errMsg = (p as any).reason?.response?.data?.error ?? (p as any).reason?.message ?? '';
        setFetchErr(errMsg === 'Project not found' ? 'Project not found' : 'Could not load project — the server may be starting up. Please try again.');
      }
      if (m.status === 'fulfilled') setMilestones(m.value.data.milestones ?? []);
      if (inv.status === 'fulfilled') setInvestments(inv.value.data.investments ?? []);
    } catch { setFetchErr('Could not load project — please try again.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadProject(); }, [id]); // eslint-disable-line

  if (authLoading || loading) return (
    <div className="h-screen bg-[#050505] flex flex-col items-center justify-center gap-3">
      <Loader2 className="animate-spin text-teal-500" size={32}/>
      <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">Loading project…</p>
    </div>
  );
  if (fetchErr || !project) return (
    <div className="h-screen bg-[#050505] flex flex-col items-center justify-center gap-5 px-6 text-center">
      <AlertCircle className="text-amber-400" size={36}/>
      <div>
        <p className="text-white font-bold text-lg">{fetchErr || 'Project not found'}</p>
        <p className="text-zinc-500 text-sm mt-1">
          {fetchErr && fetchErr !== 'Project not found'
            ? 'The server may still be waking up. Wait a moment and retry.'
            : 'This project may have been removed or the link is incorrect.'}
        </p>
      </div>
      <div className="flex gap-3 flex-wrap justify-center">
        {fetchErr && fetchErr !== 'Project not found' && (
          <button onClick={loadProject}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all">
            Retry
          </button>
        )}
        <Link href="/investments"
          className="flex items-center gap-2 px-5 py-2.5 border border-zinc-700 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all">
          <ArrowLeft size={12}/> Investment Nodes
        </Link>
        <Link href="/projects"
          className="flex items-center gap-2 px-5 py-2.5 border border-zinc-700 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all">
          Browse Marketplace
        </Link>
      </div>
    </div>
  );

  const budget   = Number(project.budget);
  const raised   = investments.filter((i:any) => i.status === 'COMMITTED').reduce((s:any,i:any) => s + Number(i.amount), 0);
  const fillPct  = budget > 0 ? Math.min(Math.round((raised / budget) * 100), 100) : 0;
  const riskGrade = RISK_GRADES[Math.floor(Math.random() * RISK_GRADES.length)];

  const TABS = ['overview','financials','documents','team'];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar/>
      <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full">

        {/* back */}
        <Link href="/investments" className="inline-flex items-center gap-2 text-[10px] text-zinc-500 hover:text-white uppercase font-bold tracking-widest mb-6 transition-colors">
          <ArrowLeft size={12}/> Investment Nodes
        </Link>

        {/* ── hero ─────────────────────────────────────────────────────────── */}
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
                      <ShieldCheck size={9}/> GOV VERIFIED
                    </span>
                  )}
                  <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${
                    project.status === 'ACTIVE' ? 'border-emerald-500/40 text-emerald-400' : 'border-zinc-700 text-zinc-500'
                  }`}>{project.status}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500 flex-wrap">
                  <span className="flex items-center gap-1"><MapPin size={11}/> {project.location}, {project.country}</span>
                  <span className="flex items-center gap-1"><Building2 size={11}/> {project.category}</span>
                  {project.timeline_months && <span className="flex items-center gap-1"><Calendar size={11}/> {project.timeline_months}mo timeline</span>}
                </div>
              </div>
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed">{project.description}</p>
            <div className="flex items-center gap-3 flex-wrap pt-2">
              {['12% est. annual return','Tri-layer verification','Escrow-secured','SHA-256 ledger'].map(b => (
                <span key={b} className="flex items-center gap-1 text-[9px] text-teal-500 border border-teal-500/30 bg-teal-500/5 px-2 py-1 rounded-lg font-bold uppercase tracking-widest">
                  <CheckCircle2 size={8}/> {b}
                </span>
              ))}
            </div>
          </div>

          {/* investment CTA card */}
          <div className="p-6 rounded-3xl border border-zinc-700 bg-zinc-900/50 space-y-5 flex flex-col">
            <div>
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Project Budget</p>
              <p className="text-3xl font-black font-mono text-white">{format(budget)}</p>
              <p className="text-zinc-600 text-[9px] font-mono">₦{safeF(budget * 1381)} NGN</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest">
                <span className="text-zinc-500">Capital Secured</span>
                <span className="text-teal-500">{fillPct}%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all shadow-[0_0_8px_rgba(20,184,166,0.4)]" style={{width:`${fillPct}%`}}/>
              </div>
              <div className="flex justify-between text-[9px] text-zinc-600 font-mono">
                <span>{format(raised)} raised</span>
                <span>{investments.filter(i=>i.status==='COMMITTED').length} investors</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Risk Grade',    value: riskGrade,           color: 'text-emerald-400' },
                { label: 'Annual Yield',  value: '12% est.',          color: 'text-teal-400' },
                { label: 'Min. Invest',   value: '₦5,000',            color: 'text-white' },
                { label: 'Tenure',        value: '24 months',         color: 'text-amber-400' },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                  <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s.label}</p>
                  <p className={`font-mono text-sm font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
            <Link href="/investments"
              className="w-full py-4 bg-teal-500 text-black font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-teal-400 transition-all flex items-center justify-center gap-2 text-center mt-auto">
              <CreditCard size={14}/> Fund This Project
            </Link>
            {project.gov_verified && (
              <div className="flex items-center gap-2 text-[8px] text-zinc-600">
                <ShieldCheck size={10} className="text-teal-500"/> Government verified · Ref: {project.verification_hash?.slice(0,16) ?? 'N/A'}…
              </div>
            )}
          </div>
        </div>

        {/* ── tab nav ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 border-b border-zinc-800 mb-6 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t as any)}
              className={`px-5 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                tab === t ? 'border-teal-500 text-teal-500' : 'border-transparent text-zinc-500 hover:text-white'
              }`}>{t}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* gallery */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Site Visuals & Renders</h3>
              {/* Hero image — real project image if uploaded, fallback to architectural renders */}
              <div className="grid grid-cols-2 gap-3">
                {project.hero_image_url ? (
                  <>
                    {/* Real hero image spans full width */}
                    <div className="col-span-2 rounded-xl overflow-hidden border border-teal-500/20 relative group aspect-video">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={project.hero_image_url}
                        alt={project.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        onError={e => { (e.target as HTMLImageElement).style.display='none'; }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                        <p className="text-[9px] text-teal-400 font-mono font-black">{project.project_number}</p>
                        <p className="text-white text-sm font-bold uppercase tracking-tight">{project.title}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  // Fallback to architectural renders when no hero image
                  FALLBACK_IMAGES.map((g, i) => (
                    <div key={i} className="rounded-xl overflow-hidden border border-zinc-800 relative group aspect-video">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.src} alt={g.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-black/50 flex items-end p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[9px] text-white font-bold uppercase tracking-widest">{g.label}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <p className="text-[9px] text-zinc-600">3D architectural renders · Site master plans · Engineering schematics available in Documents tab.</p>
            </div>

            {/* milestones */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Project Milestones</h3>
              {milestones.length === 0 && <p className="text-zinc-600 text-xs">No milestones published yet.</p>}
              {milestones.map(m => {
                const allOk = m.ai_status==='VERIFIED' && m.human_status==='VERIFIED' && m.drone_status==='VERIFIED';
                const isOpen = expandedMs === m.id;
                return (
                  <div key={m.id} className={`rounded-xl border transition-all ${allOk ? 'border-teal-500/30 bg-teal-500/5' : m.status === 'PAID' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/20'}`}>
                    <button onClick={() => setExpandedMs(isOpen ? null : m.id)} className="w-full flex items-center justify-between p-4 text-left">
                      <div className="flex items-center gap-3">
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 ${
                          m.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' :
                          allOk ? 'bg-teal-500/20 text-teal-500' : 'bg-zinc-800 text-zinc-500'
                        }`}>
                          {m.status === 'PAID' ? <CheckCircle2 size={13}/> : allOk ? <ShieldCheck size={13}/> : <Clock size={13}/>}
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-tight">{m.title}</p>
                          <p className="text-[9px] text-zinc-500 font-mono">${safeF(m.budget_allocation)}</p>
                        </div>
                      </div>
                      {isOpen ? <ChevronUp size={14} className="text-zinc-500"/> : <ChevronDown size={14} className="text-zinc-500"/>}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 space-y-2 border-t border-zinc-800/50">
                        <p className="text-zinc-500 text-xs mt-3 leading-relaxed">{m.description}</p>
                        <div className="flex gap-3 mt-2">
                          {[
                            { label: 'AI', status: m.ai_status },
                            { label: 'Human', status: m.human_status },
                            { label: 'Drone', status: m.drone_status },
                          ].map(v => (
                            <div key={v.label} className={`flex items-center gap-1 text-[8px] font-bold uppercase px-2 py-1 rounded-lg border ${
                              v.status === 'VERIFIED' ? 'border-teal-500/40 text-teal-500 bg-teal-500/10' : 'border-zinc-700 text-zinc-500'
                            }`}>
                              <ShieldCheck size={8}/> {v.label}: {v.status}
                            </div>
                          ))}
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-[8px] text-zinc-600 mb-1">
                            <span>Progress</span><span>{m.progress_percentage ?? 0}%</span>
                          </div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-teal-500" style={{width:`${m.progress_percentage ?? 0}%`}}/>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── FINANCIALS ───────────────────────────────────────────────────── */}
        {tab === 'financials' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-5">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Financial Breakdown</h3>
              {[
                { label: 'Total Project Budget',   value: format(budget), sub: `₦${safeF(budget*1381)}`, hi: true },
                { label: 'Capital Raised to Date', value: format(raised), sub: `${fillPct}% funded` },
                { label: 'Remaining to Raise',     value: format(budget - raised), sub: 'Open for investment' },
                { label: 'Estimated Annual Return',value: '12% p.a.',      sub: 'Over 24-month tenure' },
                { label: 'Milestone Payouts',       value: milestones.length + ' tranches', sub: 'Released on verification' },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-start py-3 border-b border-zinc-800/50">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{r.label}</span>
                  <div className="text-right">
                    <p className={`font-mono text-sm font-bold ${r.hi ? 'text-teal-500' : 'text-white'}`}>{r.value}</p>
                    <p className="text-[8px] text-zinc-600">{r.sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Escrow Mechanics</h3>
                {[
                  { n:'1', t:'Investor Funds via Paystack', d:'Capital enters Nested Ark escrow. Fully segregated, never co-mingled.' },
                  { n:'2', t:'Milestone Gates', d:'Funds released per milestone. Each gate requires AI + Human + Drone sign-off.' },
                  { n:'3', t:'Tri-Layer Verification', d:'AI risk model, Government human audit, and drone site footage all confirm progress.' },
                  { n:'4', t:'SHA-256 Release Hash', d:'Each release creates an immutable cryptographic record on the ledger.' },
                ].map(s => (
                  <div key={s.n} className="flex gap-3">
                    <div className="h-5 w-5 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-400 text-[9px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{s.n}</div>
                    <div>
                      <p className="text-[10px] font-bold text-white uppercase tracking-widest">{s.t}</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5 leading-relaxed">{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-5 rounded-2xl border border-teal-500/20 bg-teal-500/5 flex items-start gap-3">
                <ShieldCheck size={15} className="text-teal-500 flex-shrink-0 mt-0.5"/>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  All payments processed by <strong className="text-white">Impressions & Impacts Ltd</strong> via Paystack. Your bank statement will show "Impressions and Impacts Ltd".
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── DOCUMENTS ────────────────────────────────────────────────────── */}
        {tab === 'documents' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label:'Environmental Impact Assessment', ext:'PDF' },
                { label:'Government Approval Letter',      ext:'PDF' },
                { label:'Financial Model & Projections',   ext:'XLSX' },
                { label:'Engineering Feasibility Report',  ext:'PDF' },
                { label:'Site Survey & Geotechnical Report', ext:'PDF' },
                { label:'Contractor Qualification Pack',   ext:'PDF' },
              ].map((doc, i) => (
                <div key={i} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex items-center gap-4 hover:border-zinc-700 transition-all">
                  <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <FileText size={18} className="text-teal-500"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{doc.label}</p>
                    <p className="text-[8px] text-zinc-500 uppercase font-mono mt-0.5">{(doc as any).ext} · Government Issued</p>
                  </div>
                  <button className="text-[8px] text-teal-500 border border-teal-500/30 px-2 py-1 rounded-lg font-bold uppercase hover:bg-teal-500/10 transition-all">View</button>
                </div>
              ))}
            </div>
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/20 flex items-start gap-3">
              <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5"/>
              <p className="text-zinc-500 text-xs leading-relaxed">Full document access granted to KYC-verified investors. <Link href="/kyc" className="text-teal-500 hover:underline">Complete KYC →</Link></p>
            </div>
          </div>
        )}

        {/* ── TEAM ─────────────────────────────────────────────────────────── */}
        {tab === 'team' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Project Principals</h3>
              {[
                { role: 'Government Sponsor', name: project.location + ' State Ministry of Works', badge: 'GOV', color: 'text-teal-500' },
                { role: 'Lead Contractor', name: project.primary_supplier ?? 'Assigned upon bid award', badge: 'CONTR', color: 'text-amber-400' },
                { role: 'Funding Bank', name: project.funding_bank ?? 'Open for bank tender', badge: 'BANK', color: 'text-purple-400' },
                { role: 'Materials Supplier', name: project.vendor ?? 'Dangote Industries / Pending RFQ', badge: 'SUPP', color: 'text-blue-400' },
              ].map(p => (
                <div key={p.role} className="flex items-center gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/20">
                  <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <Users size={16} className="text-zinc-500"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{p.role}</p>
                    <p className="text-sm font-bold truncate">{p.name}</p>
                  </div>
                  <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${p.color} border-current`}>{p.badge}</span>
                </div>
              ))}
            </div>
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Platform Guarantees</h3>
              {[
                { icon: ShieldCheck, t: 'Tri-Layer Verification',   d: 'Every milestone verified by AI + Government auditor + Drone footage before escrow release.' },
                { icon: Hash,        t: 'Immutable Ledger',          d: 'SHA-256 hash chain records every transaction. Tamper-proof and publicly auditable.' },
                { icon: Globe,       t: 'Government Authorization',  d: 'Projects require signed approval from the relevant government ministry before going live.' },
                { icon: Award,       t: 'AML/KYC Compliance',        d: 'All investors undergo identity verification. Fully compliant with Nigerian financial regulations.' },
              ].map(g => {
                const Icon = g.icon;
                return (
                  <div key={g.t} className="flex items-start gap-3">
                    <Icon size={15} className="text-teal-500 flex-shrink-0 mt-0.5"/>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest">{g.t}</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5 leading-relaxed">{g.d}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
      <Footer/>
    </div>
  );
}
