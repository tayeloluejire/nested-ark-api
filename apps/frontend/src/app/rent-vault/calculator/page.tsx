'use client';

/**
 * /rent-vault/calculator/page.tsx
 * NO CHOP YOUR RENT™ — Viral Rent Savings Calculator
 * Target keywords: "rent calculator Nigeria", "how much should I save for rent",
 *                  "annual rent savings calculator", "rent planner Nigeria",
 *                  "daily rent savings calculator", "save for rent Nigeria"
 * Public page — no login required. Funnel: Calculate → Wow Moment → Register
 */

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  PiggyBank, Calendar, TrendingUp, ArrowRight,
  CheckCircle2, Share2, ChevronDown, Trophy,
  Flame, AlertCircle,
} from 'lucide-react';

// ── Schema ────────────────────────────────────────────────────────────────────
const SCHEMA_CALCULATOR = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'NO CHOP YOUR RENT™ — Rent Savings Calculator by Nested Ark',
  description: 'Calculate exactly how much to save daily, weekly or monthly to meet your next rent without borrowing. Free. No login required.',
  url: 'https://nested-ark-api.vercel.app/rent-vault/calculator',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'All',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

const SCHEMA_FAQ = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How much should I save per day for annual rent in Nigeria?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Divide your annual rent amount by the number of days until renewal. For example, ₦1,200,000 annual rent ÷ 365 days = ₦3,288 per day. Use the Nested Ark Rent Savings Calculator above for a precise breakdown.',
      },
    },
    {
      '@type': 'Question',
      name: 'How can I save for annual rent without borrowing?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Open a Nested Ark Rent Vault, set your annual rent amount as your target, then choose a daily, weekly or monthly contribution amount. The vault tracks your progress automatically and releases funds to your landlord when the target is reached.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is a good monthly savings amount for rent in Lagos?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'For a typical Lagos annual rent of ₦600,000, you need to save ₦50,000 per month to be ready in 12 months. For ₦1,200,000 annual rent, that is ₦100,000 per month. The calculator adjusts based on your specific target and timeline.',
      },
    },
  ],
};

// ── Currency config ───────────────────────────────────────────────────────────
const CURRENCIES = [
  { code: 'NGN', symbol: '₦',   name: 'Nigerian Naira',   exampleRent: 1200000, flag: '🇳🇬', locale: 'en-NG', tagline: 'No chop your rent.' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi',    exampleRent: 18000,   flag: '🇬🇭', locale: 'en-GH', tagline: "Don't let rent catch you slipping." },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling',  exampleRent: 180000,  flag: '🇰🇪', locale: 'en-KE', tagline: "Plan your rent. Own your peace." },
  { code: 'GBP', symbol: '£',   name: 'British Pound',    exampleRent: 12000,   flag: '🇬🇧', locale: 'en-GB', tagline: "Never scramble for rent again." },
  { code: 'USD', symbol: '$',   name: 'US Dollar',        exampleRent: 18000,   flag: '🌍',  locale: 'en-US', tagline: "Stress-free rent starts here." },
];

// ── Readiness Score ───────────────────────────────────────────────────────────
type ReadinessLevel = { label: string; emoji: string; color: string; bar: string; message: string };

function getReadiness(pct: number): ReadinessLevel {
  if (pct >= 91) return { label: 'Rent Ready', emoji: '🏆', color: 'text-green-400', bar: 'bg-green-500', message: "Your landlord can't catch you lacking. You're sorted." };
  if (pct >= 61) return { label: 'On Track',   emoji: '🟢', color: 'text-teal-400',  bar: 'bg-teal-500',  message: "Good discipline. Keep the pace and you'll land safely." };
  if (pct >= 31) return { label: 'Catch Up',   emoji: '🟡', color: 'text-amber-400', bar: 'bg-amber-500', message: "You need to increase your saving pace. Don't panic — start now." };
  return           { label: 'Danger Zone', emoji: '🔴', color: 'text-red-400',   bar: 'bg-red-500',   message: "Rent stress is real. The best time to start was yesterday. The next best time is now." };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number, sym: string): string => {
  if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${sym}${n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return `${sym}${n.toFixed(2)}`;
};

const pct = (saved: number, target: number): number =>
  Math.min(Math.round((saved / target) * 100), 100);

// ── Main Component ────────────────────────────────────────────────────────────
export default function RentCalculatorPage() {
  const [currency,   setCurrency]   = useState(CURRENCIES[0]);
  const [rentAmount, setRentAmount] = useState('1200000');
  const [daysLeft,   setDaysLeft]   = useState('365');
  const [savedSoFar, setSavedSoFar] = useState('0');
  const [showFAQ,    setShowFAQ]    = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [wasCopied,  setWasCopied]  = useState(false);
  const [day,        setDay]        = useState(1);

  // Simulate "Day N of 365" gamification tick on mount
  useEffect(() => {
    const stored = localStorage.getItem('ncyr_start');
    if (!stored) {
      localStorage.setItem('ncyr_start', String(Date.now()));
    } else {
      const elapsed = Math.floor((Date.now() - parseInt(stored)) / 86_400_000) + 1;
      setDay(Math.min(elapsed, 365));
    }
  }, []);

  // ── Core calculations ─────────────────────────────────────────────────────
  const target    = parseFloat(rentAmount)  || 0;
  const days      = parseInt(daysLeft)      || 365;
  const saved     = parseFloat(savedSoFar)  || 0;
  const remaining = Math.max(target - saved, 0);
  const funded    = pct(saved, target);

  const daily     = days > 0 ? remaining / days           : 0;
  const weekly    = days > 0 ? remaining / (days / 7)     : 0;
  const monthly   = days > 0 ? remaining / (days / 30.44) : 0;
  const biannual  = days > 0 ? remaining / (days / 182)   : 0;
  const quarterly = days > 0 ? remaining / (days / 91)    : 0;

  const sym       = currency.symbol;
  const readiness = getReadiness(funded);

  const whatsappText = encodeURIComponent(
    `I just calculated my rent plan. 🏠\n\nTo meet ${fmt(target, sym)} rent, I only need to save ${fmt(daily, sym)} daily.\n\nCalculate yours FREE 👇\nhttps://nested-ark-api.vercel.app/rent-vault/calculator\n\nNO CHOP YOUR RENT™ — powered by @NestedArk`
  );

  const handleShare = useCallback(() => {
    const text = `NO CHOP YOUR RENT™\n\nMy rent plan:\n${fmt(remaining, sym)} needed → ${fmt(daily, sym)}/day · ${fmt(weekly, sym)}/week · ${fmt(monthly, sym)}/month\n\nCalculate yours FREE: https://nested-ark-api.vercel.app/rent-vault/calculator`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setWasCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [remaining, daily, weekly, monthly, sym]);

  const inp = "w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white font-mono text-sm outline-none focus:border-teal-500 transition-colors";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA_CALCULATOR) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA_FAQ) }} />

      <div className="min-h-screen bg-[#050505] text-white flex flex-col">
        <Navbar />

        <main className="flex-1 max-w-2xl mx-auto px-4 py-10 w-full space-y-6">

          {/* ── Hero Header ─────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-teal-400">
                Free Tool · No Login Required · {currency.flag} {currency.name}
              </span>
            </div>

            {/* Brand mark */}
            <div>
              <div className="inline-flex items-center gap-2 mb-1">
                <Flame size={16} className="text-orange-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">
                  NO CHOP YOUR RENT™
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tighter leading-none">
                Know exactly how much<br />
                <span className="text-teal-400">to save for rent.</span>
              </h1>
            </div>

            <p className="text-zinc-500 text-sm leading-relaxed max-w-md">
              {currency.tagline} Enter your rent, choose your timeline — we show you the daily,
              weekly and monthly savings amount to arrive rent-ready without borrowing a kobo.
            </p>

            {/* Gamification badge */}
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-orange-500/20 bg-orange-500/5">
              <Trophy size={12} className="text-orange-400" />
              <span className="text-[9px] font-black text-orange-300 tracking-wide">
                🏆 Rent Discipline Challenge — Day {day} of 365
              </span>
            </div>
          </div>

          {/* ── Currency selector ───────────────────────────────────────── */}
          <div>
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-2">Your Region</p>
            <div className="flex flex-wrap gap-2">
              {CURRENCIES.map(c => (
                <button
                  key={c.code}
                  onClick={() => { setCurrency(c); setRentAmount(String(c.exampleRent)); }}
                  className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                    currency.code === c.code
                      ? 'border-teal-500/50 bg-teal-500/10 text-teal-400'
                      : 'border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {c.flag} {c.code}
                </button>
              ))}
            </div>
          </div>

          {/* ── Inputs ──────────────────────────────────────────────────── */}
          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">

            {/* Annual rent target */}
            <div>
              <label className="block text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-1.5">
                Annual Rent Amount ({currency.code})
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-black text-sm select-none">
                  {sym}
                </span>
                <input
                  type="number"
                  min={0}
                  placeholder={String(currency.exampleRent)}
                  value={rentAmount}
                  onChange={e => setRentAmount(e.target.value)}
                  className={`${inp} pl-8`}
                />
              </div>
              <p className="text-[9px] text-zinc-600 mt-1.5">
                Total amount your landlord requires
              </p>
            </div>

            {/* Days until renewal */}
            <div>
              <label className="block text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-1.5">
                Time Until Rent Is Due
              </label>
              <input
                type="number"
                min={1}
                max={730}
                placeholder="365"
                value={daysLeft}
                onChange={e => setDaysLeft(e.target.value)}
                className={inp}
              />
              <div className="flex gap-2 mt-2 flex-wrap">
                {[
                  { label: '1 month',  days: '30'  },
                  { label: '3 months', days: '90'  },
                  { label: '6 months', days: '180' },
                  { label: '1 year',   days: '365' },
                ].map(q => (
                  <button
                    key={q.days}
                    onClick={() => setDaysLeft(q.days)}
                    className={`px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${
                      daysLeft === q.days
                        ? 'border-teal-500/40 bg-teal-500/10 text-teal-400'
                        : 'border-zinc-800 text-zinc-600 hover:text-zinc-400'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
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
                  type="number"
                  min={0}
                  placeholder="0"
                  value={savedSoFar}
                  onChange={e => setSavedSoFar(e.target.value)}
                  className={`${inp} pl-8`}
                />
              </div>
            </div>
          </div>

          {/* ── Results ─────────────────────────────────────────────────── */}
          {target > 0 && (
            <div className="space-y-4">

              {/* Rent Readiness Score */}
              <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Rent Target</p>
                    <p className="text-xl font-black font-mono text-white">{fmt(target, sym)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Rent Readiness</p>
                    <p className={`text-2xl font-black font-mono ${readiness.color}`}>
                      {funded}% {readiness.emoji}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${readiness.bar}`}
                    style={{ width: `${funded}%` }}
                  />
                </div>

                {/* Readiness label + message */}
                <div className={`flex items-start gap-2 p-3 rounded-xl border ${
                  funded >= 91 ? 'border-green-500/20 bg-green-500/5' :
                  funded >= 61 ? 'border-teal-500/20 bg-teal-500/5' :
                  funded >= 31 ? 'border-amber-500/20 bg-amber-500/5' :
                                 'border-red-500/20 bg-red-500/5'
                }`}>
                  <AlertCircle size={12} className={`${readiness.color} shrink-0 mt-0.5`} />
                  <div>
                    <p className={`text-[9px] font-black uppercase tracking-widest ${readiness.color}`}>
                      {readiness.label}
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">
                      {readiness.message}
                    </p>
                  </div>
                </div>

                {saved > 0 && (
                  <div className="flex justify-between text-[9px] font-mono">
                    <span className="text-teal-400">Saved: {fmt(saved, sym)}</span>
                    <span className="text-zinc-500">Remaining: {fmt(remaining, sym)}</span>
                  </div>
                )}
              </div>

              {/* Savings plan */}
              <div className="p-5 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-teal-400" />
                  <p className="text-[9px] text-teal-400 uppercase font-black tracking-widest">
                    Your Savings Plan
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {[
                    { label: 'Daily',     value: daily,     sub: 'Save this every day'      },
                    { label: 'Weekly',    value: weekly,    sub: 'Save this every week'     },
                    { label: 'Monthly',   value: monthly,   sub: 'Save this every month'    },
                    { label: 'Quarterly', value: quarterly, sub: 'Save this every 3 months' },
                    { label: 'Bi-Annual', value: biannual,  sub: 'Save this every 6 months' },
                  ].map(s => (
                    <div
                      key={s.label}
                      className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/60 border border-zinc-800"
                    >
                      <div>
                        <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{s.label}</p>
                        <p className="text-[9px] text-zinc-600 mt-0.5">{s.sub}</p>
                      </div>
                      <p className="text-xl font-black font-mono text-white">{fmt(s.value, sym)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key insight */}
              <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
                <Calendar size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-amber-400">
                    {days} days to go · {fmt(remaining, sym)} remaining
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                    If you save <strong className="text-white">{fmt(daily, sym)} every day</strong> starting
                    today, you will have your full rent ready in exactly {days} days —
                    without borrowing a single kobo.
                  </p>
                </div>
              </div>

              {/* Viral share block */}
              <div className="p-5 rounded-2xl border border-zinc-700 bg-zinc-900/40 space-y-3">
                <div className="flex items-center gap-2">
                  <Flame size={13} className="text-orange-400" />
                  <p className="text-[9px] text-orange-400 uppercase font-black tracking-widest">
                    Help someone avoid rent stress
                  </p>
                </div>

                {/* Shareable card text */}
                <div className="p-4 rounded-xl border border-zinc-700 bg-black/40 space-y-1 font-mono text-[11px] text-zinc-300 leading-relaxed select-all">
                  <p className="text-white font-black">NO CHOP YOUR RENT™</p>
                  <p>To meet {fmt(target, sym)} rent, I need:</p>
                  <p className="text-teal-400">{fmt(daily, sym)} daily · {fmt(weekly, sym)} weekly · {fmt(monthly, sym)} monthly</p>
                  <p className="text-zinc-500 text-[9px] mt-1">nested-ark-api.vercel.app/rent-vault/calculator</p>
                </div>

                <div className="flex gap-2">
                  {/* Copy button */}
                  <button
                    onClick={handleShare}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${
                      copied
                        ? 'border-green-500/30 bg-green-500/10 text-green-400'
                        : 'border-zinc-700 text-zinc-400 hover:border-teal-500/30 hover:text-teal-400'
                    }`}
                  >
                    {copied
                      ? <><CheckCircle2 size={13} /> Copied!</>
                      : <><Share2 size={13} /> Copy & Share</>
                    }
                  </button>

                  {/* WhatsApp direct share */}
                  <a
                    href={`https://wa.me/?text=${whatsappText}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-green-600/30 bg-green-600/10 text-green-400 font-black text-[10px] uppercase tracking-widest hover:bg-green-600/20 transition-all"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.118.552 4.107 1.517 5.829L.057 23.585a.75.75 0 0 0 .916.906l5.89-1.433A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.723 9.723 0 0 1-4.952-1.354l-.355-.211-3.676.894.928-3.567-.232-.368A9.718 9.718 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
                    </svg>
                    WhatsApp
                  </a>
                </div>

                {wasCopied && (
                  <p className="text-[9px] text-zinc-600 text-center">
                    Paste to WhatsApp, X, Instagram caption, or anywhere — spread the word 🔥
                  </p>
                )}
              </div>

              {/* Primary CTA — no login required here, register on click */}
              <div className="p-5 rounded-2xl border border-teal-500/30 bg-teal-500/8 space-y-3 text-center">
                <div className="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center mx-auto">
                  <PiggyBank size={18} className="text-teal-400" />
                </div>
                <div>
                  <p className="font-black text-sm tracking-tight">
                    Ready to lock in your savings?
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                    Open a Nested Ark Rent Vault. Set {fmt(target, sym)} as your target.
                    Save daily, weekly or monthly — we track every kobo on a SHA-256
                    ledger and release funds to your landlord automatically.
                  </p>
                </div>

                {/* Big CTA — redirects to register, no login needed before this point */}
                <Link
                  href="/register?intent=tenant"
                  className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-teal-500 text-black font-black text-sm uppercase tracking-widest hover:bg-teal-400 transition-all"
                >
                  <PiggyBank size={15} /> Start My Rent Vault — Free
                </Link>

                <p className="text-[9px] text-zinc-700">
                  Free to join · No card required · Start from any amount
                </p>
              </div>
            </div>
          )}

          {/* ── How it works ────────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
              How Nested Ark Rent Vault Works
            </p>
            {[
              { n: '01', t: 'Set your rent target',  b: 'Enter the exact amount your landlord requires. Daily, weekly or monthly — you choose the pace.' },
              { n: '02', t: 'Save gradually',         b: 'Contribute any amount, any time. Every contribution is recorded with a SHA-256 hash on an immutable ledger.' },
              { n: '03', t: 'Track your progress',    b: 'See your vault fill in real-time. Get notified at 25%, 50%, 75% and 100% milestones.' },
              { n: '04', t: 'Pay confidently',        b: 'When your vault reaches 100%, funds release automatically to your landlord. No last-minute stress.' },
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

          {/* ── FAQ ─────────────────────────────────────────────────────── */}
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
                {SCHEMA_FAQ.mainEntity.map(q => (
                  <div key={q.name} className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20">
                    <p className="text-xs font-black mb-2">{q.name}</p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">{q.acceptedAnswer.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Nav links ───────────────────────────────────────────────── */}
          <div className="flex items-center justify-center gap-6 pb-4">
            <Link href="/" className="text-[11px] text-teal-500 font-bold hover:underline flex items-center gap-1">
              ← Home
            </Link>
            <Link
              href="/register?intent=tenant"
              className="text-[11px] text-zinc-500 hover:text-zinc-300 font-bold flex items-center gap-1 transition-colors"
            >
              Open Rent Vault <ArrowRight size={10} />
            </Link>
            <Link
              href="/faq"
              className="text-[11px] text-zinc-500 hover:text-zinc-300 font-bold flex items-center gap-1 transition-colors"
            >
              FAQ <ArrowRight size={10} />
            </Link>
          </div>

        </main>
        <Footer />
      </div>
    </>
  );
}
