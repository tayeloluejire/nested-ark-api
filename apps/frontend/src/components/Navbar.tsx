'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import MarketTicker from './MarketTicker';
import CurrencySelector from './CurrencySelector';
import ThemeToggle from './ThemeToggle';
import NapSearch from './NapSearch';
import { useCurrency } from '@/hooks/useCurrency';
import {
  Menu, X, LayoutDashboard, Briefcase, PieChart,
  Milestone, LogOut, ChevronRight, ChevronDown, Database,
  Search, TrendingUp, ShieldCheck, Building2, Map, User,
  Home, Globe, HardHat, Landmark, Hammer, Wallet, Gavel,
  Users, Share2, MessageCircle, Copy, Bell, FileText, ArrowRight,
} from 'lucide-react';

// ── Solutions menu items (public-facing, role-based) ─────────────────────────
const SOLUTIONS = [
  {
    href: '/register?role=landlord',
    icon: Home,
    accent: 'text-teal-400',
    bg: 'hover:bg-teal-500/8',
    label: 'Landlords & Property Owners',
    sub: 'Automate rent, Flex-Pay vaults & legal notices',
    suite: ['Tenant Onboarding', 'Notice to Quit Generator', 'Auto Receipting', 'Ejection Proceedings'],
  },
  {
    href: '/register?role=investor',
    icon: TrendingUp,
    accent: 'text-amber-400',
    bg: 'hover:bg-amber-500/8',
    label: 'Investors',
    sub: 'Earn 12% ROI on escrow-backed infrastructure',
  },
  {
    href: '/projects/submit',
    icon: HardHat,
    accent: 'text-blue-400',
    bg: 'hover:bg-blue-500/8',
    label: 'Developers & Builders',
    sub: 'Submit projects, raise capital, manage milestones',
  },
  {
    href: '/register?role=diaspora',
    icon: Globe,
    accent: 'text-rose-400',
    bg: 'hover:bg-rose-500/8',
    label: 'Diaspora Construction',
    sub: 'Fund and track your build remotely from anywhere',
  },
  {
    href: '/register',
    icon: Hammer,
    accent: 'text-zinc-400',
    bg: 'hover:bg-zinc-800',
    label: 'Contractors & Suppliers',
    sub: 'Bid on milestones, get paid on verified completion',
  },
  {
    href: '/register',
    icon: Landmark,
    accent: 'text-purple-400',
    bg: 'hover:bg-purple-500/8',
    label: 'Government & Verifiers',
    sub: 'Approve, verify, and monitor infrastructure projects',
  },
];

// ── Landlord Quick Panel ──────────────────────────────────────────────────────
// Floating dropdown that gives DEVELOPER/landlord role one-click access to
// tenant onboarding, notice generation, and referral sharing.
function LandlordQuickPanel({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [shareTab, setShareTab] = useState<'tenant'|'landlord'>('tenant');

  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://nested-ark-frontend.vercel.app';
  const tenantInviteUrl  = `${BASE_URL}/onboard?ref=landlord`;
  const landlordShareUrl = `${BASE_URL}/register?role=landlord&ref=nested-ark`;

  const copyLink = async (url: string) => {
    try { await navigator.clipboard.writeText(url); } catch { prompt('Copy this link:', url); }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };

  const whatsappShare = (url: string, msg: string) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(msg + '\n' + url)}`, '_blank');
  };

  const emailShare = (url: string, subject: string, body: string) => {
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + '\n\n' + url)}`, '_blank');
  };

  const tenantMsg  = "You've been invited to join as a tenant on Nested Ark. Set up your Flex-Pay vault and manage your tenancy digitally in 60 seconds.";
  const landlordMsg = "Nested Ark OS automates rent collection, legal notices, and tenant onboarding for landlords. Join free and manage your property with zero hassle.";

  return (
    <div className="absolute top-full right-0 mt-2 w-[340px] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-[200]">
      {/* Header */}
      <div className="p-4 border-b border-zinc-900 flex items-center justify-between">
        <div>
          <p className="text-[8px] text-teal-500 uppercase font-black tracking-[0.25em]">Landlord Command</p>
          <p className="text-xs font-bold text-white mt-0.5">Quick Actions</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-600 hover:text-white hover:bg-zinc-800 transition-all"><X size={14} /></button>
      </div>

      {/* Quick nav actions */}
      <div className="p-3 space-y-1 border-b border-zinc-900">
        {[
          { href: '/projects/my',                icon: Building2,    label: 'My Properties',         sub: 'View all project units',             accent: 'text-teal-400',   bg: 'hover:bg-teal-500/8' },
          { href: '/projects/my',                icon: Users,        label: 'Manage Tenants',         sub: 'Onboard, view & manage tenants',    accent: 'text-blue-400',   bg: 'hover:bg-blue-500/8' },
          { href: '/projects/my',                icon: Gavel,        label: 'Issue Legal Notice',     sub: 'Notice to Quit / Pay / Eviction',   accent: 'text-red-400',    bg: 'hover:bg-red-500/8'  },
          { href: '/tenant/dashboard',           icon: FileText,     label: 'View Receipts & Ledger', sub: 'Court-admissible payment history',   accent: 'text-amber-400',  bg: 'hover:bg-amber-500/8'},
        ].map(item => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${item.bg} group`}>
              <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0 group-hover:border-zinc-700">
                <Icon size={13} className={item.accent} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-white">{item.label}</p>
                <p className="text-[9px] text-zinc-600">{item.sub}</p>
              </div>
              <ArrowRight size={11} className="text-zinc-700 group-hover:text-zinc-400 flex-shrink-0" />
            </Link>
          );
        })}
      </div>

      {/* Invite & Share Panel */}
      <div className="p-3">
        <p className="text-[8px] text-zinc-600 uppercase font-black tracking-[0.25em] mb-2">Invite & Share Links</p>

        {/* Tab toggle */}
        <div className="flex gap-1 mb-3 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
          {(['tenant', 'landlord'] as const).map(tab => (
            <button key={tab} onClick={() => setShareTab(tab)}
              className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${shareTab === tab ? 'bg-teal-500 text-black' : 'text-zinc-500 hover:text-white'}`}>
              {tab === 'tenant' ? '🏠 Invite Tenant' : '🤝 Invite Landlord'}
            </button>
          ))}
        </div>

        {shareTab === 'tenant' ? (
          <div className="space-y-2">
            <p className="text-[9px] text-zinc-500 leading-relaxed">Send this link to your tenant — they self-register, sign their digital lease, and activate their Flex-Pay vault in 60 seconds.</p>
            <div className="flex items-center gap-1.5 p-2 bg-zinc-900 border border-zinc-800 rounded-xl font-mono text-[8px] text-zinc-500 truncate">
              <span className="flex-1 truncate">{tenantInviteUrl}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button onClick={() => whatsappShare(tenantInviteUrl, tenantMsg)}
                className="flex flex-col items-center gap-1 py-2 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] rounded-xl text-[8px] font-black uppercase hover:bg-[#25D366]/20 transition-all">
                <MessageCircle size={13} /> WhatsApp
              </button>
              <button onClick={() => emailShare(tenantInviteUrl, 'Your Nested Ark Tenant Invitation', tenantMsg)}
                className="flex flex-col items-center gap-1 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl text-[8px] font-black uppercase hover:bg-blue-500/20 transition-all">
                <Bell size={13} /> Email
              </button>
              <button onClick={() => copyLink(tenantInviteUrl)}
                className={`flex flex-col items-center gap-1 py-2 border rounded-xl text-[8px] font-black uppercase transition-all ${copied ? 'bg-teal-500/20 border-teal-500/40 text-teal-400' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'}`}>
                <Copy size={13} /> {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[9px] text-zinc-500 leading-relaxed">Know another landlord? Share this link — when they sign up, they get instant access to the full Property Suite.</p>
            <div className="flex items-center gap-1.5 p-2 bg-zinc-900 border border-zinc-800 rounded-xl font-mono text-[8px] text-zinc-500 truncate">
              <span className="flex-1 truncate">{landlordShareUrl}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button onClick={() => whatsappShare(landlordShareUrl, landlordMsg)}
                className="flex flex-col items-center gap-1 py-2 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] rounded-xl text-[8px] font-black uppercase hover:bg-[#25D366]/20 transition-all">
                <MessageCircle size={13} /> WhatsApp
              </button>
              <button onClick={() => emailShare(landlordShareUrl, 'Manage Your Properties on Nested Ark', landlordMsg)}
                className="flex flex-col items-center gap-1 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl text-[8px] font-black uppercase hover:bg-blue-500/20 transition-all">
                <Bell size={13} /> Email
              </button>
              <button onClick={() => copyLink(landlordShareUrl)}
                className={`flex flex-col items-center gap-1 py-2 border rounded-xl text-[8px] font-black uppercase transition-all ${copied ? 'bg-teal-500/20 border-teal-500/40 text-teal-400' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'}`}>
                <Copy size={13} /> {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Navbar() {
  const [isOpen,           setIsOpen]           = useState(false);
  const [showSearch,       setShowSearch]       = useState(false);
  const [solutionsOpen,    setSolutionsOpen]    = useState(false);
  const [landlordPanelOpen, setLandlordPanelOpen] = useState(false);
  const solutionsRef   = useRef<HTMLDivElement>(null);
  const landlordRef    = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const { currency, setCurrency } = useCurrency();

  // Close solutions dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (solutionsRef.current && !solutionsRef.current.contains(e.target as Node)) {
        setSolutionsOpen(false);
      }
      if (landlordRef.current && !landlordRef.current.contains(e.target as Node)) {
        setLandlordPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Role-aware authenticated nav links ────────────────────────────────────
  const baseLinks = [
    { name: 'Dashboard',   href: '/dashboard',   icon: LayoutDashboard, roles: ['INVESTOR','CONTRACTOR','SUPPLIER','BANK','GOVERNMENT','ADMIN','VERIFIER','DEVELOPER'] },
    { name: 'Projects',    href: '/projects',    icon: Briefcase,       roles: ['DEVELOPER','GOVERNMENT','CONTRACTOR','SUPPLIER','ADMIN','INVESTOR','VERIFIER','BANK'] },
    { name: 'Investments', href: '/investments', icon: TrendingUp,      roles: ['INVESTOR','ADMIN'] },
    { name: 'My Projects', href: '/projects/my', icon: Building2,       roles: ['DEVELOPER','GOVERNMENT','ADMIN'] },
    { name: 'Tenants',     href: '/projects/my', icon: Users,           roles: ['DEVELOPER'] },
    { name: 'Milestones',  href: '/milestones',  icon: Milestone,       roles: ['GOVERNMENT','DEVELOPER','CONTRACTOR','ADMIN','VERIFIER'] },
    { name: 'Portfolio',   href: '/portfolio',   icon: PieChart,        roles: ['INVESTOR','ADMIN'] },
    { name: 'Ledger',      href: '/ledger',      icon: Database,        roles: ['ADMIN','GOVERNMENT','BANK','INVESTOR','VERIFIER','DEVELOPER'] },
    { name: 'Map',         href: '/map',         icon: Map,             roles: ['INVESTOR','GOVERNMENT','ADMIN','BANK','CONTRACTOR','DEVELOPER','VERIFIER'] },
  ];

  const navLinks = user
    ? baseLinks.filter(l => !l.roles || l.roles.includes(user.role)).slice(0, 5)
    : [];

  return (
    <>
      <MarketTicker />

      <nav className="sticky top-0 z-[100] border-b border-zinc-800 bg-black/80 backdrop-blur-xl px-4 md:px-8 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">

          {/* Logo */}
          <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-3 flex-shrink-0">
            <div className="relative h-8 w-8 flex-shrink-0">
              <Image src="/nested_ark_icon.png" alt="Nested Ark" fill sizes="32px" priority className="object-contain" />
            </div>
            <h1 className="text-sm font-bold tracking-tighter uppercase hidden sm:block">
              Nested Ark <span className="text-teal-500">OS</span>
            </h1>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">

            {/* PUBLIC: Solutions dropdown */}
            {!user && (
              <div className="relative" ref={solutionsRef}>
                <button
                  onClick={() => setSolutionsOpen(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                    solutionsOpen ? 'bg-teal-500/10 text-teal-500' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
                  }`}>
                  Solutions <ChevronDown size={11} className={`transition-transform ${solutionsOpen ? 'rotate-180' : ''}`} />
                </button>

                {solutionsOpen && (
                  <div className="absolute top-full left-0 mt-2 w-[380px] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50">
                    <div className="p-3 border-b border-zinc-900">
                      <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-[0.25em]">Choose your role</p>
                    </div>
                    <div className="p-2">
                      {SOLUTIONS.map(s => {
                        const Icon = s.icon;
                        return (
                          <Link key={s.href + s.label} href={s.href}
                            onClick={() => setSolutionsOpen(false)}
                            className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${s.bg}`}>
                            <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center">
                              <Icon size={15} className={s.accent} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-white">{s.label}</p>
                              <p className="text-[9px] text-zinc-500 mt-0.5">{s.sub}</p>
                              {(s as any).suite && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {(s as any).suite.map((f: string) => (
                                    <span key={f} className="text-[7px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-500 border border-teal-500/20 font-bold uppercase tracking-wide">{f}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <ChevronRight size={12} className="text-zinc-700 ml-auto flex-shrink-0" />
                          </Link>
                        );
                      })}
                    </div>
                    <div className="p-3 border-t border-zinc-900 flex gap-2">
                      <Link href="/explore" onClick={() => setSolutionsOpen(false)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-zinc-800 text-zinc-500 text-[9px] font-bold uppercase tracking-widest hover:border-zinc-600 hover:text-zinc-300 transition-all">
                        <Search size={10} /> Explore Projects
                      </Link>
                      <Link href="/register" onClick={() => setSolutionsOpen(false)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-teal-500 text-black text-[9px] font-black uppercase tracking-widest hover:bg-teal-400 transition-all">
                        Get Started
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Public quick links */}
            {!user && (
              <>
                <Link href="/explore"
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${pathname === '/explore' ? 'bg-teal-500/10 text-teal-500' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}`}>
                  <Search size={12} /> Explore
                </Link>
                <Link href="/landing"
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${pathname === '/landing' ? 'bg-teal-500/10 text-teal-500' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}`}>
                  About
                </Link>
              </>
            )}

            {/* Authenticated nav links */}
            {navLinks.map(link => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
              return (
                <Link key={link.href} href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                    isActive ? 'bg-teal-500/10 text-teal-500' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
                  }`}>
                  <Icon size={13} /> {link.name}
                </Link>
              );
            })}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* Search — authenticated */}
            {user && (showSearch ? (
              <div className="hidden md:flex items-center gap-2">
                <NapSearch mode="inline" compact />
                <button onClick={() => setShowSearch(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button onClick={() => setShowSearch(true)}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-teal-500 hover:border-teal-500/40 text-[10px] font-bold uppercase tracking-widest transition-all">
                <Search size={12} /> Track
              </button>
            ))}

            <ThemeToggle />
            <CurrencySelector currency={currency} onSelect={setCurrency} compact />

            {user && (
              <span className="hidden xl:flex items-center gap-1.5 text-[9px] text-zinc-600 font-mono uppercase max-w-[120px] truncate">
                <User size={9} /> {user.email}
              </span>
            )}

            {/* Landlord quick-panel button — DEVELOPER role only */}
            {user && (user.role === 'DEVELOPER') && (
              <div className="relative" ref={landlordRef}>
                <button
                  onClick={() => setLandlordPanelOpen(v => !v)}
                  title="Landlord Command Centre"
                  className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
                    landlordPanelOpen
                      ? 'bg-teal-500/10 border-teal-500/40 text-teal-400'
                      : 'border-zinc-800 text-zinc-500 hover:border-teal-500/40 hover:text-teal-400'
                  }`}>
                  <Home size={13} /> Landlord
                  <ChevronDown size={10} className={`transition-transform ${landlordPanelOpen ? 'rotate-180' : ''}`} />
                </button>
                {landlordPanelOpen && <LandlordQuickPanel onClose={() => setLandlordPanelOpen(false)} />}
              </div>
            )}

            {/* Public CTA */}
            {!user && (
              <>
                <Link href="/login"
                  className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-800 text-zinc-500 text-[10px] font-bold uppercase tracking-widest hover:border-zinc-600 hover:text-zinc-300 transition-all">
                  Sign In
                </Link>
                <Link href="/register"
                  className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-500 text-black text-[10px] font-black uppercase tracking-widest hover:bg-teal-400 transition-all">
                  Get Started
                </Link>
              </>
            )}

            {user && (
              <button onClick={logout}
                className="hidden md:flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-[10px] font-bold uppercase tracking-tighter text-zinc-500 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all">
                <LogOut size={13} /> Out
              </button>
            )}

            <button onClick={() => setIsOpen(!isOpen)} className="lg:hidden p-2 text-zinc-400 hover:text-teal-500 transition-colors">
              {isOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile full-screen menu */}
      <div className={`fixed inset-0 z-[90] bg-black/96 backdrop-blur-xl transition-all duration-300 lg:hidden ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex flex-col h-full pt-20 px-6 pb-10 overflow-y-auto">

          {/* Identity */}
          <div className="mb-6 px-4 pb-6 border-b border-zinc-800">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
              {user ? 'Operator Terminal' : 'Nested Ark OS'}
            </p>
            <p className="text-white font-medium mt-1">{user?.email ?? 'Infrastructure Protocol'}</p>
            {user?.role && <p className="text-teal-500 text-[10px] uppercase font-bold tracking-widest mt-1">{user.role}</p>}
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <CurrencySelector currency={currency} onSelect={setCurrency} compact={false} />
              <ThemeToggle />
            </div>
            {user && <div className="mt-3"><NapSearch mode="inline" placeholder="Search projects…" /></div>}
          </div>

          <div className="space-y-2 flex-1">
            {/* Public: role entry links */}
            {!user && (
              <>
                <p className="text-[8px] text-zinc-700 uppercase font-bold tracking-[0.25em] px-2 mb-3">Choose Your Path</p>
                {SOLUTIONS.map(s => {
                  const Icon = s.icon;
                  return (
                    <Link key={s.label} href={s.href} onClick={() => setIsOpen(false)}
                      className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 text-white hover:border-zinc-600 transition-all">
                      <div className="flex items-center gap-3">
                        <Icon size={18} className={s.accent} />
                        <div>
                          <span className="text-sm font-bold uppercase tracking-tight block">{s.label}</span>
                          <span className="text-[9px] text-zinc-500">{s.sub}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-zinc-600 flex-shrink-0" />
                    </Link>
                  );
                })}
                <div className="pt-2 space-y-2">
                  <Link href="/explore" onClick={() => setIsOpen(false)}
                    className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800/50 bg-zinc-900/20 text-zinc-400 hover:text-white transition-all">
                    <span className="text-sm font-bold uppercase tracking-tight">Explore Projects</span>
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </>
            )}

            {/* Authenticated links */}
            {user && baseLinks.filter(l => !l.roles || l.roles.includes(user.role)).map(link => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link key={link.href} href={link.href} onClick={() => setIsOpen(false)}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    isActive ? 'bg-teal-500 border-teal-400 text-black' : 'bg-zinc-900/50 border-zinc-800 text-white hover:border-zinc-600'
                  }`}>
                  <div className="flex items-center gap-3"><Icon size={18} /><span className="text-base font-bold uppercase tracking-tight">{link.name}</span></div>
                  <ChevronRight size={16} />
                </Link>
              );
            })}

            {user && [
              { href: '/about', label: 'About' },
              { href: '/kyc', label: 'KYC Verification' },
            ].map(l => (
              <Link key={l.href} href={l.href} onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800/50 bg-zinc-900/20 text-zinc-500 hover:text-white hover:border-zinc-700 transition-all">
                <span className="text-sm font-bold uppercase tracking-tight">{l.label}</span>
                <ChevronRight size={16} />
              </Link>
            ))}
          </div>

          <div className="mt-6 space-y-2">
            {/* Landlord mobile quick-actions */}
            {user?.role === 'DEVELOPER' && (
              <div className="p-4 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-3">
                <p className="text-[8px] text-teal-500 uppercase font-black tracking-[0.25em]">Landlord Command</p>
                <div className="space-y-1.5">
                  {[
                    { href: '/projects/my', icon: Building2,    label: 'My Properties & Units' },
                    { href: '/projects/my', icon: Users,        label: 'Onboard Tenants' },
                    { href: '/projects/my', icon: Gavel,        label: 'Issue Legal Notice' },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.label} href={item.href} onClick={() => setIsOpen(false)}
                        className="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-900/50 text-white hover:border-teal-500/30 transition-all">
                        <div className="flex items-center gap-3">
                          <Icon size={15} className="text-teal-400" />
                          <span className="text-xs font-bold uppercase tracking-tight">{item.label}</span>
                        </div>
                        <ChevronRight size={14} className="text-zinc-600" />
                      </Link>
                    );
                  })}
                </div>
                {/* Mobile share links */}
                <div className="pt-2 border-t border-zinc-800 space-y-2">
                  <p className="text-[8px] text-zinc-600 uppercase font-black tracking-[0.25em]">Share & Invite</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/onboard?ref=landlord`;
                        window.open(`https://wa.me/?text=${encodeURIComponent("You've been invited to join as a tenant on Nested Ark.\n" + url)}`, '_blank');
                      }}
                      className="flex items-center justify-center gap-1.5 py-2.5 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] rounded-xl text-[9px] font-black uppercase">
                      <MessageCircle size={12} /> Invite Tenant
                    </button>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/register?role=landlord&ref=nested-ark`;
                        window.open(`https://wa.me/?text=${encodeURIComponent("Manage your property on Nested Ark.\n" + url)}`, '_blank');
                      }}
                      className="flex items-center justify-center gap-1.5 py-2.5 bg-teal-500/10 border border-teal-500/30 text-teal-400 rounded-xl text-[9px] font-black uppercase">
                      <Share2 size={12} /> Invite Landlord
                    </button>
                  </div>
                </div>
              </div>
            )}
            {user?.role === 'ADMIN' && (
              <Link href="/admin" onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400">
                <span className="text-sm font-bold uppercase">Admin Command Center</span>
                <ChevronRight size={16} />
              </Link>
            )}
            {user ? (
              <button onClick={() => { logout(); setIsOpen(false); }}
                className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 font-bold uppercase text-xs tracking-[0.2em]">
                <LogOut size={16} /> Terminate Session
              </button>
            ) : (
              <div className="flex gap-2">
                <Link href="/login" onClick={() => setIsOpen(false)}
                  className="flex-1 flex items-center justify-center py-4 rounded-2xl border border-zinc-800 text-zinc-400 font-bold uppercase text-xs tracking-widest hover:border-zinc-600 transition-all">
                  Sign In
                </Link>
                <Link href="/register" onClick={() => setIsOpen(false)}
                  className="flex-1 flex items-center justify-center py-4 rounded-2xl bg-teal-500 text-black font-black uppercase text-xs tracking-widest hover:bg-teal-400 transition-all">
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
