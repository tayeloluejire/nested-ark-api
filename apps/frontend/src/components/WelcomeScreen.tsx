'use client';
/**
 * components/WelcomeScreen.tsx
 * Role-aware welcome overlay shown once after registration.
 * Dismissed by clicking CTA or X. Stores dismissal in localStorage
 * so it only shows once per user session.
 *
 * Usage: mount in register/page.tsx after successful registration,
 * or in tenant/dashboard + landlord/dashboard on first visit.
 *
 * Props:
 *   name     — first name of user
 *   role     — 'TENANT' | 'LANDLORD' | 'INVESTOR' | other
 *   onDismiss — called when user clicks CTA or X
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  X, Wallet, Building2, TrendingUp, ShieldCheck,
  ArrowRight, CheckCircle2, Globe,
} from 'lucide-react';

interface WelcomeScreenProps {
  name:      string;
  role:      string;
  onDismiss: () => void;
}

// ── Role config ───────────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<string, {
  emoji:    string;
  headline: string;
  sub:      string;
  features: string[];
  steps:    { n: string; t: string }[];
  cta:      string;
  ctaHref:  string;
  color:    string;
  border:   string;
  icon:     React.ElementType;
}> = {
  TENANT: {
    emoji:   '🔑',
    headline:'Your Rent Journey Starts Here',
    sub:     'You now have a personal Flex-Pay vault. Save gradually, pay stress-free.',
    features:[
      'Create a Rent Vault for your next payment',
      'Contribute weekly or monthly — no lump sum pressure',
      'Every payment SHA-256 hashed & court-admissible',
      'Auto-disbursement to landlord when target is reached',
      'Portable tenant score across properties',
    ],
    steps: [
      { n:'01', t:'Initialize your Rent Vault' },
      { n:'02', t:'Set your rent target amount'  },
      { n:'03', t:'Choose your payment rhythm'   },
      { n:'04', t:'Start contributing today'     },
    ],
    cta:    'Create My Rent Vault',
    ctaHref:'/tenant/vault',
    color:  'text-green-400',
    border: 'border-green-500/20',
    icon:   Wallet,
  },
  LANDLORD: {
    emoji:   '🏠',
    headline:'Welcome to the Landlord Network',
    sub:     'Automate rent collection, manage tenants, and receive payouts on autopilot.',
    features:[
      'List properties and invite tenants instantly',
      'Flex-Pay vaults bridge the annual rent gap',
      'Auto legal notices: 30-day → 7-day → 48h overdue',
      'Paystack-automated payout to your bank account',
      'SHA-256 receipts — court-admissible evidence trail',
    ],
    steps: [
      { n:'01', t:'Add your bank account for payouts' },
      { n:'02', t:'List your first property'          },
      { n:'03', t:'Invite tenants via WhatsApp link'  },
      { n:'04', t:'Automated rent collection begins'  },
    ],
    cta:    'Add My First Property',
    ctaHref:'/projects/my',
    color:  'text-teal-400',
    border: 'border-teal-500/20',
    icon:   Building2,
  },
  DEVELOPER: {
    emoji:   '🏠',
    headline:'Welcome to the Landlord Network',
    sub:     'Automate rent collection, manage tenants, and receive payouts on autopilot.',
    features:[
      'List properties and invite tenants instantly',
      'Flex-Pay vaults bridge the annual rent gap',
      'Auto legal notices: 30-day → 7-day → 48h overdue',
      'Paystack-automated payout to your bank account',
      'SHA-256 receipts — court-admissible evidence trail',
    ],
    steps: [
      { n:'01', t:'Add your bank account for payouts' },
      { n:'02', t:'List your first property'          },
      { n:'03', t:'Invite tenants via WhatsApp link'  },
      { n:'04', t:'Automated rent collection begins'  },
    ],
    cta:    'Add My First Property',
    ctaHref:'/projects/my',
    color:  'text-teal-400',
    border: 'border-teal-500/20',
    icon:   Building2,
  },
  INVESTOR: {
    emoji:   '💼',
    headline:'Welcome to the Infrastructure Exchange',
    sub:     'Participate in market-linked infrastructure yields with escrow-protected capital.',
    features:[
      'Browse verified NAP infrastructure projects',
      'Capital held in programmable milestone escrow',
      'Benchmark-linked returns — no speculative promises',
      'Tri-Layer verification: AI + human + drone',
      'Real-time dashboard and SHA-256 receipts',
    ],
    steps: [
      { n:'01', t:'Browse verified projects'       },
      { n:'02', t:'Commit capital to escrow'       },
      { n:'03', t:'Track milestone verification'   },
      { n:'04', t:'Receive benchmark-linked yield' },
    ],
    cta:    'Browse Infrastructure Projects',
    ctaHref:'/investments',
    color:  'text-amber-400',
    border: 'border-amber-500/20',
    icon:   TrendingUp,
  },
  DEFAULT: {
    emoji:   '🌍',
    headline:'Welcome to Nested Ark OS',
    sub:     'Global infrastructure and housing operating system.',
    features:[
      'Escrow-protected capital infrastructure',
      'SHA-256 immutable ledger receipts',
      'Paystack-powered automated payouts',
      'Real-time dashboards and milestone tracking',
    ],
    steps: [
      { n:'01', t:'Complete your profile' },
      { n:'02', t:'Explore the platform'  },
    ],
    cta:    'Explore Platform',
    ctaHref:'/dashboard',
    color:  'text-teal-400',
    border: 'border-teal-500/20',
    icon:   Globe,
  },
};

const STORAGE_KEY = 'nested_ark_welcome_dismissed';

export default function WelcomeScreen({ name, role, onDismiss }: WelcomeScreenProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show once per account creation — check localStorage
    const dismissed = localStorage.getItem(`${STORAGE_KEY}_${role}`);
    if (!dismissed) setVisible(true);
  }, [role]);

  const dismiss = () => {
    localStorage.setItem(`${STORAGE_KEY}_${role}`, '1');
    setVisible(false);
    onDismiss();
  };

  if (!visible) return null;

  const cfg  = ROLE_CONFIG[role.toUpperCase()] || ROLE_CONFIG.DEFAULT;
  const Icon = cfg.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md px-0 sm:px-6">
      <div className={`w-full sm:max-w-lg bg-zinc-950 border-t sm:border ${cfg.border} rounded-t-3xl sm:rounded-3xl max-h-[95vh] overflow-y-auto`}>

        {/* Header */}
        <div className="relative p-6 pb-0">
          <button onClick={dismiss}
            className="absolute top-5 right-5 p-2 rounded-xl bg-zinc-900 text-zinc-500 hover:text-white transition-colors">
            <X size={15} />
          </button>
          {/* Animated pulse badge */}
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span className="text-[9px] text-teal-500 font-black uppercase tracking-[0.25em]">
              Nested Ark OS · Account Active
            </span>
          </div>
          <div className="flex items-start gap-4 mb-6">
            <div className={`w-12 h-12 rounded-2xl bg-zinc-900 border ${cfg.border} flex items-center justify-center flex-shrink-0 text-2xl`}>
              {cfg.emoji}
            </div>
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${cfg.color}`}>
                Welcome, {name}!
              </p>
              <h2 className="text-xl font-black uppercase tracking-tight leading-tight">
                {cfg.headline}
              </h2>
              <p className="text-zinc-500 text-xs mt-1 leading-relaxed">{cfg.sub}</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-5">

          {/* Features */}
          <div className={`p-4 rounded-2xl border ${cfg.border} bg-zinc-900/20 space-y-2`}>
            <p className={`text-[8px] uppercase font-black tracking-widest ${cfg.color} mb-3`}>
              With Nested Ark, you can:
            </p>
            {cfg.features.map((f, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 size={12} className={`${cfg.color} shrink-0 mt-0.5`} />
                <p className="text-[11px] text-zinc-400 leading-relaxed">{f}</p>
              </div>
            ))}
          </div>

          {/* Steps */}
          <div className="space-y-2">
            <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">
              Your next steps:
            </p>
            {cfg.steps.map((s, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-zinc-800/60 last:border-0">
                <span className={`text-[9px] font-black font-mono ${cfg.color} w-6 shrink-0`}>{s.n}</span>
                <p className="text-[11px] text-zinc-300">{s.t}</p>
                {i === 0 && (
                  <span className="ml-auto text-[7px] text-teal-500 border border-teal-500/30 px-1.5 py-0.5 rounded font-black uppercase">
                    Start here
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Trust strip */}
          <div className="flex flex-wrap gap-2">
            {[
              <><ShieldCheck size={9}/> Paystack-secured</>,
              <><CheckCircle2 size={9}/> SHA-256 receipts</>,
              <><Globe size={9}/> 12+ Countries</>,
            ].map((b, i) => (
              <span key={i} className="flex items-center gap-1 text-[8px] text-teal-500 border border-teal-500/20 bg-teal-500/5 px-2.5 py-1.5 rounded-lg font-bold uppercase tracking-widest">
                {b}
              </span>
            ))}
          </div>

          {/* CTA */}
          <Link href={cfg.ctaHref} onClick={dismiss}
            className="flex items-center justify-center gap-2 w-full py-4 bg-teal-500 text-black font-black text-xs uppercase rounded-xl hover:bg-teal-400 transition-all tracking-widest active:scale-[0.99]">
            <Icon size={14} />
            {cfg.cta}
            <ArrowRight size={13} />
          </Link>

          <button onClick={dismiss}
            className="w-full py-2.5 text-zinc-600 text-[10px] uppercase font-bold hover:text-zinc-400 transition-colors">
            Skip for now — explore dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
