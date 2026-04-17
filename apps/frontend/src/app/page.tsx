'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  TrendingUp, Building2, ShieldCheck, Globe, ArrowRight,
  Search, Zap, DollarSign, Hammer, Home, Users, Lock,
  CheckCircle2, Activity, FileText, Bell, Wallet,
  ChevronRight, Play, Star, MessageCircle, RefreshCw
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface Stats {
  active_projects: number;
  total_project_value_usd: number;
  countries_active: number;
  total_committed_usd: number;
  total_investors: number;
  milestones_total: number;
  milestones_paid: number;
  ledger_events: number;
  key_rates: Record<string, number>;
}

interface SearchResult {
  id: string; project_number: string; title: string;
  location: string; country: string; budget: number;
  currency: string; category: string; status: string;
  expected_roi: number; funded_pct: number;
  open_bids: number; has_rental: boolean;
}

// ── Compliance label map (mirrors submit page) ────────────────────────────────
const COMPLIANCE_COUNTRIES: Record<string, string> = {
  Nigeria: 'LASG Digital Permit', 'United Kingdom': 'Planning Permission',
  USA: 'Building Permit / EIN', 'United Arab Emirates': 'DLD Project Permit',
  Kenya: 'NCA Registration', Germany: 'Baugenehmigung',
  Singapore: 'BCA Permit', Australia: 'DA Approval',
  Canada: 'Building Permit', India: 'RERA Registration',
  France: 'Permis de Construire', Japan: 'Construction License',
};

// ── Number formatter ─────────────────────────────────────────────────────────
function fmtNum(n: number, decimals = 0) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(decimals)}`;
}

// ── Animated counter ─────────────────────────────────────────────────────────
function Counter({ target, prefix = '', suffix = '', duration = 1800 }: { target: number; prefix?: string; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (target === 0) return;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(target * ease));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);
  return <span>{prefix}{val.toLocaleString()}{suffix}</span>;
}

// ── Engine card ───────────────────────────────────────────────────────────────
function EngineCard({ icon: Icon, color, label, title, bullets, href, tag }: {
  icon: any; color: string; label: string; title: string;
  bullets: string[]; href: string; tag?: string;
}) {
  return (
    <Link href={href} className="group block p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all space-y-4">
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-xl bg-zinc-800 group-hover:bg-zinc-700 transition-all`}>
          <Icon size={18} className={color} />
        </div>
        {tag && (
          <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
            {tag}
          </span>
        )}
      </div>
      <div>
        <p className="text-[8px] uppercase font-bold tracking-widest text-zinc-600 mb-1">{label}</p>
        <p className="font-black text-base uppercase tracking-tight">{title}</p>
      </div>
      <ul className="space-y-1.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-[10px] text-zinc-500">
            <CheckCircle2 size={9} className="text-teal-500/70 flex-shrink-0 mt-0.5" />
            {b}
          </li>
        ))}
      </ul>
      <div className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest ${color}`}>
        Explore <ChevronRight size={10} />
      </div>
    </Link>
  );
}

// ── Step card ────────────────────────────────────────────────────────────────
function StepCard({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full border border-teal-500/40 flex items-center justify-center">
        <span className="text-[9px] font-black font-mono text-teal-500">{num}</span>
      </div>
      <div>
        <p className="font-bold text-sm">{title}</p>
        <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

// ── Safe number guard (prevents toLocaleString crash on undefined fields) ─────
const safeNum = (val: any): number => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

// ─────────────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [stats,          setStats]         = useState<Stats | null>(null);
  const [searchInput,    setSearchInput]   = useState('');
  const [searchResults,  setSearchResults] = useState<SearchResult[]>([]);
  const [searching,      setSearching]     = useState(false);
  const [searchActive,   setSearchActive]  = useState(false);
  const [roiSlider,      setRoiSlider]     = useState(500000);
  const [escrowHovered,  setEscrowHovered] = useState(false);

  // Load live stats
  useEffect(() => {
    api.get('/api/marketplace/stats')
      .then(r => setStats(r.data.stats))
      .catch(() => {});
  }, []);

  // OmniSearch
  useEffect(() => {
    if (!searchInput.trim() || searchInput.length < 2) {
      setSearchResults([]); setSearchActive(false);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get('/api/projects/search', { params: { q: searchInput.trim() } });
        setSearchResults((res.data.results ?? []).slice(0, 5));
        setSearchActive(true);
      } catch { setSearchResults([]); }
      finally   { setSearching(false); }
    }, 380);
    return () => clearTimeout(t);
  }, [searchInput]);

  const roiMonthly = Math.round((roiSlider * 0.12) / 12);
  const roiYearly  = Math.round(roiSlider * 0.12);

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
      <Navbar />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative border-b border-zinc-900 overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
        {/* Radial glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-32">
          <div className="max-w-4xl">
            {/* Tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-500/30 bg-teal-500/5 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-teal-400">
                Global Infrastructure Operating System — Live
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none mb-6">
              The OS for{' '}
              <span className="text-teal-400">Real-World</span>{' '}
              Assets
            </h1>
            <p className="text-zinc-400 text-base md:text-lg max-w-2xl leading-relaxed mb-10">
              Invest, build, verify, and manage physical infrastructure — anywhere on earth.
              Funds secured by escrow. Milestones verified by AI, human, and drone.
              Rents automated by code.
            </p>

            {/* CTA row */}
            <div className="flex flex-wrap gap-3 mb-12">
              <Link href="/register"
                className="flex items-center gap-2 px-7 py-4 bg-teal-500 text-black font-black text-xs uppercase tracking-[0.2em] rounded-xl hover:bg-white transition-all">
                <Zap size={14} /> Start Investing
              </Link>
              <Link href="/projects/submit"
                className="flex items-center gap-2 px-7 py-4 border border-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-[0.2em] rounded-xl hover:border-teal-500/50 hover:text-white transition-all">
                <Building2 size={14} /> Submit a Project
              </Link>
              <Link href="/explore"
                className="flex items-center gap-2 px-7 py-4 border border-zinc-800 text-zinc-500 font-bold text-xs uppercase tracking-[0.2em] rounded-xl hover:border-zinc-600 hover:text-zinc-300 transition-all">
                <Globe size={14} /> Explore Marketplace
              </Link>
            </div>

            {/* Live stat pills */}
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Active Projects',  value: stats ? stats.active_projects.toLocaleString() : '—' },
                { label: 'Countries',        value: stats ? stats.countries_active.toLocaleString() : '—' },
                { label: 'Ledger Events',    value: stats ? safeNum(stats.ledger_events).toLocaleString() : '—' },
                { label: 'Investors',        value: stats ? stats.total_investors.toLocaleString() : '—' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800">
                  <Activity size={9} className="text-teal-500" />
                  <span className="font-mono font-bold text-xs">{s.value}</span>
                  <span className="text-[8px] text-zinc-600 uppercase tracking-widest">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── OMNISEARCH ────────────────────────────────────────────────────── */}
      <section className="border-b border-zinc-900 bg-zinc-950">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest mb-4 text-center">
            Global Project Search — Find infrastructure anywhere in the world
          </p>

          <div className="relative">
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-2xl px-5 focus-within:border-teal-500 transition-all">
              <Search size={16} className="text-zinc-600 flex-shrink-0 mr-4" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search by Project ID (NAP-2026-00042), city, category, or country…"
                className="flex-1 bg-transparent border-none outline-none text-sm py-5 placeholder:text-zinc-700"
              />
              {searching && <RefreshCw size={13} className="animate-spin text-zinc-600 mr-3" />}
              <Link href="/explore"
                className="flex-shrink-0 flex items-center gap-1.5 px-5 py-2.5 bg-teal-500 text-black font-black text-[9px] uppercase tracking-widest rounded-xl hover:bg-white transition-all">
                <Search size={10} /> Search
              </Link>
            </div>

            {/* Live results dropdown */}
            {searchActive && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden z-50 shadow-2xl">
                {searchResults.map(p => (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-800 transition-all border-b border-zinc-800/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-[9px] font-mono text-teal-500">{p.project_number}</span>
                        <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          p.status === 'ACTIVE' ? 'bg-teal-500/10 text-teal-500' : 'bg-zinc-800 text-zinc-500'
                        }`}>{p.status}</span>
                      </div>
                      <p className="font-bold text-sm truncate">{p.title}</p>
                      <p className="text-[9px] text-zinc-500">{p.location}, {p.country} · {p.category}</p>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      <p className="font-mono text-xs font-bold">{p.currency} {Number(p.budget).toLocaleString()}</p>
                      <div className="flex items-center gap-2 justify-end">
                        {p.funded_pct < 100 && (
                          <span className="text-[8px] text-teal-400">💼 {p.expected_roi}% ROI</span>
                        )}
                        {p.open_bids > 0 && (
                          <span className="text-[8px] text-blue-400">🔨 {p.open_bids} jobs</span>
                        )}
                        {p.has_rental && (
                          <span className="text-[8px] text-amber-400">🏠 Rental</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
                <Link href={`/explore?q=${encodeURIComponent(searchInput)}`}
                  className="flex items-center justify-center gap-2 px-5 py-3 text-[9px] text-teal-500 hover:text-white font-bold uppercase tracking-widest bg-zinc-900/50 transition-all">
                  View all results <ArrowRight size={10} />
                </Link>
              </div>
            )}

            {searchActive && searchResults.length === 0 && !searching && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 z-50">
                <p className="text-xs text-zinc-500 text-center">No projects found for "{searchInput}"</p>
                <Link href="/projects/submit" className="block text-center text-[9px] text-teal-500 font-bold mt-2 hover:text-white">
                  Post this project to the marketplace →
                </Link>
              </div>
            )}
          </div>

          {/* Search hints */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {['Lagos', 'Dubai', 'NAP-2026-00001', 'Residential', 'Solar', 'London', 'Nairobi'].map(h => (
              <button key={h} onClick={() => setSearchInput(h)}
                className="px-3 py-1.5 border border-zinc-800 text-zinc-600 text-[9px] font-mono rounded-lg hover:border-teal-500/30 hover:text-teal-500 transition-all">
                {h}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE AUM TICKER ───────────────────────────────────────────────── */}
      {stats && (
        <div className="border-b border-zinc-900 bg-gradient-to-r from-teal-500/5 via-zinc-950 to-teal-500/5">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Infrastructure AUM',   value: fmtNum(stats.total_project_value_usd),    color: 'text-teal-400' },
                { label: 'Capital Committed',    value: fmtNum(stats.total_committed_usd),         color: 'text-amber-400' },
                { label: 'Milestones Completed', value: `${stats.milestones_paid}/${stats.milestones_total}`, color: 'text-white' },
                { label: 'Ledger Immutable Hashes', value: safeNum(stats.ledger_events).toLocaleString(), color: 'text-zinc-400' },
              ].map(s => (
                <div key={s.label} className="text-center space-y-1">
                  <p className={`text-2xl font-black font-mono tabular-nums ${s.color}`}>{s.value}</p>
                  <p className="text-[8px] text-zinc-600 uppercase tracking-widest font-bold">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 4 ENGINE GRID ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16 space-y-6">
        <div className="text-center space-y-3 mb-10">
          <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">The Ecosystem</p>
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">
            One Platform. Four Engines.
          </h2>
          <p className="text-zinc-500 text-sm max-w-xl mx-auto">
            From a bare plot of land to a dividend-paying asset — the Ark manages every stage
            of the infrastructure lifecycle in one closed loop.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <EngineCard
            icon={DollarSign} color="text-teal-400" label="Capital Engine"
            title="Invest"
            bullets={[
              'Fractional ownership from any country',
              '12% annual yield, escrow-backed',
              'Real-time ROI dashboard',
              'Multi-currency: NGN, USD, GBP, AED…',
            ]}
            href="/register"
          />
          <EngineCard
            icon={Hammer} color="text-amber-400" label="Execution Engine"
            title="Build"
            bullets={[
              'Submit projects with global permit references',
              '70/30 mobilization escrow for contractors',
              'Milestone-based fund release',
              'Full BOQ and bid management',
            ]}
            href="/projects/submit"
          />
          <EngineCard
            icon={ShieldCheck} color="text-blue-400" label="Verification Engine"
            title="Verify"
            bullets={[
              'AI analysis on every milestone',
              'Human auditor sign-off required',
              'Drone footage evidence upload',
              'SHA-256 immutable ledger hash',
            ]}
            href="/explore"
          />
          <EngineCard
            icon={Home} color="text-rose-400" label="Management Engine"
            title="Manage"
            tag="New"
            bullets={[
              'Tenant onboarding via WhatsApp link',
              'Flex-Pay vaults: weekly/monthly/quarterly',
              'Auto legal notices — 48h overdue',
              'Landlord cashout: lump-sum or drawdown',
            ]}
            href="/projects/submit"
          />
        </div>
      </section>

      {/* ── TRUST PROTOCOL ────────────────────────────────────────────────── */}
      <section className="border-y border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div>
                <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest mb-3">Trust Protocol</p>
                <h2 className="text-3xl font-black uppercase tracking-tighter leading-tight">
                  Where Your Money<br />
                  <span className="text-teal-400">Actually Sits</span>
                </h2>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                No "trust us". Every transaction is SHA-256 hashed onto an immutable ledger.
                Funds are held by Paystack (a regulated payment processor) and only released
                when verified work is confirmed by three independent layers.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Lock,        title: 'Paystack Escrow',         body: 'Investor capital held in a regulated escrow vault. No manual access by operators.' },
                  { icon: ShieldCheck, title: 'Tri-Layer Verification',   body: 'AI + human auditor + drone footage. All three must confirm before funds release.' },
                  { icon: FileText,    title: 'Immutable Ledger',         body: 'Every payment, milestone, and notice is SHA-256 hashed. Permanent. Tamper-proof.' },
                ].map(t => (
                  <div key={t.title} className="flex items-start gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
                    <t.icon size={16} className="text-teal-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs uppercase tracking-tight">{t.title}</p>
                      <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{t.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Escrow flow visual */}
            <div
              className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4 cursor-pointer"
              onMouseEnter={() => setEscrowHovered(true)}
              onMouseLeave={() => setEscrowHovered(false)}>
              <p className="text-[9px] text-teal-500 uppercase font-bold tracking-widest">
                Live Escrow Flow
              </p>
              <div className="space-y-3">
                {[
                  { step: '01', label: 'Investor commits capital',     active: true },
                  { step: '02', label: 'Funds locked in Paystack escrow', active: escrowHovered },
                  { step: '03', label: 'Contractor completes milestone',   active: escrowHovered },
                  { step: '04', label: 'AI + Human + Drone verify',        active: escrowHovered },
                  { step: '05', label: '70% mobilization released instantly', active: false },
                  { step: '06', label: '30% balance released on verification', active: false },
                  { step: '07', label: 'Platform fee (2%) credited to Ark',    active: false },
                  { step: '08', label: 'SHA-256 hash written to ledger',        active: false },
                ].map((s, idx) => (
                  <div key={s.step}
                    style={{ transitionDelay: `${idx * 40}ms` }}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                      (s.active || escrowHovered) ? 'bg-teal-500/10 border border-teal-500/20' : 'border border-zinc-800 bg-zinc-900/30'
                    }`}>
                    <span className="text-[8px] font-mono text-teal-500 font-black">{s.step}</span>
                    <p className="text-[10px] text-zinc-300">{s.label}</p>
                    {(s.active || escrowHovered) && <CheckCircle2 size={10} className="text-teal-500 ml-auto flex-shrink-0" />}
                  </div>
                ))}
              </div>
              <p className="text-[8px] text-zinc-700 text-center">Hover to activate flow</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── MANAGEMENT ENGINE DEEP DIVE ───────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16 space-y-10">
        <div className="text-center space-y-3">
          <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">Rental Management Engine</p>
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">
            Runs While You Sleep
          </h2>
          <p className="text-zinc-500 text-sm max-w-xl mx-auto">
            For Nigerian landlords demanding 1-year rent upfront. For global investors managing
            property across borders. For developers who need contractors to actually finish.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Flex-Pay Vault */}
          <div className="p-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 space-y-4">
            <Wallet size={20} className="text-blue-400" />
            <div>
              <p className="font-black text-sm uppercase tracking-tight">Flex-Pay Vault</p>
              <p className="text-[9px] text-zinc-500 mt-1">Bridging the upfront vs monthly gap</p>
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Nigerian landlords want 1 year upfront. Tenants earn monthly.
              The Ark Vault lets tenants pay weekly, monthly or quarterly —
              while landlords receive their lump sum or monthly drawdown automatically.
            </p>
            <div className="space-y-2 text-[9px] text-zinc-500">
              <div className="flex justify-between">
                <span>Weekly payment on ₦600k/yr rent</span>
                <span className="text-blue-400 font-bold font-mono">₦11,538/wk</span>
              </div>
              <div className="flex justify-between">
                <span>Monthly payment</span>
                <span className="text-blue-400 font-bold font-mono">₦50,000/mo</span>
              </div>
              <div className="flex justify-between">
                <span>Landlord cashout</span>
                <span className="text-teal-400 font-bold">Full year or monthly drawdown</span>
              </div>
            </div>
          </div>

          {/* Automated Enforcer */}
          <div className="p-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-4">
            <Bell size={20} className="text-amber-400" />
            <div>
              <p className="font-black text-sm uppercase tracking-tight">Automated Enforcer</p>
              <p className="text-[9px] text-zinc-500 mt-1">No more chasing tenants</p>
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Cron-scheduled reminders fire automatically. When rent is 48h overdue,
              the system issues a formal legal notice — SHA-256 stamped,
              emailed as PDF, logged on the immutable ledger. Zero landlord involvement.
            </p>
            <div className="space-y-2">
              {[
                { label: '30 days before due', type: 'Courtesy reminder email' },
                { label: '7 days before due',  type: 'Urgent reminder' },
                { label: '48h overdue',        type: 'Legal Notice to Pay (PDF)' },
                { label: '14 days overdue',    type: 'Escalation notice' },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between text-[9px]">
                  <span className="text-zinc-600 font-mono">{r.label}</span>
                  <span className="text-amber-400 font-bold">{r.type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* WhatsApp Onboarding */}
          <div className="p-6 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-4">
            <MessageCircle size={20} className="text-teal-400" />
            <div>
              <p className="font-black text-sm uppercase tracking-tight">WhatsApp Onboarding</p>
              <p className="text-[9px] text-zinc-500 mt-1">One tap → tenant is onboarded</p>
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Landlord taps "Invite via WhatsApp" on any vacant unit.
              Tenant receives a professional pre-filled message with a direct link.
              They set up their profile and payment rhythm in under 60 seconds.
            </p>
            <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-2">
              <p className="text-[8px] text-zinc-600 uppercase font-bold">Automated after sign-up:</p>
              {[
                'Flex-Pay Vault initialized',
                'Payment rhythm set (weekly/monthly)',
                'First reminder queued by cron',
                'Welcome email + receipt sent',
              ].map(s => (
                <div key={s} className="flex items-center gap-2 text-[9px] text-zinc-400">
                  <CheckCircle2 size={8} className="text-teal-500" /> {s}
                </div>
              ))}
            </div>
            <Link href="/explore"
              className="flex items-center gap-2 text-[9px] text-teal-400 font-bold hover:text-white transition-colors">
              See it in action <ArrowRight size={9} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── GLOBAL COMPLIANCE MAP ─────────────────────────────────────────── */}
      <section className="border-y border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div>
                <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest mb-3">Global Compliance</p>
                <h2 className="text-3xl font-black uppercase tracking-tighter leading-tight">
                  Built for Any<br />
                  <span className="text-teal-400">Country. Any Law.</span>
                </h2>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Nested Ark's Modular Compliance Engine adapts its permit fields to match
                your country's regulatory framework. Not locked to Nigeria.
                Not limited to Africa. Operational anywhere with local legal recognition.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(COMPLIANCE_COUNTRIES).map(([country, permit]) => (
                  <div key={country} className="flex items-start gap-2 text-[9px]">
                    <div className="w-1 h-1 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-zinc-300 font-bold">{country}</p>
                      <p className="text-zinc-600">{permit}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-zinc-700 leading-relaxed">
                + Any country with a regulatory reference system. Expandable by config.
              </p>
            </div>
            <div className="space-y-4">
              <div className="p-5 rounded-2xl border border-teal-500/20 bg-teal-500/5">
                <p className="text-[9px] text-teal-500 uppercase font-bold tracking-widest mb-3">Lagos Example</p>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Nigeria's LASG Digital Permit System (2024) requires all construction projects
                  to carry a government-issued digital permit reference. Nested Ark automatically
                  captures this at project submission — making every project on the platform
                  compliance-ready for audit, bank financing, and government verification.
                </p>
                <div className="mt-3 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 font-mono text-[9px]">
                  <span className="text-zinc-600">Permit ref: </span>
                  <span className="text-teal-400">LASG-2026-00042</span>
                  <span className="text-zinc-700"> · SHA-256 hashed · Ledger verified</span>
                </div>
              </div>
              <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5">
                <p className="text-[9px] text-amber-500 uppercase font-bold tracking-widest mb-2">Sovereign Adaptability</p>
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  A government in Tokyo can register infrastructure using their BCA equivalent.
                  A developer in Berlin uses Baugenehmigung refs. An investor in Dubai uses DLD codes.
                  Same platform. Same security. Local legal standing everywhere.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ROI CALCULATOR ────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-16 space-y-8">
        <div className="text-center space-y-3">
          <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">Yield Calculator</p>
          <h2 className="text-3xl font-black uppercase tracking-tighter">What Would You Earn?</h2>
        </div>

        <div className="p-8 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">Investment Amount</label>
              <span className="font-mono font-bold text-teal-400 text-lg">₦{roiSlider.toLocaleString()}</span>
            </div>
            <input
              type="range" min={100000} max={10000000} step={100000}
              value={roiSlider} onChange={e => setRoiSlider(Number(e.target.value))}
              className="w-full accent-teal-500 h-2"
            />
            <div className="flex justify-between text-[8px] text-zinc-700">
              <span>₦100K</span><span>₦10M</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 text-center">
              <p className="text-[8px] text-zinc-600 uppercase font-bold mb-2">ROI Rate</p>
              <p className="font-black text-xl text-teal-400 font-mono">12%</p>
              <p className="text-[8px] text-zinc-600 mt-1">per annum</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-teal-500/30 text-center">
              <p className="text-[8px] text-zinc-600 uppercase font-bold mb-2">Monthly Yield</p>
              <p className="font-black text-xl text-teal-400 font-mono">₦{roiMonthly.toLocaleString()}</p>
              <p className="text-[8px] text-zinc-600 mt-1">passive income</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 text-center">
              <p className="text-[8px] text-zinc-600 uppercase font-bold mb-2">Annual Return</p>
              <p className="font-black text-xl text-white font-mono">₦{roiYearly.toLocaleString()}</p>
              <p className="text-[8px] text-zinc-600 mt-1">year 1</p>
            </div>
          </div>

          <div className="text-center">
            <Link href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 bg-teal-500 text-black font-black text-xs uppercase tracking-[0.2em] rounded-xl hover:bg-white transition-all">
              <TrendingUp size={14} /> Start Earning {Math.round(12)}% ROI
            </Link>
          </div>

          <p className="text-[8px] text-zinc-700 text-center">
            Returns secured by escrow. Platform takes 2% on milestone release only.
            Principal held until you withdraw.
          </p>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section className="border-y border-zinc-900 bg-zinc-950">
        <div className="max-w-4xl mx-auto px-6 py-16 space-y-10">
          <div className="text-center space-y-3">
            <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">Process</p>
            <h2 className="text-3xl font-black uppercase tracking-tighter">How the Ark Works</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-5">
              <p className="text-[9px] text-teal-500 uppercase font-bold tracking-widest border-b border-teal-500/20 pb-2">
                For Investors
              </p>
              <div className="space-y-5">
                <StepCard num="01" title="Choose a project" body="Browse verified global infrastructure. Filter by ROI, country, category, or asset type." />
                <StepCard num="02" title="Commit capital" body="Funds go directly into Paystack escrow. You receive a cryptographic receipt on the ledger." />
                <StepCard num="03" title="Earn automatically" body="Rent and milestone payments credit your portfolio. Withdraw anytime after the escrow period." />
              </div>
            </div>
            <div className="space-y-5">
              <p className="text-[9px] text-amber-500 uppercase font-bold tracking-widest border-b border-amber-500/20 pb-2">
                For Developers
              </p>
              <div className="space-y-5">
                <StepCard num="01" title="Submit a node" body="Register your project with its regulatory permit ref. Receive a unique NAP-YYYY-NNNNN Project ID." />
                <StepCard num="02" title="Set milestones & bids" body="Define construction milestones. Contractors submit competitive bids. You choose who builds." />
                <StepCard num="03" title="Get funded & verified" body="Investors fund escrow. Work is verified. Funds release automatically on completion proof." />
              </div>
            </div>
            <div className="space-y-5">
              <p className="text-[9px] text-rose-400 uppercase font-bold tracking-widest border-b border-rose-400/20 pb-2">
                For Landlords
              </p>
              <div className="space-y-5">
                <StepCard num="01" title="List your unit" body="Add your rental property. Get a shareable invite link generated instantly." />
                <StepCard num="02" title="Invite via WhatsApp" body="One tap sends a professional onboarding link to your tenant. They self-register in 60s." />
                <StepCard num="03" title="Ark runs the rest" body="Reminders, legal notices, vault accumulation, and cashout are fully automated." />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LIVE PROOF ────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16 space-y-8">
        <div className="text-center space-y-3">
          <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">Network Activity</p>
          <h2 className="text-3xl font-black uppercase tracking-tighter">Live Global Network</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Globe,        label: 'Countries Active',       value: stats ? String(stats.countries_active)   : '—', color: 'text-teal-400' },
            { icon: Building2,    label: 'Projects on Platform',   value: stats ? String(stats.active_projects)    : '—', color: 'text-amber-400' },
            { icon: Users,        label: 'Verified Investors',     value: stats ? String(stats.total_investors)    : '—', color: 'text-blue-400' },
            { icon: ShieldCheck,  label: 'Ledger Events',          value: stats ? safeNum(stats.ledger_events).toLocaleString() : '—', color: 'text-zinc-400' },
          ].map(s => (
            <div key={s.label}
              className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 text-center space-y-2">
              <s.icon size={18} className={`${s.color} mx-auto`} />
              <p className={`text-3xl font-black font-mono ${s.color}`}>{s.value}</p>
              <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Currency rates strip */}
        {stats?.key_rates && (
          <div className="flex flex-wrap justify-center gap-4 pt-4 border-t border-zinc-900">
            <p className="text-[8px] text-zinc-700 uppercase font-bold tracking-widest self-center">Live Rates (vs USD):</p>
            {Object.entries(stats.key_rates).slice(0, 6).map(([cur, rate]) => (
              <div key={cur} className="flex items-center gap-2 text-[9px]">
                <span className="text-zinc-600 font-mono">{cur}</span>
                <span className="text-zinc-400 font-bold font-mono">{safeNum(rate).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── STAKEHOLDERS ──────────────────────────────────────────────────── */}
      <section className="border-y border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6 py-16 space-y-10">
          <div className="text-center space-y-3">
            <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">Who Uses Nested Ark</p>
            <h2 className="text-3xl font-black uppercase tracking-tighter">Built for Every Role</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { icon: '💼', label: 'Investors',    sub: 'Earn 12% ROI on verified infrastructure',   href: '/register' },
              { icon: '🔨', label: 'Contractors',  sub: 'Bid on milestones, get paid on completion',  href: '/register' },
              { icon: '🏗️', label: 'Developers',   sub: 'Fund and manage projects end-to-end',        href: '/projects/submit' },
              { icon: '🏠', label: 'Landlords',    sub: 'Automate rent, notices, and tenant onboarding', href: '/projects/submit' },
              { icon: '🏛️', label: 'Governments', sub: 'Verify, approve, and track infrastructure',   href: '/register' },
            ].map(r => (
              <Link key={r.label} href={r.href}
                className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-teal-500/30 hover:bg-teal-500/5 transition-all text-center group space-y-2">
                <div className="text-3xl">{r.icon}</div>
                <p className="font-black text-xs uppercase tracking-tight">{r.label}</p>
                <p className="text-[9px] text-zinc-600 leading-relaxed">{r.sub}</p>
                <div className="flex items-center justify-center gap-1 text-[8px] text-teal-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                  Get started <ChevronRight size={8} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center space-y-8">
        <div className="space-y-4">
          <p className="text-[9px] text-teal-500 uppercase font-bold tracking-widest">Start Now</p>
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none">
            The World's Infrastructure<br />
            <span className="text-teal-400">Needs a Protocol.</span>
          </h2>
          <p className="text-zinc-500 text-sm max-w-lg mx-auto leading-relaxed">
            Roads, housing, energy, logistics. Every physical asset that shapes civilisation
            can now be funded, built, verified, and managed through a single programmable layer.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/register"
            className="flex items-center gap-2 px-8 py-5 bg-teal-500 text-black font-black text-sm uppercase tracking-[0.2em] rounded-2xl hover:bg-white transition-all">
            <Zap size={16} /> Join the Network
          </Link>
          <Link href="/explore"
            className="flex items-center gap-2 px-8 py-5 border border-zinc-700 text-zinc-300 font-bold text-sm uppercase tracking-[0.15em] rounded-2xl hover:border-zinc-500 hover:text-white transition-all">
            <Globe size={16} /> Explore Projects
          </Link>
          <Link href="/projects/submit"
            className="flex items-center gap-2 px-8 py-5 border border-zinc-800 text-zinc-500 font-bold text-sm uppercase tracking-[0.15em] rounded-2xl hover:border-zinc-700 hover:text-zinc-300 transition-all">
            <Building2 size={16} /> Submit a Node
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-6 text-[9px] text-zinc-700 pt-4">
          <span className="flex items-center gap-1.5"><ShieldCheck size={9} className="text-teal-500/50" /> SHA-256 Ledger</span>
          <span className="flex items-center gap-1.5"><Lock size={9} className="text-teal-500/50" /> Paystack Escrow</span>
          <span className="flex items-center gap-1.5"><Globe size={9} className="text-teal-500/50" /> 12+ Countries</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 size={9} className="text-teal-500/50" /> Tri-Layer Verification</span>
          <span className="flex items-center gap-1.5"><FileText size={9} className="text-teal-500/50" /> Automated Legal Notices</span>
        </div>
      </section>

      <Footer />
    </div>
  );
}
