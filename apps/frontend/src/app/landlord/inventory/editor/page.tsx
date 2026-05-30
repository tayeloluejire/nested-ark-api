'use client';
export const dynamic = 'force-dynamic';

/**
 * /landlord/inventory/editor/page.tsx
 *
 * Unit property editor — create, edit, upload photos, preview listing.
 *
 * FLOW:
 *   1. Load all landlord units from GET /api/landlord/units
 *   2. Select a unit to edit (or create new via GET /api/rental/units/:projectId)
 *   3. Edit all fields + upload photos via Cloudinary signed upload
 *   4. Save via PUT /api/rental/units/:id
 *   5. Preview card shows exactly how the listing appears on marketplace
 *
 * PHOTO UPLOAD:
 *   - POST /api/upload/signature → get Cloudinary signature
 *   - POST directly to Cloudinary → get URL
 *   - URL saved in cover_image (first/primary) and photo_urls_arr (additional)
 *   - Max 8 photos, validated server-side
 *
 * ROUTES USED (all existing, no changes to backend):
 *   GET  /api/landlord/units          — load unit list
 *   PUT  /api/rental/units/:id        — save unit edits
 *   POST /api/upload/signature        — Cloudinary signed upload
 */

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  ArrowLeft, Save, Eye, EyeOff, Upload, X, Plus, Loader2,
  CheckCircle2, AlertCircle, Building2, Home, Star,
  BedDouble, Bath, Car, Sofa, MapPin, DollarSign,
  Image as ImageIcon, Edit3, ChevronDown, ShieldCheck,
  Wifi, Wind, Droplets, Zap, Shield, Trees,
} from 'lucide-react';

// ── Auth helper ───────────────────────────────────────────────────────────────
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

// ── Amenity options ───────────────────────────────────────────────────────────
const AMENITY_OPTIONS = [
  { id: 'wifi',         label: 'WiFi',           icon: Wifi     },
  { id: 'ac',           label: 'Air Conditioning',icon: Wind     },
  { id: 'water',        label: '24h Water',       icon: Droplets },
  { id: 'power',        label: 'Steady Power',    icon: Zap      },
  { id: 'security',     label: 'Security',        icon: Shield   },
  { id: 'garden',       label: 'Garden',          icon: Trees    },
  { id: 'pool',         label: 'Swimming Pool',   icon: Droplets },
  { id: 'gym',          label: 'Gym',             icon: Star     },
  { id: 'cctv',         label: 'CCTV',            icon: Shield   },
  { id: 'intercom',     label: 'Intercom',        icon: Zap      },
  { id: 'elevator',     label: 'Elevator',        icon: Building2},
  { id: 'balcony',      label: 'Balcony',         icon: Home     },
];

const UNIT_TYPES = ['Apartment','Studio','Duplex','Bungalow','Penthouse','Office','Shop','Warehouse','Land','Townhouse'];
const CURRENCIES = ['NGN','USD','GBP','EUR','AED','GHS','KES'];
const FREQUENCIES = ['MONTHLY','ANNUALLY','QUARTERLY','WEEKLY'];
const STATUSES    = ['VACANT','ACTIVE','MAINTENANCE','SOLD'];

// ── Cloudinary upload ─────────────────────────────────────────────────────────
async function uploadToCloudinary(file: File, token: string): Promise<string> {
  // 1. Get signature
  const sigRes = await fetch('/api/upload/signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ folder: 'nested-ark-units' }),
  });
  if (!sigRes.ok) throw new Error('Could not get upload signature');
  const { signature, timestamp, api_key, cloud_name, folder, upload_preset } = await sigRes.json();

  // 2. Upload directly to Cloudinary
  const fd = new FormData();
  fd.append('file', file);
  fd.append('api_key', api_key);
  fd.append('timestamp', String(timestamp));
  fd.append('signature', signature);
  fd.append('folder', folder);
  if (upload_preset) fd.append('upload_preset', upload_preset);

  const upRes = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, {
    method: 'POST',
    body: fd,
  });
  if (!upRes.ok) throw new Error('Cloudinary upload failed');
  const upData = await upRes.json();
  return upData.secure_url as string;
}

// ── Photo upload slot ─────────────────────────────────────────────────────────
function PhotoSlot({
  url, index, isPrimary, onUpload, onRemove, uploading,
}: {
  url:       string | null;
  index:     number;
  isPrimary: boolean;
  onUpload:  (file: File, idx: number) => void;
  onRemove:  (idx: number) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={`relative rounded-xl overflow-hidden border-2 transition-all ${
      isPrimary ? 'border-teal-500/60' : 'border-zinc-800'
    }`} style={{ aspectRatio: '4/3' }}>
      {url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button onClick={() => inputRef.current?.click()}
              className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-all">
              <Edit3 size={12} className="text-white" />
            </button>
            <button onClick={() => onRemove(index)}
              className="p-1.5 bg-red-500/80 rounded-lg hover:bg-red-500 transition-all">
              <X size={12} className="text-white" />
            </button>
          </div>
          {isPrimary && (
            <div className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-teal-500 rounded text-[7px] font-black uppercase text-black tracking-widest">
              Cover
            </div>
          )}
        </>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-full flex flex-col items-center justify-center gap-1 bg-zinc-900/60 hover:bg-zinc-800/80 transition-all"
        >
          {uploading ? (
            <Loader2 size={18} className="animate-spin text-teal-500" />
          ) : (
            <>
              <Plus size={18} className="text-zinc-600" />
              <span className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">
                {isPrimary ? 'Cover photo' : 'Add photo'}
              </span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onUpload(f, index);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ── Listing preview card ──────────────────────────────────────────────────────
function ListingPreview({ unit }: { unit: UnitForm }) {
  const photos = [unit.cover_image, ...unit.photo_urls_arr].filter(Boolean);
  const [imgIdx, setImgIdx] = useState(0);
  const amenityLabels = AMENITY_OPTIONS.filter(a => unit.amenities.includes(a.id)).map(a => a.label);
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
      {/* Image carousel */}
      <div className="relative bg-zinc-900" style={{ aspectRatio: '16/9' }}>
        {photos[imgIdx] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photos[imgIdx]} alt="Unit" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={40} className="text-zinc-700" />
          </div>
        )}
        {photos.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {photos.map((_, i) => (
              <button key={i} onClick={() => setImgIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === imgIdx ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
        )}
        <div className={`absolute top-3 left-3 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
          unit.status === 'VACANT' ? 'bg-teal-500 text-black' :
          unit.status === 'ACTIVE' ? 'bg-blue-500 text-white' :
          unit.status === 'MAINTENANCE' ? 'bg-amber-500 text-black' :
          'bg-zinc-700 text-zinc-300'
        }`}>{unit.status || 'VACANT'}</div>
        {unit.is_advertised && (
          <div className="absolute top-3 right-3 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest bg-amber-400 text-black">
            Listed
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-4 space-y-3">
        <div>
          <p className="text-[8px] text-teal-500 uppercase font-bold tracking-widest">{unit.unit_type || 'Unit'}</p>
          <p className="font-black text-base">{unit.unit_name || 'Unnamed Unit'}</p>
          {unit.location && (
            <p className="flex items-center gap-1 text-[10px] text-zinc-500 mt-0.5">
              <MapPin size={9} /> {unit.location}
            </p>
          )}
        </div>

        {/* Specs */}
        <div className="flex items-center gap-4 flex-wrap">
          {unit.bedrooms > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
              <BedDouble size={11} className="text-teal-500" /> {unit.bedrooms} bed{unit.bedrooms !== 1 ? 's' : ''}
            </span>
          )}
          {unit.bathrooms > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
              <Bath size={11} className="text-teal-500" /> {unit.bathrooms} bath{unit.bathrooms !== 1 ? 's' : ''}
            </span>
          )}
          {unit.floor_area_sqm > 0 && (
            <span className="text-[10px] text-zinc-400">{unit.floor_area_sqm} m²</span>
          )}
          {unit.furnished && (
            <span className="flex items-center gap-1 text-[10px] text-teal-400">
              <Sofa size={11} /> Furnished
            </span>
          )}
          {unit.parking && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
              <Car size={11} /> Parking
            </span>
          )}
        </div>

        {/* Price */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-black text-teal-400 text-lg font-mono">
              {unit.currency} {unit.rent_amount > 0 ? unit.rent_amount.toLocaleString() : '—'}
            </p>
            <p className="text-[9px] text-zinc-600 uppercase font-bold">/{unit.payment_frequency?.toLowerCase() || 'year'}</p>
          </div>
          {(unit.security_deposit > 0 || unit.service_charge > 0) && (
            <div className="text-right text-[9px] text-zinc-600">
              {unit.security_deposit > 0 && <p>Deposit: {unit.currency} {unit.security_deposit.toLocaleString()}</p>}
              {unit.service_charge > 0 && <p>Service: {unit.currency} {unit.service_charge.toLocaleString()}</p>}
            </div>
          )}
        </div>

        {/* Marketing description */}
        {unit.marketing_description && (
          <p className="text-[10px] text-zinc-500 leading-relaxed line-clamp-3">{unit.marketing_description}</p>
        )}

        {/* Amenities */}
        {amenityLabels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {amenityLabels.map(a => (
              <span key={a} className="text-[7px] px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-500 font-bold">{a}</span>
            ))}
          </div>
        )}

        {/* Trust badge */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-800">
          <ShieldCheck size={9} className="text-teal-500" />
          <span className="text-[8px] text-zinc-600 font-mono">Nested Ark Verified · SHA-256 Ledger</span>
        </div>
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface UnitForm {
  id:                   string;
  unit_name:            string;
  unit_type:            string;
  status:               string;
  bedrooms:             number;
  bathrooms:            number;
  floor_area_sqm:       number;
  floor_level:          string;
  furnished:            boolean;
  parking:              boolean;
  rent_amount:          number;
  currency:             string;
  payment_frequency:    string;
  service_charge:       number;
  security_deposit:     number;
  description:          string;
  marketing_description:string;
  amenities:            string[];
  cover_image:          string;
  photo_urls_arr:       string[];
  is_advertised:        boolean;
  project_id:           string;
  project_title:        string;
  location:             string;
}

const emptyForm = (): UnitForm => ({
  id: '', unit_name: '', unit_type: 'Apartment', status: 'VACANT',
  bedrooms: 1, bathrooms: 1, floor_area_sqm: 0, floor_level: '',
  furnished: false, parking: false,
  rent_amount: 0, currency: 'NGN', payment_frequency: 'ANNUALLY',
  service_charge: 0, security_deposit: 0,
  description: '', marketing_description: '', amenities: [],
  cover_image: '', photo_urls_arr: [],
  is_advertised: false, project_id: '', project_title: '', location: '',
});

function rowToForm(u: any): UnitForm {
  return {
    id:                    u.id,
    unit_name:             u.unit_name             || '',
    unit_type:             u.unit_type             || 'Apartment',
    status:                u.status                || 'VACANT',
    bedrooms:              Number(u.bedrooms)       || 1,
    bathrooms:             Number(u.bathrooms)      || 1,
    floor_area_sqm:        Number(u.floor_area_sqm || u.size_sqm) || 0,
    floor_level:           u.floor_level           || '',
    furnished:             Boolean(u.furnished),
    parking:               Boolean(u.parking),
    rent_amount:           Number(u.rent_amount)    || 0,
    currency:              u.currency              || 'NGN',
    payment_frequency:     u.payment_frequency     || 'ANNUALLY',
    service_charge:        Number(u.service_charge) || 0,
    security_deposit:      Number(u.security_deposit) || 0,
    description:           u.description           || '',
    marketing_description: u.marketing_description || '',
    amenities:             Array.isArray(u.amenities) ? u.amenities : (typeof u.amenities === 'string' ? JSON.parse(u.amenities || '[]') : []),
    cover_image:           u.cover_image           || '',
    photo_urls_arr:        Array.isArray(u.photo_urls_arr) ? u.photo_urls_arr : [],
    is_advertised:         Boolean(u.is_advertised),
    project_id:            u.project_id            || '',
    project_title:         u.project_title         || '',
    location:              u.location              || '',
  };
}

// ── Main editor ───────────────────────────────────────────────────────────────
function UnitEditorContent() {
  const [units,        setUnits]        = useState<any[]>([]);
  const [selected,     setSelected]     = useState<string>('');
  const [form,         setForm]         = useState<UnitForm>(emptyForm());
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [uploading,    setUploading]    = useState<number | null>(null);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const [showPreview,  setShowPreview]  = useState(false);
  const [activeTab,    setActiveTab]    = useState<'basic'|'media'|'marketing'|'finance'>('basic');

  // Load all units on mount
  useEffect(() => {
    const token = getToken();
    if (!token) { window.location.href = '/login'; return; }
    fetch('/api/landlord/units', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setUnits(d.units || []);
        if (d.units?.length) {
          const first = d.units[0];
          setSelected(first.id);
          setForm(rowToForm(first));
        }
      })
      .catch(e => setError(e.message || 'Failed to load units'))
      .finally(() => setLoading(false));
  }, []);

  // Switch selected unit
  const selectUnit = (id: string) => {
    const u = units.find(u => u.id === id);
    if (!u) return;
    setSelected(id);
    setForm(rowToForm(u));
    setError(''); setSuccess('');
  };

  // Form field updater
  const set = (key: keyof UnitForm, val: any) =>
    setForm(prev => ({ ...prev, [key]: val }));

  // Photo upload
  const handlePhotoUpload = async (file: File, slotIndex: number) => {
    if (file.size > 5 * 1024 * 1024) { setError('Photo must be under 5MB'); return; }
    setError('');
    setUploading(slotIndex);
    try {
      const token = getToken()!;
      const url   = await uploadToCloudinary(file, token);
      if (slotIndex === 0) {
        set('cover_image', url);
      } else {
        const arr = [...form.photo_urls_arr];
        arr[slotIndex - 1] = url;
        set('photo_urls_arr', arr);
      }
    } catch (e: any) {
      setError(e.message || 'Upload failed. Check Cloudinary configuration.');
    } finally {
      setUploading(null);
    }
  };

  const removePhoto = (slotIndex: number) => {
    if (slotIndex === 0) {
      set('cover_image', '');
    } else {
      const arr = [...form.photo_urls_arr];
      arr.splice(slotIndex - 1, 1);
      set('photo_urls_arr', arr);
    }
  };

  // Save
  const handleSave = async () => {
    if (!form.id) { setError('No unit selected'); return; }
    if (!form.unit_name.trim()) { setError('Unit name is required'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const token = getToken()!;
      const body  = {
        unit_name:             form.unit_name,
        unit_type:             form.unit_type,
        status:                form.status,
        bedrooms:              form.bedrooms,
        bathrooms:             form.bathrooms,
        floor_area_sqm:        form.floor_area_sqm || null,
        floor_level:           form.floor_level    || null,
        furnished:             form.furnished,
        parking:               form.parking,
        rent_amount:           form.rent_amount,
        currency:              form.currency,
        payment_frequency:     form.payment_frequency,
        service_charge:        form.service_charge  || null,
        security_deposit:      form.security_deposit || null,
        description:           form.description     || null,
        marketing_description: form.marketing_description || null,
        amenities:             form.amenities,
        cover_image:           form.cover_image     || null,
        photo_urls_arr:        form.photo_urls_arr.filter(Boolean),
      };
      const res = await fetch(`/api/rental/units/${form.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');
      // Update local unit list
      setUnits(prev => prev.map(u => u.id === form.id ? { ...u, ...data.unit } : u));
      setSuccess('Unit saved successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // All photo slots: slot 0 = cover, slots 1-8 = additional
  const MAX_PHOTOS  = 9; // 1 cover + 8 additional
  const allPhotos   = [form.cover_image, ...form.photo_urls_arr];
  const photoSlots  = Array.from({ length: MAX_PHOTOS }, (_, i) => allPhotos[i] || null);

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

      <main className="flex-1 max-w-6xl mx-auto px-6 py-10 w-full space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link href="/landlord/inventory"
              className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-3 w-fit">
              <ArrowLeft size={13} /> Inventory
            </Link>
            <div className="border-l-2 border-teal-500 pl-5">
              <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Landlord Portal</p>
              <h1 className="text-3xl font-black uppercase tracking-tighter">Unit Editor</h1>
              <p className="text-zinc-500 text-xs mt-1">Edit, upload photos, and manage listing visibility</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                showPreview ? 'border-teal-500/50 bg-teal-500/10 text-teal-400' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
              }`}>
              {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
              {showPreview ? 'Hide Preview' : 'Preview Listing'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.id}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-black text-[10px] font-black uppercase rounded-xl hover:bg-teal-400 transition-all disabled:opacity-40 tracking-widest">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? 'Saving…' : 'Save Unit'}
            </button>
          </div>
        </div>

        {/* Feedback */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        {success && (
          <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/5 text-teal-400 text-sm font-bold flex items-center gap-2">
            <CheckCircle2 size={14} /> {success}
          </div>
        )}

        <div className={`grid gap-6 ${showPreview ? 'grid-cols-1 lg:grid-cols-[1fr_340px]' : 'grid-cols-1'}`}>

          {/* ── LEFT: Editor ─────────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Unit selector */}
            {units.length > 0 && (
              <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20">
                <label className="block text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-2">
                  Select Unit to Edit
                </label>
                <div className="relative">
                  <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <select
                    value={selected}
                    onChange={e => selectUnit(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 pl-9 pr-4 py-3 rounded-xl text-sm text-white outline-none focus:border-teal-500 appearance-none cursor-pointer"
                  >
                    {units.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.project_title} — {u.unit_name} ({u.status})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                </div>
              </div>
            )}

            {units.length === 0 && (
              <div className="p-8 rounded-2xl border border-dashed border-zinc-800 text-center space-y-3">
                <Building2 size={36} className="text-zinc-700 mx-auto" />
                <p className="text-zinc-400 font-bold">No units found</p>
                <p className="text-zinc-600 text-sm">Add a property and units first, then return here to edit them.</p>
                <Link href="/projects/submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-black text-xs font-black uppercase rounded-xl hover:bg-teal-400 transition-all">
                  <Plus size={13} /> Add Property
                </Link>
              </div>
            )}

            {form.id && (
              <>
                {/* Tab navigation */}
                <div className="flex gap-1 p-1 bg-zinc-950 rounded-2xl border border-zinc-900">
                  {(['basic', 'media', 'finance', 'marketing'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                        activeTab === tab ? 'bg-teal-500 text-black' : 'text-zinc-600 hover:text-zinc-400'
                      }`}>
                      {tab}
                    </button>
                  ))}
                </div>

                {/* ── TAB: BASIC ──────────────────────────────────────────── */}
                {activeTab === 'basic' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="field-label">Unit Name *</label>
                        <input value={form.unit_name} onChange={e => set('unit_name', e.target.value)}
                          placeholder="e.g. Flat 3B" className="field-input" />
                      </div>
                      <div>
                        <label className="field-label">Unit Type</label>
                        <select value={form.unit_type} onChange={e => set('unit_type', e.target.value)} className="field-input">
                          {UNIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="field-label">Status</label>
                        <select value={form.status} onChange={e => set('status', e.target.value)} className="field-input">
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="field-label">Floor Level</label>
                        <input value={form.floor_level} onChange={e => set('floor_level', e.target.value)}
                          placeholder="e.g. 2nd Floor" className="field-input" />
                      </div>
                      <div>
                        <label className="field-label">Bedrooms</label>
                        <input type="number" min={0} max={20} value={form.bedrooms} onChange={e => set('bedrooms', Number(e.target.value))} className="field-input" />
                      </div>
                      <div>
                        <label className="field-label">Bathrooms</label>
                        <input type="number" min={0} max={20} value={form.bathrooms} onChange={e => set('bathrooms', Number(e.target.value))} className="field-input" />
                      </div>
                      <div>
                        <label className="field-label">Floor Area (m²)</label>
                        <input type="number" min={0} value={form.floor_area_sqm} onChange={e => set('floor_area_sqm', Number(e.target.value))} className="field-input" />
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Furnished',       key: 'furnished' as const, icon: Sofa  },
                        { label: 'Parking Included', key: 'parking'   as const, icon: Car   },
                      ].map(f => (
                        <button key={f.key} type="button"
                          onClick={() => set(f.key, !form[f.key])}
                          className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                            form[f.key]
                              ? 'border-teal-500/50 bg-teal-500/10 text-teal-400'
                              : 'border-zinc-800 bg-zinc-900/20 text-zinc-500 hover:border-zinc-700'
                          }`}>
                          <f.icon size={16} />
                          <span className="text-xs font-bold">{f.label}</span>
                          {form[f.key] && <CheckCircle2 size={13} className="ml-auto" />}
                        </button>
                      ))}
                    </div>

                    {/* Amenities */}
                    <div>
                      <label className="field-label">Amenities</label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                        {AMENITY_OPTIONS.map(a => {
                          const checked = form.amenities.includes(a.id);
                          return (
                            <button key={a.id} type="button"
                              onClick={() => {
                                const next = checked
                                  ? form.amenities.filter(x => x !== a.id)
                                  : [...form.amenities, a.id];
                                set('amenities', next);
                              }}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[9px] font-bold uppercase tracking-widest transition-all ${
                                checked
                                  ? 'border-teal-500/50 bg-teal-500/10 text-teal-400'
                                  : 'border-zinc-800 bg-zinc-900/20 text-zinc-500 hover:border-zinc-700'
                              }`}>
                              <a.icon size={11} />
                              {a.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="field-label">Internal Description</label>
                      <textarea value={form.description} onChange={e => set('description', e.target.value)}
                        rows={3} placeholder="Internal notes about this unit…"
                        className="field-input resize-none" />
                    </div>
                  </div>
                )}

                {/* ── TAB: MEDIA ──────────────────────────────────────────── */}
                {activeTab === 'media' && (
                  <div className="space-y-5">
                    <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
                      <Upload size={14} className="text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Photo Upload</p>
                        <p className="text-[9px] text-zinc-500 mt-0.5 leading-relaxed">
                          Upload up to 8 photos. The first slot is the cover photo shown on marketplace listings.
                          JPG, PNG or WebP · max 5MB per image.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {photoSlots.map((url, i) => (
                        <PhotoSlot
                          key={i}
                          url={url}
                          index={i}
                          isPrimary={i === 0}
                          onUpload={handlePhotoUpload}
                          onRemove={removePhoto}
                          uploading={uploading === i}
                        />
                      ))}
                    </div>

                    {/* Cover image URL — manual entry fallback */}
                    <div>
                      <label className="field-label">Cover Image URL (manual entry)</label>
                      <input value={form.cover_image} onChange={e => set('cover_image', e.target.value)}
                        placeholder="https://res.cloudinary.com/…" className="field-input font-mono text-xs" />
                      <p className="text-[9px] text-zinc-600 mt-1">Override or paste a URL directly if upload is unavailable.</p>
                    </div>
                  </div>
                )}

                {/* ── TAB: FINANCE ────────────────────────────────────────── */}
                {activeTab === 'finance' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="field-label">Rent Amount *</label>
                        <div className="relative">
                          <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                          <input type="number" min={0} value={form.rent_amount}
                            onChange={e => set('rent_amount', Number(e.target.value))}
                            className="field-input pl-8" />
                        </div>
                      </div>
                      <div>
                        <label className="field-label">Currency</label>
                        <select value={form.currency} onChange={e => set('currency', e.target.value)} className="field-input">
                          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="field-label">Payment Frequency</label>
                        <select value={form.payment_frequency} onChange={e => set('payment_frequency', e.target.value)} className="field-input">
                          {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="field-label">Security Deposit</label>
                        <input type="number" min={0} value={form.security_deposit}
                          onChange={e => set('security_deposit', Number(e.target.value))} className="field-input" />
                      </div>
                      <div>
                        <label className="field-label">Service Charge</label>
                        <input type="number" min={0} value={form.service_charge}
                          onChange={e => set('service_charge', Number(e.target.value))} className="field-input" />
                      </div>
                    </div>

                    {/* Finance summary */}
                    {form.rent_amount > 0 && (
                      <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/5 space-y-2">
                        <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest">Tenant Cost Summary</p>
                        {[
                          { label: 'Annual Rent',       val: form.rent_amount                                                  },
                          { label: 'Security Deposit',  val: form.security_deposit                                             },
                          { label: 'Service Charge',    val: form.service_charge                                               },
                          { label: 'Total Move-In',     val: form.rent_amount + form.security_deposit + form.service_charge    },
                        ].map(r => r.val > 0 && (
                          <div key={r.label} className="flex justify-between text-xs">
                            <span className="text-zinc-500">{r.label}</span>
                            <span className="font-mono font-bold text-white">{form.currency} {r.val.toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="pt-2 border-t border-teal-500/20">
                          <p className="text-[9px] text-zinc-500 leading-relaxed">
                            With Flex-Pay Vault: monthly installment ≈ {form.currency} {Math.ceil(form.rent_amount / 12).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB: MARKETING ──────────────────────────────────────── */}
                {activeTab === 'marketing' && (
                  <div className="space-y-4">
                    <div>
                      <label className="field-label">Marketplace Headline Description</label>
                      <textarea value={form.marketing_description}
                        onChange={e => set('marketing_description', e.target.value)}
                        rows={5}
                        placeholder="Write a compelling description shown on the marketplace listing. Highlight key features, location advantages, and unique selling points…"
                        className="field-input resize-none" />
                      <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
                        <span>Shown to prospective tenants on /marketplace</span>
                        <span>{form.marketing_description.length}/500</span>
                      </div>
                    </div>

                    {/* Advertised toggle */}
                    <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      form.is_advertised
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-zinc-800 bg-zinc-900/20'
                    }`}>
                      <div>
                        <p className={`font-bold text-sm ${form.is_advertised ? 'text-amber-400' : 'text-zinc-300'}`}>
                          {form.is_advertised ? '📢 Currently Listed on Marketplace' : '⬜ Not Listed on Marketplace'}
                        </p>
                        <p className="text-[9px] text-zinc-500 mt-0.5">
                          {form.is_advertised
                            ? 'Visible to all marketplace browsers. Listing managed via Inventory page.'
                            : 'Activate listing from the Inventory page to make this unit publicly visible.'}
                        </p>
                      </div>
                    </div>

                    {/* SEO tips */}
                    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/10 space-y-2">
                      <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Listing Tips</p>
                      {[
                        'Include exact location — estate name, street, LGA',
                        'Mention proximity to landmarks (airport, university, mall)',
                        'List all included amenities and utilities',
                        'Note Flex-Pay availability to attract more tenants',
                        'Add your availability date for interested tenants',
                      ].map((tip, i) => (
                        <div key={i} className="flex items-start gap-2 text-[9px] text-zinc-500">
                          <CheckCircle2 size={9} className="text-teal-500 shrink-0 mt-0.5" />
                          {tip}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save button — bottom */}
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-teal-500 text-black text-xs font-black uppercase rounded-xl hover:bg-teal-400 transition-all disabled:opacity-40 tracking-widest">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <Link href="/landlord/inventory"
                    className="flex items-center gap-2 px-5 py-3 border border-zinc-700 text-zinc-400 text-xs font-bold uppercase rounded-xl hover:border-zinc-600 transition-all tracking-widest">
                    Back to Inventory
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* ── RIGHT: Preview ───────────────────────────────────────────── */}
          {showPreview && form.id && (
            <div className="space-y-3">
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">
                Marketplace Preview
              </p>
              <p className="text-[9px] text-zinc-600 leading-relaxed">
                This is how your listing appears to prospective tenants on the marketplace.
              </p>
              <ListingPreview unit={form} />
              <div className="flex gap-2 flex-wrap">
                <Link href="/marketplace"
                  className="flex items-center gap-1.5 px-4 py-2 border border-zinc-700 text-zinc-400 text-[9px] font-bold uppercase rounded-xl hover:border-zinc-600 transition-all tracking-widest">
                  <Eye size={11} /> View Marketplace
                </Link>
                <Link href="/landlord/inventory"
                  className="flex items-center gap-1.5 px-4 py-2 border border-zinc-700 text-zinc-400 text-[9px] font-bold uppercase rounded-xl hover:border-zinc-600 transition-all tracking-widest">
                  <Building2 size={11} /> Manage Listings
                </Link>
              </div>
            </div>
          )}
        </div>

      </main>

      {/* Tailwind utility classes injected via style for field inputs */}
      <style jsx global>{`
        .field-label {
          display: block;
          font-size: 10px;
          color: #6b7280;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.12em;
          margin-bottom: 6px;
        }
        .field-input {
          width: 100%;
          background: rgb(24 24 27 / 0.8);
          border: 1px solid rgb(63 63 70);
          border-radius: 12px;
          padding: 11px 14px;
          color: #fff;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
          appearance: none;
        }
        .field-input:focus {
          border-color: rgb(20 184 166 / 0.6);
        }
        .field-input::placeholder { color: #4b5563; }
      `}</style>

      <Footer />
    </div>
  );
}

export default function UnitEditorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
    }>
      <UnitEditorContent />
    </Suspense>
  );
}
