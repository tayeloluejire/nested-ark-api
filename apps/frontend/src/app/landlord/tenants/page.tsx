'use client';
export const dynamic = 'force-dynamic';
/**
 * /landlord/tenants/page.tsx
 * API: GET /api/rental/tenants
 *
 * MERGED — best of both versions:
 * FROM OLD: WhatsApp sendReminder + sendInvite (rich deep-link), Edit modal
 *           (tenant particulars + unit lifecycle), two-step eviction,
 *           fetchTenants/useCallback refresh, Resend Invite for pending tenants,
 *           correct receipt route /landlord/receipts?tenancy_id=
 * FROM NEW: UnitPhoto (cover_image + photo_urls_arr fallback), Navbar + Footer,
 *           Suspense, useMemo, alphabetical letter groups, BedDouble + unit_type,
 *           expanded photo panel, StatusBadge, search clear X, terminated tab
 */
import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import Navbar  from '@/components/Navbar';
import Footer  from '@/components/Footer';
import api from '@/lib/api';
import {
  Users, Loader2, RefreshCw, Search, MessageCircle,
  FileText, ChevronRight, Plus, Download,
  SlidersHorizontal, X, Trash2, CheckCircle, AlertTriangle,
  BedDouble, Image as ImageIcon, ShieldCheck, Bell,
  Clock, Building2,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const safeN = (v: any) => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any) => safeN(v).toLocaleString();

// ── Types ─────────────────────────────────────────────────────────────────────
interface Tenant {
  id:                string;
  tenant_name:       string;
  tenant_email:      string;
  tenant_phone?:     string;
  unit_id:           string;
  unit_name:         string;
  unit_status?:      string;
  cover_image?:      string | null;
  photo_urls_arr?:   string[] | null;
  bedrooms?:         number | null;
  unit_type?:        string | null;
  project_title?:    string;
  project_number?:   string;
  rent_amount:       number;
  currency:          string;
  payment_frequency: string;
  status:            string;
  move_in_date?:     string;
  next_payment_date?: string;
  vault_balance?:    number;
  invite_link?:      string;
  invite_token?:     string;
  tenant_user_id?:   string | null;
}

type FilterTab = 'all' | 'active' | 'pending' | 'overdue' | 'terminated';

// ── Status styles ─────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  ACTIVE:     'bg-teal-500/10 text-teal-400 border-teal-500/20',
  active:     'bg-teal-500/10 text-teal-400 border-teal-500/20',
  PENDING:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  pending:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  OVERDUE:    'bg-red-500/10 text-red-400 border-red-500/20',
  overdue:    'bg-red-500/10 text-red-400 border-red-500/20',
  TERMINATED: 'bg-zinc-800 text-zinc-500 border-zinc-700',
  terminated: 'bg-zinc-800 text-zinc-500 border-zinc-700',
};

// ── Unit photo with initial fallback ─────────────────────────────────────────
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
        onError={() => setErrored(true)} />
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

// ── Tenant card ───────────────────────────────────────────────────────────────
function TenantCard({
  tenant, onEdit, onReminder, onInvite,
}: {
  tenant:     Tenant;
  onEdit:     (t: Tenant) => void;
  onReminder: (t: Tenant) => void;
  onInvite:   (t: Tenant) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const photo    = tenant.cover_image || (Array.isArray(tenant.photo_urls_arr) ? tenant.photo_urls_arr[0] : null);
  const isPending = ['pending', 'PENDING'].includes(tenant.status);
  const isOverdue = tenant.next_payment_date && new Date(tenant.next_payment_date) < new Date();
  const isTerminated = ['terminated', 'TERMINATED'].includes(tenant.status);
  const nextDue = tenant.next_payment_date
    ? new Date(tenant.next_payment_date).toLocaleDateString('en-NG', { month: 'numeric', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      isTerminated
        ? 'border-zinc-800/60 bg-zinc-900/10 opacity-70'
        : isOverdue
          ? 'border-red-500/20 bg-red-500/5'
          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
    }`}>

      {/* Main row */}
      <div className="flex items-start gap-4 p-5">

        {/* Unit photo */}
        <UnitPhoto src={photo} name={tenant.unit_name} className="w-14 h-14 rounded-xl" />

        {/* Info block */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Name + status */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-6 h-6 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-teal-500 font-black text-[10px]">
                {tenant.tenant_name?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
            <p className="font-black uppercase text-sm truncate">{tenant.tenant_name}</p>
            <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase border ${STATUS_STYLES[tenant.status] || STATUS_STYLES.pending}`}>
              {tenant.status}
            </span>
          </div>

          {/* Email + phone */}
          <p className="text-zinc-500 text-xs truncate">{tenant.tenant_email}</p>
          {tenant.tenant_phone && (
            <p className="text-zinc-600 text-xs font-mono">{tenant.tenant_phone}</p>
          )}

          {/* Property + unit details */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Building2 size={9} className="text-zinc-600 shrink-0" />
            <p className="text-[10px] text-zinc-500 truncate">
              {tenant.project_title}
              {tenant.unit_name && <> · <span className="text-zinc-400">{tenant.unit_name}</span></>}
            </p>
            {(tenant.bedrooms ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] text-zinc-600">
                <BedDouble size={8} />{tenant.bedrooms}bd
              </span>
            )}
            {tenant.unit_type && (
              <span className="text-[8px] text-zinc-700 uppercase font-bold tracking-widest">{tenant.unit_type}</span>
            )}
          </div>

          {/* Rent + next due + vault */}
          <div className="flex items-center gap-3 flex-wrap text-[10px]">
            <span className="font-mono text-teal-400 font-bold">
              {tenant.currency || 'NGN'} {safeF(tenant.rent_amount)} / {(tenant.payment_frequency || 'monthly').toLowerCase()}
            </span>
            {nextDue && (
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400 font-bold' : 'text-zinc-500'}`}>
                <Clock size={9} /> Next: {nextDue}
              </span>
            )}
            {safeN(tenant.vault_balance) > 0 && (
              <span className="text-teal-600 font-mono">
                Vault: {tenant.currency || 'NGN'} {safeF(tenant.vault_balance)}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={() => isPending ? onInvite(tenant) : onReminder(tenant)}
            className="flex items-center gap-1 text-[8px] font-black uppercase bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-1.5 rounded-lg hover:bg-green-500/20 transition-all">
            <MessageCircle size={9} /> WhatsApp
          </button>
          <Link href={`/landlord/notices?tenant=${tenant.id}`}
            className="flex items-center gap-1 text-[8px] font-black uppercase bg-zinc-800 text-zinc-400 border border-zinc-700 px-2.5 py-1.5 rounded-lg hover:bg-zinc-700 transition-all">
            <FileText size={9} /> Notice
          </Link>
          <Link href={`/landlord/receipts?tenancy_id=${tenant.id}`}
            className="flex items-center gap-1 text-[8px] font-black uppercase bg-zinc-800 text-zinc-400 border border-zinc-700 px-2.5 py-1.5 rounded-lg hover:bg-zinc-700 transition-all">
            <Download size={9} /> Receipt
          </Link>
          <button
            onClick={() => onEdit(tenant)}
            className="flex items-center gap-1 text-[8px] font-black uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1.5 rounded-lg hover:bg-blue-500/20 transition-all">
            <SlidersHorizontal size={9} /> Edit
          </button>
          {isPending && (
            <Link href={`/landlord/onboard/${tenant.unit_id}`}
              className="flex items-center gap-1 text-[8px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1.5 rounded-lg hover:bg-amber-500/20 transition-all">
              Resend <ChevronRight size={9} />
            </Link>
          )}
        </div>
      </div>

      {/* Expanded photo + details panel */}
      {expanded && (
        <div className="border-t border-zinc-800 px-5 py-4 bg-zinc-900/40 space-y-3">
          {/* Large cover photo */}
          {photo && (
            <div className="rounded-xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={tenant.unit_name} className="w-full h-40 object-cover" />
            </div>
          )}
          {/* Additional photos strip */}
          {Array.isArray(tenant.photo_urls_arr) && tenant.photo_urls_arr.filter(Boolean).length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tenant.photo_urls_arr.filter(Boolean).map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt={`Photo ${i + 1}`}
                  className="w-16 h-14 rounded-lg object-cover flex-shrink-0 border border-zinc-700" />
              ))}
            </div>
          )}
          {/* Key facts grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Unit',      val: tenant.unit_name },
              { label: 'Property',  val: tenant.project_title },
              { label: 'NAP ID',    val: tenant.project_number },
              { label: 'Move-in',   val: tenant.move_in_date ? new Date(tenant.move_in_date).toLocaleDateString('en-NG') : '—' },
              { label: 'Vault',     val: `${tenant.currency || 'NGN'} ${safeF(tenant.vault_balance)}` },
              { label: 'User ID',   val: tenant.tenant_user_id ? tenant.tenant_user_id.slice(0, 8) + '…' : '—' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-[7px] text-zinc-600 uppercase font-bold tracking-widest mb-0.5">{s.label}</p>
                <p className="text-[10px] text-zinc-300 font-mono truncate">{s.val || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center py-2 border-t border-zinc-800/60 text-[8px] text-zinc-600 uppercase font-bold tracking-widest hover:text-zinc-400 hover:bg-zinc-900/20 transition-all">
        {expanded ? '↑ Hide Details' : '↓ Show Photos & Details'}
      </button>
    </div>
  );
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditModal({ tenant, onClose, onSaved }: {
  tenant:  Tenant;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name,       setName]       = useState(tenant.tenant_name    || '');
  const [email,      setEmail]      = useState(tenant.tenant_email   || '');
  const [phone,      setPhone]      = useState(tenant.tenant_phone   || '');
  const [rent,       setRent]       = useState(String(tenant.rent_amount || ''));
  const [unitName,   setUnitName]   = useState(tenant.unit_name      || '');
  const [unitStatus, setUnitStatus] = useState(tenant.unit_status    || 'ACTIVE');
  const [freq,       setFreq]       = useState(tenant.payment_frequency || 'monthly');
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState('');
  const [confirmEvict, setConfirmEvict] = useState(false);

  const handleSave = async () => {
    setSaving(true); setErr('');
    try {
      await api.post('/api/rental/tenancies/lifecycle', {
        tenancy_id:        tenant.id,
        action:            'UPDATE_PARTICULARS',
        tenant_name:       name,
        tenant_email:      email,
        tenant_phone:      phone,
        rent_override:     Number(rent),
        payment_frequency: freq,
      });
      await api.put(`/api/rental/units/${tenant.unit_id}`, {
        unit_name:   unitName,
        rent_amount: Number(rent),
        status:      unitStatus,
      });
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? 'Could not save changes. Try again.');
    } finally { setSaving(false); }
  };

  const handleEvict = async () => {
    setSaving(true); setErr('');
    try {
      await api.post('/api/rental/tenancies/lifecycle', {
        tenancy_id: tenant.id,
        action:     'TERMINATE_OR_TRANSFER',
      });
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? 'Could not remove tenant. Try again.');
    } finally { setSaving(false); setConfirmEvict(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm px-0 sm:px-4">
      <div className="w-full sm:max-w-lg bg-zinc-950 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 space-y-5 max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-900 pb-4">
          <div className="border-l-2 border-blue-500 pl-4">
            <p className="text-[9px] text-blue-400 uppercase font-black tracking-[0.2em]">Tenancy Management</p>
            <h2 className="text-base font-black uppercase tracking-tight">{tenant.tenant_name}</h2>
            <p className="text-zinc-600 text-[10px] mt-0.5">
              {tenant.unit_name}{tenant.project_title ? ` · ${tenant.project_title}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors mt-1">
            <X size={16} />
          </button>
        </div>

        {/* Tenant particulars */}
        <div className="space-y-3">
          <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Tenant Particulars</p>
          <div>
            <label className="modal-label">Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="modal-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="modal-label">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="modal-input" />
            </div>
            <div>
              <label className="modal-label">Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className="modal-input font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="modal-label">Rent Amount</label>
              <input type="number" value={rent} onChange={e => setRent(e.target.value)} className="modal-input font-mono text-teal-400 font-bold" />
            </div>
            <div>
              <label className="modal-label">Frequency</label>
              <select value={freq} onChange={e => setFreq(e.target.value)} className="modal-input">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="biannual">Bi-Annual</option>
                <option value="annually">Annually</option>
              </select>
            </div>
          </div>
        </div>

        {/* Unit / property */}
        <div className="space-y-3 pt-1 border-t border-zinc-900">
          <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest pt-1">Unit / Property Status</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="modal-label">Unit Name</label>
              <input value={unitName} onChange={e => setUnitName(e.target.value)} className="modal-input" />
            </div>
            <div>
              <label className="modal-label">Unit State</label>
              <select value={unitStatus} onChange={e => setUnitStatus(e.target.value)} className="modal-input">
                <option value="ACTIVE">Active Occupancy</option>
                <option value="VACANT">Vacant</option>
                <option value="SOLD">Sold</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error */}
        {err && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/5 text-red-400 text-xs">
            <AlertTriangle size={12} className="shrink-0" /> {err}
          </div>
        )}

        {/* Save / Cancel */}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-zinc-800 rounded-xl text-zinc-500 text-xs font-bold uppercase hover:text-white transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && !confirmEvict
              ? <><Loader2 size={12} className="animate-spin" /> Saving…</>
              : <><CheckCircle size={12} /> Save Changes</>}
          </button>
        </div>

        {/* Eviction — two-step */}
        <div className="border-t border-zinc-900 pt-4">
          {!confirmEvict ? (
            <button onClick={() => setConfirmEvict(true)}
              className="w-full py-2.5 bg-red-950/20 border border-red-900/40 text-red-400 hover:bg-red-950/40 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2">
              <Trash2 size={12} /> Remove Tenant / Vacate Unit
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] text-red-400 text-center font-bold">
                ⚠ This will permanently remove the tenant and reset the unit to VACANT. Confirm?
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmEvict(false)}
                  className="flex-1 py-2 border border-zinc-800 rounded-xl text-zinc-500 text-xs font-bold uppercase hover:text-white transition-colors">
                  Cancel
                </button>
                <button onClick={handleEvict} disabled={saving}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <><Loader2 size={12} className="animate-spin" /> Removing…</> : <><Trash2 size={12} /> Confirm Remove</>}
                </button>
              </div>
            </div>
          )}
        </div>

        <style jsx>{`
          .modal-label { display:block; font-size:9px; color:#6b7280; text-transform:uppercase; font-weight:700; letter-spacing:0.12em; margin-bottom:4px; }
          .modal-input { width:100%; background:#18181b; border:1px solid #3f3f46; border-radius:12px; padding:10px 14px; color:#fff; font-size:13px; outline:none; transition:border-color .15s; }
          .modal-input:focus { border-color:rgba(59,130,246,.5); }
        `}</style>
      </div>
    </div>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────
function TenantsContent() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [tab,     setTab]     = useState<FilterTab>('all');
  const [editTarget, setEditTarget] = useState<Tenant | null>(null);

  const fetchTenants = useCallback(() => {
    setLoading(true);
    api.get('/api/rental/tenants')
      .then(r => setTenants(Array.isArray(r.data) ? r.data : (r.data?.tenants ?? [])))
      .catch(e => setError(e?.response?.data?.error ?? 'Could not load tenants.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  // ── WhatsApp: rent reminder ─────────────────────────────────────────────
  const sendReminder = (t: Tenant) => {
    const amount = Number(t.rent_amount).toLocaleString();
    const text = `Hello ${t.tenant_name}, this is a friendly reminder from Nested Ark OS that your rent of ${t.currency || 'NGN'} ${amount} is due. Please visit your tenant portal to make payment.`;
    const phone = String(t.tenant_phone || '').replace(/\D/g, '');
    const url = phone
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ── WhatsApp: onboarding invite with deep-link ──────────────────────────
  const sendInvite = (t: Tenant) => {
    const base = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://nested-ark-api.vercel.app';
    const inviteUrl = t.invite_link || `${base}/tenant/invite?token=${t.invite_token || t.id}&unit=${t.unit_id}`;
    const amount = Number(t.rent_amount).toLocaleString();
    const unit = [t.unit_name, t.project_title].filter(Boolean).join(' · ');
    const text = [
      `Hello ${t.tenant_name},`,
      ``,
      `You have been invited to join as a tenant on *Nested Ark OS* for *${unit}*.`,
      ``,
      `💰 Rent: ${t.currency || 'NGN'} ${amount} / ${(t.payment_frequency || 'monthly').toLowerCase()}`,
      ``,
      `Please complete your KYC and set up your Flex-Pay vault here:`,
      `🔗 ${inviteUrl}`,
      ``,
      `_Powered by Nested Ark OS · Impressions & Impacts Ltd_`,
    ].join('\n');
    const phone = String(t.tenant_phone || '').replace(/\D/g, '');
    const url = phone
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ── Counts ──────────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    all:        tenants.length,
    active:     tenants.filter(t => ['active','ACTIVE'].includes(t.status)).length,
    pending:    tenants.filter(t => ['pending','PENDING'].includes(t.status)).length,
    overdue:    tenants.filter(t => ['overdue','OVERDUE'].includes(t.status)).length,
    terminated: tenants.filter(t => ['terminated','TERMINATED'].includes(t.status)).length,
  }), [tenants]);

  // ── Filtered + searched list ─────────────────────────────────────────────
  const visible = useMemo(() => {
    let list = tenants;
    if (tab !== 'all') list = list.filter(t => t.status.toLowerCase() === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        [t.tenant_name, t.tenant_email, t.unit_name, t.project_title, t.tenant_phone]
          .some(v => v?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [tenants, tab, search]);

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
        <header className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 border-b border-zinc-800 pb-6">
          <div>
            <p className="text-[10px] text-teal-500 uppercase font-black tracking-widest mb-1">Landlord Command</p>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Tenants</h1>
            <p className="text-zinc-500 text-xs mt-1">Manage all tenants across your properties</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchTenants}
              className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors">
              <RefreshCw size={15} className="text-zinc-400" />
            </button>
            <Link href="/projects/my"
              className="bg-white text-black px-5 py-3 rounded-xl font-black uppercase text-xs flex items-center gap-2 hover:bg-teal-500 transition-colors">
              <Plus size={14} /> Add Unit / Invite
            </Link>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Tenants', val: counts.all,        col: 'text-white'     },
            { label: 'Active',        val: counts.active,     col: 'text-teal-400'  },
            { label: 'Pending KYC',   val: counts.pending,    col: 'text-amber-400' },
            { label: 'Overdue',       val: counts.overdue,    col: counts.overdue > 0 ? 'text-red-400' : 'text-zinc-600' },
          ].map(s => (
            <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-1">
              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">{s.label}</p>
              <p className={`text-3xl font-black ${s.col}`}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, or unit…"
              className="w-full bg-zinc-900 border border-zinc-800 pl-10 pr-10 py-3 rounded-xl text-sm outline-none focus:border-teal-500/60 transition-colors placeholder:text-zinc-600" />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all','active','pending','overdue','terminated'] as FilterTab[]).map(f => (
              <button key={f} onClick={() => setTab(f)}
                className={`px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  tab === f
                    ? 'bg-teal-500 text-black'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}>
                {f} ({counts[f] ?? 0})
              </button>
            ))}
          </div>
        </div>

        {/* Empty state */}
        {visible.length === 0 && !error && (
          <div className="text-center py-20 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-3xl space-y-4">
            <Users className="mx-auto text-zinc-700" size={48} />
            <h2 className="text-xl font-bold uppercase">
              {search ? `No results for "${search}"` : 'No tenants found'}
            </h2>
            <p className="text-zinc-500 text-sm">
              {tenants.length === 0 ? 'Add units to your properties and invite tenants.' : 'No tenants match your search or filter.'}
            </p>
            {tenants.length === 0 && (
              <Link href="/projects/my"
                className="inline-block bg-teal-500 text-black font-black uppercase text-xs px-8 py-4 rounded-xl hover:bg-teal-400 transition-colors">
                Go to My Properties
              </Link>
            )}
          </div>
        )}

        {/* Tenant list — alphabetical groups */}
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
                  {group.map(t => (
                    <TenantCard
                      key={t.id}
                      tenant={t}
                      onEdit={setEditTarget}
                      onReminder={sendReminder}
                      onInvite={sendInvite}
                    />
                  ))}
                </div>
              ))}
          </div>
        )}

        {/* Footer ledger badge */}
        {visible.length > 0 && (
          <div className="flex items-center justify-center gap-2 pt-4 border-t border-zinc-900">
            <ShieldCheck size={10} className="text-teal-500" />
            <p className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest">
              {visible.length} tenant{visible.length !== 1 ? 's' : ''} · SHA-256 ledger · Nested Ark OS
            </p>
          </div>
        )}

      </main>

      {/* Edit modal */}
      {editTarget && (
        <EditModal
          tenant={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); fetchTenants(); }}
        />
      )}

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
