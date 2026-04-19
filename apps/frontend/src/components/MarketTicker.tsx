'use client';
/**
 * MarketTicker — Nested Ark OS
 * ─────────────────────────────────────────────────────────────────────────────
 * Sky News / CNN-style broadcast ticker.
 * • Slow, authoritative crawl (55s loop) — feels like live intelligence, not noise
 * • Pause on hover — user can read and click without the text running away
 * • Colour-coded labels: LIVE / ESCROW / GOVT / RATE / PERMIT / AD / LEDGER
 * • Clickable items link to relevant pages
 * • Seamless infinite loop (items doubled, animates to -50%)
 * • Refreshes data from /api/ticker every 30s without interrupting the animation
 */
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

interface TickerItem {
  type: string;
  text: string;
  link?: string;
  sponsor?: string;
}

// ── Label config — each type maps to a colour and short label ─────────────────
const TYPE_META: Record<string, { label: string; labelCls: string; textCls: string }> = {
  INVESTMENT: { label: 'ESCROW',  labelCls: 'bg-emerald-500 text-black',  textCls: 'text-emerald-300' },
  RATE:       { label: 'RATE',    labelCls: 'bg-amber-400  text-black',   textCls: 'text-amber-200'   },
  AD:         { label: 'PARTNER', labelCls: 'bg-purple-500 text-white',   textCls: 'text-purple-300'  },
  LEDGER:     { label: 'LEDGER',  labelCls: 'bg-teal-500   text-black',   textCls: 'text-teal-300'    },
  NEWS:       { label: 'LIVE',    labelCls: 'bg-red-500    text-white',   textCls: 'text-white'       },
  PERMIT:     { label: 'PERMIT',  labelCls: 'bg-blue-500   text-white',   textCls: 'text-blue-200'    },
  GOVT:       { label: 'GOVT',    labelCls: 'bg-blue-600   text-white',   textCls: 'text-blue-200'    },
  MILESTONE:  { label: 'VERIFIED',labelCls: 'bg-teal-500   text-black',   textCls: 'text-teal-300'    },
};

const DEFAULT_META = { label: 'LIVE', labelCls: 'bg-zinc-700 text-zinc-300', textCls: 'text-zinc-300' };

// ── Static fallback items shown before backend responds ───────────────────────
const FALLBACK: TickerItem[] = [
  { type: 'GOVT',   text: 'LASG enforces digital building permits — all Nested Ark projects are fully compliant', link: 'https://thenewsstar.com.ng/lasg-enforces-digital-building-permits-declares-manual-process-illegal/' },
  { type: 'LEDGER', text: 'Tri-Layer Verification live across all active projects — AI + Human + Drone required' },
  { type: 'NEWS',   text: 'Nested Ark OS Pilot Phase active — join the infrastructure revolution' },
  { type: 'RATE',   text: 'USD/NGN 1,379  ·  USD/GBP 0.79  ·  USD/GHS 11.09' },
  { type: 'LEDGER', text: 'SHA-256 hash chain secured — every event immutably recorded' },
  { type: 'NEWS',   text: 'Paystack escrow active — capital held until milestone verified' },
];

export default function MarketTicker() {
  const [items, setItems]       = useState<TickerItem[]>(FALLBACK);
  const [paused, setPaused]     = useState(false);
  const animRef                 = useRef<HTMLDivElement>(null);
  // ── Use a ref so fetchTicker is never re-created, preventing duplicate intervals ──
  const fetchRef = useRef<() => Promise<void>>();

  fetchRef.current = async () => {
    try {
      const res = await api.get('/api/ticker');
      if (res.data.items?.length > 0) setItems(res.data.items);
    } catch { /* silent — fallback items stay */ }
  };

  useEffect(() => {
    // Fire immediately on mount
    fetchRef.current?.();
    // Poll every 60s (was 30s — halved to reduce Render free-tier load)
    const iv = setInterval(() => fetchRef.current?.(), 60_000);
    return () => clearInterval(iv);
  }, []); // ← empty deps: only ever runs once, interval never duplicates

  // Seamless loop: double the items, animate translateX(0 → -50%)
  const display = [...items, ...items];

  return (
    <div
      className="w-full overflow-hidden relative select-none"
      style={{ background: '#000', borderBottom: '1px solid #18181b' }}
    >
      {/* ── Left "NESTED ARK" station ID — fixed, not scrolling ── */}
      <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center pl-3 pr-4"
           style={{ background: 'linear-gradient(to right, #000 70%, transparent)' }}>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Pulsing live dot */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white whitespace-nowrap">
            ARK FEED
          </span>
        </div>
        {/* Hard fade — hides the tail of the scrolling text */}
        <div className="absolute right-0 top-0 bottom-0 w-8"
             style={{ background: 'linear-gradient(to right, transparent, #000)' }} />
      </div>

      {/* ── Right fade ── */}
      <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
           style={{ background: 'linear-gradient(to left, #000 40%, transparent)' }} />

      {/* ── Scrolling track ── */}
      <div className="py-2.5 pl-28 overflow-hidden">
        <div
          ref={animRef}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          className="flex items-center"
          style={{
            width: 'max-content',
            animation: 'ark-ticker 55s linear infinite',
            animationPlayState: paused ? 'paused' : 'running',
          }}
        >
          {display.map((item, idx) => {
            const meta = TYPE_META[item.type] ?? DEFAULT_META;
            const inner = (
              <span
                className={`flex items-center gap-2.5 px-5 whitespace-nowrap group cursor-pointer`}
              >
                {/* Coloured type badge */}
                <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[9px] font-black uppercase tracking-wider flex-shrink-0 ${meta.labelCls}`}>
                  {meta.label}
                </span>
                {/* Item text */}
                <span className={`text-[11px] font-bold tracking-tight ${meta.textCls} group-hover:brightness-125 transition-all`}>
                  {item.sponsor ? <><span className="text-zinc-600 font-normal mr-1">SPONSORED:</span>{item.text}</> : item.text}
                </span>
                {/* Separator dot */}
                <span className="text-zinc-700 ml-3 flex-shrink-0">◆</span>
              </span>
            );

            return item.link ? (
              <Link key={idx} href={item.link} target={item.link.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
                {inner}
              </Link>
            ) : (
              <span key={idx}>{inner}</span>
            );
          })}
        </div>
      </div>

      {/* ── Keyframe injected inline — works with any CSS setup ── */}
      <style>{`
        @keyframes ark-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
