'use client';
import { useState } from 'react';
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
  Milestone, LogOut, ChevronRight, Database, Search,
  TrendingUp, ShieldCheck, Building2, Map, User
} from 'lucide-react';

export default function Navbar() {
  const [isOpen,     setIsOpen]     = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const { currency, setCurrency } = useCurrency();

  // ── Role-aware nav links ───────────────────────────────────────────────────
  const baseLinks = [
    { name: 'Dashboard',   href: '/dashboard',   icon: LayoutDashboard,
      roles: ['INVESTOR','CONTRACTOR','SUPPLIER','BANK','GOVERNMENT','ADMIN','VERIFIER','DEVELOPER'] },
    { name: 'Projects',    href: '/projects',    icon: Briefcase,
      roles: ['DEVELOPER','GOVERNMENT','CONTRACTOR','SUPPLIER','ADMIN','INVESTOR','VERIFIER','BANK'] },
    { name: 'Investments', href: '/investments', icon: TrendingUp,
      roles: ['INVESTOR','ADMIN'] },
    { name: 'My Projects', href: '/projects/my', icon: Building2,
      roles: ['DEVELOPER','GOVERNMENT','ADMIN'] },
    { name: 'Milestones',  href: '/milestones',  icon: Milestone,
      roles: ['GOVERNMENT','DEVELOPER','CONTRACTOR','ADMIN','VERIFIER'] },
    { name: 'Portfolio',   href: '/portfolio',   icon: PieChart,
      roles: ['INVESTOR','ADMIN'] },
    { name: 'Ledger',      href: '/ledger',      icon: Database,
      roles: ['ADMIN','GOVERNMENT','BANK','INVESTOR','VERIFIER','DEVELOPER'] },
    { name: 'Map',         href: '/map',         icon: Map,
      roles: ['INVESTOR','GOVERNMENT','ADMIN','BANK','CONTRACTOR','DEVELOPER','VERIFIER'] },
  ];

  // Filter to max 5 links based on user role, prioritising the most relevant
  const navLinks = user
    ? baseLinks.filter(l => !l.roles || l.roles.includes(user.role)).slice(0, 5)
    : baseLinks.slice(0, 5);

  return (
    <>
      <MarketTicker />

      <nav className="sticky top-0 z-[100] border-b border-zinc-800 bg-black/80 backdrop-blur-xl px-4 md:px-8 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">

          {/* Logo */}
          <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-3 flex-shrink-0">
            <div className="relative h-8 w-8 flex-shrink-0">
              <Image src="/nested_ark_icon.png" alt="Nested Ark Logo" fill sizes="32px" priority className="object-contain" />
            </div>
            <h1 className="text-sm font-bold tracking-tighter uppercase hidden sm:block">
              Nested Ark <span className="text-teal-500">OS</span>
            </h1>
          </Link>

          {/* Desktop nav links — role-aware */}
          <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
            {navLinks.map(link => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
              return (
                <Link key={link.href} href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-teal-500/10 text-teal-500'
                      : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
                  }`}>
                  <Icon size={13} /> {link.name}
                </Link>
              );
            })}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* Inline NAP search — desktop */}
            {showSearch ? (
              <div className="hidden md:flex items-center gap-2">
                <NapSearch mode="inline" compact />
                <button onClick={() => setShowSearch(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button onClick={() => setShowSearch(true)}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-teal-500 hover:border-teal-500/40 text-[10px] font-bold uppercase tracking-widest transition-all">
                <Search size={12} /> Track Project
              </button>
            )}

            <ThemeToggle />
            <CurrencySelector currency={currency} onSelect={setCurrency} compact />

            {user && (
              <span className="hidden xl:flex items-center gap-1.5 text-[9px] text-zinc-600 font-mono uppercase max-w-[120px] truncate">
                <User size={9} /> {user.email}
              </span>
            )}

            <button onClick={logout}
              className="hidden md:flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-[10px] font-bold uppercase tracking-tighter text-zinc-500 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all">
              <LogOut size={13} /> Out
            </button>

            <button onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden p-2 text-zinc-400 hover:text-teal-500 transition-colors">
              {isOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile full-screen menu */}
      <div className={`fixed inset-0 z-[90] bg-black/95 backdrop-blur-xl transition-all duration-300 lg:hidden ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex flex-col h-full pt-20 px-6 pb-10 overflow-y-auto">

          {/* User identity */}
          <div className="mb-6 px-4 pb-6 border-b border-zinc-800">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">Operator Terminal</p>
            <p className="text-white font-medium mt-1">{user?.email ?? 'Guest'}</p>
            {user?.role && (
              <p className="text-teal-500 text-[10px] uppercase font-bold tracking-widest mt-1">
                {user.role}
              </p>
            )}
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <CurrencySelector currency={currency} onSelect={setCurrency} compact={false} />
              <ThemeToggle />
            </div>
            {/* Mobile NAP search */}
            <div className="mt-3">
              <NapSearch mode="inline" placeholder="Search projects…" />
            </div>
          </div>

          {/* All nav links — mobile shows all relevant ones */}
          <div className="space-y-2 flex-1">
            {baseLinks
              .filter(l => !user || !l.roles || l.roles.includes(user.role))
              .map(link => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link key={link.href} href={link.href} onClick={() => setIsOpen(false)}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      isActive
                        ? 'bg-teal-500 border-teal-400 text-black'
                        : 'bg-zinc-900/50 border-zinc-800 text-white hover:border-zinc-600'
                    }`}>
                    <div className="flex items-center gap-3">
                      <Icon size={18} />
                      <span className="text-base font-bold uppercase tracking-tight">{link.name}</span>
                    </div>
                    <ChevronRight size={16} />
                  </Link>
                );
              })}

            {/* Extra mobile links */}
            {[
              { href: '/about',   label: 'About' },
              { href: '/kyc',     label: 'KYC Verification' },
              { href: '/landing', label: 'Platform Overview' },
            ].map(l => (
              <Link key={l.href} href={l.href} onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800/50 bg-zinc-900/20 text-zinc-500 hover:text-white hover:border-zinc-700 transition-all">
                <span className="text-sm font-bold uppercase tracking-tight">{l.label}</span>
                <ChevronRight size={16} />
              </Link>
            ))}
          </div>

          <div className="mt-6 space-y-2">
            {user?.role === 'ADMIN' && (
              <Link href="/admin" onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400">
                <span className="text-sm font-bold uppercase">Admin Command Center</span>
                <ChevronRight size={16} />
              </Link>
            )}
            <button onClick={() => { logout(); setIsOpen(false); }}
              className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 font-bold uppercase text-xs tracking-[0.2em]">
              <LogOut size={16} /> Terminate Session
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
