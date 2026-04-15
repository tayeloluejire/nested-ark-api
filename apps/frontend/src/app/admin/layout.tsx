'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import {
  LayoutDashboard, ShieldCheck, Briefcase, Users, Database,
  Megaphone, LogOut, ArrowLeft, Menu, X, DollarSign,
  Camera
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const navItems = [
  { href: '/admin',           label: 'Command Center', icon: LayoutDashboard, exact: true },
  { href: '/admin/approval',  label: 'Approval Queue', icon: ShieldCheck },
  { href: '/admin/revenue',   label: 'Revenue Engine', icon: DollarSign },
  { href: '/admin/projects',  label: 'Projects',       icon: Briefcase },
  { href: '/admin/users',     label: 'Users',          icon: Users },
  { href: '/admin/news',      label: 'Ticker & Ads',   icon: Megaphone },
  { href: '/admin/ledger',    label: 'Ledger',         icon: Database },
  { href: '/admin/drone',     label: 'Drone Upload',   icon: Camera },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading } = useAuth();
  const pathname  = usePathname();
  const router    = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN')) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 flex-shrink-0 border-r border-zinc-800 bg-black sticky top-0 h-screen">
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <Image src="/nested_ark_icon.png" alt="Logo" width={28} height={28} style={{ width: '28px', height: 'auto' }}/>
            <div>
              <p className="text-[9px] font-black text-white uppercase tracking-[0.15em]">Nested Ark OS</p>
              <p className="text-[7px] text-red-400 font-bold uppercase tracking-widest">Admin Terminal</p>
            </div>
          </div>
          <div className="mt-2 px-1">
            <p className="text-[7px] text-zinc-600 truncate">{user.email}</p>
            <span className="text-[7px] font-bold text-red-400 uppercase tracking-widest">{user.role}</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href) && item.href !== '/admin';
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${
                  active
                    ? item.href === '/admin/revenue'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-teal-500/10 text-teal-500 border border-teal-500/20'
                    : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
                }`}>
                <div className="flex items-center gap-2.5"><Icon size={14}/> {item.label}</div>
                {item.href === '/admin/revenue' && <span className="text-[6px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded font-black uppercase">$</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-zinc-800 space-y-1">
          <Link href="/dashboard" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-900 text-[11px] font-bold uppercase tracking-widest transition-all">
            <ArrowLeft size={14}/> Back to OS
          </Link>
          <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-zinc-600 hover:text-red-400 hover:bg-red-500/5 text-[11px] font-bold uppercase tracking-widest transition-all">
            <LogOut size={14}/> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-black border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Image src="/nested_ark_icon.png" alt="Logo" width={24} height={24} style={{ width: '24px', height: 'auto' }}/>
          <span className="text-[10px] font-black uppercase tracking-widest">Admin <span className="text-red-400">ADMIN</span></span>
        </div>
        <button onClick={() => setOpen(!open)} className="text-zinc-400"><Menu size={20}/></button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/90 flex">
          <aside className="w-64 bg-black border-r border-zinc-800 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Admin</span>
              <button onClick={() => setOpen(false)}><X size={18} className="text-zinc-400"/></button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map(item => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${pathname.startsWith(item.href) ? 'bg-teal-500/10 text-teal-500' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}`}>
                    <Icon size={14}/> {item.label}
                    {item.href === '/admin/revenue' && <span className="ml-auto text-[6px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded font-black">LIVE $</span>}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-zinc-800">
              <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-zinc-500 text-[11px] font-bold uppercase tracking-widest">
                <LogOut size={14}/> Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 md:pt-0 pt-14">{children}</div>
    </div>
  );
}
