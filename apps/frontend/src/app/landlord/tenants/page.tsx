'use client';
export const dynamic = 'force-dynamic';
/**
 * src/app/landlord/tenants/page.tsx
 * Landlord tenant roster — shows all tenants across their properties.
 * Receipt button → /landlord/receipts?tenancy_id=<tenancy_id>
 * Resend Invite → regenerates invite link for pending tenants
 */
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import {
  Users, Loader2, RefreshCw, Search, MessageCircle,
  FileText, ChevronRight, Plus, Download,
  SlidersHorizontal, X, Trash2, CheckCircle, AlertTriangle,
} from 'lucide-react';

interface Tenant {
  id: string;
  tenant_name: string;
  tenant_email: string;
  tenant_phone?: string;
  unit_id: string;
  unit_name: string;
  project_title?: string;
  project_number?: string;
  rent_amount: number;
  currency: string;
  payment_frequency: string;
  status: string;
  unit_status?: string;       // ACTIVE | VACANT | SOLD — for unit lifecycle management
  move_in_date?: string;
  next_payment_date?: string;
  vault_balance?: number;
  invite_link?: string;       // full invite URL if returned by backend
  invite_token?: string;      // raw token for constructing invite URL
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:     'bg-teal-500/10 text-teal-400 border-teal-500/20',
  active:     'bg-teal-500/10 text-teal-400 border-teal-500/20',
  pending:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  PENDING:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  overdue:    'bg-red-500/10 text-red-400 border-red-500/20',
  OVERDUE:    'bg-red-500/10 text-red-400 border-red-500/20',
  terminated: 'bg-zinc-800 text-zinc-500 border-zinc-700',
};

export default function LandlordTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState<'all' | 'active' | 'pending' | 'overdue'>('all');

  // ── Edit / Manage modal state ─────────────────────────────────────────────
  const [editTarget,    setEditTarget]    = useState<Tenant | null>(null);
  const [editName,      setEditName]      = useState('');
  const [editEmail,     setEditEmail]     = useState('');
  const [editPhone,     setEditPhone]     = useState('');
  const [editRent,      setEditRent]      = useState('');
  const [editUnitName,  setEditUnitName]  = useState('');
  const [editUnitStatus,setEditUnitStatus]= useState('ACTIVE');
  const [editFreq,      setEditFreq]      = useState('');
  const [modalSaving,   setModalSaving]   = useState(false);
  const [modalErr,      setModalErr]      = useState('');
  const [confirmEvict,  setConfirmEvict]  = useState(false);

  const openEdit = (t: Tenant) => {
    setEditTarget(t);
    setEditName(t.tenant_name || '');
    setEditEmail(t.tenant_email || '');
    setEditPhone(t.tenant_phone || '');
    setEditRent(String(t.rent_amount || ''));
    setEditUnitName(t.unit_name || '');
    setEditUnitStatus(t.unit_status || 'ACTIVE');
    setEditFreq(t.payment_frequency || 'monthly');
    setModalErr('');
    setConfirmEvict(false);
  };

  const closeEdit = () => {
    setEditTarget(null);
    setModalErr('');
    setConfirmEvict(false);
  };

  const handleSaveParticulars = async () => {
    if (!editTarget) return;
    setModalSaving(true);
    setModalErr('');
    try {
      // 1. Update tenant particulars (name, email, phone, rent)
      await api.post('/api/rental/tenancies/lifecycle', {
        tenancy_id:    editTarget.id,
        action:        'UPDATE_PARTICULARS',
        tenant_name:   editName,
        tenant_email:  editEmail,
        tenant_phone:  editPhone,
        rent_override: Number(editRent),
        payment_frequency: editFreq,
      });
      // 2. Update unit metadata (name, status, rent)
      await api.put(`/api/rental/units/${editTarget.unit_id}`, {
        unit_name:   editUnitName,
        rent_amount: Number(editRent),
        status:      editUnitStatus,
      });
      closeEdit();
      fetchTenants();
    } catch (e: any) {
      setModalErr(e?.response?.data?.error ?? 'Could not save changes. Try again.');
    } finally {
      setModalSaving(false);
    }
  };

  const handleEvictTenant = async () => {
    if (!editTarget) return;
    setModalSaving(true);
    setModalErr('');
    try {
      await api.post('/api/rental/tenancies/lifecycle', {
        tenancy_id: editTarget.id,
        action:     'TERMINATE_OR_TRANSFER',
      });
      closeEdit();
      fetchTenants();
    } catch (e: any) {
      setModalErr(e?.response?.data?.error ?? 'Could not remove tenant. Try again.');
    } finally {
      setModalSaving(false);
      setConfirmEvict(false);
    }
  };

  const fetchTenants = useCallback(() => {
    setLoading(true);
    api.get('/api/rental/tenants')
      .then(res => setTenants(Array.isArray(res.data) ? res.data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const filtered = tenants.filter(t => {
    const q = search.toLowerCase();
    const matchesSearch = !search || [t.tenant_name, t.tenant_email, t.unit_name, t.project_title]
      .some(v => v?.toLowerCase().includes(q));
    const s = (t.status ?? '').toLowerCase();
    const matchesFilter = filter === 'all' || s === filter;
    return matchesSearch && matchesFilter;
  });

  const counts = {
    all:     tenants.length,
    active:  tenants.filter(t => ['active','ACTIVE'].includes(t.status)).length,
    pending: tenants.filter(t => ['pending','PENDING'].includes(t.status)).length,
    overdue: tenants.filter(t => ['overdue','OVERDUE'].includes(t.status)).length,
  };

  // ── WhatsApp: rent reminder (active tenants) ────────────────────────────
  const sendReminder = (t: Tenant) => {
    const currency = t.currency || 'NGN';
    const amount   = Number(t.rent_amount).toLocaleString();
    const text =
      `Hello ${t.tenant_name}, this is a friendly reminder from Nested Ark OS that your rent of ${currency} ${amount} is due. Please visit your tenant portal to make payment.`;
    const phone = String(t.tenant_phone || '').replace(/\D/g, '');
    const url   = phone
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ── WhatsApp: onboarding invite card with deep-link ──────────────────────
  // Builds the same rich invite message that was previously working, carrying
  // the correct /tenant/invite?token=...&unit=... deep-link from the backend.
  // Falls back to a generic onboard URL if invite fields are absent.
  const sendInvite = (t: Tenant) => {
    const baseUrl   = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://nested-ark-api.vercel.app';
    const inviteUrl = (t as any).invite_link
      || `${baseUrl}/tenant/invite?token=${(t as any).invite_token || t.id}&unit=${t.unit_id}`;
    const currency = t.currency || 'NGN';
    const amount   = Number(t.rent_amount).toLocaleString();
    const unit     = [t.unit_name, t.project_title].filter(Boolean).join(' · ');
    const text = [
      `Hello ${t.tenant_name},`,
      ``,
      `You have been invited to join as a tenant on *Nested Ark OS* for *${unit}*.`,
      ``,
      `💰 Rent: ${currency} ${amount} / ${(t.payment_frequency || 'monthly').toLowerCase()}`,
      ``,
      `Please complete your AI KYC verification and securely set up your Flex-Pay vault here:`,
      `🔗 ${inviteUrl}`,
      ``,
      `_Powered by Nested Ark OS · Impressions & Impacts Ltd_`,
    ].join('\n');
    const phone = String(t.tenant_phone || '').replace(/\D/g, '');
    const url   = phone
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) return (
    <div className="flex h-96 items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={32} />
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 border-b border-zinc-800 pb-6">
        <div>
          <p className="text-[10px] text-teal-500 uppercase font-black tracking-widest mb-1">Landlord Command</p>
          <h1 className="text-3xl font-black uppercase italic">Tenants</h1>
          <p className="text-zinc-500 text-xs mt-1">Manage all tenants across your properties</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchTenants} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors">
            <RefreshCw size={16} className="text-zinc-400" />
          </button>
          <Link href="/projects/my"
            className="bg-white text-black px-5 py-3 rounded-xl font-black uppercase text-xs flex items-center gap-2 hover:bg-teal-500 transition-colors">
            <Plus size={16} /> Add Unit / Invite
          </Link>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Tenants', val: counts.all,     color: 'text-white' },
          { label: 'Active',        val: counts.active,  color: 'text-teal-400' },
          { label: 'Pending KYC',   val: counts.pending, color: 'text-amber-400' },
          { label: 'Overdue',       val: counts.overdue, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-[10px] text-zinc-500 uppercase font-black">{s.label}</p>
            <p className={`text-3xl font-black ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or unit…"
            className="w-full bg-zinc-900 border border-zinc-800 pl-11 pr-4 py-3 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'active', 'pending', 'overdue'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-colors ${
                filter === f ? 'bg-teal-500 text-black' : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-600'
              }`}>
              {f} ({counts[f]})
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-3xl">
          <Users className="mx-auto text-zinc-700 mb-4" size={48} />
          <h2 className="text-xl font-bold uppercase">No tenants found</h2>
          <p className="text-zinc-500 text-sm mb-6">
            {tenants.length === 0
              ? 'Add units to your properties and invite tenants to get started.'
              : 'No tenants match your search or filter.'}
          </p>
          {tenants.length === 0 && (
            <Link href="/projects/my" className="bg-teal-500 text-black font-black uppercase text-xs px-8 py-4 rounded-xl hover:bg-teal-400 transition-colors">
              Go to My Properties
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(tenant => (
            <div key={tenant.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-10 h-10 bg-teal-500/10 border border-teal-500/20 rounded-2xl flex items-center justify-center shrink-0">
                    <span className="text-teal-500 font-black text-sm">
                      {tenant.tenant_name?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-black uppercase truncate">{tenant.tenant_name}</p>
                    <p className="text-zinc-500 text-xs truncate">{tenant.tenant_email}</p>
                    {tenant.tenant_phone && <p className="text-zinc-600 text-xs font-mono">{tenant.tenant_phone}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-black text-zinc-300">
                      {tenant.unit_name}
                      {tenant.project_title && <span className="text-zinc-600"> · {tenant.project_title}</span>}
                    </p>
                    <p className="text-xs font-mono text-teal-400">
                      {tenant.currency || 'NGN'} {Number(tenant.rent_amount).toLocaleString()} / {(tenant.payment_frequency || 'mo').toLowerCase()}
                    </p>
                    {tenant.next_payment_date && (
                      <p className="text-[10px] text-zinc-600">Next: {new Date(tenant.next_payment_date).toLocaleDateString()}</p>
                    )}
                    {tenant.vault_balance != null && (
                      <p className="text-[10px] text-teal-600 font-mono">Vault: {(tenant.currency||'NGN')} {Number(tenant.vault_balance).toLocaleString()}</p>
                    )}
                  </div>
                  <span className={`text-[9px] font-black px-2.5 py-1.5 rounded-lg uppercase border ${STATUS_STYLES[tenant.status] || STATUS_STYLES.pending}`}>
                    {tenant.status}
                  </span>
                </div>
              </div>

              {/* Action Row */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-800 flex-wrap">
                <button
                  onClick={() => ['pending','PENDING'].includes(tenant.status) ? sendInvite(tenant) : sendReminder(tenant)}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-2 rounded-xl hover:bg-green-500/20 transition-colors">
                  <MessageCircle size={12} /> WhatsApp
                </button>
                <Link href={`/landlord/notices?tenant=${tenant.id}`}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase bg-zinc-800 text-zinc-400 border border-zinc-700 px-3 py-2 rounded-xl hover:bg-zinc-700 transition-colors">
                  <FileText size={12} /> Notice
                </Link>
                {/* ✅ FIX: Pass tenancy_id so receipts page shows THIS tenant's receipts */}
                <Link href={`/landlord/receipts?tenancy_id=${tenant.id}`}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase bg-zinc-800 text-zinc-400 border border-zinc-700 px-3 py-2 rounded-xl hover:bg-zinc-700 transition-colors">
                  <Download size={12} /> Receipt
                </Link>
                {/* ── Edit / Manage tenant & unit ── */}
                <button
                  onClick={() => openEdit(tenant)}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-2 rounded-xl hover:bg-blue-500/20 transition-colors">
                  <SlidersHorizontal size={12} /> Edit
                </button>
                {['pending','PENDING'].includes(tenant.status) && (
                  <Link href={`/landlord/onboard/${tenant.unit_id}`}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-2 rounded-xl hover:bg-amber-500/20 transition-colors ml-auto">
                    Resend Invite <ChevronRight size={12} />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Edit / Manage Tenant & Unit Modal ──────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm px-0 sm:px-4">
          <div className="w-full sm:max-w-lg bg-zinc-950 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 space-y-5 max-h-[92vh] overflow-y-auto">

            {/* Modal header */}
            <div className="flex items-start justify-between border-b border-zinc-900 pb-4">
              <div className="border-l-2 border-blue-500 pl-4">
                <p className="text-[9px] text-blue-400 uppercase font-black tracking-[0.2em]">Tenancy Management</p>
                <h2 className="text-base font-black uppercase tracking-tight">{editTarget.tenant_name}</h2>
                <p className="text-zinc-600 text-[10px] mt-0.5">
                  {editTarget.unit_name}{editTarget.project_title ? ` · ${editTarget.project_title}` : ''}
                </p>
              </div>
              <button onClick={closeEdit} className="text-zinc-600 hover:text-white transition-colors mt-1">
                <X size={16} />
              </button>
            </div>

            {/* ── Tenant particulars ── */}
            <div className="space-y-3">
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Tenant Particulars</p>

              <div>
                <label className="text-[9px] text-zinc-600 uppercase font-bold block mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] text-zinc-600 uppercase font-bold block mb-1">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-600 uppercase font-bold block mb-1">Phone</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] text-zinc-600 uppercase font-bold block mb-1">Rent Amount (NGN)</label>
                  <input
                    type="number"
                    value={editRent}
                    onChange={e => setEditRent(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-teal-400 font-mono font-bold focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-600 uppercase font-bold block mb-1">Payment Frequency</label>
                  <select
                    value={editFreq}
                    onChange={e => setEditFreq(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="biannual">Bi-Annual</option>
                    <option value="annually">Annually</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── Unit metadata ── */}
            <div className="space-y-3 pt-1 border-t border-zinc-900">
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest pt-1">Unit / Property Status</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] text-zinc-600 uppercase font-bold block mb-1">Unit Name</label>
                  <input
                    type="text"
                    value={editUnitName}
                    onChange={e => setEditUnitName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-600 uppercase font-bold block mb-1">Unit Lifecycle State</label>
                  <select
                    value={editUnitStatus}
                    onChange={e => setEditUnitStatus(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  >
                    <option value="ACTIVE">Active Occupancy</option>
                    <option value="VACANT">Vacant</option>
                    <option value="SOLD">Sold</option>
                    <option value="MAINTENANCE">Maintenance</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Error */}
            {modalErr && (
              <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/5 text-red-400 text-xs">
                <AlertTriangle size={12} className="shrink-0" /> {modalErr}
              </div>
            )}

            {/* ── Actions ── */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={closeEdit}
                className="flex-1 py-2.5 border border-zinc-800 rounded-xl text-zinc-500 text-xs font-bold uppercase hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveParticulars}
                disabled={modalSaving}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {modalSaving && !confirmEvict
                  ? <><Loader2 size={12} className="animate-spin" /> Saving…</>
                  : <><CheckCircle size={12} /> Save Changes</>
                }
              </button>
            </div>

            {/* ── Evict / Remove tenant — two-step confirm ── */}
            <div className="border-t border-zinc-900 pt-4">
              {!confirmEvict ? (
                <button
                  onClick={() => setConfirmEvict(true)}
                  className="w-full py-2.5 bg-red-950/20 border border-red-900/40 text-red-400 hover:bg-red-950/40 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={12} /> Remove Tenant / Vacate Unit
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] text-red-400 text-center font-bold">
                    ⚠ This will permanently remove the tenant and reset the unit to VACANT. Confirm?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmEvict(false)}
                      className="flex-1 py-2 border border-zinc-800 rounded-xl text-zinc-500 text-xs font-bold uppercase hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEvictTenant}
                      disabled={modalSaving}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {modalSaving
                        ? <><Loader2 size={12} className="animate-spin" /> Removing…</>
                        : <><Trash2 size={12} /> Confirm Remove</>
                      }
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
