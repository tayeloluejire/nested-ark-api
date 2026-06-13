'use client';

/**
 * /rent-vault/calculator/page.tsx
 * Rent Savings Calculator — highest-intent SEO page
 * Target keywords: "how much should I save for rent per month Nigeria"
 *                  "annual rent savings calculator"
 *                  "rent target calculator Nigeria"
 * No backend needed. Pure client-side math.
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  PiggyBank, Calendar, TrendingUp, ArrowRight,
  CheckCircle2, Share2, RefreshCw, ChevronDown,
} from 'lucide-react';

// ── Schema ────────────────────────────────────────────────────────────────────
const SCHEMA_CALCULATOR = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Nested Ark Rent Savings Calculator',
  description: 'Calculate exactly how much you need to save daily, weekly or monthly to meet your annual rent target in Nigeria, Ghana, Kenya or the UK.',
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
      acceptedAnswer: { '@type': 'Answer', text: 'Divide your annual rent amount by the number of days until renewal. For example, ₦1,200,000 annual rent ÷ 365 days = ₦3,288 per day. Use the Nested Ark Rent Savings Calculator above for a precise breakdown.' },
    },
    {
      '@type': 'Question',
      name: 'How can I save for annual rent without borrowing?',
      acceptedAnswer: { '@type': 'Answer', text: 'Open a Nested Ark Rent Vault, set your annual rent amount as your target, then choose a daily, weekly or monthly contribution amount. The vault tracks your progress automatically and releases funds to your landlord when the target is reached.' },
    },
    {
      '@type': 'Question',
      name: 'What is a good monthly savings amount for rent in Lagos?',
      acceptedAnswer: { '@type': 'Answer', text: 'For a typical Lagos annual rent of ₦600,000, you need to save ₦50,000 per month to be ready in 12 months. For ₦1,200,000 annual rent, that is ₦100,000 per month. The calculator adjusts based on your specific target and timeline.' },
    },
  ],
};

// ── Currency config ───────────────────────────────────────────────────────────
const CURRENCIES = [
  { code: 'NGN', symbol: '₦',   name: 'Nigerian Naira',    exampleRent: 600000,  flag: '🇳🇬' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi',     exampleRent: 18000,   flag: '🇬🇭' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling',   exampleRent: 180000,  flag: '🇰🇪' },
  { code: 'GBP', symbol: '£',   name: 'British Pound',     exampleRent: 12000,   flag: '🇬🇧' },
  { code: 'USD', symbol: '$',   name: 'US Dollar',         exampleRent: 18000,   flag: '🌍' },
];

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
  const [rentAmount, setRentAmount] = useState('600000');
  const [daysLeft,   setDaysLeft]   = useState('365');
  const [savedSoFar, setSavedSoFar] = useState('0');
  const [showFAQ,    setShowFAQ]    = useState(false);
  const [copied,     setCopied]     = useState(false);

  // ── Core calculations ─────────────────────────────────────────────────────
  const target    = parseFloat(rentAmount)  || 0;
  const days      = parseInt(daysLeft)      || 365;
  const saved     = parseFloat(savedSoFar)  || 0;
  const remaining = Math.max(target - saved, 0);
  const funded    = pct(saved, target);

  const daily     = days > 0 ? remaining / days              : 0;
  const weekly    = days > 0 ? remaining / (days / 7)        : 0;
  const monthly   = days > 0 ? remaining / (days / 30.44)    : 0;
  const biannual  = days > 0 ? remaining / (days / 182)      : 0;
  const quarterly = days > 0 ? remaining / (days / 91)       : 0;

  const sym = currency.symbol;

  const handleShare = useCallback(() => {
    const text = `I need to save ${fmt(remaining, sym)} for rent. Here's my plan: ${fmt(daily, sym)}/day · ${fmt(weekly, sym)}/week · ${fmt(monthly, sym)}/month. Calculate yours: https://nested-ark-api.vercel.app/rent-vault/calculator`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
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

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-teal-400">
                Free Tool · No Login Required
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter">
              Rent Savings Calculator
            </h1>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Enter your annual rent amount and we&apos;ll tell you exactly how much to save
              daily, weekly or monthly — so you never have to borrow for rent again.
            </p>
          </div>

          {/* ── Currency selector ───────────────────────────────────────── */}
          <div>
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-2">Your Currency</p>
            <div className="flex flex-wrap gap-2">
              {CURRENCIES.map(c => (
                <button key={c.code} onClick={() => { setCurrency(c); setRentAmount(String(c.exampleRent)); }}
                  className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                    currency.code === c.code
                      ? 'border-teal-500/50 bg-teal-500/10 text-teal-400'
                      : 'border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                  }`}>
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
                This is the total rent you need to pay your landlord
              </p>
            </div>

            {/* Days until renewal */}
            <div>
              <label className="block text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-1.5">
                Days Until Rent Is Due
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
                  <button key={q.days} onClick={() => setDaysLeft(q.days)}
                    className={`px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${
                      daysLeft === q.days
                        ? 'border-teal-500/40 bg-teal-500/10 text-teal-400'
                        : 'border-zinc-800 text-zinc-600 hover:text-zinc-400'
                    }`}>
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

              {/* Progress bar */}
              <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Rent Target</p>
                    <p className="text-xl font-black font-mono text-white">{fmt(target, sym)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Progress</p>
                    <p className={`text-2xl font-black font-mono ${funded >= 100 ? 'text-green-400' : funded >= 50 ? 'text-amber-400' : 'text-teal-400'}`}>
                      {funded}%
                    </p>
                  </div>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      funded >= 100 ? 'bg-green-500' : funded >= 50 ? 'bg-amber-500' : 'bg-teal-500'
                    }`}
                    style={{ width: `${funded}%` }}
                  />
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
                    { label: 'Daily',      value: daily,    sub: 'Save this every day'       },
                    { label: 'Weekly',     value: weekly,   sub: 'Save this every week'      },
                    { label: 'Monthly',    value: monthly,  sub: 'Save this every month'     },
                    { label: 'Quarterly',  value: quarterly,sub: 'Save this every 3 months'  },
                    { label: 'Bi-Annual',  value: biannual, sub: 'Save this every 6 months'  },
                  ].map(s => (
                    <div key={s.label}
                      className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                      <div>
                        <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{s.label}</p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">{s.sub}</p>
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

              {/* Share button */}
              <button onClick={handleShare}
                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${
                  copied
                    ? 'border-green-500/30 bg-green-500/10 text-green-400'
                    : 'border-zinc-700 text-zinc-400 hover:border-teal-500/30 hover:text-teal-400'
                }`}>
                {copied ? <><CheckCircle2 size={13} /> Plan Copied!</> : <><Share2 size={13} /> Share My Savings Plan</>}
              </button>

              {/* CTA to create vault */}
              <div className="p-5 rounded-2xl border border-teal-500/30 bg-teal-500/8 space-y-3 text-center">
                <div className="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center mx-auto">
                  <PiggyBank size={18} className="text-teal-400" />
                </div>
                <div>
                  <p className="font-black text-sm tracking-tight">
                    Ready to start saving?
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                    Open a Nested Ark Rent Vault. Set this amount as your target.
                    Track every contribution on a SHA-256 ledger. Pay your landlord
                    on time — without borrowing.
                  </p>
                </div>
                <Link href="/register?intent=tenant"
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-teal-500 text-black font-black text-[10px] uppercase tracking-widest hover:bg-teal-400 transition-all">
                  <PiggyBank size={13} /> Open My Rent Vault — Free
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
              { n: '01', t: 'Set your rent target',   b: 'Enter the exact amount your landlord requires. Daily, weekly or monthly — you choose the pace.' },
              { n: '02', t: 'Save gradually',          b: 'Contribute any amount, any time. Every contribution is recorded with a SHA-256 hash on an immutable ledger.' },
              { n: '03', t: 'Track your progress',     b: 'See your vault fill in real-time. Get notified at 25%, 50%, 75% and 100% milestones.' },
              { n: '04', t: 'Pay confidently',         b: 'When your vault reaches 100%, funds release automatically to your landlord. No last-minute stress.' },
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
            <button onClick={() => setShowFAQ(!showFAQ)}
              className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border border-zinc-800 hover:bg-zinc-900/40 transition-colors">
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
            <Link href="/register?intent=tenant"
              className="text-[11px] text-zinc-500 hover:text-zinc-300 font-bold flex items-center gap-1 transition-colors">
              Open Rent Vault <ArrowRight size={10} />
            </Link>
            <Link href="/faq"
              className="text-[11px] text-zinc-500 hover:text-zinc-300 font-bold flex items-center gap-1 transition-colors">
              FAQ <ArrowRight size={10} />
            </Link>
          </div>

        </main>
        <Footer />
      </div>
    </>
  );
}
