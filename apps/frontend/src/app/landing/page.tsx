'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowRight, ShieldCheck, TrendingUp, Building2, Users, Globe,
  CheckCircle2, Lock, Eye, Cpu, Scale, FileText, MapPin,
  DollarSign, Zap, Home, Factory, TreePine, Wrench, BarChart3,
  BadgeCheck, ChevronDown, Star, Play, RefreshCw, 
  Database, Camera, Briefcase, HardHat // <--- Add these missing icons
} from 'lucide-react';
import MarketTicker from '@/components/MarketTicker';
import ThemeToggle from '@/components/ThemeToggle';
import NapSearch from '@/components/NapSearch';
import api from '@/lib/api';

// ── Defensive numeric helpers — never crash on undefined/null/NaN ──────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();
const safeD = (v: any, d = 2): string => safeN(v).toFixed(d);


// ── Live market stats hook ─────────────────────────────────────────────────────
function useMarketStats() {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    api.get('/api/marketplace/stats').then(r => setStats(r.data.stats)).catch(() => {});
  }, []);
  return stats;
}

// ── Animated counter ─────────────────────────────────────────────────────────
function Counter({ to, prefix = '', suffix = '', duration = 1800 }: {
  to: number; prefix?: string; suffix?: string; duration?: number;
}) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const start = Date.now();
    const iv = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - pct, 3);
      setVal(Math.floor(eased * to));
      if (pct >= 1) clearInterval(iv);
    }, 16);
  }, [to, duration]);
  return <>{prefix}{safeF(val)}{suffix}</>;
}

// ── Pill tag ──────────────────────────────────────────────────────────────────
function Tag({ children, color = 'teal' }: { children: React.ReactNode; color?: string }) {
  const c: Record<string, string> = {
    teal:    'border-teal-500/30 bg-teal-500/8 text-teal-400',
    amber:   'border-amber-500/30 bg-amber-500/8 text-amber-400',
    emerald: 'border-emerald-500/30 bg-emerald-500/8 text-emerald-400',
    blue:    'border-blue-500/30 bg-blue-500/8 text-blue-400',
    red:     'border-red-500/30 bg-red-500/8 text-red-400',
    purple:  'border-purple-500/30 bg-purple-500/8 text-purple-400',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${c[color] ?? c.teal}`}>
      {children}
    </span>
  );
}

// ── Project type cards ────────────────────────────────────────────────────────
const PROJECT_TYPES = [
  { icon: Zap,       label: 'Infrastructure',  desc: 'Roads, bridges, utilities, energy grids',       color: 'teal',    type: 'INFRASTRUCTURE' },
  { icon: Home,      label: 'Residential',      desc: 'Private homes, estate development, Diaspora builds', color: 'emerald', type: 'RESIDENTIAL' },
  { icon: Building2, label: 'Commercial',       desc: 'Offices, retail, mixed-use developments',      color: 'blue',    type: 'COMMERCIAL' },
  { icon: Factory,   label: 'Industrial',       desc: 'Manufacturing plants, warehouses, logistics',  color: 'amber',   type: 'INDUSTRIAL' },
  { icon: Wrench,    label: 'Renovation',       desc: 'Refurbishment, retrofits, property upgrades',  color: 'purple',  type: 'RENOVATION' },
  { icon: TreePine,  label: 'Landscape',        desc: 'Parks, green spaces, eco-infrastructure',      color: 'emerald', type: 'LANDSCAPE' },
];

// ── Role panels ───────────────────────────────────────────────────────────────
const ROLES = [
  {
    id: 'investor', emoji: '💰', flag: '🇬🇧 🇺🇸 🇦🇪',
    label: 'Diaspora Investor', color: 'teal',
    headline: 'Send capital from London. Watch it build in Lagos.',
    body: 'Fund verified infrastructure projects from anywhere in the world. Your money enters Paystack escrow — it physically cannot reach a contractor until three independent parties confirm the work is done. Track your yield in GBP, USD or NGN in real-time.',
    bullets: ['12% p.a. target annual yield', 'Paystack-secured escrow', 'Portfolio ticks up per second', 'GBP / USD / EUR / NGN tracking', 'Downloadable investment certificate', 'KYC-required for full access'],
    cta: 'Start Investing', href: '/register?role=INVESTOR',
  },
  {
    id: 'developer', emoji: '🏠', flag: '🌍',
    label: 'Developer / Project Owner', color: 'emerald',
    headline: 'Post your project. Build from anywhere.',
    body: 'Assign a unique NAP Project ID (NAP-2026-NNNNN) to your build site. Upload 2D blueprints and 3D renders so investors see exactly what they are funding. Individual homeowners, private developers, estates, and corporates — all welcome.',
    bullets: ['Individual, corporate & private builds', 'Unique NAP project identifier', '2D/3D document upload', 'Milestone-by-milestone escrow control', 'Invite contractors to bid', 'Government-verified projects rank higher'],
    cta: 'Post a Project', href: '/register?role=DEVELOPER',
  },
  {
    id: 'contractor', emoji: '🏗', flag: '🇳🇬',
    label: 'Contractor', color: 'amber',
    headline: 'Win work by trade. Get paid per milestone.',
    body: 'Browse project IDs by trade type — Civil, Electrical, Plumbing, Architecture. Bid transparently on NAP-registered projects. When the verifier confirms your work, escrow releases automatically. No chasing invoices. No political risk.',
    bullets: ['Search by trade category', 'Transparent bidding marketplace', 'Escrow-guaranteed payment', 'Immutable work record', 'Tri-layer release = no disputes', 'Rate your developer after completion'],
    cta: 'Find Work', href: '/register?role=CONTRACTOR',
  },
  {
    id: 'government', emoji: '🏛', flag: '🇳🇬',
    label: 'Government / Agency', color: 'blue',
    headline: 'Mandate it. Fund it. Audit it. Publicly.',
    body: 'Sponsor public infrastructure tenders with full ledger transparency. Every naira spent is SHA-256 hashed in an immutable audit log. Drone footage confirms physical progress. AML-compliant, regulation-ready.',
    bullets: ['Public tender management', 'Immutable expenditure ledger', 'Drone verification integration', 'AML & compliance reporting', 'Authorize escrow releases', 'Access full project audit trail'],
    cta: 'Open Gov Portal', href: '/register?role=GOVERNMENT',
  },
  {
    id: 'crowdfund', emoji: '🤝', flag: '🌍',
    label: 'Community / Crowdfund', color: 'purple',
    headline: 'Pool capital. Build together.',
    body: 'Communities, hometown associations, co-operatives and Diaspora groups can pool smaller investments into a single infrastructure project. Each contributor gets their own ledger entry and investment certificate. Visibility and accountability for every contributor.',
    bullets: ['Multiple investors per project', 'Individual ledger certificates', 'Community project visibility', 'Hometown association support', 'International co-investment', 'Track contributions per member'],
    cta: 'Register & Start', href: '/register?role=INVESTOR',
  },
];

const colorMap: Record<string, { border: string; bg: string; text: string; btn: string }> = {
  teal:    { border: 'border-teal-500/40',    bg: 'bg-teal-500/5',    text: 'text-teal-400',    btn: 'bg-teal-500 text-black hover:bg-white hover:text-black' },
  emerald: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/5', text: 'text-emerald-400', btn: 'bg-emerald-500 text-black hover:bg-white hover:text-black' },
  amber:   { border: 'border-amber-500/40',   bg: 'bg-amber-500/5',   text: 'text-amber-400',   btn: 'bg-amber-500 text-black hover:bg-white hover:text-black' },
  blue:    { border: 'border-blue-500/40',    bg: 'bg-blue-500/5',    text: 'text-blue-400',    btn: 'bg-blue-500 text-white hover:bg-white hover:text-black' },
  purple:  { border: 'border-purple-500/40',  bg: 'bg-purple-500/5',  text: 'text-purple-400',  btn: 'bg-purple-500 text-white hover:bg-white hover:text-black' },
};

export default function LandingPage() {
  const [activeRole, setActiveRole] = useState(0);
  const stats = useMarketStats();
  const ngnTotal = Number(stats?.total_invested_ngn ?? 0);
  const usdTotal = ngnTotal / 1379;

  const r = ROLES[activeRole];
  const c = colorMap[r.color];

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-teal-500/30 overflow-x-hidden">
      <MarketTicker />

      {/* ── Sticky Nav ───────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-zinc-900 bg-black/75 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-5 h-5 bg-teal-500 rounded-sm rotate-45 flex-shrink-0" />
            <span className="text-sm font-black tracking-[0.15em] uppercase hidden sm:block">
              Nested Ark <span className="text-teal-500 text-[10px] align-top">OS</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6 text-[9px] font-bold uppercase tracking-widest">
            <a href="#what"      className="text-zinc-500 hover:text-white transition-colors">What it is</a>
            <a href="#projects"  className="text-zinc-500 hover:text-white transition-colors">Project Types</a>
            <a href="#roles"     className="text-zinc-500 hover:text-white transition-colors">Who it's for</a>
            <a href="#trust"     className="text-zinc-500 hover:text-white transition-colors">Trust Layer</a>
            <a href="#diaspora"  className="text-zinc-500 hover:text-white transition-colors">Diaspora</a>
            <Link href="/projects" className="text-zinc-500 hover:text-teal-500 transition-colors">Marketplace</Link>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <Link href="/login"    className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors hidden sm:block px-3 py-2">Sign In</Link>
            <Link href="/register" className="bg-white text-black px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-teal-500 transition-all flex-shrink-0">
              Get Access
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative max-w-7xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#14b8a606_1px,transparent_1px),linear-gradient(to_bottom,#14b8a606_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#14b8a60a_0%,transparent_65%)] pointer-events-none" />

        <div className="relative space-y-7">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Tag color="teal"><ShieldCheck size={9} /> Tri-Layer Verified</Tag>
            <Tag color="emerald"><Lock size={9} /> Paystack Escrow</Tag>
            <Tag color="amber"><Cpu size={9} /> AI + Human + Drone</Tag>
            <Tag color="blue"><Globe size={9} /> Lagos · London · Dubai</Tag>
            <Tag color="purple"><Scale size={9} /> Platform &amp; Escrow Only — Not the Contractor</Tag>
          </div>

          <h1 className="text-5xl md:text-8xl font-black tracking-tighter uppercase leading-[0.82] italic">
            Infrastructure<br />
            You Can <span className="text-teal-500">Trust.</span><br />
            Capital You Can <span className="text-teal-500">Track.</span>
          </h1>

          <p className="text-zinc-400 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
            Nested Ark OS is the <strong className="text-white">escrow, transparency and verification layer</strong> between
            Diaspora capital and African infrastructure — residential, commercial, public and private.
            We hold the money. The contractors earn it only when the work is independently verified.
          </p>

          {/* Disclaimer */}
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 text-[9px] text-zinc-500 font-mono uppercase tracking-widest">
            <Scale size={10} className="text-amber-400 flex-shrink-0" />
            Nested Ark is the platform &amp; escrow provider. Projects are posted by independent owners. We are not the contractor.
          </div>

          {/* CTA trio */}
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/register?role=INVESTOR"
              className="flex items-center gap-2 px-8 py-4 bg-teal-500 text-black font-black uppercase text-xs tracking-[0.15em] rounded-xl hover:bg-white transition-all">
              Start Investing <ArrowRight size={13} />
            </Link>
            <Link href="/register?role=DEVELOPER"
              className="flex items-center gap-2 px-8 py-4 border border-zinc-700 text-white font-bold uppercase text-xs tracking-widest rounded-xl hover:border-emerald-500/60 hover:text-emerald-400 transition-all">
              Post a Project
            </Link>
            <Link href="/projects"
              className="flex items-center gap-2 px-8 py-4 border border-zinc-800 text-zinc-400 font-bold uppercase text-xs tracking-widest rounded-xl hover:border-zinc-600 hover:text-white transition-all">
              Browse Marketplace
            </Link>
          </div>

          {/* Live NAP Search */}
          <div className="max-w-xl mx-auto">
            <p className="text-[9px] text-zinc-700 uppercase font-bold tracking-widest mb-3">Track any project by ID</p>
            <NapSearch mode="inline" placeholder="Enter NAP-2026-00042 to track any project" />
          </div>

          {/* Live stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto pt-4">
              {[
                { label: 'Active Builds',    value: <Counter to={stats.active_projects} /> },
                { label: 'Capital Deployed', value: <>${safeD(usdTotal / 1_000_000, 2)}M</> },
                { label: 'Nations Linked',   value: <Counter to={stats.countries_active} /> },
                { label: 'Operators',        value: <Counter to={stats.total_operators} /> },
              ].map(s => (
                <div key={s.label} className="p-4 rounded-xl border border-zinc-900 bg-zinc-900/20 text-center">
                  <p className="text-2xl font-black font-mono text-teal-500">{s.value}</p>
                  <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── WHAT IS NESTED ARK ───────────────────────────────────────────────── */}
      <section id="what" className="max-w-7xl mx-auto px-6 py-24 space-y-14">
        <div className="text-center space-y-4">
          <Tag color="teal">What is Nested Ark</Tag>
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic">
            Infrastructure Needs<br />A <span className="text-teal-500">Trusted Referee</span>
          </h2>
          <p className="text-zinc-500 text-base max-w-2xl mx-auto leading-relaxed">
            Billions of pounds flow from the Diaspora to home-country projects every year. Most disappear into a fog
            of incomplete builds, diverted funds and zero accountability. Nested Ark is the missing layer.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              color: 'red', border: 'border-red-500/20', bg: 'bg-red-500/5', icon: Building2,
              title: 'The Problem',
              points: ['Diaspora sends £50k. Construction stops at foundation.', 'No independent verification of progress.', 'Contractor disappears after first payment.', 'No legal recourse across jurisdictions.'],
            },
            {
              color: 'teal', border: 'border-teal-500/20', bg: 'bg-teal-500/5', icon: ShieldCheck,
              title: 'Our Solution',
              points: ['All funds held in Paystack escrow — not with the contractor.', 'Three independent parties verify each milestone.', 'Drone footage + human auditor + AI hash = release.', 'Immutable SHA-256 ledger for every transaction.'],
            },
            {
              color: 'amber', border: 'border-amber-500/20', bg: 'bg-amber-500/5', icon: Scale,
              title: 'Our Role',
              points: ['We are the escrow layer — not the builder.', 'Projects submitted by their independent owners.', 'We verify, audit and hold funds.', 'Not liable for construction quality — we are the accountability mechanism.'],
            },
          ].map(col => {
            const Icon = col.icon;
            return (
              <div key={col.title} className={`p-8 rounded-2xl border ${col.border} ${col.bg}`}>
                <Icon size={24} className={`text-${col.color}-400 mb-5`} />
                <h3 className={`text-base font-black uppercase tracking-tight mb-4 text-${col.color}-400`}>{col.title}</h3>
                <ul className="space-y-3">
                  {col.points.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-zinc-400 leading-relaxed">
                      <CheckCircle2 size={10} className={`text-${col.color}-400 mt-0.5 flex-shrink-0`} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── PROJECT TYPES ───────────────────────────────────────────────────── */}
      <section id="projects" className="border-y border-zinc-900 bg-zinc-900/10 py-24">
        <div className="max-w-7xl mx-auto px-6 space-y-14">
          <div className="text-center space-y-4">
            <Tag color="emerald">Project Types</Tag>
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic">
              Public, Private &amp; <span className="text-teal-500">Individual.</span><br />
              Any project. Any owner.
            </h2>
            <p className="text-zinc-500 text-sm max-w-2xl mx-auto leading-relaxed">
              Nested Ark supports the full spectrum of infrastructure and property development — from a single
              Diaspora family home to a government water treatment plant to a commercial estate with crowdfunded
              investors. Every project gets a unique NAP ID and the same bulletproof escrow protection.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {PROJECT_TYPES.map(pt => {
              const Icon = pt.icon;
              const colors = colorMap[pt.color];
              return (
                <Link key={pt.type} href={`/projects?project_type=${pt.type}`}
                  className={`p-6 rounded-2xl border ${colors.border} ${colors.bg} hover:scale-[1.02] transition-all group`}>
                  <Icon size={24} className={`${colors.text} mb-4`} />
                  <p className={`text-sm font-black uppercase tracking-tight ${colors.text}`}>{pt.label}</p>
                  <p className="text-zinc-500 text-xs leading-relaxed mt-2">{pt.desc}</p>
                  <p className={`text-[8px] uppercase font-bold tracking-widest mt-3 flex items-center gap-1 ${colors.text} opacity-0 group-hover:opacity-100 transition-opacity`}>
                    Browse {pt.label} projects <ArrowRight size={9} />
                  </p>
                </Link>
              );
            })}
          </div>

          {/* Owner types */}
          <div className="p-8 rounded-3xl border border-zinc-800 bg-zinc-900/20">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-5">Who can submit projects:</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { icon: '👤', label: 'Individual', desc: 'Personal home builds' },
                { icon: '🏢', label: 'Corporate',  desc: 'Companies & estates' },
                { icon: '💼', label: 'Private Business', desc: 'SMEs & developers' },
                { icon: '🏠', label: 'Developer',  desc: 'Property developers' },
                { icon: '🏛', label: 'Government', desc: 'Public agencies' },
              ].map(o => (
                <div key={o.label} className="text-center p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
                  <p className="text-2xl mb-2">{o.icon}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest">{o.label}</p>
                  <p className="text-[9px] text-zinc-600 mt-1">{o.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────────── */}
      <section id="how" className="max-w-7xl mx-auto px-6 py-24 space-y-14">
        <div className="text-center space-y-4">
          <Tag color="amber">How It Works</Tag>
          <h2 className="text-4xl font-black uppercase tracking-tighter italic">
            Four Steps. Zero Surprises.
          </h2>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { n: '01', title: 'NAP ID Generated',   desc: 'Every build gets a unique NAP-YYYY-NNNNN identifier. Traceable globally from Lagos to London.' },
            { n: '02', title: 'Funds Enter Escrow', desc: 'Investor capital flows to Paystack-held escrow. No one — not us, not the contractor — can access it without milestone release.' },
            { n: '03', title: 'Tri-Layer Verify',   desc: 'AI image analysis + independent human auditor + drone footage. All three must pass before escrow releases.' },
            { n: '04', title: 'Ledger Hash Issued', desc: 'Every payment and verification is SHA-256 hashed and permanently chained to the public ledger. Immutable.' },
          ].map(step => (
            <div key={step.n} className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20">
              <p className="text-5xl font-black font-mono text-teal-500/20 mb-4">{step.n}</p>
              <h3 className="text-sm font-black uppercase tracking-tight mb-3">{step.title}</h3>
              <p className="text-zinc-500 text-xs leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Certificate callout */}
        <div className="p-8 rounded-3xl border border-teal-500/20 bg-teal-500/5 grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <Tag color="teal"><FileText size={9} /> Digital Certificate of Interest</Tag>
            <h3 className="text-2xl font-black uppercase tracking-tighter italic">
              Every investment generates a cryptographically-linked certificate.
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              After funding a project, investors receive a downloadable certificate containing the Global Ledger Hash
              that permanently links their commitment to our immutable audit trail. Your legal claim is on-chain — not in a filing cabinet.
            </p>
            <Link href="/register?role=INVESTOR"
              className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all">
              Get Your Certificate <ArrowRight size={12} />
            </Link>
          </div>
          <div className="p-6 rounded-2xl border border-zinc-800 bg-black/40 font-mono text-xs space-y-2.5">
            <p className="text-zinc-600 uppercase font-bold text-[9px]">Certificate Preview</p>
            <p className="text-zinc-600">──────────────────────────────</p>
            <p className="text-zinc-400">Project: <span className="text-teal-400">NAP-2026-00042</span></p>
            <p className="text-zinc-400">Investor: <span className="text-white">Taye Olaolu</span></p>
            <p className="text-zinc-400">Amount: <span className="text-emerald-400">₦5,000.00</span></p>
            <p className="text-zinc-400">ROI Rate: <span className="text-teal-400">12.00% p.a.</span></p>
            <p className="text-zinc-400">Issued: <span className="text-white">03 April 2026</span></p>
            <p className="text-zinc-600">──────────────────────────────</p>
            <p className="text-[9px] text-zinc-500 break-all">Ledger Hash: <span className="text-teal-500/70">a3f9b2c4d1e8f6...</span></p>
            <p className="text-[8px] text-zinc-700 mt-1">SHA-256 · Immutable · Nested Ark OS v4.0</p>
          </div>
        </div>
      </section>

      {/* ── ROLES ────────────────────────────────────────────────────────────── */}
      <section id="roles" className="border-y border-zinc-900 bg-zinc-900/10 py-24">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-4">
            <Tag color="blue">Who It's For</Tag>
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic">
              One OS. <span className="text-teal-500">Five Command Centers.</span>
            </h2>
            <p className="text-zinc-500 text-sm max-w-xl mx-auto">
              Every operator type has a purpose-built portal — from Diaspora investors to government agencies to community crowdfunders.
            </p>
          </div>

          {/* Role tabs */}
          <div className="flex flex-wrap gap-2 justify-center">
            {ROLES.map((role, i) => {
              const cc = colorMap[role.color];
              return (
                <button key={role.id} onClick={() => setActiveRole(i)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeRole === i ? `${cc.border} ${cc.bg} ${cc.text}` : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-white'
                  }`}>
                  <span>{role.emoji}</span> {role.label}
                </button>
              );
            })}
          </div>

          {/* Active role panel */}
          <div className={`p-8 md:p-12 rounded-3xl border ${c.border} ${c.bg} transition-all`}>
            <div className="grid md:grid-cols-2 gap-10 items-start">
              <div className="space-y-6">
                <div className="text-4xl">{r.emoji}</div>
                <div>
                  <p className={`text-[9px] uppercase font-black tracking-widest mb-2 ${c.text}`}>
                    {r.label} {r.flag}
                  </p>
                  <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter italic leading-tight">
                    {r.headline}
                  </h3>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed">{r.body}</p>
                <Link href={r.href}
                  className={`inline-flex items-center gap-2 px-7 py-3.5 font-black text-xs uppercase tracking-widest rounded-xl transition-all ${c.btn}`}>
                  {r.cta} <ArrowRight size={13} />
                </Link>
              </div>
              <div className="space-y-3">
                <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">What you get:</p>
                {r.bullets.map((b, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-zinc-800 bg-black/30">
                    <CheckCircle2 size={13} className={`${c.text} mt-0.5 flex-shrink-0`} />
                    <p className="text-sm text-white font-medium">{b}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST / PROOF OF WORK ────────────────────────────────────────────── */}
      <section id="trust" className="max-w-7xl mx-auto px-6 py-24 space-y-14">
        <div className="text-center space-y-4">
          <Tag color="blue"><Eye size={9} /> Proof of Work</Tag>
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic">
            We Don't Ask You to Trust Us.<br />
            <span className="text-teal-500">The Drone Shows You.</span>
          </h2>
          <p className="text-zinc-500 text-sm max-w-2xl mx-auto leading-relaxed">
            When an investor clicks their position, they see timestamped drone verification reports and photo
            galleries of the actual site. In infrastructure, seeing is believing. Hashing is proving.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Cpu,    color: 'text-teal-400',  border: 'border-teal-500/20',  title: 'AI Layer',     desc: 'Every uploaded evidence photo runs through computer vision analysis. Material quantity, structural markers and GPS metadata are extracted and hashed.' },
            { icon: Users,  color: 'text-amber-400', border: 'border-amber-500/20', title: 'Human Auditor', desc: 'An independent verifier — not employed by the contractor or developer — physically inspects the site and submits a digitally-signed inspection report.' },
            { icon: Eye,    color: 'text-blue-400',  border: 'border-blue-500/20',  title: 'Drone Layer',  desc: 'Aerial footage is captured, timestamped and geo-tagged. The drone hash is chained to the global ledger. Investors view footage inside their position.' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.title} className={`p-8 rounded-2xl border ${item.border} bg-zinc-900/20 space-y-4`}>
                <Icon size={28} className={item.color} />
                <h3 className={`text-base font-black uppercase tracking-tight ${item.color}`}>{item.title}</h3>
                <p className="text-zinc-500 text-xs leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <div className="inline-flex items-center gap-0 rounded-2xl border border-zinc-800 overflow-hidden">
            {['AI Hash', 'Human Audit', 'Drone Footage'].map((s, i) => (
              <div key={s} className={`px-6 py-4 text-center border-r border-zinc-800 last:border-r-0 ${i === 1 ? 'bg-teal-500/10' : ''}`}>
                <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{i + 1} of 3</p>
                <p className={`text-sm font-black uppercase ${i === 1 ? 'text-teal-400' : 'text-zinc-400'}`}>{s}</p>
              </div>
            ))}
          </div>
          <p className="text-zinc-700 text-[9px] uppercase font-bold tracking-widest mt-3">All three required before escrow releases</p>
        </div>
      </section>


      {/* ── DRONE VERIFICATION VISUAL ────────────────────────────────────────── */}
      <section className="border-y border-zinc-900 bg-black py-28">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-20 items-center">
          <div className="relative aspect-video bg-zinc-900 rounded-[2rem] overflow-hidden border border-zinc-800">
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
            <div className="absolute top-6 left-6 z-20 flex gap-2">
              <div className="px-3 py-1 rounded-full bg-red-500 text-white text-[8px] font-black uppercase tracking-widest animate-pulse">Live Verification</div>
              <div className="px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-white text-[8px] font-bold uppercase tracking-widest border border-white/10">Drone ID: NA-LAG-092</div>
            </div>
            <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1473876637954-4b483d6751a2?q=80&w=1974&auto=format&fit=crop')] bg-cover bg-center grayscale hover:grayscale-0 transition-all duration-1000 cursor-crosshair" />
          </div>
          <div className="space-y-8">
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-[0.9]">
              Every Naira <br /> <span className="text-zinc-600">Verified by</span> <br /> <span className="text-teal-500">Aerial Intel.</span>
            </h2>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Our drone verification layer is triggered per milestone. Before a single naira is released from escrow,
              aerial footage of the site is captured, geo-tagged, timestamped and hashed into the permanent ledger.
            </p>
            <div className="space-y-6">
              <div className="flex gap-5">
                <Camera className="text-teal-500 flex-shrink-0 mt-1" size={28} />
                <div>
                  <h4 className="font-black uppercase tracking-widest text-sm mb-2">Automated Drone Audits</h4>
                  <p className="text-zinc-500 text-xs leading-relaxed uppercase tracking-wide">Drone partners are triggered via API to perform autonomous 4K site scans before any escrow disbursement.</p>
                </div>
              </div>
              <div className="flex gap-5">
                <Database className="text-teal-500 flex-shrink-0 mt-1" size={28} />
                <div>
                  <h4 className="font-black uppercase tracking-widest text-sm mb-2">Immutable Hash Chain</h4>
                  <p className="text-zinc-500 text-xs leading-relaxed uppercase tracking-wide">Site data is SHA-256 hashed and locked into the project ledger — an audit trail that cannot be deleted.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* ── DIASPORA ─────────────────────────────────────────────────────────── */}
      <section id="diaspora" className="border-y border-zinc-900 bg-zinc-900/10 py-24">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-14 items-center">
          <div className="space-y-6">
            <Tag color="emerald"><Globe size={9} /> Diaspora First</Tag>
            <h2 className="text-4xl font-black uppercase tracking-tighter italic leading-tight">
              Send GBP from London.<br />
              Track NGN in Lagos.<br />
              <span className="text-teal-500">Earn in both.</span>
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Our live currency oracle updates NGN, GHS, KES, EUR and GBP rates hourly. Your portfolio value
              is displayed in your chosen currency in real-time. A Diaspora investor in Manchester sees their
              portfolio ticking up in GBP, not just Naira — and can download their certificate denominated
              in their home currency.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { currency: '🇬🇧 GBP', rate: '~0.00059', label: 'Per ₦1' },
                { currency: '🇺🇸 USD', rate: '~0.00073', label: 'Per ₦1' },
                { currency: '🇦🇪 AED', rate: '~0.0027',  label: 'Per ₦1' },
                { currency: '🇳🇬 NGN', rate: '1.00',     label: 'Base' },
              ].map(r => (
                <div key={r.currency} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/20">
                  <p className="text-sm font-bold">{r.currency}</p>
                  <p className="font-mono text-teal-400 font-black text-lg mt-1">{r.rate}</p>
                  <p className="text-[8px] text-zinc-600 uppercase font-bold mt-1">{r.label}</p>
                </div>
              ))}
            </div>
            <p className="text-zinc-700 text-[8px] font-mono uppercase tracking-widest">
              Live rates · Updated hourly · Indicative only
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-6 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-4">
              <p className="text-[9px] text-teal-500 uppercase font-bold tracking-widest">Diaspora Investor Flow</p>
              {[
                ['Sends from London',         '£500 GBP'],
                ['Converted at oracle rate',  '₦850,000 NGN'],
                ['Held in Paystack escrow',   '✓ Secured'],
                ['12% annual yield',          '+₦102,000/yr est.'],
                ['Portfolio shown in',        'GBP + NGN'],
              ].map(([label, value], i) => (
                <div key={i} className={`flex justify-between ${i < 4 ? 'border-b border-zinc-800 pb-3' : ''}`}>
                  <span className="text-zinc-400 text-sm">{label}</span>
                  <span className={`font-mono font-bold text-sm ${i === 2 ? 'text-teal-400' : i === 3 ? 'text-emerald-400' : 'text-white'}`}>{value}</span>
                </div>
              ))}
            </div>
            <p className="text-zinc-600 text-[9px] text-center font-mono uppercase tracking-widest">
              Example only · Rates vary · Not financial advice
            </p>

            {/* Crowdfund note */}
            <div className="p-5 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-2">
              <p className="text-[9px] text-purple-400 font-bold uppercase tracking-widest">Community / Crowdfund Mode</p>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Hometown associations, co-operatives, and family groups can pool smaller amounts across many
                investors into a single project. Each contributor gets their own ledger entry and certificate.
                Min. investment from ₦5,000.
              </p>
              <Link href="/register?role=INVESTOR"
                className="inline-flex items-center gap-1 text-[9px] text-purple-400 font-bold uppercase tracking-widest hover:text-white transition-colors">
                Start a community fund <ArrowRight size={9} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── PLATFORM CAPABILITIES SUMMARY ────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-24 space-y-12">
        <div className="text-center space-y-4">
          <Tag color="teal">Platform Capabilities</Tag>
          <h2 className="text-4xl font-black uppercase tracking-tighter italic">
            What Nested Ark Can Do <span className="text-teal-500">Right Now</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: ShieldCheck, color: 'text-teal-500', title: 'Multi-role Auth',          desc: '8 operator roles — Developer, Investor, Contractor, Verifier, Supplier, Bank, Government, Admin. Each routes to a purpose-built command center.' },
            { icon: Lock,        color: 'text-emerald-500', title: 'Paystack Escrow Engine', desc: 'Full payment gateway integration. Initialize charges, webhook verification, multi-split for platform fees, and automated escrow release.' },
            { icon: BarChart3,   color: 'text-amber-500', title: 'Live Portfolio + ROI',    desc: 'Investor portfolio value ticks up per second using time-weighted yield. Real-time earnings accrual. Withdrawal flow for KYC-verified users.' },
            { icon: Cpu,         color: 'text-blue-500',  title: 'Tri-Layer Verification', desc: 'AI evidence analysis, human auditor approval, and drone footage verification — all three required for escrow release. Independently audit-able.' },
            { icon: Globe,       color: 'text-purple-500',title: 'Currency Oracle',         desc: 'Hourly NGN, GHS, KES, EUR, GBP rate updates. Portfolio values switch instantly. Diaspora-first design.' },
            { icon: FileText,    color: 'text-teal-500',  title: 'NAP Project IDs',         desc: 'Every project gets NAP-YYYY-NNNNN. Globally searchable, publicly trackable. Supports all project types and owner types.' },
            { icon: Database,    color: 'text-emerald-500',title: 'Immutable Ledger',        desc: 'SHA-256 hash chain on every transaction, investment, verification and payout. Cannot be altered or deleted. Public audit trail.' },
            { icon: TrendingUp,  color: 'text-amber-500', title: 'Revenue Engine',          desc: 'Platform earns via escrow fees (2%), listing fees ($49), investment placement (0.5%), supply commissions (3%). All tracked in real-time.' },
            { icon: MapPin,      color: 'text-blue-500',  title: 'Geo + Map Layer',         desc: 'Projects geo-tagged with site coordinates. Infrastructure map view for investors and government overseers.' },
          ].map(cap => {
            const Icon = cap.icon;
            return (
              <div key={cap.title} className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3 hover:border-zinc-700 transition-all">
                <Icon size={20} className={cap.color} />
                <h3 className="text-sm font-black uppercase tracking-tight">{cap.title}</h3>
                <p className="text-zinc-500 text-xs leading-relaxed">{cap.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="p-12 md:p-16 rounded-3xl border border-teal-500/10 bg-gradient-to-br from-teal-500/5 via-transparent to-transparent text-center space-y-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#14b8a610_0%,transparent_70%)] pointer-events-none" />
          <div className="relative space-y-6">
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic">
              Ready to Build Africa?<br />
              <span className="text-teal-500">The Ledger is Waiting.</span>
            </h2>
            <p className="text-zinc-400 text-sm max-w-xl mx-auto leading-relaxed">
              Whether you have capital to invest, land to build on, a community project to fund, skills to offer,
              or a mandate to govern — Nested Ark has a command center for you.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              {[
                { href: '/register?role=INVESTOR',   label: '💰 Invest Capital',     primary: true },
                { href: '/register?role=DEVELOPER',  label: '🏠 Post a Project',     primary: false },
                { href: '/register?role=CONTRACTOR', label: '🏗 Find Work',           primary: false },
                { href: '/register?role=GOVERNMENT', label: '🏛 Government Portal',  primary: false },
                { href: '/projects',                 label: '📋 Browse Marketplace', primary: false },
              ].map(b => (
                <Link key={b.href} href={b.href}
                  className={`flex items-center gap-2 px-7 py-3.5 font-black uppercase text-xs tracking-[0.15em] rounded-xl transition-all ${
                    b.primary ? 'bg-teal-500 text-black hover:bg-white' : 'border border-zinc-700 text-zinc-300 hover:border-teal-500/50 hover:text-white'
                  }`}>
                  {b.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-900 py-14 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-5 gap-8 mb-10">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-teal-500 rounded-sm rotate-45" />
              <p className="text-sm font-black uppercase tracking-widest">Nested Ark OS</p>
            </div>
            <p className="text-zinc-600 text-xs leading-relaxed max-w-xs">
              The escrow and transparency platform for African infrastructure investment.
              We are the platform provider — not the contractor. All projects are submitted by independent owners.
            </p>
            <p className="text-[9px] text-zinc-700 font-mono">Impressions &amp; Impacts Ltd · nestedark@gmail.com</p>
          </div>
          <div className="space-y-3">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Platform</p>
            {[['My Portfolio','/portfolio'],['Investment Nodes','/investments'],['Milestone Tracker','/milestones'],['Global Ledger','/ledger'],['Infrastructure Map','/map'],['About Us','/about']].map(([l,h]) => (
              <Link key={h} href={h} className="block text-xs text-zinc-600 hover:text-teal-500 transition-colors">{l}</Link>
            ))}
          </div>
          <div className="space-y-3">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Register</p>
            {[['Investor','/register?role=INVESTOR'],['Developer / Owner','/register?role=DEVELOPER'],['Contractor','/register?role=CONTRACTOR'],['Supplier','/register?role=SUPPLIER'],['Bank / Institution','/register?role=BANK'],['Government','/register?role=GOVERNMENT']].map(([l,h]) => (
              <Link key={h} href={h} className="block text-xs text-zinc-600 hover:text-teal-500 transition-colors">{l}</Link>
            ))}
          </div>
          <div className="space-y-3">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Legal &amp; Trust</p>
            <div className="space-y-2.5 text-[10px] text-zinc-700 font-mono">
              <div className="flex items-center gap-2"><ShieldCheck size={10} className="text-teal-500/50" /> Tri-Layer Verification</div>
              <div className="flex items-center gap-2"><Lock size={10} className="text-teal-500/50" /> Paystack Escrow</div>
              <div className="flex items-center gap-2"><Database size={10} className="text-teal-500/50" /> SHA-256 Hash Chain</div>
              <div className="flex items-center gap-2"><Scale size={10} className="text-amber-500/50" /> Platform — not contractor</div>
            </div>
            <div className="mt-4 space-y-2">
              {[['KYC Verification','/kyc'],['Terms of Service','/terms'],['Privacy Policy','/privacy']].map(([l,h]) => (
                <Link key={h} href={h} className="block text-xs text-zinc-600 hover:text-white transition-colors">{l}</Link>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-zinc-900 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-[8px] text-zinc-700 font-mono">
          <p>© 2026 Impressions &amp; Impacts Ltd · Nested Ark OS. All Rights Reserved.</p>
          <p>Lagos · London · Dubai · Secured by Bulletproof Hash Chain v4.0</p>
        </div>
      </footer>
    </div>
  );
}
