'use client';
export const dynamic = 'force-dynamic';
/**
 * /landlord/tenants/page.tsx
 * API: GET /api/rental/tenants
 * Returns tenant roster with cover_image, photo_urls_arr, bedrooms, unit_type (now included)
 */
import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  Search, Bell, Receipt, Edit3, MessageCircle, Loader2,
  AlertCircle, Building2, Users, CheckCircle2, Clock,
  BedDouble, Image as ImageIcon, ArrowRight, X,
  DollarSign, ShieldCheck, MapPin,
} from 'lucide-react';

const safeN = (v: any) => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any) => safeN(v).toLocaleString();
const fmtDate = (d: string | null) => {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString('en-NG', { month: 'numeric', day: 'numeric', year: 'numeric' }); }
  catch { return null; }
};

interface Tenant {
  id:                 string;
  tenant_name:        string;
  tenant_email:       string;
  tenant_phone:       string;
  unit_id:            string;
  status:             string;
  move_in_date:       string | null;
  rent_amount:        number;
  currency:           string;
  payment_frequency:  string;
  tenant_user_id:     string | null;
  unit_name:          string;
  unit_status:        string;
  cover_image:        string | null;
  photo_urls_arr:     string[] | null;
  bedrooms:           number | null;
  unit_type:          string | null;
  project_title:      string;
  project_number:     string;
  next_payment_date:  string | null;
  vault_balance:      number;
}

type FilterTab = 'all' | 'active' | 'pending' | 'overdue' | 'terminated';

// ── Unit photo with text initial fallback ─────────────────────────────────────
function UnitPhoto({ src, name, className = '' }: {
  src?: string | null; name: string; className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const initials = name.trim().split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  if (src && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name}
        className={`object-cover flex-shrink-0 ${className}`}
        onError={() => setErrored(true)}
      />
    );
  }
  return (
    <div className={`bg-zinc-800 flex items-center justify-center flex-shrink-0 ${className}`}>
      {initials
        ? <span className="text-zinc-400 font-black text-xs">{initials}</span>
        : <ImageIcon size={14} className="text-zinc-600" />}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toUpperCase();
  const map: Record<string, string> = {
    ACTIVE:     'border-teal-500/30 text-teal-400 bg-teal-500/10',
    PENDING:    'border-amber-500/30 text-amber-400 bg-amber-500/10',
    OVERDUE:    'border-red-500/30 text-red-400 bg-red-500/10',
    TERMINATED: 'border-zinc-700 text-zinc-500 bg-zinc-800/60',
  };
  return (
    <span className={`text-[8px] px-2 py-1 rounded border font-black uppercase tracking-widest ${map[s] ?? 'border-zinc-700 text-zinc-500'}`}>
      {s}
    </span>
  );
}

// ── Tenant row card ───────────────────────────────────────────────────────────
function TenantCard({ t }: { t: Tenant }) {
  const [expanded, setExpanded] = useState(false);
  const nextDue   = fmtDate(t.next_payment_date);
  const overdue   = t.next_payment_date && new Date(t.next_payment_date) < new Date();
  const whatsapp  = t.tenant_phone?.replace(/\D/g, '');
  const photo     = t.cover_image || (Array.isArray(t.photo_urls_arr) ? t.photo_urls_arr[0] : null);

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      t.status?.toUpperCase() === 'TERMINATED'
        ? 'border-zinc-800/60 bg-zinc-900/10 opacity-70'
        : overdue
          ? 'border-red-500/20 bg-red-500/5'
          : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700'
    }`}>
      {/* Main row */}
      <div className="flex items-start gap-4 p-4">

        {/* Unit photo thumbnail */}
        <UnitPhoto
          src={photo}
          name={t.unit_name}
          className="w-14 h-14 rounded-xl"
        />

        {/* Tenant + unit info */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Name + avatar initial */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-black text-zinc-300">
                {t.tenant_name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <p className="font-black text-sm text-white truncate">{t.tenant_name}</p>
            <StatusBadge status={t.status} />
          </div>

          {/* Email + phone */}
          <p className="text-[10px] text-zinc-500 truncate">{t.tenant_email}</p>
          <p className="text-[10px] text-zinc-600 font-mono">{t.tenant_phone}</p>

          {/* Property + unit — with photo context */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Building2 size={9} className="text-zinc-600 shrink-0" />
            <p className="text-[10px] text-zinc-500 truncate">
              {t.project_title}
              {t.unit_name ? <> · <span className="text-zinc-400">{t.unit_name}</span></> : null}
            </p>
            {t.bedrooms != null && t.bedrooms > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] text-zinc-600">
                <BedDouble size={8} />{t.bedrooms}bd
              </span>
            )}
            {t.unit_type && (
              <span className="text-[8px] text-zinc-700 uppercase font-bold tracking-widest">{t.unit_type}</span>
            )}
          </div>

          {/* Rent + vault + next due */}
          <div className="flex items-center gap-3 flex-wrap text-[10px]">
            <span className="font-mono text-teal-400 font-bold">
              {t.currency || 'NGN'} {safeF(t.rent_amount)} / {t.payment_frequency?.toLowerCase() || 'mo'}
            </span>
            {nextDue && (
              <span className={`flex items-center gap-1 ${overdue ? 'text-red-400 font-bold' : 'text-zinc-500'}`}>
                <Clock size={9} /> Next: {nextDue}
              </span>
            )}
            {safeN(t.vault_balance) > 0 && (
              <span className="text-zinc-500">
                Vault: {t.currency || 'NGN'} {safeF(t.vault_balance)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0">
          {whatsapp && (
            <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 text-[8px] font-black uppercase hover:bg-green-500/20 transition-all">
              <MessageCircle size={9} /> WhatsApp
            </a>
          )}
          <Link href={`/landlord/notices?tenant=${t.id}`}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-400 text-[8px] font-black uppercase hover:bg-amber-500/10 transition-all">
            <Bell size={9} /> Notice
          </Link>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-[8px] font-black uppercase hover:border-zinc-600 transition-all">
            <Receipt size={9} /> {expanded ? 'Hide' : 'Receipt'}
          </button>
          <Link href={`/landlord/inventory/editor?unit=${t.unit_id}`}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-[8px] font-black uppercase hover:border-zinc-500 transition-all">
            <Edit3 size={9} /> Edit
          </Link>
        </div>
      </div>

      {/* Expanded: receipts / vault detail panel */}
      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-4 bg-zinc-900/30 space-y-3">
          {/* Large unit photo if available */}
          {photo && (
            <div className="rounded-xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={t.unit_name} className="w-full h-36 object-cover" />
            </div>
          )}
          {/* Additional photos strip */}
          {Array.isArray(t.photo_urls_arr) && t.photo_urls_arr.filter(Boolean).length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {t.photo_urls_arr.filter(Boolean).map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt={`Photo ${i + 1}`}
                  className="w-16 h-14 rounded-lg object-cover flex-shrink-0 border border-zinc-700" />
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Unit',      val: t.unit_name      },
              { label: 'Property',  val: t.project_title  },
              { label: 'Move-in',   val: fmtDate(t.move_in_date) || '—' },
              { label: 'Vault',     val: `${t.currency || 'NGN'} ${safeF(t.vault_balance)}` },
              { label: 'NAP ID',    val: t.project_number },
              { label: 'User ID',   val: t.tenant_user_id ? t.tenant_user_id.slice(0,8)+'…' : '—' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-[7px] text-zinc-600 uppercase font-bold tracking-widest mb-0.5">{s.label}</p>
                <p className="text-[10px] text-zinc-300 font-mono truncate">{s.val || '—'}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap pt-1">
            <Link href={`/tenant/contributions?tenancy=${t.id}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-teal-500/20 bg-teal-500/5 text-teal-400 text-[9px] font-black uppercase hover:bg-teal-500/10 transition-all">
              <Receipt size={10} /> View Receipts
            </Link>
            <Link href={`/landlord/notices?tenant=${t.id}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-[9px] font-black uppercase hover:border-zinc-600 transition-all">
              <Bell size={10} /> Manage Notices
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────
function TenantsContent() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [query,   setQuery]   = useState('');
  const [tab,     setTab]     = useState<FilterTab>('all');

  useEffect(() => {
    api.get('/api/rental/tenants')
      .then(r => setTenants(Array.isArray(r.data) ? r.data : (r.data?.tenants ?? [])))
      .catch(e => setError(e?.response?.data?.error ?? 'Could not load tenants.'))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => ({
    all:        tenants.length,
    active:     tenants.filter(t => t.status?.toUpperCase() === 'ACTIVE').length,
    pending:    tenants.filter(t => t.status?.toUpperCase() === 'PENDING').length,
    overdue:    tenants.filter(t => t.next_payment_date && new Date(t.next_payment_date) < new Date() && t.status?.toUpperCase() === 'ACTIVE').length,
    terminated: tenants.filter(t => t.status?.toUpperCase() === 'TERMINATED').length,
  }), [tenants]);

  const visible = useMemo(() => {
    let list = tenants;
    if (tab === 'active')     list = list.filter(t => t.status?.toUpperCase() === 'ACTIVE');
    if (tab === 'pending')    list = list.filter(t => t.status?.toUpperCase() === 'PENDING');
    if (tab === 'terminated') list = list.filter(t => t.status?.toUpperCase() === 'TERMINATED');
    if (tab === 'overdue')    list = list.filter(t => t.next_payment_date && new Date(t.next_payment_date) < new Date() && t.status?.toUpperCase() === 'ACTIVE');
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(t =>
        t.tenant_name?.toLowerCase().includes(q) ||
        t.tenant_email?.toLowerCase().includes(q) ||
        t.unit_name?.toLowerCase().includes(q) ||
        t.project_title?.toLowerCase().includes(q) ||
        t.tenant_phone?.includes(q)
      );
    }
    return list;
  }, [tenants, tab, query]);

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
      <Footer />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto px-6 py-10 w-full space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <p className="text-[10px] text-teal-500 uppercase font-black tracking-widest mb-1">Landlord Command</p>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Tenants</h1>
            <p className="text-zinc-500 text-xs mt-1">Manage all tenants across your properties</p>
          </div>
          <Link href="/onboard"
            className="flex items-center gap-2 px-5 py-3 bg-teal-500 text-black text-xs font-black uppercase rounded-xl hover:bg-teal-400 transition-all tracking-widest">
            <ArrowRight size={13} /> Add Unit / Invite
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Tenants', value: counts.all,        color: 'text-white'     },
            { label: 'Active',        value: counts.active,     color: 'text-teal-400'  },
            { label: 'Pending KYC',   value: counts.pending,    color: 'text-amber-400' },
            { label: 'Overdue',       value: counts.overdue,    color: counts.overdue > 0 ? 'text-red-400' : 'text-zinc-600' },
          ].map(s => (
            <div key={s.label} className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-1">
              <p className={`text-2xl font-black font-mono ${s.color}`}>{s.value}</p>
              <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, email, or unit…"
            className="w-full bg-zinc-900 border border-zinc-800 pl-10 pr-10 py-3.5 rounded-xl text-sm outline-none focus:border-teal-500/60 transition-colors placeholder:text-zinc-600"
          />
          {query && (
            <button onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['all','active','pending','overdue','terminated'] as FilterTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                tab === t
                  ? 'bg-teal-500/15 border-teal-500/50 text-teal-400'
                  : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'
              }`}>
              {t} ({counts[t] ?? visible.length})
            </button>
          ))}
        </div>

        {/* Empty state */}
        {visible.length === 0 && !error && (
          <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
            <Users size={40} className="text-zinc-700 mx-auto" />
            <p className="text-zinc-400 font-bold">
              {query ? `No tenants match "${query}"` : 'No tenants found'}
            </p>
            {!query && (
              <Link href="/onboard"
                className="inline-flex items-center gap-2 px-5 py-3 bg-teal-500 text-black font-black text-xs uppercase rounded-xl hover:bg-teal-400 transition-all">
                <ArrowRight size={13} /> Invite First Tenant
              </Link>
            )}
          </div>
        )}

        {/* Tenant list grouped by first letter */}
        {visible.length > 0 && (
          <div className="space-y-6">
            {Object.entries(
              visible.reduce((acc: Record<string, Tenant[]>, t) => {
                const letter = (t.tenant_name?.charAt(0) || '#').toUpperCase();
                if (!acc[letter]) acc[letter] = [];
                acc[letter].push(t);
                return acc;
              }, {})
            ).sort(([a], [b]) => a.localeCompare(b))
              .map(([letter, group]) => (
                <div key={letter} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                      <span className="text-[11px] font-black text-teal-400">{letter}</span>
                    </div>
                    <div className="flex-1 h-px bg-zinc-800" />
                    <span className="text-[9px] text-zinc-600 font-mono">{group.length}</span>
                  </div>
                  {group.map(t => <TenantCard key={t.id} t={t} />)}
                </div>
              ))}
          </div>
        )}

        {/* Footer count */}
        {visible.length > 0 && (
          <div className="flex items-center justify-center gap-2 pt-4 border-t border-zinc-900">
            <ShieldCheck size={10} className="text-teal-500" />
            <p className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest">
              {visible.length} tenant{visible.length !== 1 ? 's' : ''} · SHA-256 ledger · Nested Ark OS
            </p>
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}

export default function LandlordTenantsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
    }>
      <TenantsContent />
    </Suspense>
  );
}
