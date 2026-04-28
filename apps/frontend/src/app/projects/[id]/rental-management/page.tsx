'use client';
export const dynamic = 'force-dynamic';

/**
 * src/app/projects/[id]/rental-management/page.tsx
 *
 * Landlord Rental Command Centre — 5 tabs:
 *   Units · Tenants · Litigation · Receipts · Overview
 *
 * NEW in this version:
 *   • "Units" tab — full property/apartment detail management
 *     - Edit unit name, type, bedrooms, bathrooms, floor, area, furnished, parking
 *     - Set rent, service charge, security deposit, currency
 *     - Add amenities list
 *     - Upload/manage photo URLs (displayed as image grid)
 *     - Set availability date
 *     - One-click status change (VACANT / MAINTENANCE)
 *     - Inline invite button per vacant unit
 *   • All tab data persisted via PUT /api/rental/units/:id
 */

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  Building2, Users, Gavel, FileText, MessageCircle,
  Copy, CheckCircle2, Loader2, AlertCircle, ArrowRight,
  Phone, Mail, Calendar, ChevronRight, Bell, X,
  Receipt, Home, Shield, Clock, TrendingUp,
  Download, RefreshCw, Edit3, Save, Plus, Trash2,
  Camera, Bath, BedDouble, Maximize2, Car, Star,
  ChevronDown, ChevronUp, Wifi, Wind, Zap, Droplets,
  Image as ImageIcon, Check, LayoutGrid, Settings,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();
const fmtDate = (s: any) => s ? new Date(s).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Unit {
  id: string;
  unit_name: string;
  unit_type: string;
  floor?: string;
  floor_level?: string;
  bedrooms?: number;
  bathrooms?: number;
  floor_area_sqm?: number;
  furnished?: boolean;
  parking?: boolean;
  monthly_rent?: number;
  rent_amount: number;
  service_charge?: number;
  security_deposit?: number;
  currency: string;
  description?: string;
  amenities?: string[];
  photo_urls?: string[];
  available_from?: string;
  status: 'VACANT' | 'OCCUPIED' | 'PENDING' | 'MAINTENANCE';
  tenancy_id?: string;
  tenant_name?: string;
  tenant_email?: string;
}
interface Tenancy {
  id: string; unit_id: string; unit_name: string;
  tenant_name: string; tenant_email: string; tenant_phone?: string;
  rent_amount: number; start_date: string; end_date?: string;
  vault_balance: number; vault_funded_pct: number;
  status: 'ACTIVE' | 'OVERDUE' | 'NOTICE_ISSUED' | 'TERMINATED';
  days_overdue?: number; last_payment_date?: string;
}
interface RentalReceipt {
  id: string; tenant_name: string; unit_name: string;
  amount_ngn: number; paid_at: string; receipt_url?: string;
  period_month: string; ledger_hash?: string;
}
interface Summary {
  total_units: number; occupied: number; vacant: number;
  monthly_rent_roll: number; vault_total: number;
  overdue_count: number; collected_this_month: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const UNIT_TYPES   = ['APARTMENT','STUDIO','PENTHOUSE','DUPLEX','ROOM_ENSUITE','SELF_CONTAINED','BUNGALOW','TOWNHOUSE','OFFICE','SHOP'];
const CURRENCIES   = ['NGN','GHS','KES','ZAR','GBP','USD','EUR'];
const AMENITY_OPTS = ['Air Conditioning','Internet/WiFi','Generator Backup','Water Heater','DSTV/Cable','Security','CCTV','Swimming Pool','Gym','Parking Space','Elevator/Lift','Boys Quarters','Laundry Room','Garden','Balcony','Intercom'];

const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleSaveUnit = async (formData: any) => {
    try {
      const response = await api.post('/api/rental/units', {
        project_id: projectId,
        unit_name: formData.unitName,
        category: formData.category,
        current_rent: formData.rentAmount
      });

      if (response.data) {
        setUnits(prev => [...prev, response.data]);
        setIsAddModalOpen(false);
        load(); // Refreshes your dashboard stats
      }
    } catch (error) {
      alert("Failed to save unit. Check backend connection.");
    }
  };

const NOTICE_TYPES = [
  { key: 'NOTICE_TO_PAY',    label: 'Notice to Pay',    desc: '7-day formal demand for overdue rent',      color: 'border-amber-500/40 bg-amber-500/5',   badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',   icon: Bell   },
  { key: 'NOTICE_TO_QUIT',   label: 'Notice to Quit',   desc: 'Formal quit notice — vacate in 30 days',    color: 'border-red-500/40 bg-red-500/5',        badge: 'bg-red-500/10 text-red-400 border-red-500/20',         icon: Home   },
  { key: 'FINAL_WARNING',    label: 'Final Warning',    desc: '48h final warning before legal action',     color: 'border-orange-500/40 bg-orange-500/5',  badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: Clock  },
  { key: 'EVICTION_WARNING', label: 'Eviction Warning', desc: 'Formal eviction notice — legal proceedings', color: 'border-rose-600/40 bg-rose-600/5',      badge: 'bg-rose-600/10 text-rose-400 border-rose-600/20',      icon: Shield },
];

// ── InviteButton ──────────────────────────────────────────────────────────────
function InviteButton({ unitId, unitName }: { unitId: string; unitName: string }) {
  const [loading, setLoading] = useState(false);
  const [link, setLink]       = useState('');
  const [copied, setCopied]   = useState(false);
  const [error, setError]     = useState('');

  const generate = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get(`/api/rental/invite-link/${unitId}`);
      setLink(res.data.url);
      window.open(res.data.whatsapp_link, '_blank');
    } catch (e: any) { setError(e?.response?.data?.error ?? 'Failed'); }
    finally { setLoading(false); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); } catch { prompt('Copy:', link); }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };

  const emailInvite = () => window.open(
    `mailto:?subject=${encodeURIComponent(`Your Nested Ark Tenant Invite — ${unitName}`)}&body=${encodeURIComponent(`You have been invited to set up your tenancy for ${unitName}.\n\nClick to register and activate your Flex-Pay vault:\n\n${link}`)}`,
    '_blank'
  );

  if (!link) return (
    <div className="space-y-1">
      <button onClick={generate} disabled={loading}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] text-[9px] font-black uppercase tracking-wide hover:bg-[#25D366]/20 transition-all disabled:opacity-50">
        {loading ? <Loader2 size={11} className="animate-spin" /> : <MessageCircle size={11} />}
        {loading ? 'Generating…' : 'Invite via WhatsApp'}
      </button>
      {error && <p className="text-[9px] text-red-400">{error}</p>}
    </div>
  );

  return (
    <div className="space-y-1.5">
      <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">Invite link ready</p>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={generate} className="flex items-center gap-1 px-2.5 py-1.5 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] rounded-lg text-[8px] font-black uppercase hover:bg-[#25D366]/20 transition-all">
          <MessageCircle size={10} /> WhatsApp
        </button>
        <button onClick={emailInvite} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg text-[8px] font-black uppercase hover:bg-blue-500/20 transition-all">
          <Mail size={10} /> Email
        </button>
        <button onClick={copy} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all border ${copied ? 'bg-teal-500/10 border-teal-500/30 text-teal-400' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'}`}>
          {copied ? <CheckCircle2 size={10} /> : <Copy size={10} />} {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>
    </div>
  );
}

// ── UnitEditModal — full property detail editor ───────────────────────────────
function UnitEditModal({ unit, onClose, onSaved }: { unit: Unit; onClose: () => void; onSaved: (u: Unit) => void }) {
  const [form, setForm] = useState({
    unit_name:        unit.unit_name || '',
    unit_type:        unit.unit_type || 'APARTMENT',
    bedrooms:         unit.bedrooms ?? 1,
    bathrooms:        unit.bathrooms ?? 1,
    floor_area_sqm:   unit.floor_area_sqm ?? '',
    floor_level:      unit.floor_level || '',
    furnished:        unit.furnished ?? false,
    parking:          unit.parking ?? false,
    rent_amount:      unit.rent_amount || 0,
    service_charge:   unit.service_charge ?? 0,
    security_deposit: unit.security_deposit ?? 0,
    currency:         unit.currency || 'NGN',
    description:      unit.description || '',
    available_from:   unit.available_from || '',
    amenities:        (unit.amenities ?? []) as string[],
    photo_urls:       (unit.photo_urls ?? []) as string[],
  });
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [photoInput, setPhotoInput] = useState('');
  const [activeSection, setActiveSection] = useState<'details'|'rates'|'photos'|'amenities'>('details');

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const toggleAmenity = (a: string) =>
    set('amenities', form.amenities.includes(a)
      ? form.amenities.filter(x => x !== a)
      : [...form.amenities, a]
    );

  const addPhoto = () => {
    const url = photoInput.trim();
    if (!url) return;
    if (!url.startsWith('http')) { setError('Photo URL must start with http'); return; }
    set('photo_urls', [...form.photo_urls, url]);
    setPhotoInput('');
    setError('');
  };

  const removePhoto = (idx: number) =>
    set('photo_urls', form.photo_urls.filter((_, i) => i !== idx));

  const save = async () => {
    if (!form.unit_name.trim()) { setError('Unit name is required'); return; }
    if (safeN(form.rent_amount) <= 0) { setError('Rent amount must be greater than zero'); return; }
    setSaving(true); setError('');
    try {
      const res = await api.put(`/api/rental/units/${unit.id}`, {
        ...form,
        floor_area_sqm:   form.floor_area_sqm ? Number(form.floor_area_sqm) : null,
        rent_amount:      Number(form.rent_amount),
        service_charge:   Number(form.service_charge),
        security_deposit: Number(form.security_deposit),
        bedrooms:         Number(form.bedrooms),
        bathrooms:        Number(form.bathrooms),
        available_from:   form.available_from || null,
      });
      onSaved(res.data.unit);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to save unit details');
    } finally { setSaving(false); }
  };

  const sections = [
    { key: 'details',   label: 'Details',   icon: Building2 },
    { key: 'rates',     label: 'Rates',     icon: TrendingUp },
    { key: 'amenities', label: 'Amenities', icon: Star },
    { key: 'photos',    label: 'Photos',    icon: Camera },
  ] as const;

  return (
    <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-900 flex-shrink-0">
          <div>
            <p className="text-[8px] text-teal-500 uppercase font-black tracking-[0.25em]">Unit Configuration</p>
            <p className="text-sm font-black uppercase tracking-tight text-white mt-0.5">{unit.unit_name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-zinc-600 hover:text-white hover:bg-zinc-800 transition-all"><X size={16} /></button>
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-zinc-900 flex-shrink-0">
          {sections.map(s => {
            const Icon = s.icon;
            const active = activeSection === s.key;
            return (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[9px] font-black uppercase tracking-widest transition-all border-b-2 ${active ? 'border-teal-500 text-teal-400' : 'border-transparent text-zinc-600 hover:text-zinc-400'}`}>
                <Icon size={11} /> {s.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* ── DETAILS ── */}
          {activeSection === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Unit Name *</label>
                  <input value={form.unit_name} onChange={e => set('unit_name', e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none"
                    placeholder="e.g. Flat A1 — Ground Floor" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Unit Type</label>
                  <select value={form.unit_type} onChange={e => set('unit_type', e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none">
                    {UNIT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Floor/Level</label>
                  <input value={form.floor_level} onChange={e => set('floor_level', e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none"
                    placeholder="e.g. Ground, 1st, 2nd…" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Bedrooms</label>
                  <input type="number" min={0} max={20} value={form.bedrooms} onChange={e => set('bedrooms', e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Bathrooms</label>
                  <input type="number" min={0} max={10} value={form.bathrooms} onChange={e => set('bathrooms', e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Floor Area (m²)</label>
                  <input type="number" min={0} value={form.floor_area_sqm} onChange={e => set('floor_area_sqm', e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none"
                    placeholder="e.g. 45" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Available From</label>
                  <input type="date" value={form.available_from} onChange={e => set('available_from', e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none" />
                </div>

                {/* Toggles */}
                <div className="col-span-2 flex gap-3">
                  {[
                    { key: 'furnished', label: 'Furnished', icon: Settings },
                    { key: 'parking',   label: 'Parking Included', icon: Car },
                  ].map(tog => {
                    const Icon = tog.icon;
                    const on = form[tog.key as 'furnished'|'parking'];
                    return (
                      <button key={tog.key} onClick={() => set(tog.key, !on)}
                        className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold transition-all ${on ? 'border-teal-500/40 bg-teal-500/10 text-teal-400' : 'border-zinc-800 bg-zinc-900/20 text-zinc-500 hover:border-zinc-600'}`}>
                        <Icon size={14} />
                        {tog.label}
                        <span className={`ml-auto text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${on ? 'bg-teal-500/20 text-teal-300' : 'bg-zinc-800 text-zinc-500'}`}>{on ? 'YES' : 'NO'}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="col-span-2 space-y-1.5">
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Description / Notes for Tenants</label>
                  <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
                    placeholder="Describe the unit — size, finishes, view, special features…"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none resize-none" />
                </div>
              </div>
            </div>
          )}

          {/* ── RATES ── */}
          {activeSection === 'rates' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-1">
                <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">These rates appear on the tenant onboarding form and Flex-Pay vault setup</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Currency</label>
                <div className="flex gap-2 flex-wrap">
                  {CURRENCIES.map(c => (
                    <button key={c} onClick={() => set('currency', c)}
                      className={`px-4 py-2 rounded-xl border text-sm font-black transition-all ${form.currency === c ? 'border-teal-500/60 bg-teal-500/10 text-teal-400' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {[
                { key: 'rent_amount',      label: 'Monthly Rent *',         required: true,  help: 'Used for Flex-Pay vault installment calculations' },
                { key: 'service_charge',   label: 'Service Charge / Month', required: false, help: 'Estate maintenance, security, waste etc.' },
                { key: 'security_deposit', label: 'Security Deposit',       required: false, help: 'Refundable deposit collected on move-in' },
              ].map(f => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">{f.label}</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-bold">{form.currency}</span>
                    <input type="number" min={0} value={(form as any)[f.key]}
                      onChange={e => set(f.key, e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:border-teal-500 outline-none" />
                  </div>
                  <p className="text-[9px] text-zinc-700">{f.help}</p>
                </div>
              ))}

              {/* Rate summary card */}
              <div className="p-4 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-2">
                <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest">Monthly Obligation Summary</p>
                {[
                  ['Rent',             form.rent_amount],
                  ['Service Charge',   form.service_charge],
                ].map(([label, val]) => (
                  <div key={String(label)} className="flex justify-between text-sm">
                    <span className="text-zinc-400">{label}</span>
                    <span className="font-mono font-bold text-white">{form.currency} {safeF(val)}</span>
                  </div>
                ))}
                <div className="border-t border-teal-500/20 pt-2 flex justify-between text-sm">
                  <span className="text-zinc-300 font-bold">Total / Month</span>
                  <span className="font-mono font-bold text-teal-400">
                    {form.currency} {safeF(safeN(form.rent_amount) + safeN(form.service_charge))}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Security Deposit (one-time)</span>
                  <span className="font-mono">{form.currency} {safeF(form.security_deposit)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── AMENITIES ── */}
          {activeSection === 'amenities' && (
            <div className="space-y-4">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Select all amenities available in this unit</p>
              <div className="grid grid-cols-2 gap-2">
                {AMENITY_OPTS.map(a => {
                  const on = form.amenities.includes(a);
                  return (
                    <button key={a} onClick={() => toggleAmenity(a)}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-left text-xs font-bold transition-all ${on ? 'border-teal-500/40 bg-teal-500/10 text-teal-400' : 'border-zinc-800 bg-zinc-900/20 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}`}>
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${on ? 'bg-teal-500' : 'bg-zinc-800 border border-zinc-700'}`}>
                        {on && <Check size={10} className="text-black" strokeWidth={3} />}
                      </div>
                      {a}
                    </button>
                  );
                })}
              </div>
              {form.amenities.length > 0 && (
                <div className="p-3 rounded-xl border border-teal-500/20 bg-teal-500/5">
                  <p className="text-[9px] text-teal-500 font-bold uppercase tracking-widest mb-2">{form.amenities.length} Selected</p>
                  <p className="text-xs text-zinc-400 leading-relaxed">{form.amenities.join(' · ')}</p>
                </div>
              )}
            </div>
          )}

          {/* ── PHOTOS ── */}
          {activeSection === 'photos' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/20">
                <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Add Photo URLs</p>
                <p className="text-[9px] text-zinc-700 leading-relaxed">
                  Upload photos to any image host (Cloudinary, Imgur, your own CDN) and paste the direct URL here.
                  These appear on the onboarding form and tenant portal.
                </p>
              </div>

              <div className="flex gap-2">
                <input value={photoInput} onChange={e => setPhotoInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPhoto()}
                  placeholder="https://your-cdn.com/unit-photo.jpg"
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none" />
                <button onClick={addPhoto}
                  className="flex items-center gap-1.5 px-4 py-3 bg-teal-500 text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-teal-400 transition-all flex-shrink-0">
                  <Plus size={13} /> Add
                </button>
              </div>

              {form.photo_urls.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-zinc-800 rounded-2xl space-y-3">
                  <Camera className="text-zinc-700 mx-auto" size={32} />
                  <p className="text-zinc-600 text-sm">No photos yet — add URLs above</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {form.photo_urls.map((url, i) => (
                    <div key={i} className="relative group rounded-2xl overflow-hidden border border-zinc-800 aspect-video bg-zinc-900">
                      <img src={url} alt={`Unit photo ${i+1}`}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&q=60'; }} />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                        <button onClick={() => removePhoto(i)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase hover:bg-red-400 transition-all">
                          <Trash2 size={11} /> Remove
                        </button>
                      </div>
                      <div className="absolute top-2 left-2 bg-black/60 text-white text-[8px] font-bold px-2 py-0.5 rounded">
                        Photo {i+1}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-zinc-900 flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-800 text-zinc-500 font-bold text-[10px] uppercase tracking-widest hover:border-zinc-600 hover:text-zinc-300 transition-all">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-teal-500 text-black font-black text-[10px] uppercase tracking-widest hover:bg-teal-400 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Saving…' : 'Save Unit'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NoticeModal ───────────────────────────────────────────────────────────────
function NoticeModal({ tenancies, onClose, onSuccess }: { tenancies: Tenancy[]; onClose: () => void; onSuccess: () => void }) {
  const [noticeType, setNoticeType] = useState('NOTICE_TO_PAY');
  const [tenancyId,  setTenancyId]  = useState(tenancies[0]?.id ?? '');
  const [notes,      setNotes]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [result,     setResult]     = useState('');

  const send = async () => {
    if (!tenancyId) return;
    setSending(true); setResult('');
    try {
      await api.post('/api/rental/notice', { tenancy_id: tenancyId, notice_type: noticeType, notes });
      setResult('✓ Notice issued and emailed to tenant as a signed PDF.');
      setTimeout(() => { onSuccess(); onClose(); }, 2000);
    } catch (e: any) {
      setResult('Error: ' + (e?.response?.data?.error ?? 'Failed to issue notice'));
    } finally { setSending(false); }
  };

  const selected = NOTICE_TYPES.find(n => n.key === noticeType)!;

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-zinc-900">
          <div>
            <p className="text-[8px] text-red-400 uppercase font-black tracking-[0.25em]">Litigation Command</p>
            <p className="text-sm font-black uppercase tracking-tight text-white mt-0.5">Issue Legal Notice</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-zinc-600 hover:text-white hover:bg-zinc-800 transition-all"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto">
          <div className="space-y-2">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Select Tenant</label>
            {tenancies.map(t => (
              <button key={t.id} onClick={() => setTenancyId(t.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${tenancyId === t.id ? 'border-teal-500/40 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'}`}>
                <div>
                  <p className="text-xs font-bold text-white">{t.tenant_name}</p>
                  <p className="text-[9px] text-zinc-500">{t.unit_name} · {t.currency ?? 'NGN'} {safeF(t.rent_amount)}/mo</p>
                </div>
                <div className="text-right">
                  {(t.days_overdue ?? 0) > 0
                    ? <span className="text-[8px] text-red-400 font-bold uppercase">{t.days_overdue}d overdue</span>
                    : <span className="text-[8px] text-teal-400 font-bold uppercase">Current</span>}
                  {tenancyId === t.id && <CheckCircle2 size={12} className="text-teal-400 ml-auto mt-1" />}
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Notice Type</label>
            <div className="grid grid-cols-2 gap-2">
              {NOTICE_TYPES.map(n => {
                const Icon = n.icon;
                return (
                  <button key={n.key} onClick={() => setNoticeType(n.key)}
                    className={`p-3 rounded-xl border text-left transition-all ${noticeType === n.key ? n.color : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={12} className={noticeType === n.key ? '' : 'text-zinc-500'} />
                      <p className="text-[10px] font-black uppercase tracking-tight">{n.label}</p>
                    </div>
                    <p className="text-[8px] text-zinc-500 leading-relaxed">{n.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`px-3 py-2 rounded-xl border text-[9px] font-bold ${selected.badge}`}>
            ⚖️ {selected.label} — SHA-256 hashed, auto-emailed as signed PDF, logged immutably.
          </div>

          <div className="space-y-2">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Additional Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="E.g. Rent overdue since 1st March — this is your formal notice…"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-xs text-white placeholder:text-zinc-700 focus:border-teal-500 outline-none resize-none" />
          </div>

          {result && (
            <div className={`p-3 rounded-xl text-xs font-bold border ${result.startsWith('✓') ? 'bg-teal-500/10 border-teal-500/30 text-teal-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
              {result}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-zinc-900 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-800 text-zinc-500 font-bold text-[10px] uppercase tracking-widest hover:border-zinc-600 hover:text-zinc-300 transition-all">Cancel</button>
          <button onClick={send} disabled={sending || !tenancyId}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-black text-[10px] uppercase tracking-widest hover:bg-red-400 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Gavel size={13} />}
            {sending ? 'Issuing…' : 'Issue Notice'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────
function RentalManagementContent() {
  const { id: projectId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as any;

  const [tab,         setTab]         = useState<'units'|'tenants'|'litigation'|'receipts'|'overview'>(
    ['units','tenants','litigation','receipts','overview'].includes(tabParam) ? tabParam : 'units'
  );
  const [units,       setUnits]       = useState<Unit[]>([]);
  const [tenancies,   setTenancies]   = useState<Tenancy[]>([]);
  const [receipts,    setReceipts]    = useState<RentalReceipt[]>([]);
  const [summary,     setSummary]     = useState<Summary | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [noticeModal, setNoticeModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [refreshing,  setRefreshing]  = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true); setError('');
    try {
      const [uRes, tRes, rRes, sRes] = await Promise.all([
        api.get(`/api/rental/project/${projectId}/units`).catch(() => ({ data: { units: [] } })),
        api.get(`/api/rental/project/${projectId}/tenancies`).catch(() => ({ data: { tenancies: [] } })),
        api.get(`/api/rental/project/${projectId}/receipts`).catch(() => ({ data: { receipts: [] } })),
        api.get(`/api/rental/project/${projectId}/summary`).catch(() => ({ data: { summary: null } })),
      ]);
      setUnits(uRes.data.units ?? []);
      setTenancies(tRes.data.tenancies ?? []);
      setReceipts(rRes.data.receipts ?? []);
      setSummary(sRes.data.summary ?? null);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Could not load rental data.');
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleUnitSaved = (updated: Unit) =>
    setUnits(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u));

  const overdueCount     = tenancies.filter(t => (t.days_overdue ?? 0) > 0).length;
  const overdueTenancies = tenancies.filter(t => (t.days_overdue ?? 0) > 0);

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="flex items-center justify-center py-40"><Loader2 className="animate-spin text-teal-500" size={28} /></div>
      <Footer />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />

      {noticeModal && <NoticeModal tenancies={tenancies} onClose={() => setNoticeModal(false)} onSuccess={load} />}
      {editingUnit && <UnitEditModal unit={editingUnit} onClose={() => setEditingUnit(null)} onSaved={handleUnitSaved} />}

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="border-l-2 border-teal-500 pl-5">
            <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Property Management Suite</p>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Rental Command Centre</h1>
            <p className="text-zinc-500 text-xs mt-1">Manage units, tenants, notices, and income for this property</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={refresh} disabled={refreshing}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-zinc-800 text-zinc-500 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:border-zinc-600 hover:text-zinc-300 transition-all disabled:opacity-50">
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={() => setNoticeModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all">
              <Gavel size={12} /> Issue Notice
            </button>
            <Link href={`/projects/${projectId}`}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-500 text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-teal-400 transition-all">
              <Building2 size={12} /> Project Overview
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 flex items-center gap-2 text-sm font-bold">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* KPI strip */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Units',          value: summary.total_units,               color: 'text-white',     sub: `${summary.occupied} occupied · ${summary.vacant} vacant` },
              { label: 'Monthly Rent Roll',    value: `₦${safeF(summary.monthly_rent_roll)}`,    color: 'text-teal-400',  sub: 'expected per month' },
              { label: 'Collected This Month', value: `₦${safeF(summary.collected_this_month)}`, color: 'text-amber-400', sub: 'received in vaults' },
              { label: 'Overdue Tenants',      value: summary.overdue_count,             color: summary.overdue_count > 0 ? 'text-red-400' : 'text-teal-400', sub: summary.overdue_count > 0 ? 'action required' : 'all current' },
            ].map(s => (
              <div key={s.label} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-1.5">
                <p className={`text-2xl font-black font-mono tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s.label}</p>
                <p className="text-[9px] text-zinc-700">{s.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Overdue alert */}
        {overdueCount > 0 && (
          <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-black text-red-300">{overdueCount} tenant{overdueCount > 1 ? 's' : ''} overdue on rent</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{overdueTenancies.map(t => t.tenant_name).join(', ')}</p>
              </div>
            </div>
            <button onClick={() => { setNoticeModal(true); setTab('litigation'); }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-400 transition-all flex-shrink-0">
              <Gavel size={12} /> Issue Notice Now
            </button>
          </div>
        )}

        {/* Tab bar — Units is now first */}
        <div className="flex items-center gap-1 p-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl w-fit flex-wrap">
          {([
            { key: 'units',       label: 'Units & Property',  icon: LayoutGrid,  badge: units.length },
            { key: 'tenants',     label: 'Tenants',           icon: Users,       badge: tenancies.length },
            { key: 'litigation',  label: 'Litigation',        icon: Gavel,       badge: overdueCount, badgeRed: true },
            { key: 'receipts',    label: 'Receipts',          icon: Receipt,     badge: receipts.length },
          ] as const).map(t => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${isActive ? 'bg-teal-500 text-black shadow' : 'text-zinc-500 hover:text-white'}`}>
                <Icon size={12} /> {t.label}
                {(t as any).badge > 0 && (
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black ${(t as any).badgeRed ? 'bg-red-500 text-white' : isActive ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                    {(t as any).badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ══ TAB: UNITS & PROPERTY ══ */}
        {tab === 'units' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
                Property Units ({units.length}) — click <Edit3 size={9} className="inline" /> to edit details, photos, and rates
              </p>
              <button 
  onClick={() => setIsAddModalOpen(true)}
  className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white transition-all"
>
  <Plus size={11} /> Register New Unit
</button>
            </div>

            {units.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
                <Building2 className="text-zinc-700 mx-auto" size={40} />
                <p className="text-zinc-400 font-bold">No units configured yet</p>
                <p className="text-zinc-600 text-sm">Add units to this project to start setting rents and inviting tenants.</p>
                <Link href={`/projects/${projectId}`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all">
                  Go to Project Settings <ArrowRight size={11} />
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {units.map(unit => {
                  const photos: string[] = Array.isArray(unit.photo_urls) ? unit.photo_urls : [];
                  const amenities: string[] = Array.isArray(unit.amenities) ? unit.amenities : [];
                  const tenancy = tenancies.find(t => t.unit_id === unit.id);

                  const statusCfg = {
                    OCCUPIED:    { bar: 'bg-teal-500',   border: 'border-teal-500/20',   badge: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
                    VACANT:      { bar: 'bg-amber-500',  border: 'border-amber-500/20',  badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                    PENDING:     { bar: 'bg-blue-500',   border: 'border-blue-500/20',   badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                    MAINTENANCE: { bar: 'bg-zinc-500',   border: 'border-zinc-700',      badge: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
                  }[unit.status] ?? { bar: 'bg-zinc-600', border: 'border-zinc-800', badge: 'bg-zinc-800 text-zinc-500 border-zinc-700' };

                  return (
                    <div key={unit.id} className={`rounded-3xl border bg-zinc-950 overflow-hidden ${statusCfg.border}`}>
                      <div className={`h-1 w-full ${statusCfg.bar}`} />

                      {/* Photo strip */}
                      {photos.length > 0 && (
                        <div className="flex gap-1 p-2 bg-zinc-900/40 overflow-x-auto">
                          {photos.slice(0, 5).map((url, i) => (
                            <div key={i} className="relative flex-shrink-0 w-28 h-20 rounded-xl overflow-hidden border border-zinc-800">
                              <img src={url} alt={`${unit.unit_name} photo ${i+1}`}
                                className="w-full h-full object-cover"
                                onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                            </div>
                          ))}
                          {photos.length > 5 && (
                            <div className="flex-shrink-0 w-20 h-20 rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-center">
                              <p className="text-zinc-500 text-[10px] font-bold text-center">+{photos.length-5}<br/>more</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="p-5 space-y-4">
                        {/* Unit header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-black text-base uppercase tracking-tight">{unit.unit_name}</p>
                              <span className={`text-[7px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${statusCfg.badge}`}>{unit.status}</span>
                              {unit.unit_type && <span className="text-[7px] text-zinc-600 border border-zinc-800 px-1.5 py-0.5 rounded font-bold uppercase">{unit.unit_type.replace(/_/g,' ')}</span>}
                            </div>
                            {/* Specs row */}
                            <div className="flex items-center gap-3 text-[9px] text-zinc-500 flex-wrap">
                              {(unit.bedrooms ?? 0) > 0 && <span className="flex items-center gap-1"><BedDouble size={9}/>{unit.bedrooms} bed</span>}
                              {(unit.bathrooms ?? 0) > 0 && <span className="flex items-center gap-1"><Bath size={9}/>{unit.bathrooms} bath</span>}
                              {unit.floor_area_sqm && <span className="flex items-center gap-1"><Maximize2 size={9}/>{unit.floor_area_sqm}m²</span>}
                              {unit.floor_level && <span>{unit.floor_level} floor</span>}
                              {unit.furnished && <span className="text-teal-500 font-bold">Furnished</span>}
                              {unit.parking && <span className="flex items-center gap-1"><Car size={9}/>Parking</span>}
                            </div>
                          </div>
                          <button onClick={() => setEditingUnit(unit)}
                            className="flex items-center gap-1.5 px-3 py-2 border border-zinc-700 text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:border-teal-500/40 hover:text-teal-400 hover:bg-teal-500/5 transition-all flex-shrink-0">
                            <Edit3 size={11} /> Edit
                          </button>
                        </div>

                        {/* Rates */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-0.5">
                            <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">Monthly Rent</p>
                            <p className="font-mono font-bold text-white text-sm">{unit.currency ?? 'NGN'} {safeF(unit.rent_amount)}</p>
                          </div>
                          {safeN(unit.service_charge) > 0 && (
                            <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-0.5">
                              <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">Service</p>
                              <p className="font-mono font-bold text-zinc-300 text-sm">{safeF(unit.service_charge)}</p>
                            </div>
                          )}
                          {safeN(unit.security_deposit) > 0 && (
                            <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-0.5">
                              <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">Deposit</p>
                              <p className="font-mono font-bold text-zinc-300 text-sm">{safeF(unit.security_deposit)}</p>
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        {unit.description && (
                          <p className="text-[10px] text-zinc-500 leading-relaxed border-l-2 border-zinc-800 pl-3">{unit.description}</p>
                        )}

                        {/* Amenities */}
                        {amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {amenities.map(a => (
                              <span key={a} className="text-[8px] px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-500 font-bold">{a}</span>
                            ))}
                          </div>
                        )}

                        {/* No photos prompt */}
                        {photos.length === 0 && (
                          <button onClick={() => setEditingUnit(unit)}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-zinc-700 text-zinc-600 text-[9px] font-bold uppercase tracking-widest hover:border-teal-500/40 hover:text-teal-500 transition-all">
                            <Camera size={12} /> Add Photos — click Edit above
                          </button>
                        )}

                        {/* Tenant info for occupied units */}
                        {tenancy && (
                          <div className="space-y-2 pt-3 border-t border-zinc-900">
                            <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">Current Tenant</p>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-bold text-sm">{tenancy.tenant_name}</p>
                                <p className="text-[9px] text-zinc-500">{tenancy.tenant_email}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono font-bold text-teal-400">₦{safeF(tenancy.vault_balance)}</p>
                                <p className="text-[8px] text-zinc-600">{tenancy.vault_funded_pct}% vault funded</p>
                              </div>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${tenancy.vault_funded_pct >= 80 ? 'bg-teal-500' : tenancy.vault_funded_pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${tenancy.vault_funded_pct}%` }} />
                            </div>
                            {(tenancy.days_overdue ?? 0) > 0 && (
                              <div className="flex items-center gap-1.5 text-[9px] text-red-400 font-bold">
                                <AlertCircle size={10} /> {tenancy.days_overdue} days overdue
                              </div>
                            )}
                          </div>
                        )}

                        {/* Vacant — invite button */}
                        {unit.status === 'VACANT' && (
                          <div className="pt-3 border-t border-zinc-900">
                            <InviteButton unitId={unit.id} unitName={unit.unit_name} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: TENANTS ══ */}
        {tab === 'tenants' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Active Tenancies ({tenancies.length})</p>
              <button onClick={() => setTab('units')} className="text-[9px] text-teal-500 font-bold uppercase tracking-widest hover:text-white transition-all">
                + Invite New Tenant
              </button>
            </div>

            {tenancies.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
                <Users className="text-zinc-700 mx-auto" size={40} />
                <p className="text-zinc-400 font-bold">No tenants yet</p>
                <p className="text-zinc-600 text-sm">Go to the Units tab and click a vacant unit to invite your first tenant.</p>
                <button onClick={() => setTab('units')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all">
                  View Units <ArrowRight size={11} />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {tenancies.map(t => {
                  const statusCfg = {
                    ACTIVE:        'border-teal-500/20 bg-teal-500/5',
                    OVERDUE:       'border-red-500/20 bg-red-500/5',
                    NOTICE_ISSUED: 'border-orange-500/20 bg-orange-500/5',
                    TERMINATED:    'border-zinc-700 bg-zinc-900/10',
                  }[t.status] ?? 'border-zinc-800 bg-zinc-900/10';

                  return (
                    <div key={t.id} className={`p-5 rounded-2xl border ${statusCfg} space-y-4`}>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-black text-base">{t.tenant_name}</p>
                            <span className={`text-[7px] px-2 py-0.5 rounded-full font-black uppercase border ${
                              t.status === 'ACTIVE' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                              t.status === 'OVERDUE' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                              'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>{t.status}</span>
                            {(t.days_overdue ?? 0) > 0 && <span className="text-[8px] text-red-400 font-bold">{t.days_overdue}d overdue</span>}
                          </div>
                          <p className="text-[10px] text-zinc-500">{t.unit_name} · ₦{safeF(t.rent_amount)}/mo</p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="flex items-center gap-1 text-[9px] text-zinc-600"><Mail size={9}/>{t.tenant_email}</span>
                            {t.tenant_phone && <span className="flex items-center gap-1 text-[9px] text-zinc-600"><Phone size={9}/>{t.tenant_phone}</span>}
                            <span className="flex items-center gap-1 text-[9px] text-zinc-600"><Calendar size={9}/>From {fmtDate(t.start_date)}</span>
                          </div>
                        </div>
                        <div className="text-right space-y-1 flex-shrink-0">
                          <p className="font-mono font-bold text-xl text-teal-400">₦{safeF(t.vault_balance)}</p>
                          <p className="text-[8px] text-zinc-600 uppercase font-bold">vault balance</p>
                          <p className="text-[9px] text-zinc-500">{t.vault_funded_pct}% funded</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${t.vault_funded_pct >= 80 ? 'bg-teal-500' : t.vault_funded_pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${t.vault_funded_pct}%` }} />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        {(t.days_overdue ?? 0) > 0 && (
                          <button onClick={() => setNoticeModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-[9px] font-black uppercase hover:bg-red-500/20 transition-all">
                            <Gavel size={11} /> Issue Notice
                          </button>
                        )}
                        {t.tenant_phone && (
                          <a href={`https://wa.me/${t.tenant_phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] rounded-xl text-[9px] font-black uppercase hover:bg-[#25D366]/20 transition-all">
                            <MessageCircle size={11} /> WhatsApp
                          </a>
                        )}
                        <a href={`mailto:${t.tenant_email}`}
                          className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl text-[9px] font-black uppercase hover:bg-blue-500/20 transition-all">
                          <Mail size={11} /> Email
                        </a>
                        <Link href={`/projects/${projectId}/flex-pay/${t.id}`}
                          className="flex items-center gap-1.5 px-3 py-2 border border-zinc-800 text-zinc-500 rounded-xl text-[9px] font-bold uppercase hover:border-zinc-600 hover:text-zinc-300 transition-all">
                          <TrendingUp size={11} /> View Vault
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: LITIGATION ══ */}
        {tab === 'litigation' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {NOTICE_TYPES.map(n => {
                const Icon = n.icon;
                return (
                  <button key={n.key} onClick={() => setNoticeModal(true)}
                    className={`p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-lg ${n.color}`}>
                    <div className="flex items-center gap-2 mb-1.5"><Icon size={14} /><p className="text-[10px] font-black uppercase tracking-tight">{n.label}</p></div>
                    <p className="text-[8px] text-zinc-500 leading-relaxed">{n.desc}</p>
                  </button>
                );
              })}
            </div>
            {overdueTenancies.length > 0 && (
              <div className="space-y-3">
                <p className="text-[9px] text-red-400 uppercase font-black tracking-widest flex items-center gap-1.5"><AlertCircle size={11}/> Overdue — Immediate Action Required</p>
                {overdueTenancies.map(t => (
                  <div key={t.id} className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-bold text-sm">{t.tenant_name}</p>
                      <p className="text-[9px] text-zinc-500">{t.unit_name} · {t.days_overdue} days overdue · ₦{safeF(t.rent_amount)} due</p>
                    </div>
                    <button onClick={() => setNoticeModal(true)}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase hover:bg-red-400 transition-all flex-shrink-0">
                      <Gavel size={11}/> Issue Notice Now
                    </button>
                  </div>
                ))}
              </div>
            )}
            {overdueCount === 0 && tenancies.length > 0 && (
              <div className="py-12 text-center border border-teal-500/20 bg-teal-500/5 rounded-2xl space-y-3">
                <CheckCircle2 className="text-teal-400 mx-auto" size={32}/>
                <p className="text-teal-400 font-black uppercase text-sm">All Tenants Current</p>
                <p className="text-zinc-500 text-[10px]">No overdue rent. Use the buttons above to issue notices proactively if needed.</p>
              </div>
            )}
            {tenancies.length === 0 && (
              <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl space-y-3">
                <Gavel className="text-zinc-700 mx-auto" size={32}/>
                <p className="text-zinc-500 font-bold">No active tenancies to issue notices for.</p>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: RECEIPTS ══ */}
        {tab === 'receipts' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Payment Receipts ({receipts.length})</p>
              <p className="text-[9px] text-zinc-700">SHA-256 hashed · court-admissible</p>
            </div>
            {receipts.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
                <Receipt className="text-zinc-700 mx-auto" size={40}/>
                <p className="text-zinc-400 font-bold">No payments yet</p>
                <p className="text-zinc-600 text-sm">Receipts appear here automatically when tenants make vault contributions.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {receipts.map(r => (
                  <div key={r.id} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex items-center justify-between gap-4 flex-wrap">
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="font-bold text-sm">{r.tenant_name}</p>
                      <div className="flex items-center gap-3 text-[9px] text-zinc-500 flex-wrap">
                        <span className="flex items-center gap-1"><Building2 size={9}/>{r.unit_name}</span>
                        <span className="flex items-center gap-1"><Calendar size={9}/>{r.period_month}</span>
                        <span>{fmtDate(r.paid_at)}</span>
                      </div>
                      {r.ledger_hash && <p className="text-[8px] text-zinc-700 font-mono truncate max-w-xs">Hash: {r.ledger_hash.slice(0,20)}…</p>}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-mono font-bold text-xl text-teal-400">₦{safeF(r.amount_ngn)}</p>
                        <p className="text-[8px] text-zinc-600 uppercase font-bold">received</p>
                      </div>
                      {r.receipt_url && (
                        <a href={r.receipt_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 border border-zinc-700 text-zinc-400 rounded-xl text-[9px] font-bold uppercase hover:border-teal-500/40 hover:text-teal-400 transition-all">
                          <Download size={11}/> Receipt
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
      
      {isAddModalOpen && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
    <div className="bg-zinc-950 border border-zinc-800 p-8 rounded-3xl w-full max-w-md">
      <h2 className="text-xl font-black uppercase mb-6">Register Unit</h2>
      <form onSubmit={(e: any) => {
        e.preventDefault();
        handleSaveUnit({
          unitName: e.target.unitName.value,
          category: e.target.category.value,
          rentAmount: e.target.rentAmount.value
        });
      }} className="space-y-4">
        <input name="unitName" placeholder="Unit Name (e.g. Flat 101)" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3" />
        <select name="category" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
          <option>Mini-flat</option>
          <option>1-Bedroom</option>
          <option>2-Bedroom Flat</option>
        </select>
        <input name="rentAmount" type="number" placeholder="Annual Rent (₦)" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3" />
        <div className="flex gap-3">
          <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-4 py-3 border border-zinc-800 rounded-xl text-xs uppercase">Cancel</button>
          <button type="submit" className="flex-1 px-4 py-3 bg-teal-500 text-black rounded-xl text-xs font-black uppercase">Save Unit</button>
        </div>
      </form>
    </div>
  </div>
)}
      <Footer />
    </div>
  );
}

export default function RentalManagementPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={28}/></div>}>
      <RentalManagementContent />
    </Suspense>
  );
}
