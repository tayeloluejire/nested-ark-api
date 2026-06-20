'use client';

/**
 * apps/frontend/src/app/no-chop-your-rent/page.tsx
 *
 * NO CHOP YOUR RENT™ — Standalone viral acquisition page
 * URL: nested-ark-api.vercel.app/no-chop-your-rent
 *
 * Funnel: Social Share → Calculate → Wow Moment → Affordability Check
 *         → Viral Share → Start My Rent Vault → /register?intent=tenant
 *
 * Public page. Zero login required before CTA click.
 * No Navbar / Footer — this is a campaign landing page, not a platform page.
 *
 * SEO targets: "rent calculator Nigeria", "how much to save for rent",
 *              "daily rent savings calculator", "rent planner Nigeria",
 *              "can I afford this rent Nigeria", "rent readiness calculator"
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight, CheckCircle2, Share2, Trophy,
  Flame, ChevronDown, AlertTriangle, TrendingUp,
} from 'lucide-react';

// ── Schema ────────────────────────────────────────────────────────────────────
const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'NO CHOP YOUR RENT™ — Free Rent Savings Calculator',
  description:
    'Calculate exactly how much to save daily, weekly or monthly to meet your annual rent without borrowing. Free. No login. Nigeria, Ghana, Kenya, UK.',
  url: 'https://nested-ark-api.vercel.app/no-chop-your-rent',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'All',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

// ── Region config ─────────────────────────────────────────────────────────────
const REGIONS = [
  {
    code: 'NGN', symbol: '₦', flag: '🇳🇬', name: 'Nigeria',
    headline: 'NO CHOP YOUR RENT™',
    sub: 'Know exactly how much to save daily, weekly or monthly so your rent is ready before your landlord asks.',
    exampleRent: 1200000, exampleIncome: 3000000,
    incomeLabel: 'Annual Income',
    incomeNote: 'Your total yearly income (salary, business, etc.)',
  },
  {
    code: 'GHS', symbol: 'GH₵', flag: '🇬🇭', name: 'Ghana',
    headline: "DON'T LET RENT CATCH YOU OFF GUARD",
    sub: 'Plan your rent today. Know your daily savings target so you never scramble for rent again.',
    exampleRent: 18000, exampleIncome: 60000,
    incomeLabel: 'Annual Income',
    incomeNote: 'Your total yearly income',
  },
  {
    code: 'KES', symbol: 'KSh', flag: '🇰🇪', name: 'Kenya',
    headline: 'PLAN YOUR RENT EARLY',
    sub: 'Calculate your daily rent savings target and arrive rent-ready every renewal cycle.',
    exampleRent: 180000, exampleIncome: 600000,
    incomeLabel: 'Annual Income',
    incomeNote: 'Your total yearly income',
  },
  {
    code: 'GBP', symbol: '£', flag: '🇬🇧', name: 'UK',
    headline: 'NEVER SCRAMBLE FOR RENT AGAIN',
    sub: 'Calculate your weekly or monthly savings target so rent day is never a crisis.',
    exampleRent: 18000, exampleIncome: 36000,
    incomeLabel: 'Annual Income',
    incomeNote: 'Your total gross annual income',
  },
  {
    code: 'USD', symbol: '$', flag: '🌍', name: 'Other',
    headline: 'STRESS-FREE RENT STARTS HERE',
    sub: 'One calculation. A clear daily savings target. No rent stress.',
    exampleRent: 18000, exampleIncome: 48000,
    incomeLabel: 'Annual Income',
    incomeNote: 'Your total annual income',
  },
];

// ── Readiness tier ────────────────────────────────────────────────────────────
type ReadinessLevel = {
  label: string; emoji: string;
  textColor: string; barColor: string; borderColor: string; bgColor: string;
  message: string;
};

function getReadiness(pct: number): ReadinessLevel {
  if (pct >= 91) return {
    label: 'RENT READY', emoji: '🏆',
    textColor: 'text-green-400', barColor: 'bg-green-500',
    borderColor: 'border-green-500/25', bgColor: 'bg-green-500/5',
    message: "Your landlord can't catch you lacking. You're sorted.",
  };
  if (pct >= 61) return {
    label: 'ON TRACK', emoji: '🟢',
    textColor: 'text-teal-400', barColor: 'bg-teal-500',
    borderColor: 'border-teal-500/25', bgColor: 'bg-teal-500/5',
    message: 'Good discipline. Keep the pace and you will land safely.',
  };
  if (pct >= 31) return {
    label: 'CATCH UP', emoji: '🟡',
    textColor: 'text-amber-400', barColor: 'bg-amber-500',
    borderColor: 'border-amber-500/25', bgColor: 'bg-amber-500/5',
    message: 'You need to increase your saving pace. Start now — it is not too late.',
  };
  return {
    label: 'DANGER ZONE', emoji: '🔴',
    textColor: 'text-red-400', barColor: 'bg-red-500',
    borderColor: 'border-red-500/25', bgColor: 'bg-red-500/5',
    message: 'Rent stress is coming. The best time to start was yesterday. The next best time is right now.',
  };
}

// ── Affordability tier ────────────────────────────────────────────────────────
function getAffordability(rentPct: number) {
  if (rentPct <= 30) return {
    label: 'HEALTHY', emoji: '🟢', textColor: 'text-green-400',
    borderColor: 'border-green-500/25', bgColor: 'bg-green-500/5',
    message: `Your annual rent is ${rentPct}% of your yearly income. That is a healthy ratio — you can manage this comfortably.`,
  };
  if (rentPct <= 50) return {
    label: 'MANAGEABLE', emoji: '🟡', textColor: 'text-amber-400',
    borderColor: 'border-amber-500/25', bgColor: 'bg-amber-500/5',
    message: `Your annual rent is ${rentPct}% of your yearly income. Manageable but tight — consistent saving is essential.`,
  };
  return {
    label: 'RISKY', emoji: '🔴', textColor: 'text-red-400',
    borderColor: 'border-red-500/25', bgColor: 'bg-red-500/5',
    message: `Your annual rent is ${rentPct}% of your yearly income. This is a high ratio. Consider a lower rent target or increasing income before committing.`,
  };
}

// ── Number formatter ──────────────────────────────────────────────────────────
const fmt = (n: number, sym: string): string => {
  if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${sym}${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
  return `${sym}${n.toFixed(2)}`;
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function NoChopYourRentPage() {
  const [region,      setRegion]      = useState(REGIONS[0]);
  const [rentAmount,  setRentAmount]  = useState('1200000');
  const [savedSoFar,  setSavedSoFar]  = useState('0');
  const [income,      setIncome]      = useState('');
  const [showAfford,  setShowAfford]  = useState(false);
  const [showFAQ,     setShowFAQ]     = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [day,         setDay]         = useState(1);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Gamification day counter
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ncyr_start');
      if (!stored) {
        localStorage.setItem('ncyr_start', String(Date.now()));
      } else {
        const elapsed = Math.floor((Date.now() - parseInt(stored)) / 86_400_000) + 1;
        setDay(Math.min(elapsed, 365));
      }
    } catch (_) { /* incognito / SSR */ }
  }, []);

  // ── Math ──────────────────────────────────────────────────────────────────
  const target    = parseFloat(rentAmount) || 0;
  const saved     = parseFloat(savedSoFar) || 0;
  const remaining = Math.max(target - saved, 0);
  const funded    = target > 0 ? Math.min(Math.round((saved / target) * 100), 100) : 0;

  // Fixed 365-day basis for hero results (simple and viral-friendly)
  const daily     = remaining / 365;
  const weekly    = remaining / 52.18;
  const monthly   = remaining / 12;
  const quarterly = remaining / 4;
  const biannual  = remaining / 2;

  const incomeVal     = parseFloat(income) || 0;
  const rentPct       = incomeVal > 0 ? Math.round((target / incomeVal) * 100) : 0;
  const affordability = getAffordability(rentPct);
  const readiness     = getReadiness(funded);
  const sym           = region.symbol;

  // ── Share helpers ─────────────────────────────────────────────────────────
  const shareText = target > 0
    ? `NO CHOP YOUR RENT™ 🏠\n\nMy annual rent is ${fmt(target, sym)}\nI only need to save:\n\n${fmt(daily, sym)} daily\nor ${fmt(monthly, sym)} monthly\n\nto have my rent ready — no borrowing, no panic.\n\nCalculate yours FREE 👇\nhttps://nested-ark-api.vercel.app/no-chop-your-rent`
    : 'Calculate your rent savings plan FREE at https://nested-ark-api.vercel.app/no-chop-your-rent — NO CHOP YOUR RENT™';

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://nested-ark-api.vercel.app/no-chop-your-rent')}&quote=${encodeURIComponent(shareText)}`;
  const twitterUrl  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText.slice(0, 240))}`;

  const handleCopy = useCallback(() => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [shareText]);

  const handleCalculate = () => {
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const inp = "w-full bg-black border border-zinc-800 rounded-xl px-4 py-3.5 text-white font-mono text-sm outline-none focus:border-teal-500 transition-colors placeholder:text-zinc-700";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />

      <div className="min-h-screen bg-[#050505] text-white flex flex-col">

        {/* ── Minimal top bar ─────────────────────────────────────────── */}
        <div className="border-b border-zinc-900 px-4 py-3 flex items-center justify-between max-w-2xl mx-auto w-full">
          <Link href="/" className="text-[10px] font-black tracking-widest text-zinc-500 hover:text-white transition-colors uppercase">
            ← Nested Ark
          </Link>
          <span className="text-[9px] font-black tracking-widest text-teal-400 uppercase flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse inline-block" />
            Free · No Login Required
          </span>
        </div>

        <main className="flex-1 max-w-2xl mx-auto px-4 pt-10 pb-16 w-full space-y-8">

          {/* ── Region selector ─────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2">
            {REGIONS.map(r => (
              <button
                key={r.code}
                onClick={() => {
                  setRegion(r);
                  setRentAmount(String(r.exampleRent));
                  setIncome(String(r.exampleIncome));
                }}
                className={`px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${
                  region.code === r.code
                    ? 'border-teal-500/50 bg-teal-500/10 text-teal-400'
                    : 'border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                }`}
              >
                {r.flag} {r.name}
              </button>
            ))}
          </div>

          {/* ── Hero ────────────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Campaign photo — the human face of "No Chop Your Rent" */}
            <div className="relative w-full max-w-xs mx-auto sm:mx-0 rounded-2xl overflow-hidden border border-zinc-800">
              <Image
                src="/images/no-chop-your-rent-hero.png"
                alt="Shocked man feeding a tiny apartment building rice and stew off a plate — because if you don't plan, your rent chops your money like this"
                width={479}
                height={660}
                priority
                className="w-full h-auto object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                <p className="text-[9px] font-bold text-zinc-200 italic">
                  "Una go chop my rent? Not this year." 😅
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2">
              <Flame size={14} className="text-orange-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">
                NO CHOP YOUR RENT™
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tighter leading-none">
              {region.headline.split(' ').slice(0, 3).join(' ')}{' '}
              <span className="text-teal-400">{region.headline.split(' ').slice(3).join(' ')}</span>
            </h1>

            <p className="text-zinc-400 text-sm leading-relaxed max-w-md">
              {region.sub}
            </p>

            <p className="text-zinc-500 text-xs leading-relaxed max-w-md italic">
              Real talk: rent doesn't ambush you — it's on the calendar every year.
              The only surprise is whether you were ready for it. Let's fix that.
            </p>

            {/* Checkmarks */}
            <div className="grid grid-cols-2 gap-1.5">
              {['No borrowing', 'No panic', 'No embarrassment', 'No last-minute pressure'].map(c => (
                <div key={c} className="flex items-center gap-2">
                  <CheckCircle2 size={11} className="text-teal-500 flex-shrink-0" />
                  <span className="text-[10px] text-zinc-400 font-medium">{c}</span>
                </div>
              ))}
            </div>

            {/* Day badge */}
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-orange-500/20 bg-orange-500/5">
              <Trophy size={11} className="text-orange-400" />
              <span className="text-[9px] font-black text-orange-300 tracking-wide">
                Rent Discipline Challenge — Day {day} of 365
              </span>
            </div>
          </div>

          {/* ── Calculator inputs ────────────────────────────────────────── */}
          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-5">
            <div>
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">
                Calculate Your Rent Plan
              </p>
              <p className="text-[10px] text-zinc-600 mt-1">
                Two numbers. Thirty seconds. No drama.
              </p>
            </div>

            {/* Annual rent */}
            <div>
              <label className="block text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-1.5">
                Annual Rent Amount ({region.code})
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-black text-sm select-none">
                  {sym}
                </span>
                <input
                  type="number" min={0}
                  placeholder={String(region.exampleRent)}
                  value={rentAmount}
                  onChange={e => setRentAmount(e.target.value)}
                  className={`${inp} pl-8`}
                />
              </div>
              <p className="text-[9px] text-zinc-600 mt-1.5">Total rent your landlord requires per year</p>
            </div>

            {/* Already saved */}
            <div>
              <label className="block text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-1.5">
                Already Saved (optional)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-black text-sm select-none">
                  {sym}
                </span>
                <input
                  type="number" min={0} placeholder="0"
                  value={savedSoFar}
                  onChange={e => setSavedSoFar(e.target.value)}
                  className={`${inp} pl-8`}
                />
              </div>
            </div>

            {/* Calculate button */}
            <button
              onClick={handleCalculate}
              disabled={target <= 0}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-teal-500 text-black font-black text-sm uppercase tracking-widest hover:bg-teal-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <TrendingUp size={15} /> Calculate My Rent Plan
            </button>
          </div>

          {/* ── Results ─────────────────────────────────────────────────── */}
          {target > 0 && (
            <div className="space-y-5" ref={resultsRef}>

              {/* Big savings numbers */}
              <div className="p-5 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp size={13} className="text-teal-400" />
                  <p className="text-[9px] text-teal-400 uppercase font-black tracking-widest">
                    For {fmt(target, sym)} Annual Rent
                  </p>
                </div>

                {/* Hero numbers — daily & monthly most prominent */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 p-4 rounded-xl bg-black/40 border border-teal-500/20 text-center">
                    <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Daily Savings</p>
                    <p className="text-4xl font-black font-mono text-teal-400">{fmt(daily, sym)}</p>
                    <p className="text-[9px] text-zinc-600 mt-1">per day</p>
                  </div>
                  {[
                    { label: 'Weekly',    value: weekly    },
                    { label: 'Monthly',   value: monthly   },
                    { label: 'Quarterly', value: quarterly },
                    { label: 'Bi-Annual', value: biannual  },
                  ].map(s => (
                    <div key={s.label} className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center">
                      <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-1">{s.label}</p>
                      <p className="text-lg font-black font-mono text-white">{fmt(s.value, sym)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Readiness Score */}
              <div className={`p-5 rounded-2xl border ${readiness.borderColor} ${readiness.bgColor} space-y-3`}>
                <div className="flex items-center justify-between">
                  <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Rent Readiness Score</p>
                  <p className={`text-[9px] font-black uppercase tracking-widest ${readiness.textColor}`}>
                    {readiness.emoji} {readiness.label}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${readiness.barColor}`}
                    style={{ width: `${funded}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-zinc-600">
                  <span>0%</span>
                  <span className={readiness.textColor}>{funded}%</span>
                  <span>100%</span>
                </div>

                {/* Tiers legend */}
                <div className="grid grid-cols-4 gap-1 pt-1">
                  {[
                    { range: '0–30%',  label: 'Danger',   col: 'text-red-400'   },
                    { range: '31–60%', label: 'Catch Up', col: 'text-amber-400' },
                    { range: '61–90%', label: 'On Track', col: 'text-teal-400'  },
                    { range: '91–100%',label: 'Ready',    col: 'text-green-400' },
                  ].map(t => (
                    <div key={t.label} className="text-center">
                      <p className={`text-[7px] font-black uppercase ${t.col}`}>{t.label}</p>
                      <p className="text-[7px] text-zinc-600">{t.range}</p>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  {readiness.message}
                </p>

                {saved > 0 && (
                  <div className="flex justify-between text-[9px] font-mono pt-1">
                    <span className="text-teal-400">Saved: {fmt(saved, sym)}</span>
                    <span className="text-zinc-500">Remaining: {fmt(remaining, sym)}</span>
                  </div>
                )}
              </div>

              {/* Key insight line */}
              <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 text-center space-y-1">
                <p className="text-sm font-black tracking-tight">
                  If you save <span className="text-teal-400">{fmt(daily, sym)} daily</span> from today —
                </p>
                <p className="text-sm font-black tracking-tight">
                  your {fmt(target, sym)} rent will be fully ready in 365 days.
                </p>
                <p className="text-[10px] text-zinc-500 mt-2">No borrowing. No stress. No stories.</p>
              </div>

              {/* Human quote card — same voice as the campaign visual */}
              <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/10 flex gap-3">
                <span className="text-3xl text-teal-500/40 font-black leading-none">"</span>
                <p className="text-xs text-zinc-400 leading-relaxed italic">
                  Rent stress is coming. The best time to start was yesterday.
                  The next best time is right now — not when your landlord starts calling.
                </p>
              </div>

              {/* ── Affordability Check ──────────────────────────────────── */}
              <div className="rounded-2xl border border-zinc-800 overflow-hidden">
                <button
                  onClick={() => setShowAfford(!showAfford)}
                  className="w-full flex items-center justify-between px-5 py-4 bg-zinc-900/20 hover:bg-zinc-900/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={12} className="text-amber-400" />
                    <p className="text-[9px] text-zinc-300 uppercase font-black tracking-widest">
                      Can You Afford This Rent?
                    </p>
                  </div>
                  <ChevronDown size={13} className={`text-zinc-600 transition-transform ${showAfford ? 'rotate-180' : ''}`} />
                </button>

                {showAfford && (
                  <div className="p-5 space-y-4 border-t border-zinc-800">
                    <div>
                      <label className="block text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-1.5">
                        {region.incomeLabel} ({region.code})
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-black text-sm select-none">
                          {sym}
                        </span>
                        <input
                          type="number" min={0}
                          placeholder={String(region.exampleIncome)}
                          value={income}
                          onChange={e => setIncome(e.target.value)}
                          className={`${inp} pl-8`}
                        />
                      </div>
                      <p className="text-[9px] text-zinc-600 mt-1.5">{region.incomeNote}</p>
                    </div>

                    {incomeVal > 0 && (
                      <div className={`p-4 rounded-xl border ${affordability.borderColor} ${affordability.bgColor} space-y-2`}>
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
                            Affordability Score
                          </p>
                          <p className={`text-[9px] font-black uppercase tracking-widest ${affordability.textColor}`}>
                            {affordability.emoji} {affordability.label}
                          </p>
                        </div>
                        <p className="text-3xl font-black font-mono text-white">{rentPct}%</p>
                        <p className="text-[9px] text-zinc-500">of your annual income goes to rent</p>
                        <p className="text-[10px] text-zinc-400 leading-relaxed pt-1">
                          {affordability.message}
                        </p>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mt-2">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              rentPct <= 30 ? 'bg-green-500' : rentPct <= 50 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(rentPct, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Viral share card ─────────────────────────────────────── */}
              <div className="p-5 rounded-2xl border border-zinc-700 bg-zinc-900/30 space-y-4">
                <div className="flex items-center gap-2">
                  <Flame size={13} className="text-orange-400" />
                  <p className="text-[9px] text-orange-400 uppercase font-black tracking-widest">
                    Help someone avoid rent stress
                  </p>
                </div>

                {/* Shareable card */}
                <div className="p-4 rounded-xl border border-zinc-700 bg-black/50 font-mono text-[11px] text-zinc-300 leading-relaxed space-y-1 select-all">
                  <p className="text-white font-black text-sm">NO CHOP YOUR RENT™ 🏠</p>
                  <p className="text-zinc-400">My annual rent is {fmt(target, sym)}</p>
                  <p className="text-zinc-400">I only need to save:</p>
                  <p className="text-teal-400 font-black">{fmt(daily, sym)} daily</p>
                  <p className="text-zinc-500 text-[9px]">or {fmt(monthly, sym)} monthly</p>
                  <p className="text-zinc-400 mt-1">to have my rent ready — no borrowing, no panic.</p>
                  <p className="text-zinc-600 text-[9px] mt-2">nested-ark-api.vercel.app/no-chop-your-rent</p>
                </div>

                {/* Share buttons */}
                <div className="grid grid-cols-2 gap-2">
                  {/* WhatsApp */}
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 rounded-xl border border-green-600/30 bg-green-600/10 text-green-400 font-black text-[9px] uppercase tracking-widest hover:bg-green-600/20 transition-all"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.118.552 4.107 1.517 5.829L.057 23.585a.75.75 0 0 0 .916.906l5.89-1.433A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.723 9.723 0 0 1-4.952-1.354l-.355-.211-3.676.894.928-3.567-.232-.368A9.718 9.718 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
                    </svg>
                    WhatsApp
                  </a>

                  {/* Facebook */}
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 rounded-xl border border-blue-600/30 bg-blue-600/10 text-blue-400 font-black text-[9px] uppercase tracking-widest hover:bg-blue-600/20 transition-all"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Facebook
                  </a>

                  {/* X / Twitter */}
                  <a
                    href={twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 rounded-xl border border-zinc-600/40 bg-zinc-800/40 text-zinc-300 font-black text-[9px] uppercase tracking-widest hover:bg-zinc-700/40 transition-all"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    X / Twitter
                  </a>

                  {/* Copy link */}
                  <button
                    onClick={handleCopy}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-black text-[9px] uppercase tracking-widest transition-all ${
                      copied
                        ? 'border-green-500/30 bg-green-500/10 text-green-400'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                    }`}
                  >
                    {copied
                      ? <><CheckCircle2 size={12} /> Copied!</>
                      : <><Share2 size={12} /> Copy Plan</>
                    }
                  </button>
                </div>
              </div>

              {/* ── Primary CTA ──────────────────────────────────────────── */}
              <div className="p-6 rounded-2xl border border-teal-500/30 bg-teal-500/5 space-y-4 text-center">
                <div>
                  <p className="font-black text-lg tracking-tight leading-tight">
                    Ready to make this automatic?
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed max-w-sm mx-auto">
                    Open a FREE Nested Ark Rent Vault. Set {fmt(target, sym)} as your target.
                    We track every contribution, send you reminders, and release funds to your landlord
                    when your vault is full. No stress. No last-minute scramble.
                  </p>
                </div>

                <Link
                  href="/register?intent=tenant"
                  className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-teal-500 text-black font-black text-sm uppercase tracking-widest hover:bg-teal-400 transition-all"
                >
                  Start My Rent Vault — Free <ArrowRight size={14} />
                </Link>

                <p className="text-[9px] text-zinc-700">
                  Free to join · No card required · Start from any amount
                </p>
              </div>

            </div>
          )}

          {/* ── How it works ─────────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
              How Nested Ark Rent Vault Works
            </p>
            {[
              { n: '01', t: 'Set your rent target',  b: 'Enter the exact amount your landlord requires. Daily, weekly or monthly — you choose the pace.' },
              { n: '02', t: 'Save gradually',         b: 'Contribute any amount, any time. Every contribution is recorded on an immutable ledger.' },
              { n: '03', t: 'Track your progress',    b: 'Watch your vault fill in real-time. Milestone alerts at 25%, 50%, 75% and 100%.' },
              { n: '04', t: 'Pay confidently',        b: 'When your vault hits 100%, funds release automatically to your landlord. No scramble. No embarrassment.' },
            ].map(s => (
              <div key={s.n} className="flex gap-4 p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20">
                <span className="text-[9px] text-teal-500 font-black font-mono mt-0.5 flex-shrink-0">{s.n}</span>
                <div>
                  <p className="text-xs font-black mb-1">{s.t}</p>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">{s.b}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── FAQ ──────────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <button
              onClick={() => setShowFAQ(!showFAQ)}
              className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border border-zinc-800 hover:bg-zinc-900/40 transition-colors"
            >
              <p className="text-[9px] text-zinc-400 uppercase font-black tracking-widest">
                Frequently Asked Questions
              </p>
              <ChevronDown size={13} className={`text-zinc-600 transition-transform ${showFAQ ? 'rotate-180' : ''}`} />
            </button>
            {showFAQ && (
              <div className="space-y-2">
                {[
                  {
                    q: 'How much should I save per day for annual rent in Nigeria?',
                    a: 'Divide your annual rent by 365. For ₦1,200,000 annual rent ÷ 365 = ₦3,288 per day. Use the calculator above for a precise breakdown based on your exact rent.',
                  },
                  {
                    q: 'How can I save for annual rent without borrowing?',
                    a: 'Open a Nested Ark Rent Vault, set your annual rent as your target, then choose daily, weekly or monthly contributions. The vault tracks your progress automatically and releases funds to your landlord when the target is reached.',
                  },
                  {
                    q: 'What percentage of my income should go to rent?',
                    a: 'The common guideline is no more than 30% of annual income. Above 50% is considered risky. Use the "Can You Afford This Rent?" section above to calculate your personal ratio.',
                  },
                  {
                    q: 'Is this calculator free?',
                    a: 'Yes. Completely free. No login required to calculate your rent plan. Registration is only needed when you open a Rent Vault to start saving automatically.',
                  },
                ].map(item => (
                  <div key={item.q} className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20">
                    <p className="text-xs font-black mb-2">{item.q}</p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Footer note ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-center gap-6 pt-2 pb-4 border-t border-zinc-900">
            <Link href="/" className="text-[10px] text-teal-500 font-bold hover:underline">
              ← Nested Ark Home
            </Link>
            <Link href="/rent-vault/calculator" className="text-[10px] text-zinc-500 hover:text-zinc-300 font-bold transition-colors">
              Full Calculator
            </Link>
            <Link href="/register?intent=tenant" className="text-[10px] text-zinc-500 hover:text-zinc-300 font-bold transition-colors flex items-center gap-1">
              Open Rent Vault <ArrowRight size={9} />
            </Link>
          </div>

        </main>
      </div>
    </>
  );
}
