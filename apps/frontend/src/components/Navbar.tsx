'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import NapSearch from '@/components/NapSearch';
import BrandLogo from '@/components/BrandLogo';
import ThemeToggle from '@/components/ThemeToggle';
import {
  LayoutDashboard, Briefcase, TrendingUp, Building2, Users,
  Home, HardHat, ShieldCheck, Gavel, Receipt, FileText,
  LogOut, Menu, X, ChevronDown, ChevronRight,
  Globe, Wallet, User, Bell, Settings,
  DollarSign, MapPin, BookOpen, Layers, Landmark,
  BarChart3, ShoppingBag, Archive, Edit3,
} from 'lucide-react';

// ── Solutions mega-menu data ──────────────────────────────────────────────────
const SOLUTIONS = [
  {
    // PROPERTY TOOL — routes to /onboard (Register New Property)
    href: '/onboard',
    icon: Home,
    accent: 'text-teal-400',
    bg: 'hover:bg-teal-500/8',
    label: 'Landlords & Property Owners',
    sub: 'Automate rent, Flex-Pay vaults & legal notices',
    suite: ['Tenant Onboarding', 'Notice to Quit Generator', 'Auto Receipting', 'Ejection Proceedings'],
  },
  {
    // NAP INFRASTRUCTURE LEDGER — routes to /projects/submit
    href: '/projects/submit',
    icon: HardHat,
    accent: 'text-blue-400',
    bg: 'hover:bg-blue-500/8',
    label: 'Developers & Builders',
    sub: 'Submit projects, raise capital, manage milestones',
    suite: ['NAP Project ID', 'Milestone Escrow', 'Contractor Bidding', 'Diaspora Tracking'],
  },
  {
    href: '/investments',
    icon: Wallet,
    accent: 'text-amber-400',
    bg: 'hover:bg-amber-500/8',
    label: 'Investors',
    sub: 'Fractional infrastructure investment with yield tracking',
    suite: ['Fractional Shares', 'Yield Engine', 'Rental Income', 'Exit Liquidity'],
  },
  {
    href: '/gov',
    icon: Globe,
    accent: 'text-purple-400',
    bg: 'hover:bg-purple-500/8',
    label: 'Government & Regulators',
    sub: 'Oversight dashboards, permit verification & compliance',
    suite: ['Permit Registry', 'Compliance Dashboard', 'AML Reporting', 'Asset Inventory'],
  },
  {
    href: '/faq',
    icon: BookOpen,
    accent: 'text-zinc-400',
    bg: 'hover:bg-zinc-800/60',
    label: 'Help & FAQ',
    sub: 'Answers for tenants, landlords, investors & diaspora',
    suite: ['Tenant Guide', 'Escrow Explained', 'Payment FAQs', 'Legal Notices'],
  },
];

// ── Landlord quick panel (sidebar dropdown) ───────────────────────────────────
function LandlordQuickPanel({ onClose }: { onClose: () => void }) {
  const ITEMS = [
    {
      // PROPERTY TOOL entry point — separate from NAP Ledger
      href: '/onboard',
      icon: Home,
      label: 'Add New Property',
      sub: 'Register apartments & rental units',
      accent: 'text-teal-400',
      bg: 'hover:bg-teal-500/10',
    },
    {
      href: '/landlord/tenants',
      icon: Users,
      label: 'Manage Tenants',
      sub: 'Onboard, view & manage tenants',
      accent: 'text-blue-400',
      bg: 'hover:bg-blue-500/10',
    },
    {
      href: '/landlord/notices',
      icon: Gavel,
      label: 'Legal Notices',
      sub: 'Issue & track formal notices',
      accent: 'text-red-400',
      bg: 'hover:bg-red-500/10',
    },
    {
      href: '/landlord/receipts',
      icon: Receipt,
      label: 'Receipts & Ledger',
      sub: 'Payment history per property',
      accent: 'text-amber-400',
      bg: 'hover:bg-amber-500/10',
    },
    {
      // Payout Engine — required for rent to reach landlord bank account
      href: '/landlord/bank',
      icon: Landmark,
      label: 'Bank Accounts',
      sub: 'Payout engine · Rent auto-transfers here',
      accent: 'text-teal-400',
      bg: 'hover:bg-teal-500/10',
      badge: 'Payout Engine',
    },
    {
      // Yield Engine — live rent intelligence across all properties
      href: '/landlord/rent-dashboard',
      icon: BarChart3,
      label: 'Rent Dashboard',
      sub: 'Live vault status, overdue alerts & rent roll',
      accent: 'text-teal-400',
      bg: 'hover:bg-teal-500/10',
      badge: 'Yield Engine',
    },
    {
      // Inventory Matrix — manage, edit & advertise all units
      href: '/landlord/inventory',
      icon: Archive,
      label: 'Inventory Matrix',
      sub: 'Edit, advertise & manage vacant units',
      accent: 'text-amber-400',
      bg: 'hover:bg-amber-500/10',
    },
    {
      // Unit Editor — upload images, edit specs & update individual units
      href: '/landlord/inventory/editor',
      icon: Edit3,
      label: 'Unit Editor',
      sub: 'Upload photos, edit specs & update listings',
      accent: 'text-amber-400',
      bg: 'hover:bg-amber-500/10',
      badge: 'Edit & Upload',
    },
    {
      // Marketplace — public rental listings board
      href: '/marketplace',
      icon: ShoppingBag,
      label: 'Property Marketplace',
      sub: 'View advertised listings & find tenants',
      accent: 'text-blue-400',
      bg: 'hover:bg-blue-500/10',
    },
    {
      // NAP Ledger — clearly labeled separately
      href: '/projects/my',
      icon: Building2,
      label: 'NAP Infrastructure Projects',
      sub: 'Projects on the global ledger',
      accent: 'text-zinc-400',
      bg: 'hover:bg-zinc-800/60',
    },
  ];

  return (
    <div className="absolute right-0 top-full mt-2 w-72 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/70 z-[300] overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-900">
        <p className="text-[9px] text-teal-500 font-black uppercase tracking-widest">Landlord Command</p>
      </div>
      <div className="p-2 space-y-0.5">
        {ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${item.bg}`}
            >
              <Icon size={16} className={`${item.accent} shrink-0`} />
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-black uppercase ${item.accent}`}>{item.label}</p>
                <p className="text-[9px] text-zinc-600">{item.sub}</p>
              </div>
              {'badge' in item && item.badge && (
                <span className="text-[7px] px-1.5 py-0.5 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded font-black uppercase shrink-0">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Solutions mega-menu ───────────────────────────────────────────────────────
function SolutionsMenu({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[680px] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/70 z-[300] overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-900 flex items-center justify-between">
        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Solutions by Role</p>
        <button onClick={onClose} className="text-zinc-700 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-px bg-zinc-900 p-0">
        {SOLUTIONS.slice(0, 4).map(s => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              onClick={onClose}
              className={`flex gap-4 p-5 bg-zinc-950 ${s.bg} transition-colors group`}
            >
              <div className={`w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 group-hover:border-current transition-colors ${s.accent}`}>
                <Icon size={16} />
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-black uppercase ${s.accent}`}>{s.label}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{s.sub}</p>
                {s.suite && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {s.suite.map(tag => (
                      <span key={tag} className="text-[7px] font-bold uppercase tracking-wide bg-zinc-900 border border-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
      {/* FAQ full-width footer row */}
      {(() => { const faq = SOLUTIONS[4]; const Icon = faq.icon; return (
        <Link href={faq.href} onClick={onClose}
          className={`flex items-center gap-4 px-5 py-3 bg-zinc-950 border-t border-zinc-900 ${faq.bg} transition-colors group`}>
          <div className={`w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 ${faq.accent}`}>
            <Icon size={13} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] font-black uppercase ${faq.accent}`}>{faq.label}</p>
            <p className="text-[9px] text-zinc-600">{faq.sub}</p>
          </div>
          <div className="flex gap-1 flex-wrap justify-end">
            {faq.suite?.map(tag => (
              <span key={tag} className="text-[7px] font-bold uppercase tracking-wide bg-zinc-900 border border-zinc-800 text-zinc-600 px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
          </div>
        </Link>
      ); })()}
      </div>
    </div>
  );
}

// ── Main Navbar ───────────────────────────────────────────────────────────────
export default function Navbar() {
  const { user, logout } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  const [mobileOpen,    setMobileOpen]    = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [landlordOpen,  setLandlordOpen]  = useState(false);
  const [userMenuOpen,  setUserMenuOpen]  = useState(false);

  const solutionsRef = useRef<HTMLDivElement>(null);
  const landlordRef  = useRef<HTMLDivElement>(null);
  const userRef      = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (solutionsRef.current && !solutionsRef.current.contains(e.target as Node)) setSolutionsOpen(false);
      if (landlordRef.current  && !landlordRef.current.contains(e.target as Node))  setLandlordOpen(false);
      if (userRef.current      && !userRef.current.contains(e.target as Node))      setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const role = user?.role ?? '';

  // ── Role-based nav links ────────────────────────────────────────────────────
  // IMPORTANT separation:
  //   My Projects  (/projects/my)  = NAP Infrastructure Ledger — DEVELOPER/GOVT/ADMIN
  //   Add Property (/onboard)      = Rental Property Tool      — DEVELOPER (landlord)
  //   Tenants      (/landlord/tenants) — DEVELOPER (landlord)
  const baseLinks = [
    { name: 'Dashboard',    href: '/dashboard',         icon: LayoutDashboard, roles: ['INVESTOR','CONTRACTOR','SUPPLIER','BANK','GOVERNMENT','ADMIN','VERIFIER','DEVELOPER'] },
    // Tenant-only links
    { name: 'My Dashboard', href: '/tenant/dashboard',  icon: Home,            roles: ['TENANT'] },
    { name: 'My Vault',     href: '/tenant/vault',      icon: TrendingUp,      roles: ['TENANT'] },
    { name: 'Pay Rent',     href: '/tenant/pay',        icon: DollarSign,      roles: ['TENANT'] },
    { name: 'My Notices',   href: '/tenant/notices',    icon: Gavel,           roles: ['TENANT'] },
    // Shared project links
    { name: 'Projects',     href: '/projects',          icon: Briefcase,       roles: ['DEVELOPER','GOVERNMENT','CONTRACTOR','SUPPLIER','ADMIN','INVESTOR','VERIFIER','BANK'] },
    { name: 'Investments',  href: '/investments',       icon: Wallet,          roles: ['INVESTOR','ADMIN'] },
    { name: 'Milestones',   href: '/milestones',        icon: Layers,          roles: ['DEVELOPER','CONTRACTOR','ADMIN'] },
    { name: 'Ledger',       href: '/ledger',            icon: BookOpen,        roles: ['DEVELOPER','GOVERNMENT','ADMIN','INVESTOR','VERIFIER'] },
    { name: 'Map',          href: '/map',               icon: MapPin,          roles: ['DEVELOPER','GOVERNMENT','ADMIN','INVESTOR','CONTRACTOR'] },
    // DEVELOPER / Landlord — NAP Ledger (infrastructure projects)
    { name: 'My Projects',  href: '/projects/my',       icon: Building2,       roles: ['DEVELOPER','GOVERNMENT','ADMIN'] },
    // DEVELOPER / Landlord — Property Tool (rental management)
    { name: 'My Properties',href: '/onboard',           icon: Home,            roles: ['DEVELOPER'] },
    { name: 'Tenants',      href: '/landlord/tenants',  icon: Users,           roles: ['DEVELOPER'] },
    { name: 'Notices',      href: '/landlord/notices',  icon: Gavel,           roles: ['DEVELOPER'] },
    { name: 'Rent Roll',    href: '/landlord/rent-dashboard', icon: BarChart3,   roles: ['DEVELOPER'] },
    { name: 'Inventory',    href: '/landlord/inventory',        icon: Archive,     roles: ['DEVELOPER'] },
    { name: 'Unit Editor',  href: '/landlord/inventory/editor', icon: Edit3,       roles: ['DEVELOPER'] },
    { name: 'Marketplace',  href: '/marketplace',        icon: ShoppingBag,     roles: ['DEVELOPER','TENANT','INVESTOR'] },
    // Government / Admin
    { name: 'Gov Portal',   href: '/gov',               icon: Globe,           roles: ['GOVERNMENT','ADMIN'] },
    { name: 'Admin',        href: '/admin',             icon: Settings,        roles: ['ADMIN'] },
  ];

  const visibleLinks = baseLinks.filter(l => !role || l.roles.includes(role));
  const isDeveloper  = role === 'DEVELOPER';
  const isTenant     = role === 'TENANT';

  const active = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href))
      ? 'text-white'
      : 'text-zinc-500 hover:text-zinc-300';

  return (
    <nav className="sticky top-0 z-[200] border-b border-zinc-900 bg-[#050505]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-4">

        {/* ── Logo — real brand asset ── */}
        <BrandLogo
          href={user ? '/dashboard' : '/'}
          size={28}
          showText
          className="shrink-0"
        />

        {/* ── Desktop center: Solutions + NAP Search ── */}
        <div className="hidden md:flex items-center gap-3 flex-1 justify-center max-w-2xl">
          {/* Solutions dropdown */}
          <div ref={solutionsRef} className="relative">
            <button
              onClick={() => { setSolutionsOpen(o => !o); setLandlordOpen(false); }}
              className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-widest transition-colors px-3 py-2 rounded-xl ${solutionsOpen ? 'text-teal-400 bg-teal-500/10' : 'text-zinc-500 hover:text-white'}`}
            >
              Solutions <ChevronDown size={12} className={`transition-transform ${solutionsOpen ? 'rotate-180' : ''}`} />
            </button>
            {solutionsOpen && <SolutionsMenu onClose={() => setSolutionsOpen(false)} />}
          </div>

          {/* NAP Search */}
          <NapSearch mode="inline" compact />

          {/* Desktop nav links (condensed) */}
          {user && (
            <div className="flex items-center gap-1">
              {visibleLinks.slice(0, 5).map(link => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${active(link.href)}`}
                  >
                    <Icon size={12} />
                    <span className="hidden lg:block">{link.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right side ── */}
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <>
              {/* Landlord quick panel — DEVELOPER only */}
              {isDeveloper && (
                <div ref={landlordRef} className="relative">
                  <button
                    onClick={() => { setLandlordOpen(o => !o); setSolutionsOpen(false); }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${landlordOpen ? 'text-teal-400 bg-teal-500/10' : 'text-zinc-500 hover:text-white'}`}
                  >
                    <Building2 size={14} />
                    <span className="hidden sm:block">Landlord</span>
                    <ChevronDown size={11} className={`transition-transform ${landlordOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {landlordOpen && <LandlordQuickPanel onClose={() => setLandlordOpen(false)} />}
                </div>
              )}

              {/* User menu */}
              <div ref={userRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen(o => !o)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-zinc-900 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                    <span className="text-teal-400 font-black text-[10px]">
                      {user.full_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? 'U'}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-[10px] font-black text-white leading-none">{user.full_name?.split(' ')[0] ?? 'User'}</p>
                    <p className="text-[8px] text-teal-500 font-bold uppercase leading-none mt-0.5">{role}</p>
                  </div>
                  <ChevronDown size={11} className={`text-zinc-600 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl z-[300] overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-900">
                      <p className="text-xs font-black text-white truncate">{user.full_name}</p>
                      <p className="text-[9px] text-zinc-500 truncate">{user.email}</p>
                      <p className="text-[8px] text-teal-500 font-bold uppercase mt-0.5">{role}</p>
                    </div>
                    <div className="p-2 space-y-0.5">
                      {[
                        { href: '/kyc',      icon: ShieldCheck, label: 'KYC Verification' },
                        { href: '/profile',  icon: User,        label: 'My Profile' },
                        { href: '/settings', icon: Settings,    label: 'Settings' },
                      ].map(item => {
                        const Icon = item.icon;
                        return (
                          <Link key={item.href} href={item.href} onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-3 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors text-xs font-bold">
                            <Icon size={14} /> {item.label}
                          </Link>
                        );
                      })}
                      <button
                        onClick={() => { logout(); setUserMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-xs font-bold"
                      >
                        <LogOut size={14} /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Theme toggle */}
              <ThemeToggle compact />

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(o => !o)}
                className="md:hidden p-2 text-zinc-500 hover:text-white transition-colors"
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/faq"     className="text-zinc-400 text-xs font-bold uppercase px-3 py-2 rounded-xl hover:text-white transition-colors">FAQ</Link>
              <Link href="/login"   className="text-zinc-400 text-xs font-bold uppercase px-4 py-2 rounded-xl hover:text-white transition-colors">Sign In</Link>
              <Link href="/register" className="bg-teal-500 text-black text-xs font-black uppercase px-4 py-2 rounded-xl hover:bg-white transition-colors">Get Started</Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile menu ── */}
      {mobileOpen && user && (
        <div className="md:hidden border-t border-zinc-900 bg-[#050505] px-4 py-4 space-y-1 max-h-[80vh] overflow-y-auto">
          {/* Mobile NAP Search */}
          <div className="mb-4">
            <NapSearch mode="inline" placeholder="Search by NAP Project ID…" />
          </div>

          {/* Mobile Solutions */}
          <div className="mb-3">
            <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest px-3 mb-2">Solutions</p>
            {SOLUTIONS.map(s => {
              const Icon = s.icon;
              return (
                <Link key={s.href} href={s.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${s.bg}`}
                >
                  <Icon size={16} className={s.accent} />
                  <div>
                    <p className={`text-xs font-black uppercase ${s.accent}`}>{s.label}</p>
                    <p className="text-[9px] text-zinc-600">{s.sub}</p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Mobile nav links */}
          <div className="border-t border-zinc-900 pt-3">
            <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest px-3 mb-2">Navigation</p>
            {visibleLinks.map(link => {
              const Icon = link.icon;
              return (
                <Link key={link.href} href={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-zinc-900 ${active(link.href)}`}
                >
                  <Icon size={16} />
                  <span className="text-sm font-bold">{link.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Mobile sign out */}
          <div className="border-t border-zinc-900 pt-3">
            <button
              onClick={() => { logout(); setMobileOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-sm font-bold"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
