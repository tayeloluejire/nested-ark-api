'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  TrendingUp, Building2, ShieldCheck, Globe, ArrowRight,
  Search, Home, Users, Lock, CheckCircle2, Activity,
  FileText, Bell, Wallet, ChevronRight, MessageCircle,
  RefreshCw, MapPin, HardHat, Landmark, Layers, Gavel, Receipt,
} from 'lucide-react';

// ── Defensive numeric helpers ─────────────────────────────────────────────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();
const safeD = (v: any, d = 2): string => safeN(v).toFixed(d);

// ── Types ─────────────────────────────────────────────────────────────────────
interface Stats {
  active_projects: number; total_project_value_usd: number;
  countries_active: number; total_committed_usd: number;
  total_investors: number; milestones_total: number;
  milestones_paid: number; ledger_events: number;
  key_rates: Record<string, number>;
}
interface SearchResult {
  id: string; project_number: string; title: string;
  location: string; country: string; budget: number;
  currency: string; category: string; status: string;
  expected_roi: number; funded_pct: number;
  open_bids: number; has_rental: boolean;
}

function fmtNum(raw: any, decimals = 0) {
  const n = safeN(raw);
  if (n >= 1_000_000_000) return `$${safeD(n / 1_000_000_000, 1)}B`;
  if (n >= 1_000_000)     return `$${safeD(n / 1_000_000, 1)}M`;
  if (n >= 1_000)         return `$${safeD(n / 1_000, 0)}K`;
  return `$${n.toFixed(decimals)}`;
}

function Counter({ target, prefix = '', suffix = '', duration = 2000 }: {
  target: number; prefix?: string; suffix?: string; duration?: number;
}) {
  const [val, setVal] = useState(0);
  const ref = useRef<number | null>(null);
  useEffect(() => {
    if (!target) return;
    const animate = (ts: number) => {
      if (!ref.current) ref.current = ts;
      const p = Math.min((ts - ref.current) / duration, 1);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 4))));
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);
  return <span>{prefix}{val.toLocaleString()}{suffix}</span>;
}

const COMPLIANCE_COUNTRIES: Record<string, string> = {
  Nigeria: 'LASG Digital Permit', 'United Kingdom': 'Planning Permission',
  USA: 'Building Permit / EIN', 'United Arab Emirates': 'DLD Project Permit',
  Kenya: 'NCA Registration', Germany: 'Baugenehmigung',
  Singapore: 'BCA Permit', Australia: 'DA Approval',
  Canada: 'Building Permit', India: 'RERA Registration',
  France: 'Permis de Construire', Japan: 'Construction License',
};

type Accent = 'teal' | 'amber' | 'blue' | 'rose';

const accentCls = {
  teal:  { bar: 'from-teal-500 to-teal-400',  border: 'border-teal-500/30 hover:border-teal-500/60 hover:shadow-teal-500/10',  icon: 'bg-teal-500/10',  iconText: 'text-teal-400',  label: 'text-teal-500',  tag: 'border-teal-500/30 bg-teal-500/10 text-teal-400',  btn: 'bg-teal-500 hover:bg-teal-400',  check: 'text-teal-500' },
  amber: { bar: 'from-amber-500 to-amber-400', border: 'border-amber-500/30 hover:border-amber-500/60 hover:shadow-amber-500/10', icon: 'bg-amber-500/10', iconText: 'text-amber-400', label: 'text-amber-500', tag: 'border-amber-500/30 bg-amber-500/10 text-amber-400', btn: 'bg-amber-500 hover:bg-amber-400', check: 'text-amber-500' },
  blue:  { bar: 'from-blue-500 to-blue-400',   border: 'border-blue-500/30 hover:border-blue-500/60 hover:shadow-blue-500/10',   icon: 'bg-blue-500/10',  iconText: 'text-blue-400',  label: 'text-blue-500',  tag: 'border-blue-500/30 bg-blue-500/10 text-blue-400',  btn: 'bg-blue-500 hover:bg-blue-400',  check: 'text-blue-500' },
  rose:  { bar: 'from-rose-500 to-rose-400',   border: 'border-rose-500/30 hover:border-rose-500/60 hover:shadow-rose-500/10',   icon: 'bg-rose-500/10',  iconText: 'text-rose-400',  label: 'text-rose-500',  tag: 'border-rose-500/30 bg-rose-500/10 text-rose-400',  btn: 'bg-rose-500 hover:bg-rose-400',  check: 'text-rose-500' },
};

function RoleCard({ icon: Icon, accent, label, headline, points, primary, primaryLabel, secondary, secondaryLabel, tag }: {
  icon: any; accent: Accent; label: string; headline: string; points: string[];
  primary: string; primaryLabel: string; secondary?: string; secondaryLabel?: string; tag?: string;
}) {
  const c = accentCls[accent];
  return (
    <div className={`relative group flex flex-col rounded-3xl border bg-zinc-950 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${c.border}`}>
      <div className={`h-1 w-full bg-gradient-to-r ${c.bar}`} />
      <div className="p-7 flex flex-col flex-1 space-y-5">
        <div className="flex items-start justify-between">
          <div className={`p-3 rounded-2xl ${c.icon}`}><Icon size={22} className={c.iconText} /></div>
          {tag && <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border ${c.tag}`}>{tag}</span>}
        </div>
        <div>
          <p className={`text-[9px] font-black uppercase tracking-[0.25em] mb-2 ${c.label}`}>{label}</p>
          <h3 className="text-xl font-black uppercase tracking-tight leading-tight text-white">{headline}</h3>
        </div>
        <ul className="space-y-2.5 flex-1">
          {points.map((pt, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[11px] text-zinc-400 leading-relaxed">
              <CheckCircle2 size={10} className={`flex-shrink-0 mt-0.5 ${c.check}`} />{pt}
            </li>
          ))}
        </ul>
        <div className="space-y-2 pt-2">
          <Link href={primary} className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-[11px] uppercase tracking-[0.15em] transition-all text-black ${c.btn}`}>
            {primaryLabel} <ArrowRight size={12} />
          </Link>
          {secondary && secondaryLabel && (
            <Link href={secondary} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-zinc-800 text-zinc-500 font-bold text-[10px] uppercase tracking-widest hover:border-zinc-600 hover:text-zinc-300 transition-all">
              {secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function StepCard({ num, title, body, accent = 'teal' }: { num: string; title: string; body: string; accent?: string }) {
  const cls = accent === 'amber' ? 'border-amber-500/40 text-amber-500 bg-amber-500/5'
    : accent === 'blue' ? 'border-blue-500/40 text-blue-500 bg-blue-500/5'
    : accent === 'rose' ? 'border-rose-500/40 text-rose-400 bg-rose-500/5'
    : 'border-teal-500/40 text-teal-500 bg-teal-500/5';
  return (
    <div className="flex items-start gap-4">
      <div className={`flex-shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center text-[10px] font-black font-mono border ${cls}`}>{num}</div>
      <div>
        <p className="font-bold text-sm text-white">{title}</p>
        <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [stats, setStats]                   = useState<Stats | null>(null);
  const [searchInput, setSearchInput]       = useState('');
  const [searchResults, setSearchResults]   = useState<SearchResult[]>([]);
  const [searching, setSearching]           = useState(false);
  const [searchActive, setSearchActive]     = useState(false);
  const [roiSlider, setRoiSlider]           = useState(500000);
  const [activeRole, setActiveRole]         = useState<'landlord'|'investor'|'developer'|'diaspora'>('landlord');

  useEffect(() => {
    api.get('/api/marketplace/stats').then(r => setStats(r.data.stats)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!searchInput.trim() || searchInput.length < 2) { setSearchResults([]); setSearchActive(false); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get('/api/projects/search', { params: { q: searchInput.trim() } });
        setSearchResults((res.data.results ?? []).slice(0, 5)); setSearchActive(true);
      } catch { setSearchResults([]); } finally { setSearching(false); }
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
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'linear-gradient(#14b8a6 1px,transparent 1px),linear-gradient(90deg,#14b8a6 1px,transparent 1px)', backgroundSize: '80px 80px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-amber-500/3 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 py-20 md:py-28">
          <div className="max-w-5xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-500/30 bg-teal-500/5 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-teal-400">Global Infrastructure OS — Live in 12+ Countries</span>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter leading-[0.92] mb-6">
              Own. Build.<br />
              <span className="text-teal-400">Rent. Earn.</span><br />
              <span className="text-zinc-600">One Protocol.</span>
            </h1>

            <p className="text-zinc-400 text-base md:text-lg max-w-2xl leading-relaxed mb-10">
              Whether you're a landlord automating rent, a diaspora investor funding construction back home,
              a developer raising capital, or a contractor — <strong className="text-white">Nested Ark OS is your infrastructure command centre.</strong>
            </p>

            {/* ── ROLE ENTRY BUTTONS — HERO LEVEL ── */}
            <div className="flex flex-wrap gap-3 mb-10">
              <Link href="/register?role=landlord" className="flex items-center gap-2 px-6 py-4 bg-teal-500 text-black font-black text-xs uppercase tracking-[0.2em] rounded-xl hover:bg-teal-400 transition-all shadow-lg shadow-teal-500/20">
                <Home size={14} /> I'm a Landlord
              </Link>
              <Link href="/register?role=investor" className="flex items-center gap-2 px-6 py-4 bg-amber-500 text-black font-black text-xs uppercase tracking-[0.2em] rounded-xl hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20">
                <TrendingUp size={14} /> I'm an Investor
              </Link>
              <Link href="/projects/submit" className="flex items-center gap-2 px-6 py-4 bg-blue-500 text-black font-black text-xs uppercase tracking-[0.2em] rounded-xl hover:bg-blue-400 transition-all shadow-lg shadow-blue-500/20">
                <Building2 size={14} /> I'm a Developer
              </Link>
              <Link href="/register?role=diaspora" className="flex items-center gap-2 px-6 py-4 border border-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-[0.2em] rounded-xl hover:border-rose-500/50 hover:text-white transition-all">
                <Globe size={14} /> Diaspora Build
              </Link>
              <Link href="/explore" className="flex items-center gap-2 px-6 py-4 border border-zinc-800 text-zinc-500 font-bold text-xs uppercase tracking-[0.2em] rounded-xl hover:border-zinc-600 hover:text-zinc-300 transition-all">
                <Search size={14} /> Explore Projects
              </Link>
            </div>

            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Active Projects', value: stats ? safeF(stats.active_projects) : '—' },
                { label: 'Countries',       value: stats ? safeF(stats.countries_active) : '—' },
                { label: 'Ledger Events',   value: stats ? safeF(stats.ledger_events) : '—' },
                { label: 'Investors',       value: stats ? safeF(stats.total_investors) : '—' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800">
                  <Activity size={9} className="text-teal-500" />
                  <span className="font-mono font-bold text-xs text-white">{s.value}</span>
                  <span className="text-[8px] text-zinc-600 uppercase tracking-widest">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ROLE ENTRY GRID ──────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-16 space-y-8" id="get-started">
        <div className="text-center space-y-3">
          <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-[0.3em]">Choose Your Path</p>
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">What Brings You to the Ark?</h2>
          <p className="text-zinc-500 text-sm max-w-xl mx-auto">Every role has a dedicated command centre. Pick yours and we'll route you to the right tools.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <RoleCard
            icon={Home} accent="teal"
            label="Landlords & Property Owners" headline="Automate Your Rental Income" tag="Most Popular"
            points={[
              'Tenants pay weekly/monthly — you receive annual upfront or monthly drawdown',
              'Auto legal notices: 30-day → 7-day → 48h overdue PDF via email',
              'WhatsApp onboarding — tenant self-registers in 60 seconds',
              'Flex-Pay Vault bridges the upfront rent gap automatically',
            ]}
            primary="/register?role=landlord" primaryLabel="List My Property"
            secondary="/explore" secondaryLabel="See how it works"
          />
          <RoleCard
            icon={TrendingUp} accent="amber"
            label="Investors & Diaspora" headline="Earn 12% on Real Infrastructure"
            points={[
              'Fractional ownership from any country — NGN, USD, GBP, AED',
              'Capital held in Paystack escrow — released only on verified milestones',
              'Real-time ROI dashboard with immutable ledger receipts',
              'Diaspora: fund family construction back home, track it remotely',
            ]}
            primary="/register?role=investor" primaryLabel="Start Investing"
            secondary="/investments" secondaryLabel="See live projects"
          />
          <RoleCard
            icon={HardHat} accent="blue"
            label="Developers & Builders" headline="Fund & Build Any Project"
            points={[
              'Submit with any country regulatory permit reference',
              'Receive NAP-YYYY-NNNNN project ID instantly',
              '70/30 milestone escrow — mobilize contractors without cash flow gaps',
              'Full BOQ, competitive bid management, drone verification',
            ]}
            primary="/projects/submit" primaryLabel="Submit a Project"
            secondary="/projects" secondaryLabel="Browse active nodes"
          />
          <RoleCard
            icon={Landmark} accent="rose"
            label="Private & Diaspora Construction" headline="Build Your Vision Remotely" tag="New"
            points={[
              'Private residential: family homes, estates, diaspora builds',
              'Track construction milestones from anywhere in the world',
              'AI + human + drone verification on every build stage',
              'Connect to vetted local contractors, suppliers & verifiers',
            ]}
            primary="/register?role=developer" primaryLabel="Start Building"
            secondary="/explore" secondaryLabel="Explore projects"
          />
        </div>
      </section>

      {/* ── OMNISEARCH ────────────────────────────────────────────────────── */}
      <section className="border-y border-zinc-900 bg-zinc-950/80">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-[0.3em] mb-4 text-center">
            Global Project Search — Find infrastructure anywhere in the world
          </p>
          <div className="relative">
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-2xl px-5 focus-within:border-teal-500/60 transition-all">
              <Search size={16} className="text-zinc-600 flex-shrink-0 mr-4" />
              <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
                placeholder="Search by Project ID (NAP-2026-00042), city, category, or country…"
                className="flex-1 bg-transparent border-none outline-none text-sm py-5 placeholder:text-zinc-700" />
              {searching && <RefreshCw size={13} className="animate-spin text-zinc-600 mr-3" />}
              <Link href="/explore" className="flex-shrink-0 flex items-center gap-1.5 px-5 py-2.5 bg-teal-500 text-black font-black text-[9px] uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all">
                <Search size={10} /> Search
              </Link>
            </div>
            {searchActive && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden z-50 shadow-2xl">
                {searchResults.map(p => (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-800 transition-all border-b border-zinc-800/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-[9px] font-mono text-teal-500">{p.project_number}</span>
                        <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold uppercase ${p.status === 'ACTIVE' ? 'bg-teal-500/10 text-teal-500' : 'bg-zinc-800 text-zinc-500'}`}>{p.status}</span>
                      </div>
                      <p className="font-bold text-sm truncate">{p.title}</p>
                      <p className="text-[9px] text-zinc-500">{p.location}, {p.country} · {p.category}</p>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      <p className="font-mono text-xs font-bold">{p.currency} {safeF(p.budget)}</p>
                      <div className="flex items-center gap-2 justify-end">
                        {p.funded_pct < 100 && <span className="text-[8px] text-teal-400">💼 {p.expected_roi}% ROI</span>}
                        {p.open_bids > 0 && <span className="text-[8px] text-blue-400">🔨 {p.open_bids} jobs</span>}
                        {p.has_rental && <span className="text-[8px] text-amber-400">🏠 Rental</span>}
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
                <Link href="/projects/submit" className="block text-center text-[9px] text-teal-500 font-bold mt-2 hover:text-white">Post this project →</Link>
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {['Lagos', 'Dubai', 'NAP-2026-00001', 'Residential', 'Solar', 'London', 'Nairobi'].map(h => (
              <button key={h} onClick={() => setSearchInput(h)}
                className="px-3 py-1.5 border border-zinc-800 text-zinc-600 text-[9px] font-mono rounded-lg hover:border-teal-500/30 hover:text-teal-500 transition-all">{h}</button>
            ))}
          </div>
        </div>
      </section>

      {/* ── AUM TICKER ───────────────────────────────────────────────────── */}
      {stats && (
        <div className="border-b border-zinc-900 bg-gradient-to-r from-teal-500/5 via-zinc-950 to-amber-500/5">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Infrastructure AUM',     value: fmtNum(stats.total_project_value_usd), color: 'text-teal-400' },
                { label: 'Capital Committed',       value: fmtNum(stats.total_committed_usd),     color: 'text-amber-400' },
                { label: 'Milestones Completed',    value: `${safeN(stats.milestones_paid)}/${safeN(stats.milestones_total)}`, color: 'text-white' },
                { label: 'Ledger Immutable Hashes', value: safeF(stats.ledger_events),             color: 'text-zinc-400' },
              ].map(s => (
                <div key={s.label} className="text-center space-y-1.5">
                  <p className={`text-2xl md:text-3xl font-black font-mono tabular-nums ${s.color}`}>{s.value}</p>
                  <p className="text-[8px] text-zinc-600 uppercase tracking-[0.2em] font-bold">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── HOW IT WORKS — role tabs ─────────────────────────────────────── */}
      <section className="border-b border-zinc-900 bg-zinc-950">
        <div className="max-w-5xl mx-auto px-6 py-16 space-y-10">
          <div className="text-center space-y-3">
            <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-[0.3em]">Process</p>
            <h2 className="text-3xl font-black uppercase tracking-tighter">How the Ark Works</h2>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {([
              { id: 'landlord',  label: '🏠 Landlord',  color: 'teal'  },
              { id: 'investor',  label: '💼 Investor',  color: 'amber' },
              { id: 'developer', label: '🏗️ Developer', color: 'blue'  },
              { id: 'diaspora',  label: '🌍 Diaspora',  color: 'rose'  },
            ] as const).map(r => (
              <button key={r.id} onClick={() => setActiveRole(r.id)}
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeRole === r.id
                    ? r.color === 'teal'  ? 'bg-teal-500/15 text-teal-400 border border-teal-500/40'
                    : r.color === 'amber' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40'
                    : r.color === 'blue'  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/40'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/40'
                    : 'bg-zinc-900 text-zinc-600 border border-zinc-800 hover:border-zinc-600'
                }`}>{r.label}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {activeRole === 'landlord' && (<>
              <StepCard num="01" accent="teal" title="List your property" body="Add any unit — residential, commercial, or estate. Get a shareable tenant invite link instantly." />
              <StepCard num="02" accent="teal" title="Invite via WhatsApp" body="One tap sends a pre-filled onboarding link. Tenant sets up their payment rhythm in 60 seconds." />
              <StepCard num="03" accent="teal" title="Ark automates the rest" body="Vault accumulates payments. Reminders, legal notices, and cashout run fully on autopilot." />
            </>)}
            {activeRole === 'investor' && (<>
              <StepCard num="01" accent="amber" title="Browse verified projects" body="Filter by ROI, country, asset type, or category. Every project has a regulatory permit reference." />
              <StepCard num="02" accent="amber" title="Commit capital to escrow" body="Funds locked in Paystack escrow. You receive a SHA-256 cryptographic receipt on the ledger." />
              <StepCard num="03" accent="amber" title="Earn automatically" body="Milestone completions and rental distributions credit your portfolio. Withdraw after escrow period." />
            </>)}
            {activeRole === 'developer' && (<>
              <StepCard num="01" accent="blue" title="Submit your project node" body="Upload permit ref, blueprints, and renders. Receive a unique NAP-YYYY-NNNNN Project ID instantly." />
              <StepCard num="02" accent="blue" title="Set milestones & open bidding" body="Define construction stages. Contractors submit competitive bids. You select who builds." />
              <StepCard num="03" accent="blue" title="Get funded & verified" body="Investors fund escrow. Drone + AI + human verify each stage. Funds release automatically." />
            </>)}
            {activeRole === 'diaspora' && (<>
              <StepCard num="01" accent="rose" title="Register your build" body="Submit your family home or private construction with local permit ref from your country." />
              <StepCard num="02" accent="rose" title="Fund & track remotely" body="Fund escrow from abroad. Track every milestone from your phone with photo and drone evidence." />
              <StepCard num="03" accent="rose" title="Verified delivery" body="AI, human auditors, and drone footage confirm every stage. No surprises, no missing funds." />
            </>)}
          </div>
        </div>
      </section>

      {/* ── RENTAL DEEP DIVE ─────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-16 space-y-10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-[9px] text-teal-500 uppercase font-bold tracking-[0.3em] mb-2">Rental Management Engine</p>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">Runs While You Sleep</h2>
          </div>
          <Link href="/register?role=landlord" className="flex items-center gap-2 px-6 py-3.5 bg-teal-500 text-black font-black text-xs uppercase tracking-[0.15em] rounded-xl hover:bg-teal-400 transition-all">
            <Home size={14} /> List Your Property
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Wallet, accent: 'border-blue-500/20 bg-blue-500/5', iconC: 'bg-blue-500/10', iconT: 'text-blue-400',
              title: 'Flex-Pay Vault', sub: 'Bridging upfront vs monthly',
              body: 'Nigerian landlords want 1-year upfront. Tenants earn monthly. The Vault lets tenants pay weekly, monthly, or quarterly — landlords receive a lump sum or monthly drawdown automatically.',
              rows: [
                { l: 'Weekly on ₦600k/yr rent', v: '₦11,538/wk', c: 'text-blue-400' },
                { l: 'Monthly payment', v: '₦50,000/mo', c: 'text-blue-400' },
                { l: 'Landlord cashout', v: 'Full year or drawdown', c: 'text-teal-400' },
              ],
            },
            {
              icon: Bell, accent: 'border-amber-500/20 bg-amber-500/5', iconC: 'bg-amber-500/10', iconT: 'text-amber-400',
              title: 'Automated Enforcer', sub: 'No more chasing tenants',
              body: 'Cron-scheduled reminders fire automatically. 48h overdue triggers a SHA-256 stamped legal notice — emailed as PDF, logged immutably. Zero landlord involvement required.',
              rows: [
                { l: '30 days before due', v: 'Courtesy reminder', c: 'text-zinc-400' },
                { l: '7 days before due',  v: 'Urgent reminder',   c: 'text-amber-400' },
                { l: '48h overdue',        v: 'Legal Notice (PDF)', c: 'text-red-400' },
                { l: '14 days overdue',    v: 'Escalation notice',  c: 'text-red-500' },
              ],
            },
            {
              icon: MessageCircle, accent: 'border-teal-500/20 bg-teal-500/5', iconC: 'bg-teal-500/10', iconT: 'text-teal-400',
              title: 'WhatsApp Onboarding', sub: 'One tap → tenant onboarded',
              body: 'Landlord taps "Invite via WhatsApp" on any vacant unit. Tenant receives a professional pre-filled link. They self-register in under 60 seconds.',
              rows: null,
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className={`p-7 rounded-3xl border space-y-5 ${card.accent}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${card.iconC}`}><Icon size={18} className={card.iconT} /></div>
                  <div>
                    <p className="font-black text-sm uppercase tracking-tight">{card.title}</p>
                    <p className="text-[9px] text-zinc-500">{card.sub}</p>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{card.body}</p>
                {card.rows && (
                  <div className="space-y-2.5">
                    {card.rows.map((r: any) => (
                      <div key={r.l} className="flex justify-between items-center text-[10px]">
                        <span className="text-zinc-500">{r.l}</span>
                        <span className={`font-bold font-mono ${r.c}`}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!card.rows && (
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2.5">
                    <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">Automated after sign-up:</p>
                    {['Flex-Pay Vault initialized','Payment rhythm set (weekly/monthly)','First reminder queued by cron','Welcome email + receipt sent'].map(s => (
                      <div key={s} className="flex items-center gap-2 text-[10px] text-zinc-400">
                        <CheckCircle2 size={9} className="text-teal-500 flex-shrink-0" /> {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          LANDLORD CAPABILITIES — Feature Discovery Grid
          So users immediately see litigation, receipting, ejection
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="border-b border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6 py-16 space-y-10">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <p className="text-[9px] text-teal-500 uppercase font-bold tracking-[0.3em] mb-2">Property Management Suite</p>
              <h2 className="text-3xl font-black uppercase tracking-tighter">
                Every Tool a Landlord Needs
              </h2>
              <p className="text-zinc-500 text-sm mt-2 max-w-lg">
                From the first WhatsApp invite to formal court-admissible ejection proceedings — Nested Ark handles every stage of property management.
              </p>
            </div>
            <Link href="/register?role=landlord"
              className="flex items-center gap-2 px-6 py-3.5 bg-teal-500 text-black font-black text-xs uppercase tracking-[0.15em] rounded-xl hover:bg-teal-400 transition-all flex-shrink-0">
              <Home size={14} /> Get Started Free
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: Users, accent: 'teal', title: 'Digital Tenant Onboarding',
                desc: 'KYC-verified tenant onboarding via WhatsApp link. Tenant self-registers in 60 seconds — guarantor details, digital lease execution, and Flex-Pay vault initialization all automated.',
                badge: null,
                tags: ['WhatsApp Invite', 'KYC Verification', 'Lease Execution', 'Instant Activation'],
              },
              {
                icon: Gavel, accent: 'red', title: 'Litigation & Notice Generator',
                desc: 'Issue court-admissible Notice to Pay, Notice to Quit, Final Warning, and Eviction Warning. Every notice is SHA-256 hashed, logged immutably, and auto-emailed as a signed PDF.',
                badge: 'Critical Feature',
                tags: ['Notice to Quit', 'Notice to Pay', 'Eviction Warning', 'SHA-256 Hashed'],
              },
              {
                icon: Receipt, accent: 'blue', title: 'Instant Smart Receipting',
                desc: 'Every Flex-Pay contribution generates a ledger-backed PDF receipt automatically sent to the tenant via email. Permanent, tamper-proof, court-admissible.',
                badge: null,
                tags: ['Auto PDF Receipt', 'Email Delivery', 'Ledger-Backed', 'Downloadable'],
              },
              {
                icon: Wallet, accent: 'amber', title: 'Flex-Pay Vault System',
                desc: 'Bridging the upfront vs monthly rent gap. Tenants pay weekly, monthly, or quarterly into a secure vault — landlord receives full annual rent or monthly drawdown on demand.',
                badge: null,
                tags: ['Weekly / Monthly', 'Annual Lumpsum', 'Drawdown Mode', '2% Platform Fee'],
              },
              {
                icon: Bell, accent: 'zinc', title: 'Automated Reminder Engine',
                desc: 'Cron-scheduled payment reminders fire automatically at 30 days, 7 days, and 48h overdue thresholds. Zero landlord involvement required.',
                badge: null,
                tags: ['30-Day Courtesy', '7-Day Urgent', '48h Overdue', 'Auto Legal Notice'],
              },
              {
                icon: ShieldCheck, accent: 'purple', title: 'Ejection Proceedings',
                desc: 'When informal notices fail, escalate to formal ejection. Generate legally-formatted ejection proceedings documentation complete with ledger hash as evidence trail.',
                badge: 'Legal Grade',
                tags: ['Court-Admissible', 'Evidence Trail', 'Ledger Proof', 'PDF Export'],
              },
            ].map((f) => {
              const Icon = f.icon;
              const accentMap: Record<string, { border: string; iconBg: string; iconC: string; badgeC: string }> = {
                teal:   { border: 'border-teal-500/20 hover:border-teal-500/40',   iconBg: 'bg-teal-500/10',   iconC: 'text-teal-400',   badgeC: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
                red:    { border: 'border-red-500/25 hover:border-red-500/50',     iconBg: 'bg-red-500/10',    iconC: 'text-red-400',    badgeC: 'bg-red-500/10 text-red-400 border-red-500/20' },
                blue:   { border: 'border-blue-500/20 hover:border-blue-500/40',   iconBg: 'bg-blue-500/10',   iconC: 'text-blue-400',   badgeC: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                amber:  { border: 'border-amber-500/20 hover:border-amber-500/40', iconBg: 'bg-amber-500/10',  iconC: 'text-amber-400',  badgeC: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                zinc:   { border: 'border-zinc-700 hover:border-zinc-600',         iconBg: 'bg-zinc-800',      iconC: 'text-zinc-400',   badgeC: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
                purple: { border: 'border-purple-500/20 hover:border-purple-500/40', iconBg: 'bg-purple-500/10', iconC: 'text-purple-400', badgeC: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
              };
              const a = accentMap[f.accent];
              return (
                <div key={f.title} className={`p-6 rounded-3xl border bg-zinc-950 transition-all space-y-4 ${a.border}`}>
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-2xl ${a.iconBg}`}><Icon size={20} className={a.iconC} /></div>
                    {f.badge && <span className={`text-[7px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${a.badgeC}`}>{f.badge}</span>}
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-tight text-white">{f.title}</h3>
                    <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">{f.desc}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {f.tags.map(t => (
                      <span key={t} className="text-[8px] px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 font-bold uppercase tracking-wide">{t}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── TRUST PROTOCOL ───────────────────────────────────────────────── */}
      <section className="border-y border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div>
                <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-[0.3em] mb-3">Trust Protocol</p>
                <h2 className="text-3xl font-black uppercase tracking-tighter leading-tight">
                  Where Your Money<br /><span className="text-teal-400">Actually Sits</span>
                </h2>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                No "trust us". Every naira and dollar is SHA-256 hashed on an immutable ledger.
                Funds held by Paystack — released only when all three verification layers confirm.
              </p>
              <div className="space-y-3">
                {[
                  { icon: Lock,        title: 'Paystack Escrow',        body: 'Investor capital held in a regulated vault. No manual access by operators.' },
                  { icon: ShieldCheck, title: 'Tri-Layer Verification',  body: 'AI + human auditor + drone footage. All three must confirm before release.' },
                  { icon: FileText,    title: 'Immutable Ledger',        body: 'Every payment and milestone is SHA-256 hashed. Permanent. Tamper-proof.' },
                ].map(t => (
                  <div key={t.title} className="flex items-start gap-4 p-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-all">
                    <t.icon size={15} className="text-teal-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs uppercase tracking-tight">{t.title}</p>
                      <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{t.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-7 rounded-3xl border border-zinc-800 bg-zinc-900/20 space-y-4">
              <p className="text-[9px] text-teal-500 uppercase font-bold tracking-[0.25em]">Live Escrow Flow</p>
              <div className="space-y-2.5">
                {[
                  { t: '01 · Investor commits capital', active: true },
                  { t: '02 · Funds locked in Paystack escrow', active: true },
                  { t: '03 · Contractor completes milestone', active: true },
                  { t: '04 · AI + Human + Drone verify work', active: true },
                  { t: '05 · 70% mobilization released instantly', active: false },
                  { t: '06 · 30% balance released on verification', active: false },
                  { t: '07 · Platform fee (2%) credited to Ark', active: false },
                  { t: '08 · SHA-256 hash written to ledger', active: false },
                ].map((step, i) => (
                  <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[11px] border ${step.active ? 'bg-teal-500/8 border-teal-500/20 text-zinc-300' : 'border-zinc-800/60 bg-zinc-900/20 text-zinc-600'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${step.active ? 'bg-teal-500 animate-pulse' : 'bg-zinc-700'}`} />
                    {step.t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ROI CALCULATOR ───────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-16 space-y-8">
        <div className="text-center space-y-3">
          <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-[0.3em]">Yield Calculator</p>
          <h2 className="text-3xl font-black uppercase tracking-tighter">What Would You Earn?</h2>
        </div>
        <div className="p-8 rounded-3xl border border-teal-500/20 bg-teal-500/5 space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">Investment Amount</label>
              <span className="font-mono font-bold text-teal-400 text-xl">₦{roiSlider.toLocaleString()}</span>
            </div>
            <input type="range" min={100000} max={10000000} step={100000} value={roiSlider}
              onChange={e => setRoiSlider(Number(e.target.value))} className="w-full accent-teal-500 h-2" />
            <div className="flex justify-between text-[8px] text-zinc-700"><span>₦100K</span><span>₦10M</span></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'ROI Rate',      val: '12%',                         sub: 'per annum',    color: 'text-teal-400',  hi: false },
              { label: 'Monthly Yield', val: `₦${roiMonthly.toLocaleString()}`, sub: 'passive income', color: 'text-teal-400',  hi: true  },
              { label: 'Annual Return', val: `₦${roiYearly.toLocaleString()}`,  sub: 'year 1',        color: 'text-white',     hi: false },
            ].map(c => (
              <div key={c.label} className={`p-4 rounded-2xl text-center border ${c.hi ? 'border-teal-500/30 bg-zinc-900/80' : 'border-zinc-800 bg-zinc-900/50'}`}>
                <p className="text-[8px] text-zinc-600 uppercase font-bold mb-2">{c.label}</p>
                <p className={`font-black text-xl font-mono ${c.color}`}>{c.val}</p>
                <p className="text-[8px] text-zinc-600 mt-1">{c.sub}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link href="/register?role=investor" className="inline-flex items-center gap-2 px-8 py-4 bg-teal-500 text-black font-black text-xs uppercase tracking-[0.2em] rounded-xl hover:bg-teal-400 transition-all">
              <TrendingUp size={14} /> Start Earning 12% ROI
            </Link>
          </div>
          <p className="text-[8px] text-zinc-700 text-center">Returns secured by escrow. Platform takes 2% on milestone release only. Principal held until you withdraw.</p>
        </div>
      </section>

      {/* ── LIVE NETWORK ─────────────────────────────────────────────────── */}
      <section className="border-y border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6 py-16 space-y-8">
          <div className="text-center space-y-3">
            <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-[0.3em]">Network Activity</p>
            <h2 className="text-3xl font-black uppercase tracking-tighter">Live Global Network</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Globe,       label: 'Countries Active',     value: stats ? String(safeN(stats.countries_active)) : '—', color: 'text-teal-400' },
              { icon: Building2,   label: 'Projects on Platform', value: stats ? String(safeN(stats.active_projects))  : '—', color: 'text-amber-400' },
              { icon: Users,       label: 'Verified Investors',   value: stats ? String(safeN(stats.total_investors))  : '—', color: 'text-blue-400' },
              { icon: ShieldCheck, label: 'Ledger Events',        value: stats ? safeF(stats.ledger_events)            : '—', color: 'text-zinc-400' },
            ].map(s => (
              <div key={s.label} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 text-center space-y-2 hover:border-zinc-700 transition-all">
                <s.icon size={18} className={`${s.color} mx-auto`} />
                <p className={`text-3xl font-black font-mono ${s.color}`}>{s.value}</p>
                <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s.label}</p>
              </div>
            ))}
          </div>
          {stats?.key_rates && (
            <div className="flex flex-wrap justify-center gap-4 pt-4 border-t border-zinc-900">
              <p className="text-[8px] text-zinc-700 uppercase font-bold tracking-widest self-center">Live Rates (vs USD):</p>
              {Object.entries(stats.key_rates).slice(0, 6).map(([cur, rate]) => (
                <div key={cur} className="flex items-center gap-2 text-[9px]">
                  <span className="text-zinc-600 font-mono">{cur}</span>
                  <span className="text-zinc-400 font-bold font-mono">{safeF(rate)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── STAKEHOLDERS ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16 space-y-10">
        <div className="text-center space-y-3">
          <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-[0.3em]">Who Uses Nested Ark</p>
          <h2 className="text-3xl font-black uppercase tracking-tighter">Built for Every Role</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: '🏠', label: 'Landlords',   sub: 'Automate rent, notices & tenant management', href: '/register?role=landlord', hover: 'hover:border-teal-500/40 hover:bg-teal-500/5' },
            { icon: '💼', label: 'Investors',   sub: 'Earn 12% ROI on verified infrastructure',    href: '/register?role=investor', hover: 'hover:border-amber-500/40 hover:bg-amber-500/5' },
            { icon: '🏗️', label: 'Developers',  sub: 'Fund and build projects end-to-end',          href: '/projects/submit',        hover: 'hover:border-blue-500/40 hover:bg-blue-500/5' },
            { icon: '🌍', label: 'Diaspora',    sub: 'Build back home — track from anywhere',        href: '/register?role=diaspora', hover: 'hover:border-rose-500/40 hover:bg-rose-500/5' },
            { icon: '🔨', label: 'Contractors', sub: 'Bid on milestones, get paid on completion',    href: '/register',               hover: 'hover:border-zinc-600 hover:bg-zinc-900/40' },
          ].map(r => (
            <Link key={r.label} href={r.href}
              className={`p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 transition-all text-center group space-y-2 ${r.hover}`}>
              <div className="text-3xl">{r.icon}</div>
              <p className="font-black text-xs uppercase tracking-tight">{r.label}</p>
              <p className="text-[9px] text-zinc-600 leading-relaxed">{r.sub}</p>
              <div className="flex items-center justify-center gap-1 text-[8px] text-teal-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                Get started <ChevronRight size={8} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── COMPLIANCE ───────────────────────────────────────────────────── */}
      <section className="border-y border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div>
                <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-[0.3em] mb-3">Global Compliance</p>
                <h2 className="text-3xl font-black uppercase tracking-tighter leading-tight">
                  Built for Any<br /><span className="text-teal-400">Country. Any Law.</span>
                </h2>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Nested Ark's Modular Compliance Engine adapts permit fields to match your country's
                regulatory framework. Not locked to Nigeria. Operational anywhere with local legal recognition.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {Object.entries(COMPLIANCE_COUNTRIES).map(([country, permit]) => (
                  <div key={country} className="flex items-start gap-2 text-[9px]">
                    <MapPin size={8} className="text-teal-500 flex-shrink-0 mt-1" />
                    <div><p className="text-zinc-300 font-bold">{country}</p><p className="text-zinc-600">{permit}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="p-6 rounded-2xl border border-teal-500/20 bg-teal-500/5">
                <p className="text-[9px] text-teal-500 uppercase font-bold tracking-widest mb-3">Lagos Example</p>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Nigeria's LASG Digital Permit System requires all construction projects to carry a
                  government-issued digital permit reference. Nested Ark captures this automatically —
                  making every project compliance-ready for audit, bank financing, and government verification.
                </p>
                <div className="mt-3 p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 font-mono text-[9px]">
                  <span className="text-zinc-600">Permit ref: </span>
                  <span className="text-teal-400">LASG-2026-00042</span>
                  <span className="text-zinc-700"> · SHA-256 hashed · Ledger verified</span>
                </div>
              </div>
              <div className="p-6 rounded-2xl border border-amber-500/20 bg-amber-500/5">
                <p className="text-[9px] text-amber-500 uppercase font-bold tracking-widest mb-2">Sovereign Adaptability</p>
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  Tokyo → BCA equivalent. Berlin → Baugenehmigung. Dubai → DLD codes.
                  Same platform. Same security. Local legal standing everywhere.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ───────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center space-y-10">
        <div className="space-y-5">
          <p className="text-[9px] text-teal-500 uppercase font-bold tracking-[0.3em]">The New Global Standard</p>
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-[0.9]">
            Infrastructure<br /><span className="text-teal-400">Needs a Protocol.</span>
          </h2>
          <p className="text-zinc-500 text-sm max-w-lg mx-auto leading-relaxed">
            Roads, housing, energy, rental income. Every physical asset that shapes civilisation
            can now be funded, built, verified, and managed through one programmable layer.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/register?role=landlord" className="flex items-center gap-2 px-7 py-4 bg-teal-500 text-black font-black text-sm uppercase tracking-[0.15em] rounded-2xl hover:bg-teal-400 transition-all">
            <Home size={16} /> I'm a Landlord
          </Link>
          <Link href="/register?role=investor" className="flex items-center gap-2 px-7 py-4 bg-amber-500 text-black font-black text-sm uppercase tracking-[0.15em] rounded-2xl hover:bg-amber-400 transition-all">
            <TrendingUp size={16} /> Start Investing
          </Link>
          <Link href="/projects/submit" className="flex items-center gap-2 px-7 py-4 bg-blue-500 text-black font-black text-sm uppercase tracking-[0.15em] rounded-2xl hover:bg-blue-400 transition-all">
            <Building2 size={16} /> Submit a Project
          </Link>
          <Link href="/register?role=developer" className="flex items-center gap-2 px-7 py-4 border border-zinc-700 text-zinc-300 font-bold text-sm uppercase tracking-[0.12em] rounded-2xl hover:border-rose-500/40 hover:text-white transition-all">
            <Globe size={16} /> Diaspora Build
          </Link>
        </div>
        <div className="flex flex-wrap justify-center gap-6 text-[9px] text-zinc-700 pt-2">
          <span className="flex items-center gap-1.5"><ShieldCheck size={9} className="text-teal-500/50" /> SHA-256 Ledger</span>
          <span className="flex items-center gap-1.5"><Lock size={9} className="text-teal-500/50" /> Paystack Escrow</span>
          <span className="flex items-center gap-1.5"><Globe size={9} className="text-teal-500/50" /> 12+ Countries</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 size={9} className="text-teal-500/50" /> Tri-Layer Verification</span>
          <span className="flex items-center gap-1.5"><FileText size={9} className="text-teal-500/50" /> Automated Legal Notices</span>
          <span className="flex items-center gap-1.5"><Layers size={9} className="text-teal-500/50" /> Global Standard</span>
        </div>
      </section>

      <Footer />
    </div>
  );
}
