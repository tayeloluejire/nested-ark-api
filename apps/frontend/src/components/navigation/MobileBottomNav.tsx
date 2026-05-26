'use client';

/**
 * MobileBottomNav — Nested Ark OS
 * Fixed bottom navigation for mobile only (hidden on md+).
 * Uses Next.js usePathname — NOT react-router (this is Next.js App Router).
 * Mount once in layout.tsx inside <AuthProvider>.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { Home, Wallet, Building2, Bell, User, Store } from 'lucide-react';

// ── Role-aware nav items ──────────────────────────────────────────────────────
// Non-authenticated users see public items.
// Tenant users get tenant-specific items.
// Developer/Landlord users get landlord items.
function useNavItems(dbRole?: string, accountType?: string) {
  const isTenant    = dbRole === 'TENANT';
  const isLandlord  = dbRole === 'DEVELOPER' || accountType === 'LANDLORD';

  if (isTenant) {
    return [
      { label: 'Home',    icon: Home,      href: '/tenant/dashboard' },
      { label: 'Vault',   icon: Wallet,    href: '/tenant/vault'     },
      { label: 'Market',  icon: Store,     href: '/marketplace'      },
      { label: 'Notices', icon: Bell,      href: '/tenant/notices'   },
      { label: 'Account', icon: User,      href: '/dashboard'        },
    ];
  }
  if (isLandlord) {
    return [
      { label: 'Home',         icon: Home,      href: '/dashboard'              },
      { label: 'Inventory',    icon: Building2, href: '/landlord/inventory'     },
      { label: 'Tenants',      icon: User,      href: '/landlord/tenants'       },
      { label: 'Notices',      icon: Bell,      href: '/landlord/notices'       },
      { label: 'Payouts',      icon: Wallet,    href: '/landlord/payout-status' },
    ];
  }
  // Public / unauthenticated
  return [
    { label: 'Home',    icon: Home,      href: '/'                       },
    { label: 'Market',  icon: Store,     href: '/marketplace'            },
    { label: 'Invest',  icon: Wallet,    href: '/register?role=investor' },
    { label: 'Build',   icon: Bell,      href: '/projects/submit'        },
    { label: 'Sign In', icon: User,      href: '/login'                  },
  ];
}

export default function MobileBottomNav() {
  const pathname   = usePathname();
  const { user }   = useAuth() as any;
  const items      = useNavItems(user?.db_role, user?.account_type);

  // Hide on auth pages to avoid covering forms
  const hideOn = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/onboard'];
  if (hideOn.some(p => pathname?.startsWith(p))) return null;

  return (
    <>
      {/* ── Bottom nav — mobile only ─────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-zinc-800/80 bg-black/95 backdrop-blur-xl safe-area-pb">
        <div className="grid grid-cols-5 h-[60px]">
          {items.map(item => {
            const Icon      = item.icon;
            const isActive  = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold uppercase tracking-wider transition-all active:scale-90 ${
                  isActive
                    ? 'text-teal-400'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                <div className={`relative p-1.5 rounded-xl transition-all ${isActive ? 'bg-teal-500/10' : ''}`}>
                  <Icon size={17} strokeWidth={isActive ? 2.5 : 1.8} />
                  {isActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-teal-500" />
                  )}
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Spacer so content isn't hidden behind nav — mobile only ─────── */}
      <div className="h-[60px] md:hidden" aria-hidden="true" />
    </>
  );
}
