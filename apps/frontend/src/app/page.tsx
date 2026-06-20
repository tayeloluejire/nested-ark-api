'use client';
export const dynamic = 'force-dynamic';

/**
 * /app/page.tsx — Nested Ark OS Home
 * Mobile-first tabbed redesign. All existing Link hrefs preserved exactly.
 * Uses Next.js Link + usePathname only. No react-router.
 * Sections: Hero → Stats → Search → Role Tabs → Feature Cards →
 *           ROI Calc (investor) → Trust → Escrow (collapsible) →
 *           Compliance (collapsible) → Who Uses → Bottom CTA
 */

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  TrendingUp, Building2, ShieldCheck, Globe, ArrowRight,
  Search, Home, Users, Lock, CheckCircle2,
  FileText, Bell, Wallet,
  RefreshCw, HardHat, Landmark, Layers, Gavel, Receipt,
  ChevronDown, Radio, Zap, BarChart3, Shield, PiggyBank,
} from 'lucide-react';

// ── Numeric helpers ───────────────────────────────────────────────────────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string  => safeN(v).toLocaleString();
const safeD = (v: any, d = 2): string => safeN(v).toFixed(d);
// fmtNum is now provided by useCurrency() hook as { fmt: fmtNum }

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
}

type RoleTab = 'landlord' | 'investor' | 'developer' | 'diaspora' | 'tenant';

// ── Geo-aware currency config ─────────────────────────────────────────────────
const GEO_CURRENCY: Record<string, { symbol: string; code: string; locale: string }> = {
  NG: { symbol: '₦',   code: 'NGN', locale: 'en-NG' },
  GB: { symbol: '£',   code: 'GBP', locale: 'en-GB' },
  US: { symbol: '$',   code: 'USD', locale: 'en-US' },
  CA: { symbol: 'CA$', code: 'CAD', locale: 'en-CA' },
  AU: { symbol: 'A$',  code: 'AUD', locale: 'en-AU' },
  AE: { symbol: 'AED', code: 'AED', locale: 'ar-AE' },
  GH: { symbol: 'GH₵', code: 'GHS', locale: 'en-GH' },
  KE: { symbol: 'KSh', code: 'KES', locale: 'sw-KE' },
  DE: { symbol: '€',   code: 'EUR', locale: 'de-DE' },
  FR: { symbol: '€',   code: 'EUR', locale: 'fr-FR' },
  SG: { symbol: 'S$',  code: 'SGD', locale: 'en-SG' },
  IN: { symbol: '₹',   code: 'INR', locale: 'en-IN' },
  JP: { symbol: '¥',   code: 'JPY', locale: 'ja-JP' },
};
const DEFAULT_CURRENCY = { symbol: '$', code: 'USD', locale: 'en-US' };

function useCurrency() {
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [country,  setCountry]  = useState('');

  useEffect(() => {
    const locale = (typeof navigator !== 'undefined' ? navigator.language : 'en-US') || 'en-US';
    const region = locale.split('-')[1]?.toUpperCase() || '';
    if (region && GEO_CURRENCY[region]) {
      setCurrency(GEO_CURRENCY[region]);
      setCountry(region);
    }
    fetch('https://ipapi.co/json/', { cache: 'force-cache' })
      .then(r => r.json())
      .then(data => {
        const cc = data.country_code?.toUpperCase();
        if (cc && GEO_CURRENCY[cc]) { setCurrency(GEO_CURRENCY[cc]); setCountry(cc); }
      })
      .catch(() => {});
  }, []);

  const fmt = (raw: any): string => {
    const n = safeN(raw);
    const sym = currency.symbol;
    if (n >= 1_000_000_000) return `${sym}${safeD(n / 1_000_000_000, 1)}B`;
    if (n >= 1_000_000)     return `${sym}${safeD(n / 1_000_000, 1)}M`;
    if (n >= 1_000)         return `${sym}${safeD(n / 1_000, 0)}K`;
    return `${sym}${n.toFixed(0)}`;
  };

  return { currency, country, fmt };
}

// ── JSON-LD Schema markup ────────────────────────────────────────────────────
const SCHEMA_ORGANIZATION = {
  '@context': 'https://schema.org', '@type': 'Organization',
  name: 'Nested Ark', url: 'https://nestedark.com',
  logo: 'https://nestedark.com/nested_ark_icon.png',
  description: 'Nested Ark Rent Vault helps tenants save gradually for rent commitments while giving landlords confidence they will be paid on time.',
  foundingDate: '2024', areaServed: ['Nigeria','Ghana','Kenya','United Kingdom'],
  contactPoint: { '@type': 'ContactPoint', email: 'nestedark@gmail.com', contactType: 'customer service' },
  sameAs: ['https://twitter.com/NestedArkOS'],
};
const SCHEMA_FINANCIAL_SERVICE = {
  '@context': 'https://schema.org', '@type': 'FinancialService',
  name: 'Nested Ark Rent Vault',
  description: 'A rent savings and escrow platform helping tenants save gradually toward annual rent while giving landlords payment assurance.',
  url: 'https://nestedark.com',
  areaServed: ['Nigeria','Ghana','Kenya','United Kingdom'],
  currenciesAccepted: 'NGN GHS KES GBP USD',
  offers: { '@type': 'Offer', name: 'Rent Vault', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
};
const SCHEMA_FAQ = {
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'What is Nested Ark Rent Vault?',
      acceptedAnswer: { '@type': 'Answer', text: 'Nested Ark Rent Vault is a savings and escrow platform that helps tenants save gradually toward their annual rent target. Contributions accumulate until the full rent amount is reached, then released to the landlord.' } },
    { '@type': 'Question', name: 'How do I save for rent using Nested Ark?',
      acceptedAnswer: { '@type': 'Answer', text: 'Register as a tenant, set your rent target amount, choose your contribution frequency — daily, weekly or monthly — and your contributions accumulate in a secure vault until your target is reached.' } },
    { '@type': 'Question', name: 'Is Nested Ark available in Nigeria?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes. Nested Ark fully supports Nigerian Naira (NGN) and is designed for the Nigerian rental market where annual rent payments are standard. Tenants save in installments toward their annual rent target.' } },
    { '@type': 'Question', name: 'How does Nested Ark help landlords?',
      acceptedAnswer: { '@type': 'Answer', text: 'Landlords get full visibility of tenant savings progress, automated payment assurance, automated legal notices, and receive funds directly when the vault target is reached.' } },
    { '@type': 'Question', name: 'Is my money safe with Nested Ark?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes. All contributions are held in Paystack escrow. Every transaction is SHA-256 hashed and recorded on an immutable ledger. Funds are only released when the verified rent target is met.' } },
  ],
};

// ── Geo-aware hero messaging ──────────────────────────────────────────────────
const GEO_HERO: Record<string, { h1: string; sub: string; cta: string; example: string }> = {
  NG: {
    h1:      "Never Struggle to Raise One Year's Rent Again",
    sub:     "Save daily, weekly or monthly toward your annual rent. Track your progress. Pay your landlord on time — without borrowing.",
    cta:     "Start Your Rent Vault — It's Free",
    example: "Join tenants already preparing for rent the smarter way.",
  },
  GH: {
    h1:      "Plan Ahead for Your Annual Rent With Confidence",
    sub:     "Save gradually toward your rent target. No last-minute stress. No borrowing. Just consistent progress.",
    cta:     "Open Your Rent Vault Free",
    example: "Helping tenants across Accra, Kumasi and Ghana plan for rent.",
  },
  KE: {
    h1:      "Build Your Rent Target Gradually and Pay On Time",
    sub:     "Save toward your rent commitments daily or monthly. Track every shilling. Pay confidently when due.",
    cta:     "Create Your Rent Vault Today",
    example: "Helping tenants across Nairobi and Kenya meet rent commitments.",
  },
  GB: {
    h1:      "Smart Rent Planning for Modern Tenants",
    sub:     "Set a rent savings goal, contribute regularly, and never miss a payment. Your landlord gets confidence. You get peace of mind.",
    cta:     "Start Your Rent Savings Plan",
    example: "Helping tenants across the UK plan and meet rent commitments.",
  },
  DEFAULT: {
    h1:      "Save for Rent. Pay with Confidence.",
    sub:     "Nested Ark Rent Vault helps tenants save gradually toward rent commitments while giving landlords confidence they'll be paid on time.",
    cta:     "Start Your Rent Vault Free",
    example: "Trusted by tenants and landlords across Nigeria, Ghana, Kenya and the UK.",
  },
};

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ target, prefix = '', suffix = '' }: { target: number; prefix?: string; suffix?: string }) {
  const [val, setVal] = useState(0);
  const start = useRef<number | null>(null);
  useEffect(() => {
    if (!target) return;
    start.current = null;
    const go = (ts: number) => {
      if (!start.current) start.current = ts;
      const p = Math.min((ts - start.current) / 1600, 1);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 4))));
      if (p < 1) requestAnimationFrame(go);
    };
    requestAnimationFrame(go);
  }, [target]);
  return <>{prefix}{val.toLocaleString()}{suffix}</>;
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Skel() { return <div className="skeleton h-7 w-3/4 rounded-lg" />; }

// ── Role config ───────────────────────────────────────────────────────────────
const ROLES: { id: RoleTab; emoji: string; label: string; color: 'teal' | 'amber' | 'blue' | 'rose' | 'green' }[] = [
  { id: 'landlord',  emoji: '🏠', label: 'Landlord',  color: 'teal'  },
  { id: 'investor',  emoji: '💼', label: 'Investor',  color: 'amber' },
  { id: 'developer', emoji: '🏗️', label: 'Dev',       color: 'blue'  },
  { id: 'diaspora',  emoji: '🌍', label: 'Diaspora',  color: 'rose'  },
  { id: 'tenant',    emoji: '🏠', label: 'Tenant',    color: 'green' },
];

const CC = {
  teal:  { bar:'from-teal-500 to-teal-400',   bd:'border-teal-500/25',  tx:'text-teal-400',  btn:'bg-teal-500 hover:bg-teal-400 text-black',  sh:'shadow-teal-500/15',  act:'bg-teal-500 text-black',  tag:'bg-teal-500/8 text-teal-400 border-teal-500/20'  },
  amber: { bar:'from-amber-500 to-amber-400',  bd:'border-amber-500/25', tx:'text-amber-400', btn:'bg-amber-500 hover:bg-amber-400 text-black', sh:'shadow-amber-500/15', act:'bg-amber-500 text-black', tag:'bg-amber-500/8 text-amber-400 border-amber-500/20' },
  blue:  { bar:'from-blue-500 to-blue-400',    bd:'border-blue-500/25',  tx:'text-blue-400',  btn:'bg-blue-500 hover:bg-blue-400 text-black',  sh:'shadow-blue-500/15',  act:'bg-blue-500 text-black',  tag:'bg-blue-500/8 text-blue-400 border-blue-500/20'  },
  rose:  { bar:'from-rose-500 to-rose-400',    bd:'border-rose-500/25',  tx:'text-rose-400',  btn:'bg-rose-500 hover:bg-rose-400 text-white',  sh:'shadow-rose-500/15',  act:'bg-rose-500 text-white',  tag:'bg-rose-500/8 text-rose-400 border-rose-500/20'  },
  green: { bar:'from-green-500 to-green-400',  bd:'border-green-500/25', tx:'text-green-400', btn:'bg-green-500 hover:bg-green-400 text-black', sh:'shadow-green-500/15', act:'bg-green-500 text-black', tag:'bg-green-500/8 text-green-400 border-green-500/20' },
};

// ── Role content ──────────────────────────────────────────────────────────────
const RD: Record<RoleTab, {
  headline: string; sub: string; points: string[];
  steps: { n: string; t: string; b: string }[];
  cta: string; ctaLabel: string; sec: string; secLabel: string;
  cards: { icon: any; title: string; tags: string[] }[];
}> = {
  landlord: {
    headline: 'Automate Your Rental Income',
    sub: 'WhatsApp invite → vault → cashout. Fully automated.',
    points: [
      'Tenants pay weekly/monthly — you receive lump sum or monthly drawdown',
      'Auto legal notices: 30-day → 7-day → 48h overdue PDF via email',
      'WhatsApp onboarding — tenant self-registers in 60 seconds',
      'Flex-Pay Vault bridges the upfront rent gap automatically',
    ],
    steps: [
      { n:'01', t:'List your property',    b:'Add any unit and get a shareable tenant invite link instantly.'    },
      { n:'02', t:'Invite via WhatsApp',   b:'One tap. Tenant sets up their payment rhythm in 60 seconds.'      },
      { n:'03', t:'Ark automates the rest', b:'Vault, reminders, notices, and cashout on autopilot.'             },
    ],
    cta:'/register?role=landlord', ctaLabel:'List My Property',
    sec:'/explore',                secLabel:'See how it works',
    cards: [
      { icon: Users,       title:'Digital Onboarding',     tags:['WhatsApp Invite','KYC Verified','60-Second Setup'] },
      { icon: Gavel,       title:'Legal Notice Generator', tags:['Notice to Quit','SHA-256 Signed','PDF Email']      },
      { icon: Receipt,     title:'Smart Receipting',       tags:['Auto PDF','Ledger-Backed','Email Delivery']        },
      { icon: Wallet,      title:'Flex-Pay Vault',         tags:['Weekly/Monthly','Annual Lumpsum','2% Fee']         },
      { icon: Bell,        title:'Reminder Engine',        tags:['30-Day Courtesy','7-Day Urgent','48h Legal']       },
      { icon: ShieldCheck, title:'Ejection Proceedings',   tags:['Court-Admissible','Evidence Trail','PDF Export']   },
    ],
  },
  investor: {
    headline: 'Build Wealth Through Escrow-Protected Infrastructure',
    sub: 'Market-linked infrastructure returns. Capital held in programmable escrow until milestone verification.',
    points: [
      'Real infrastructure participation — not speculative yield products',
      'Capital locked in programmable escrow, released only on verified milestones',
      'Benchmark-linked returns indexed to prevailing macroeconomic reference rates',
      'Real-time ROI dashboards with SHA-256 immutable ledger receipts',
      'Fractional participation from anywhere — NGN, USD, GBP, EUR, AED',
      'Diaspora-ready: fund infrastructure remotely and track every stage live',
    ],
    steps: [
      { n:'01', t:'Browse Verified Infrastructure', b:'Filter by projected yield range, country, infrastructure type, or verified milestone status.' },
      { n:'02', t:'Commit Capital to Escrow',        b:'Funds secured in programmable escrow infrastructure and tracked with immutable cryptographic receipts.' },
      { n:'03', t:'Earn Dynamic Infrastructure Returns', b:'Distributions benchmarked against prevailing market rates, adjusted using project-specific infrastructure premiums.' },
    ],
    cta:'/register?role=investor', ctaLabel:'Access Infrastructure Exchange',
    sec:'/investments',            secLabel:'View live projects',
    cards: [
      { icon: TrendingUp,  title:'Market-Linked Yields',   tags:['Benchmark-Referenced','Infrastructure Premium','Dynamic Pricing']  },
      { icon: Lock,        title:'Escrow-Protected Capital', tags:['Programmable Escrow','Milestone-Gated','No Premature Release']   },
      { icon: ShieldCheck, title:'Tri-Layer Verification',  tags:['AI Analysis','Human Audit','Drone Evidence']                      },
      { icon: FileText,    title:'SHA-256 Receipts',        tags:['Tamper-Proof','Court-Admissible','Immutable Ledger']               },
      { icon: Globe,       title:'Multi-Currency Rails',    tags:['NGN','USD','GBP','EUR','AED']                                     },
      { icon: BarChart3,   title:'Real-Time Dashboards',    tags:['Live ROI','Milestone Tracker','Portfolio Analytics']              },
    ],
  },
  developer: {
    headline: 'Fund & Build Any Project',
    sub: 'Submit with any country permit. Get a NAP ID. Raise capital.',
    points: [
      'Submit with any country regulatory permit reference',
      'Receive NAP-YYYY-NNNNN project ID instantly on submission',
      '70/30 milestone escrow — mobilize without cash flow gaps',
      'Full BOQ, competitive bid management, drone verification',
    ],
    steps: [
      { n:'01', t:'Submit your project node',  b:'Upload permit ref and blueprints. Receive NAP ID instantly.'  },
      { n:'02', t:'Set milestones & open bids', b:'Contractors submit bids. You select who builds each stage.'   },
      { n:'03', t:'Get funded & verified',      b:'Investors fund escrow. Drone + AI + human verify each stage.' },
    ],
    cta:'/projects/submit', ctaLabel:'Submit a Project',
    sec:'/projects',        secLabel:'Browse active nodes',
    cards: [
      { icon: Building2,   title:'NAP Project ID',     tags:['Instant Issuance','Global Registry','Ledger-Stamped'] },
      { icon: Layers,      title:'70/30 Escrow',       tags:['Mobilization','Milestone Release','Automatic']        },
      { icon: HardHat,     title:'Contractor Bids',    tags:['Competitive','Verified','BOQ Managed']                },
      { icon: ShieldCheck, title:'Drone Verification', tags:['AI Review','Human Audit','Photo Evidence']            },
    ],
  },
  diaspora: {
    headline: 'Build Your Vision Remotely',
    sub: 'Fund family construction from anywhere. Track every stage live.',
    points: [
      'Private residential: family homes, estates, diaspora builds',
      'Track construction milestones from anywhere in the world',
      'AI + human + drone verification on every build stage',
      'Connect to vetted local contractors, suppliers & verifiers',
    ],
    steps: [
      { n:'01', t:'Register your build',   b:'Submit your family home or private build with local permit ref.'  },
      { n:'02', t:'Fund & track remotely', b:'Fund escrow from abroad. Track every milestone from your phone.'  },
      { n:'03', t:'Verified delivery',     b:'AI, human auditors, and drone footage confirm every stage.'       },
    ],
    cta:'/register?role=developer', ctaLabel:'Start Building',
    sec:'/explore',                  secLabel:'Explore projects',
    cards: [
      { icon: Globe,       title:'Remote Tracking',    tags:['Real-Time','Mobile-First','Photo Updates']      },
      { icon: ShieldCheck, title:'Verified Stages',    tags:['AI Review','Drone Evidence','Human Audit']      },
      { icon: HardHat,     title:'Vetted Contractors', tags:['Background-Checked','Bonded','Milestone-Paid']  },
      { icon: Landmark,    title:'Local Compliance',   tags:['Any Country','Permit-Ready','Court-Grade']      },
    ],
  },
  tenant: {
    headline: 'Save Toward Your Next Home',
    sub: 'Set a target. Pay your rhythm. Ark auto-credits your landlord.',
    points: [
      'Browse verified vacant units and save toward any property',
      'Weekly or monthly installments — no annual lump-sum pressure',
      'Vault auto-disburses to landlord when your target is 100% reached',
      'Build a portable tenant score and payment history on every payment',
    ],
    steps: [
      { n:'01', t:'Browse & choose a home',   b:'Search verified listings. Pick your unit and set your savings target.'   },
      { n:'02', t:'Set your payment rhythm',  b:'Choose weekly or monthly. Ark holds every installment in escrow.'        },
      { n:'03', t:'Vault completes. You move in.', b:'Target hit → landlord auto-credited → ledger receipt issued to you.' },
    ],
    cta:'/register?intent=tenant', ctaLabel:'Create Tenant Account',
    sec:'/marketplace',            secLabel:'Browse properties',
    cards: [
      { icon: Wallet,      title:'Flex-Pay Vault',      tags:['Weekly/Monthly','Escrow-Held','Auto-Disburse']      },
      { icon: ShieldCheck, title:'Paystack Escrow',      tags:['Regulated','Tamper-Proof','T+1 Settled']           },
      { icon: Receipt,     title:'SHA-256 Receipts',     tags:['Per Payment','Ledger-Backed','PDF Export']         },
      { icon: TrendingUp,  title:'Tenant Score',         tags:['Portable','Landlord-Visible','Trust-Building']     },
    ],
  },
};

// ═════════════════════════════════════════════════════════════════════════════
export default function HomePage() {
  const { currency, country, fmt: fmtNum } = useCurrency();
  const [geoHero, setGeoHero] = useState(GEO_HERO.DEFAULT);

  useEffect(() => {
    if (country && GEO_HERO[country]) setGeoHero(GEO_HERO[country]);
  }, [country]);

  // Public platform stats — live social proof (no auth required)
  const [platformStats, setPlatformStats] = useState<{users:number;vaults:number;tenants:number} | null>(null);
  const [heroSlide,     setHeroSlide]     = useState(0); // 0 = tenant, 1 = landlord
  const [heroVisible,   setHeroVisible]   = useState(true);
  const [heroPaused,    setHeroPaused]    = useState(false);

  // Alternate between tenant and landlord hero every 5 seconds
  useEffect(() => {
    if (heroPaused) return; // user is interacting — don't auto-advance
    const t = setInterval(() => {
      setHeroVisible(false);
      setTimeout(() => {
        setHeroSlide(s => (s + 1) % 4);
        setHeroVisible(true);
      }, 300); // fade out 300ms, then swap content and fade back in
    }, 5000);
    return () => clearInterval(t);
  }, [heroPaused]);
  useEffect(() => {
    fetch('/api/public/stats')
      .then(r => r.json())
      .then(d => { if (d.users) setPlatformStats(d); })
      .catch(() => {}); // silent fail — stats are optional social proof
  }, []);

  const [stats, setStats]                 = useState<Stats | null>(null);
  const [searchInput, setSearchInput]     = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching]         = useState(false);
  const [searchOpen, setSearchOpen]       = useState(false);
  const [activeRole, setActiveRole]       = useState<RoleTab>('landlord');
  const [roiSlider, setRoiSlider]         = useState(500_000);
  const [tickerIdx, setTickerIdx]         = useState(0);
  const [showEscrow, setShowEscrow]       = useState(false);
  const [showCompliance, setShowCompliance] = useState(false);

  useEffect(() => {
    api.get('/api/marketplace/stats').then(r => setStats(r.data?.stats || null)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!searchInput.trim() || searchInput.length < 2) {
      setSearchResults([]); setSearchOpen(false); return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get('/api/projects/search', { params: { q: searchInput.trim() } });
        setSearchResults((res.data?.results ?? []).slice(0, 5));
        setSearchOpen(true);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 380);
    return () => clearTimeout(t);
  }, [searchInput]);

  const TICKER = [
    { label: 'LEDGER', val: 'SHA-256 SECURED' },
    { label: 'POOL',   val: stats ? fmtNum(stats.total_committed_usd) : '…' },
    { label: 'ESCROW', val: 'T+1 SETTLED'      },
    { label: 'NODES',  val: stats ? `${safeN(stats.countries_active)} REGIONS` : '…' },
  ];
  useEffect(() => {
    const t = setInterval(() => setTickerIdx(i => (i + 1) % TICKER.length), 3200);
    return () => clearInterval(t);
  }, [TICKER.length]);

  const roiMonthly = Math.round((roiSlider * 0.12) / 12);
  const roiYearly  = Math.round(roiSlider * 0.12);

  const roleTab = ROLES.find(r => r.id === activeRole)!;
  const cc      = CC[roleTab.color];
  const role    = RD[activeRole];

  return (
    <>
      {/* ── JSON-LD Schema Markup — Organization + FinancialService + FAQ ── */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA_ORGANIZATION) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA_FINANCIAL_SERVICE) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA_FAQ) }} />

    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden selection:bg-teal-500 selection:text-black">
      <Navbar />

      {/* ── CALCULATOR CTA ─────────────────────────────────────────── */}
      <section className="px-4 py-3">
        <Link href="/rent-vault/calculator"
          className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-teal-500/30 hover:bg-teal-500/5 transition-all group">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={15} className="text-teal-400" />
            </div>
            <div>
              <p className="text-xs font-black">Not sure how much to save?</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Calculate your rent plan in seconds — free tool</p>
            </div>
          </div>
          <ArrowRight size={14} className="text-teal-400 group-hover:translate-x-1 transition-transform flex-shrink-0" />
        </Link>
      </section>

      {/* LIVE TICKER */}
      <div className="w-full bg-zinc-950 border-b border-zinc-900 px-4 py-2 flex items-center justify-between text-[10px] font-mono">
        <span className="flex items-center gap-1.5 text-teal-500 font-black">
          <Radio size={9} className="animate-pulse" /> LIVE
        </span>
        <span className="flex items-center gap-2 transition-all">
          <span className="text-zinc-600 uppercase tracking-widest">{TICKER[tickerIdx].label}:</span>
          <span className="text-white font-bold">{TICKER[tickerIdx].val}</span>
        </span>
        <Link href="/explore" className="text-zinc-600 hover:text-teal-400 transition-colors uppercase tracking-widest text-[9px]">
          Explore →
        </Link>
      </div>

      <main className="max-w-2xl mx-auto space-y-5 pb-6">

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section className="px-4 pt-6 space-y-4">

          {/* What is Nested Ark — category definition for Google + humans */}
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse block" />
            <span className="text-[9px] font-black uppercase tracking-[0.28em] text-teal-400">
              Rent Vault Platform · Nigeria · Ghana · Kenya · UK
            </span>
          </div>

          {/* H1 in DOM for SEO — Slide 1 content is the primary keyword target */}
          <h1 className="sr-only">{geoHero.h1}</h1>

          {/* ── Human hero image — real people, warm tone ──────────────
              Addresses reviewer feedback: homepage felt "too serious and
              verbose." A real photo breaks the wall of text/icons and
              matches the warmth already established in social campaigns. */}
          <div className="relative rounded-3xl overflow-hidden border border-zinc-800 -mx-1">
            <img
              src="/hero-tenant-couple.jpg"
              alt="A couple reviewing their Nested Ark Rent Vault together at home"
              className="w-full h-[200px] sm:h-[260px] object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-white font-black text-lg leading-tight tracking-tight">
                Rent Today. <span className="text-teal-400">Ready Tomorrow.</span>
              </p>
              <p className="text-zinc-300 text-[11px] mt-1">Save gradually. Pay confidently.</p>
            </div>
          </div>

          {/* ── 4-slide rotating hero ──────────────────────────────── */}
          <div
            onMouseEnter={() => setHeroPaused(true)}
            onMouseLeave={() => setHeroPaused(false)}
            onTouchStart={() => setHeroPaused(true)}
            onTouchEnd={() => setTimeout(() => setHeroPaused(false), 3000)}
          >
            {/* Slide indicator dots + audience badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest border transition-all ${
                heroSlide === 0 ? 'bg-teal-500/15 border-teal-500/20 text-teal-400'
              : heroSlide === 1 ? 'bg-amber-500/15 border-amber-500/20 text-amber-400'
              : heroSlide === 2 ? 'bg-purple-500/15 border-purple-500/20 text-purple-400'
              :                   'bg-blue-500/15 border-blue-500/20 text-blue-400'
              }`}>
                {heroSlide === 0 ? '🏠 For Tenants'
               : heroSlide === 1 ? '🏢 For Landlords'
               : heroSlide === 2 ? '🤝 For Everyone'
               :                   '🌍 For Diaspora'}
              </span>
              <div className="flex gap-1 ml-auto">
                {[0,1,2,3].map(i => (
                  <button key={i} onClick={() => { setHeroPaused(true); setHeroVisible(false); setTimeout(() => { setHeroSlide(i); setHeroVisible(true); }, 350); }}
                    className={`rounded-full transition-all ${
                      i === heroSlide ? 'w-4 h-1.5 bg-teal-500' : 'w-1.5 h-1.5 bg-zinc-700 hover:bg-zinc-500'
                    }`} aria-label={`Slide ${i+1}`} />
                ))}
              </div>
            </div>

            {/* Slide content with fade + lift transition */}
            <div style={{
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 0.35s ease, transform 0.35s ease',
              minHeight: '220px',
            }}>

              {/* ── Slide 1: TENANT ───────────────────────────────── */}
              {heroSlide === 0 && (
                <div className="space-y-3">
                  <p className="text-[clamp(1.7rem,7vw,3.2rem)] font-black tracking-tighter leading-[0.9]">
                    {geoHero.h1}
                  </p>
                  <p className="text-zinc-400 text-sm leading-relaxed max-w-sm">
                    {geoHero.sub}
                  </p>
                  <p className="text-[10px] text-zinc-600 border-l-2 border-teal-500/40 pl-3 leading-relaxed">
                    No borrowing. No panic. No last-minute pressure.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { n:'01', t:'Set your rent target' },
                      { n:'02', t:'Save gradually'        },
                      { n:'03', t:'Track progress'        },
                      { n:'04', t:'Pay confidently'       },
                    ].map(s => (
                      <div key={s.n} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/40">
                        <span className="text-[8px] text-teal-500 font-black font-mono">{s.n}</span>
                        <span className="text-[10px] text-zinc-300 font-semibold">{s.t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Slide 2: LANDLORD ─────────────────────────────── */}
              {heroSlide === 1 && (
                <div className="space-y-3">
                  <p className="text-[clamp(1.7rem,7vw,3.2rem)] font-black tracking-tighter leading-[0.9]">
                    Stop Chasing Rent.<br />
                    <span className="text-amber-400">Start Predicting Cashflow.</span>
                  </p>
                  <p className="text-zinc-400 text-sm leading-relaxed max-w-sm">
                    Invite tenants to their own Rent Vaults. Automated reminders, payment
                    tracking and lump-sum rent collection — built in from day one.
                  </p>
                  <p className="text-[10px] text-zinc-600 border-l-2 border-amber-500/40 pl-3 leading-relaxed">
                    Your tenants save gradually. You get full visibility, automated notices,
                    and payment delivered — without chasing.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { n:'01', t:'Invite via WhatsApp'   },
                      { n:'02', t:'Track tenant savings'  },
                      { n:'03', t:'Auto rent reminders'   },
                      { n:'04', t:'Receive payment'       },
                    ].map(s => (
                      <div key={s.n} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-500/10 bg-amber-500/5">
                        <span className="text-[8px] text-amber-500 font-black font-mono">{s.n}</span>
                        <span className="text-[10px] text-zinc-300 font-semibold">{s.t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Slide 3: ECOSYSTEM ────────────────────────────── */}
              {heroSlide === 2 && (
                <div className="space-y-3">
                  <p className="text-[clamp(1.7rem,7vw,3.2rem)] font-black tracking-tighter leading-[0.9]">
                    Where Tenants Save<br />
                    <span className="text-purple-400">and Landlords Get Paid.</span>
                  </p>
                  <p className="text-zinc-400 text-sm leading-relaxed max-w-sm">
                    A shared ecosystem that helps tenants prepare for annual rent while
                    giving landlords confidence, visibility, and on-time payment.
                  </p>
                  <p className="text-[10px] text-zinc-600 border-l-2 border-purple-500/40 pl-3 leading-relaxed">
                    One platform. Two sides. Every rent transaction secured by Paystack
                    escrow and SHA-256 ledger.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { n:'🏠', t:'Tenant saves daily'    },
                      { n:'🏢', t:'Landlord tracks live'  },
                      { n:'🔒', t:'Escrow holds funds'    },
                      { n:'✅', t:'Payment releases'      },
                    ].map(s => (
                      <div key={s.t} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-purple-500/10 bg-purple-500/5">
                        <span className="text-sm">{s.n}</span>
                        <span className="text-[10px] text-zinc-300 font-semibold">{s.t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Slide 4: DIASPORA ─────────────────────────────── */}
              {heroSlide === 3 && (
                <div className="space-y-3">
                  <p className="text-[clamp(1.7rem,7vw,3.2rem)] font-black tracking-tighter leading-[0.9]">
                    Help Family Pay Rent<br />
                    <span className="text-blue-400">From Anywhere.</span>
                  </p>
                  <p className="text-zinc-400 text-sm leading-relaxed max-w-sm">
                    Fund rent goals securely from the UK, US, Canada, Europe or anywhere
                    in the world. Every contribution tracked. Every naira accounted for.
                  </p>
                  <p className="text-[10px] text-zinc-600 border-l-2 border-blue-500/40 pl-3 leading-relaxed">
                    Support family rent vaults across Nigeria, Ghana and Kenya from
                    wherever you are. SHA-256 verified. Court-admissible receipts.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { n:'01', t:'Fund from abroad'      },
                      { n:'02', t:'Multi-currency'        },
                      { n:'03', t:'Track remotely'        },
                      { n:'04', t:'Family stays housed'   },
                    ].map(s => (
                      <div key={s.n} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-500/10 bg-blue-500/5">
                        <span className="text-[8px] text-blue-400 font-black font-mono">{s.n}</span>
                        <span className="text-[10px] text-zinc-300 font-semibold">{s.t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Primary CTAs — respond to active slide */}
          <div className="grid grid-cols-1 gap-3"
            style={{ opacity: heroVisible ? 1 : 0, transition: 'opacity 0.35s ease' }}>

            {/* Primary CTA — changes per slide */}
            {heroSlide === 0 && (
              <Link href="/register?intent=tenant"
                className="flex items-center justify-center gap-2 py-4 bg-teal-500 text-black rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-teal-400 transition-all active:scale-95 shadow-lg shadow-teal-500/20">
                <PiggyBank size={14} /> {geoHero.cta}
              </Link>
            )}
            {heroSlide === 1 && (
              <Link href="/register?role=landlord"
                className="flex items-center justify-center gap-2 py-4 bg-amber-500 text-black rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-amber-400 transition-all active:scale-95 shadow-lg shadow-amber-500/20">
                <Building2 size={14} /> List My Property — Free
              </Link>
            )}
            {heroSlide === 2 && (
              <Link href="/register"
                className="flex items-center justify-center gap-2 py-4 bg-purple-500 text-black rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-purple-400 transition-all active:scale-95 shadow-lg shadow-purple-500/20">
                <Zap size={14} /> Get Started — Free
              </Link>
            )}
            {heroSlide === 3 && (
              <Link href="/register?role=diaspora"
                className="flex items-center justify-center gap-2 py-4 bg-blue-500 text-black rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-blue-400 transition-all active:scale-95 shadow-lg shadow-blue-500/20">
                <Globe size={14} /> Support a Rent Vault
              </Link>
            )}

            {/* Secondary CTAs — always visible */}
            <div className="grid grid-cols-2 gap-3">
              <Link href={heroSlide === 1 ? '/register?intent=tenant' : '/register?role=landlord'}
                className={`flex items-center justify-center gap-2 py-3 bg-zinc-900 rounded-2xl font-black text-xs uppercase tracking-wider transition-all active:scale-95 border ${
                  heroSlide === 1
                    ? 'border-teal-500/30 text-teal-400 hover:bg-teal-500/10'
                    : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
                }`}>
                {heroSlide === 1
                  ? <><PiggyBank size={13} /> I&apos;m a Tenant</>
                  : <><Building2 size={13} /> I&apos;m a Landlord</>
                }
              </Link>
              <Link href="/login"
                className="flex items-center justify-center gap-2 py-3 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-2xl font-black text-xs uppercase tracking-wider hover:border-zinc-600 transition-all active:scale-95">
                <Users size={13} /> Sign In
              </Link>
            </div>
          </div>

          {/* Social proof — live platform stats + realistic vault example */}
          <div className="space-y-2">
            {platformStats && (
              <div className="grid grid-cols-2 gap-2">
                {([
                  { label: 'Registered Users',   value: String(platformStats.users),   color: 'text-white'    },
                  { label: 'Active Rent Vaults', value: String(platformStats.vaults),  color: 'text-teal-400' },
                  { label: 'Tenants Saving',     value: String(platformStats.tenants), color: 'text-teal-400' },
                  { label: 'Ledger Verified',    value: '100%',                        color: 'text-green-400'},
                ] as {label:string;value:string;color:string}[]).map(s => (
                  <div key={s.label} className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 text-center">
                    <p className={`text-base font-black font-mono ${s.color}`}>{s.value}</p>
                    <p className="text-[8px] text-zinc-600 uppercase tracking-widest mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="p-3 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-2">
              <p className="text-[8px] text-teal-400 uppercase font-black tracking-widest">Example Rent Vault · Lagos Tenant</p>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] text-zinc-300 font-bold">Annual Rent Target</p>
                  <p className="text-[9px] text-zinc-600 font-mono">Target: ₦1,200,000 · Saved: ₦180,000</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-black text-teal-400">15%</p>
                  <p className="text-[8px] text-zinc-600">Funded</p>
                </div>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 rounded-full" style={{ width: '15%' }} />
              </div>
              <p className="text-[8px] text-zinc-700 font-mono">SHA-256 Verified · Paystack Secured</p>
            </div>
          </div>

          {/* Trust line */}
          <p className="text-[9px] text-zinc-600">{geoHero.example}</p>

          {/* Role scroll chips — all existing hrefs preserved */}
          <div className="snap-x-card -mx-4 px-4">
            {[
              { label:'🏠 Landlord',   href:'/register?role=landlord' },
              { label:'💼 Investor',   href:'/register?role=investor' },
              { label:'🏗️ Developer',  href:'/projects/submit'        },
              { label:'🌍 Diaspora',   href:'/register?role=diaspora' },
              { label:'🔨 Contractor', href:'/register'               },
              { label:'🏛️ Government', href:'/gov'                    },
              { label:'🏠 Tenant',     href:'/register?intent=tenant' },
            ].map(r => (
              <Link key={r.href} href={r.href}
                className="snap-start px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/50 text-[11px] font-bold text-zinc-300 hover:border-zinc-600 transition-all active:scale-95 whitespace-nowrap min-w-max">
                {r.label}
              </Link>
            ))}
          </div>
        </section>

        {/* ── CURRENCY BADGE ──────────────────────────────────────────────── */}
        {country && (
          <div className="px-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/40 w-fit">
              <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Showing prices in</span>
              <span className="text-[9px] font-black text-teal-400 uppercase tracking-widest">{currency.code} {currency.symbol}</span>
            </div>
          </div>
        )}

        {/* ── LIVE STATS ────────────────────────────────────────────────── */}
        <section className="px-4">
          <div className="grid grid-cols-2 gap-3">
            {stats ? ([
              { label:'Active Assets',    val:safeN(stats.active_projects),     color:'text-white',     fmt:false },
              { label:'Escrow Capital',   val:safeN(stats.total_committed_usd), color:'text-teal-400',  fmt:true  },
              { label:'Ledger Events',    val:safeN(stats.ledger_events),        color:'text-zinc-300',  fmt:false },
              { label:'Countries Active', val:safeN(stats.countries_active),     color:'text-amber-400', fmt:false },
            ] as const).map(s => (
              <div key={s.label} className="p-4 bg-zinc-950 border border-zinc-900 rounded-2xl space-y-1">
                <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">{s.label}</p>
                <p className={`text-2xl font-black font-mono tabular-nums ${s.color}`}>
                  {s.fmt ? fmtNum(s.val) : <Counter target={s.val} />}
                </p>
              </div>
            )) : Array(4).fill(0).map((_, i) => (
              <div key={i} className="p-4 bg-zinc-950 border border-zinc-900 rounded-2xl space-y-3">
                <div className="skeleton h-3 w-2/3 rounded" />
                <Skel />
              </div>
            ))}
          </div>
        </section>

        {/* ── SEARCH ────────────────────────────────────────────────────── */}
        <section className="px-4 relative">
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-2xl px-4 focus-within:border-teal-500/60 transition-all">
            <Search size={15} className="text-zinc-600 flex-shrink-0 mr-3" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by Project ID, city, category…"
              className="flex-1 bg-transparent outline-none py-4 text-sm placeholder:text-zinc-700"
            />
            {searching && <RefreshCw size={11} className="animate-spin text-zinc-600 mr-2" />}
          </div>

          <div className="snap-x-card mt-2">
            {['Lagos', 'Dubai', 'NAP-2026-00001', 'Residential', 'Solar', 'London'].map(h => (
              <button key={h} onClick={() => setSearchInput(h)}
                className="snap-start px-3 py-1.5 border border-zinc-800 text-zinc-600 text-[9px] font-mono rounded-lg hover:border-teal-500/30 hover:text-teal-500 transition-all whitespace-nowrap min-w-max">
                {h}
              </button>
            ))}
          </div>

          {searchOpen && searchResults.length > 0 && (
            <div className="absolute top-[58px] left-4 right-4 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden z-50 shadow-2xl">
              {searchResults.map(p => (
                <Link key={p.id} href={`/projects/${p.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-zinc-800 transition-all border-b border-zinc-800/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[9px] font-mono text-teal-500">{p.project_number}</span>
                      <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold uppercase ${p.status === 'ACTIVE' ? 'bg-teal-500/10 text-teal-500' : 'bg-zinc-800 text-zinc-500'}`}>{p.status}</span>
                    </div>
                    <p className="font-bold text-sm truncate">{p.title}</p>
                    <p className="text-[9px] text-zinc-500">{p.location}, {p.country}</p>
                  </div>
                  <span className="font-mono text-xs font-bold flex-shrink-0">{p.currency} {safeF(p.budget)}</span>
                </Link>
              ))}
              <Link href={`/explore?q=${encodeURIComponent(searchInput)}`}
                className="flex items-center justify-center gap-2 px-4 py-3 text-[9px] text-teal-500 font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all">
                View all results <ArrowRight size={10} />
              </Link>
            </div>
          )}
          {searchOpen && searchResults.length === 0 && !searching && (
            <div className="absolute top-[58px] left-4 right-4 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-4 z-50 text-center">
              <p className="text-xs text-zinc-500">No results for &ldquo;{searchInput}&rdquo;</p>
              <Link href="/projects/submit" className="text-[9px] text-teal-500 font-bold mt-1 block hover:text-white">
                Post this project →
              </Link>
            </div>
          )}
        </section>

        {/* ── ROLE TABS ─────────────────────────────────────────────────── */}
        <section>
          {/* Sticky tab bar */}
          <div className="sticky top-0 z-30 px-4 pt-2 pb-2 bg-[#050505]">
            <div className="grid grid-cols-5 gap-1 bg-zinc-950 p-1 rounded-2xl border border-zinc-900">
              {ROLES.map(r => {
                const rc = CC[r.color];
                return (
                  <button key={r.id} onClick={() => setActiveRole(r.id)}
                    className={`py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all flex flex-col items-center gap-0.5 ${
                      activeRole === r.id ? rc.act : 'text-zinc-600 hover:text-zinc-400'
                    }`}>
                    <span className="text-base leading-none">{r.emoji}</span>
                    <span>{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panel */}
          <div key={activeRole} className={`mx-4 rounded-3xl border ${cc.bd} bg-zinc-950 overflow-hidden animate-fadeIn`}>
            <div className={`h-1 w-full bg-gradient-to-r ${cc.bar}`} />
            <div className="p-5 space-y-5">
              <div>
                <p className={`text-[9px] font-black uppercase tracking-[0.25em] mb-1 ${cc.tx}`}>{roleTab.emoji} {roleTab.label}</p>
                <h2 className="text-xl font-black uppercase tracking-tight leading-tight">{role.headline}</h2>
                <p className="text-xs text-zinc-500 mt-1">{role.sub}</p>
              </div>

              <ul className="space-y-2.5">
                {role.points.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[11px] text-zinc-400 leading-relaxed">
                    <CheckCircle2 size={11} className={`flex-shrink-0 mt-0.5 ${cc.tx}`} />
                    {pt}
                  </li>
                ))}
              </ul>

              <div className="space-y-3 pt-1 border-t border-zinc-900">
                <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest pt-1">How it works</p>
                {role.steps.map(s => (
                  <div key={s.n} className="flex items-start gap-3">
                    <span className={`flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center text-[9px] font-black font-mono border ${cc.bd} ${cc.tx} bg-zinc-900`}>{s.n}</span>
                    <div>
                      <p className="font-bold text-xs text-white">{s.t}</p>
                      <p className="text-[10px] text-zinc-500 leading-relaxed">{s.b}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-1">
                <Link href={role.cta}
                  className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg ${cc.btn} ${cc.sh}`}>
                  {role.ctaLabel} <ArrowRight size={13} />
                </Link>
                <Link href={role.sec}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-zinc-800 text-zinc-500 font-bold text-[10px] uppercase tracking-widest hover:border-zinc-600 hover:text-zinc-300 transition-all">
                  {role.secLabel}
                </Link>
              </div>
            </div>
          </div>

          {/* Feature cards — swipeable */}
          <div className="mt-4 snap-x-card px-4">
            {role.cards.map(card => {
              const Icon = card.icon;
              return (
                <div key={card.title}
                  className={`snap-start min-w-[72vw] max-w-[72vw] sm:min-w-[230px] sm:max-w-[230px] p-4 rounded-2xl border ${cc.bd} bg-zinc-950 space-y-3`}>
                  <Icon size={18} className={cc.tx} />
                  <p className="font-black text-[11px] uppercase tracking-tight text-white">{card.title}</p>
                  <div className="flex flex-wrap gap-1">
                    {card.tags.map(t => (
                      <span key={t} className={`text-[8px] px-1.5 py-0.5 rounded border font-bold ${cc.tag}`}>{t}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── ROI CALCULATOR (investor only) ────────────────────────────── */}
        {activeRole === 'investor' && (
          <section className="px-4 animate-fadeIn">
            <div className="p-5 rounded-3xl border border-amber-500/20 bg-amber-500/5 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[9px] text-amber-500 uppercase font-black tracking-widest">Infrastructure Yield Estimator</p>
                <span className="text-[8px] text-zinc-600 border border-zinc-800 px-2 py-0.5 rounded-full font-mono">Benchmark-linked · Variable</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed -mt-2">
                Projected distributions benchmarked against prevailing macroeconomic reference rates with an additional infrastructure premium applied per project.
              </p>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Capital Commitment</span>
                  <span className="font-mono font-black text-amber-400 text-lg">₦{roiSlider.toLocaleString()}</span>
                </div>
                <input type="range" min={100_000} max={10_000_000} step={100_000} value={roiSlider}
                  onChange={e => setRoiSlider(Number(e.target.value))}
                  className="w-full accent-amber-500 h-2 cursor-pointer" />
                <div className="flex justify-between text-[8px] text-zinc-700 font-mono">
                  <span>₦100K</span><span>₦10M</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label:'Est. Rate',      val:'~10–15%',                       color:'text-amber-400', note:'target range'  },
                  { label:'Est. Monthly',   val:`₦${roiMonthly.toLocaleString()}`, color:'text-white',   note:'illustrative'  },
                  { label:'Est. Annual',    val:`₦${roiYearly.toLocaleString()}`,  color:'text-teal-400', note:'variable'     },
                ].map(c => (
                  <div key={c.label} className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/50 text-center space-y-0.5">
                    <p className="text-[8px] text-zinc-600 uppercase font-bold">{c.label}</p>
                    <p className={`font-black text-base font-mono ${c.color}`}>{c.val}</p>
                    <p className="text-[7px] text-zinc-700 font-mono">{c.note}</p>
                  </div>
                ))}
              </div>
              <Link href="/register?role=investor"
                className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-amber-500 text-black font-black text-xs uppercase tracking-wider hover:bg-amber-400 transition-all active:scale-95">
                <TrendingUp size={13} /> Access Infrastructure Exchange
              </Link>
              <p className="text-[8px] text-zinc-700 text-center leading-relaxed">
                Projections are illustrative. Returns are market-linked and variable. Capital held in programmable escrow. 2% platform fee on milestone release only.
              </p>
            </div>
          </section>
        )}

        {/* ── TRUST ─────────────────────────────────────────────────────── */}
        <section className="px-4 space-y-3">
          <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">Trust Protocol</p>
          <div className="space-y-2">
            {[
              { icon:Lock,        title:'Paystack Escrow',       body:'Capital held in a regulated vault. Released only on verified milestones.'        },
              { icon:ShieldCheck, title:'Tri-Layer Verification', body:'AI + human auditor + drone footage. All three must confirm before release.'       },
              { icon:FileText,    title:'Immutable Ledger',       body:'Every payment is SHA-256 hashed. Permanent. Tamper-proof. Court-admissible.'     },
            ].map(t => (
              <div key={t.title} className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20">
                <t.icon size={14} className="text-teal-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs uppercase tracking-tight">{t.title}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{t.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── ESCROW FLOW (collapsible) ──────────────────────────────────── */}
        <section className="px-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
            <button onClick={() => setShowEscrow(!showEscrow)}
              className="w-full flex items-center justify-between px-5 py-4 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
              <span className="flex items-center gap-2"><BarChart3 size={13} /> Live Escrow Flow</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${showEscrow ? 'rotate-180' : ''}`} />
            </button>
            {showEscrow && (
              <div className="px-4 pb-4 space-y-2 border-t border-zinc-900 pt-3 animate-fadeIn">
                {[
                  { t:'01 · Investor commits capital',          active:true  },
                  { t:'02 · Funds locked in Paystack escrow',   active:true  },
                  { t:'03 · Contractor completes milestone',     active:true  },
                  { t:'04 · AI + Human + Drone verify work',     active:true  },
                  { t:'05 · 70% mobilization released',          active:false },
                  { t:'06 · 30% balance released on verify',     active:false },
                  { t:'07 · 2% platform fee credited to Ark',    active:false },
                  { t:'08 · SHA-256 hash written to ledger',     active:false },
                ].map((s, i) => (
                  <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[11px] border ${
                    s.active ? 'bg-teal-500/5 border-teal-500/20 text-zinc-300' : 'border-zinc-800/60 bg-zinc-900/20 text-zinc-600'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.active ? 'bg-teal-500 animate-pulse' : 'bg-zinc-700'}`} />
                    {s.t}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── GLOBAL COMPLIANCE (collapsible) ───────────────────────────── */}
        <section className="px-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
            <button onClick={() => setShowCompliance(!showCompliance)}
              className="w-full flex items-center justify-between px-5 py-4 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
              <span className="flex items-center gap-2"><Globe size={13} /> Global Compliance · 12+ Countries</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${showCompliance ? 'rotate-180' : ''}`} />
            </button>
            {showCompliance && (
              <div className="pb-4 border-t border-zinc-900 pt-3 animate-fadeIn">
                <div className="snap-x-card px-4">
                  {Object.entries({
                    Nigeria:'LASG Digital Permit', 'United Kingdom':'Planning Permission',
                    USA:'Building Permit / EIN', UAE:'DLD Project Permit',
                    Kenya:'NCA Registration', Germany:'Baugenehmigung',
                    Singapore:'BCA Permit', Australia:'DA Approval',
                    Canada:'Building Permit', India:'RERA Registration',
                    France:'Permis de Construire', Japan:'Construction License',
                  }).map(([country, permit]) => (
                    <div key={country} className="snap-start min-w-[150px] p-3 rounded-xl border border-zinc-800 bg-zinc-900/20 space-y-0.5">
                      <p className="text-[10px] font-bold text-white">{country}</p>
                      <p className="text-[8px] text-zinc-600">{permit}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── WHO USES NESTED ARK ───────────────────────────────────────── */}
        <section className="px-4 space-y-3">
          <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">Who Uses Nested Ark</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon:'🏠', label:'Landlords',   href:'/register?role=landlord', hover:'hover:border-teal-500/40'   },
              { icon:'💼', label:'Investors',   href:'/register?role=investor', hover:'hover:border-amber-500/40'  },
              { icon:'🏗️', label:'Developers',  href:'/projects/submit',        hover:'hover:border-blue-500/40'   },
              { icon:'🌍', label:'Diaspora',    href:'/register?role=diaspora', hover:'hover:border-rose-500/40'   },
              { icon:'🔨', label:'Contractors', href:'/register',               hover:'hover:border-zinc-600'      },
              { icon:'🏛️', label:'Government',  href:'/gov',                    hover:'hover:border-purple-500/40' },
              { icon:'🏠', label:'Tenants',     href:'/register?intent=tenant', hover:'hover:border-green-500/40'  },
            ].map(r => (
              <Link key={r.label} href={r.href}
                className={`flex items-center gap-3 p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 transition-all group ${r.hover}`}>
                <span className="text-2xl">{r.icon}</span>
                <div>
                  <p className="font-black text-xs uppercase tracking-tight">{r.label}</p>
                  <p className="text-[9px] text-teal-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold mt-0.5">Get started →</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── BOTTOM CTA ────────────────────────────────────────────────── */}
        <section className="px-4">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center space-y-5">
            <div className="space-y-2">
              <p className="text-[9px] text-teal-500 uppercase font-bold tracking-[0.3em]">Join Free — Start Today</p>
              <h2 className="text-2xl font-black tracking-tighter leading-tight">
                Start Your Rent Vault Today
              </h2>
              <p className="text-[11px] text-zinc-500 leading-relaxed max-w-xs mx-auto">
                Join tenants already preparing for rent the smarter way.
              </p>
              <div className="grid grid-cols-2 gap-2 text-left max-w-xs mx-auto">
                {['Set your rent target','Save gradually','Track progress','Pay confidently'].map((s,i) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <span className="text-[8px] text-teal-500 font-black font-mono">0{i+1}</span>
                    <span className="text-[10px] text-zinc-400">{s}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/register?role=landlord"
                className="flex items-center justify-center gap-2 py-4 bg-teal-500 text-black font-black text-xs uppercase tracking-wider rounded-xl hover:bg-teal-400 transition-all active:scale-95">
                <Home size={13} /> Landlord
              </Link>
              <Link href="/register?role=investor"
                className="flex items-center justify-center gap-2 py-4 bg-amber-500 text-black font-black text-xs uppercase tracking-wider rounded-xl hover:bg-amber-400 transition-all active:scale-95">
                <TrendingUp size={13} /> Invest
              </Link>
              <Link href="/projects/submit"
                className="flex items-center justify-center gap-2 py-4 bg-blue-500 text-black font-black text-xs uppercase tracking-wider rounded-xl hover:bg-blue-400 transition-all active:scale-95">
                <Building2 size={13} /> Build
              </Link>
              <Link href="/register?role=diaspora"
                className="flex items-center justify-center gap-2 py-4 border border-zinc-700 text-zinc-300 font-black text-xs uppercase tracking-wider rounded-xl hover:border-rose-500/40 hover:text-white transition-all active:scale-95">
                <Globe size={13} /> Diaspora
              </Link>
              <Link href="/register?intent=tenant"
                className="col-span-2 flex items-center justify-center gap-2 py-4 bg-green-500 text-black font-black text-xs uppercase tracking-wider rounded-xl hover:bg-green-400 transition-all active:scale-95">
                <PiggyBank size={13} /> Save for Rent — Open Rent Vault Free
              </Link>
            </div>
            <div className="flex flex-wrap justify-center gap-4 pt-1 text-[8px] text-zinc-700">
              {[
                { icon:Shield,       label:'SHA-256 Ledger'    },
                { icon:Lock,         label:'Paystack Escrow'   },
                { icon:Globe,        label:'12+ Countries'     },
                { icon:CheckCircle2, label:'Tri-Layer Verify'  },
              ].map(b => (
                <span key={b.label} className="flex items-center gap-1.5">
                  <b.icon size={9} className="text-teal-500/50" /> {b.label}
                </span>
              ))}
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
    </>
  );
}
