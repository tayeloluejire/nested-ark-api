'use client';
export const dynamic = 'force-dynamic';
/**
 * /landlord/inventory/editor/page.tsx
 *
 * Unit Editor — landlord can:
 *   • Upload cover photo + gallery (Cloudinary via /api/upload/signature)
 *   • Write marketing description for the marketplace listing
 *   • Edit specs (bedrooms, rent, fees, furnishing etc.)
 *   • Pay ₦5,000 to advertise the unit on the public marketplace
 *
 * URL: /landlord/inventory/editor?unitId=<uuid>
 * Linked from: /landlord/inventory (Edit button per card)
 *              /landlord/inventory (Edit / Upload Unit header button → no unitId → picker)
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BrandLogo from '@/components/BrandLogo';
import api from '@/lib/api';
import {
  ArrowLeft, Loader2, CheckCircle2, AlertCircle,
  Camera, Upload, X, Megaphone, Save,
  BedDouble, Bath, Building2, Tag, Image as ImageIcon,
  ShoppingBag, ExternalLink, RefreshCw, Trash2,
} from 'lucide-react';

const safeF = (v: any) => Number(v ?? 0).toLocaleString();

const AMENITY_OPTIONS = [
  'Air Conditioning', 'Generator', 'Water Supply', 'Security', 'CCTV',
  'Parking', 'Gym', 'Swimming Pool', 'Internet/WiFi', 'Elevator',
  'Balcony', 'Tiled Floors', 'POP Ceiling', 'Wardrobe', 'Kitchen Cabinet',
];

// ── Cloudinary photo uploader ─────────────────────────────────────────────
function PhotoUploader({
  label, hint, value, onUpload, onClear, disabled,
}: {
  label: string; hint?: string; value?: string;
  onUpload: (url: string) => void; onClear: () => void; disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [error,     setError]     = useState('');

  const handleFile = useCallback(async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { setError('Max 10 MB'); return; }
    setUploading(true); setError(''); setProgress(0);
    try {
      const sigRes = await api.post('/api/upload/signature', { folder: 'nested-ark/units', resource_type: 'image' });
      const { signature, timestamp, cloud_name, api_key } = sigRes.data;
      const fd = new FormData();
      fd.append('file', file); fd.append('signature', signature);
      fd.append('timestamp', String(timestamp)); fd.append('api_key', api_key);
      fd.append('folder', 'nested-ark/units');
      const url = await new Promise<string>((res, rej) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`);
        xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round(e.loaded/e.total*100)); };
        xhr.onload = () => { if (xhr.status===200) res(JSON.parse(xhr.responseText).secure_url); else rej(new Error('Upload failed')); };
        xhr.onerror = () => rej(new Error('Network error'));
        xhr.send(fd);
      });
      onUpload(url);
    } catch (e: any) { setError(e.message ?? 'Upload failed'); }
    finally { setUploading(false); }
  }, [onUpload]);

  const inputId = `uploader-${label.replace(/\s+/g,'-')}`;

  return (
    <div className="space-y-2">
      <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">{label}</p>
      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-teal-500/30 bg-zinc-900">
          <img src={value} alt={label} className="w-full aspect-video object-cover" />
          <div className="absolute top-2 right-2 flex gap-1.5">
            <label htmlFor={`replace-${inputId}`}
              className="flex items-center gap-1 px-2 py-1 bg-black/70 text-[9px] text-white font-bold rounded-lg cursor-pointer hover:bg-black transition-all">
              <RefreshCw size={9}/> Replace
              <input id={`replace-${inputId}`} type="file" accept="image/*" className="sr-only"
                onChange={e => { const f=e.target.files?.[0]; if(f) handleFile(f); e.target.value=''; }} />
            </label>
            <button onClick={onClear}
              className="p-1 bg-black/70 text-red-400 rounded-lg hover:bg-red-500/20 transition-all">
              <X size={11}/>
            </button>
          </div>
        </div>
      ) : uploading ? (
        <div className="p-5 rounded-xl border border-teal-500/20 bg-teal-500/5 space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="animate-spin text-teal-500" size={14}/>
            <span className="text-xs text-zinc-400">Uploading… {progress}%</span>
          </div>
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 transition-all" style={{width:`${progress}%`}}/>
          </div>
        </div>
      ) : (
        <label htmlFor={inputId}
          className="flex items-center gap-4 p-5 rounded-xl border-2 border-dashed border-zinc-700 hover:border-teal-500/50 hover:bg-teal-500/5 transition-all cursor-pointer group">
          <div className="p-3 rounded-xl border border-zinc-700 bg-zinc-900 group-hover:border-teal-500/30">
            <Camera size={20} className="text-zinc-500 group-hover:text-teal-400 transition-colors"/>
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors">
              {hint ?? 'Tap to upload photo'}
            </p>
            <p className="text-[9px] text-zinc-600 mt-0.5">JPG, PNG, WEBP · Max 10 MB</p>
          </div>
          <input id={inputId} type="file" accept="image/*" className="sr-only"
            onChange={e => { const f=e.target.files?.[0]; if(f) handleFile(f); e.target.value=''; }}/>
        </label>
      )}
      {error && (
        <div className="flex items-center gap-2 text-[10px] text-red-400 font-bold">
          <AlertCircle size={10}/> {error}
        </div>
      )}
    </div>
  );
}

// ── Main editor content ──────────────────────────────────────────────────────
function EditorContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const unitId       = searchParams.get('unitId') ?? '';

  const [unit,         setUnit]         = useState<any>(null);
  const [allUnits,     setAllUnits]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [advertising,  setAdvertising]  = useState(false);
  const [saveOk,       setSaveOk]       = useState('');
  const [saveErr,      setSaveErr]      = useState('');
  const [advertiseErr, setAdvertiseErr] = useState('');

  // ── Form state ────────────────────────────────────────────────────────────
  const [marketingDesc, setMarketingDesc] = useState('');
  const [coverImage,    setCoverImage]    = useState('');
  const [gallery,       setGallery]       = useState<string[]>([]);
  const [unitName,      setUnitName]      = useState('');
  const [bedrooms,      setBedrooms]      = useState('');
  const [bathrooms,     setBathrooms]     = useState('');
  const [floorArea,     setFloorArea]     = useState('');
  const [rentAmount,    setRentAmount]    = useState('');
  const [currency,      setCurrency]      = useState('NGN');
  const [frequency,     setFrequency]     = useState('Annual');
  const [furnished,     setFurnishing]    = useState('Unfurnished');
  const [parking,       setParking]       = useState(false);
  const [deposit,       setDeposit]       = useState('');
  const [agencyFee,     setAgencyFee]     = useState('');
  const [cautionFee,    setCautionFee]    = useState('');
  const [amenities,     setAmenities]     = useState<string[]>([]);
  const [confirmAdvert, setConfirmAdvert] = useState(false);

  // ── Load unit(s) ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/landlord/units');
        const units = res.data?.units ?? [];
        setAllUnits(units);
        if (unitId) {
          const found = units.find((u: any) => u.id === unitId);
          if (found) populateForm(found);
          else setSaveErr('Unit not found. Select from the list below.');
        }
      } catch { setSaveErr('Could not load units.'); }
      finally { setLoading(false); }
    };
    load();
  }, [unitId]);

  const populateForm = (u: any) => {
    setUnit(u);
    setUnitName(u.unit_name ?? '');
    setMarketingDesc(u.marketing_description ?? '');
    setCoverImage(u.cover_image ?? '');
    setGallery(Array.isArray(u.photo_urls_arr) ? u.photo_urls_arr : []);
    setBedrooms(String(u.bedrooms ?? ''));
    setBathrooms(String(u.bathrooms ?? ''));
    setFloorArea(String(u.size_sqm ?? ''));
    setRentAmount(String(u.rent_amount ?? ''));
    setCurrency(u.currency ?? 'NGN');
    setFrequency(u.payment_frequency ?? 'Annual');
    setFurnishing(u.furnished ? 'Fully Furnished' : 'Unfurnished');
    setParking(!!u.parking);
    setDeposit(String(u.security_deposit ?? ''));
    setAgencyFee(String(u.agency_fee ?? ''));
    setCautionFee(String(u.caution_fee ?? ''));
    const rawAmenities = Array.isArray(u.amenities)
      ? u.amenities
      : typeof u.amenities === 'string' && u.amenities.startsWith('[')
        ? JSON.parse(u.amenities)
        : [];
    setAmenities(rawAmenities);
  };

  const addGalleryPhoto = (url: string) => setGallery(g => [...g, url]);
  const removeGalleryPhoto = (idx: number) => setGallery(g => g.filter((_, i) => i !== idx));
  const toggleAmenity = (a: string) => setAmenities(prev =>
    prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
  );

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!unit) return;
    setSaving(true); setSaveOk(''); setSaveErr('');
    try {
      await api.put(`/api/rental/units/${unit.id}`, {
        unit_name:             unitName || undefined,
        bedrooms:              bedrooms ? Number(bedrooms) : undefined,
        bathrooms:             bathrooms ? Number(bathrooms) : undefined,
        floor_area_sqm:        floorArea ? Number(floorArea) : undefined,
        rent_amount:           rentAmount ? Number(rentAmount) : undefined,
        currency,
        payment_frequency:     frequency,
        furnished:             furnished !== 'Unfurnished',
        parking,
        security_deposit:      deposit    ? Number(deposit)    : undefined,
        agency_fee:            agencyFee  ? Number(agencyFee)  : undefined,
        caution_fee:           cautionFee ? Number(cautionFee) : undefined,
        amenities,
        marketing_description: marketingDesc || undefined,
        cover_image:           coverImage || undefined,
        photo_urls_arr:        gallery.length > 0 ? gallery : undefined,
      });
      setSaveOk('Unit saved successfully.');
      setTimeout(() => setSaveOk(''), 4000);
    } catch (e: any) {
      setSaveErr(e?.response?.data?.error ?? 'Save failed. Try again.');
    } finally { setSaving(false); }
  };

  // ── Advertise ─────────────────────────────────────────────────────────────
  const handleAdvertise = async () => {
    if (!unit) return;
    setAdvertising(true); setAdvertiseErr(''); setConfirmAdvert(false);
    try {
      const res = await api.post('/api/rental/marketplace/advertise', { unit_id: unit.id });
      if (res.data?.authorization_url) {
        window.location.href = res.data.authorization_url;
      } else {
        setSaveOk(res.data?.message ?? 'Unit listed on marketplace!');
      }
    } catch (e: any) {
      setAdvertiseErr(e?.response?.data?.error ?? 'Advertisement failed. Try again.');
    } finally { setAdvertising(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={32}/>
    </div>
  );

  // ── No unitId — show unit picker ──────────────────────────────────────────
  if (!unitId || !unit) return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar/>
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12 w-full space-y-6">
        <Link href="/landlord/inventory"
          className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors w-fit">
          <ArrowLeft size={12}/> Inventory
        </Link>
        <div className="border-l-2 border-amber-400 pl-4">
          <p className="text-[9px] text-amber-400 uppercase font-black tracking-widest mb-1">Unit Editor</p>
          <h1 className="text-2xl font-black uppercase tracking-tight">Select a Unit to Edit</h1>
          <p className="text-zinc-500 text-xs mt-1">Choose which unit you want to update or list on the marketplace.</p>
        </div>
        {saveErr && (
          <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={12}/> {saveErr}
          </div>
        )}
        <div className="space-y-2">
          {allUnits.filter(u => !u.tenant_name).map(u => (
            <Link key={u.id} href={`/landlord/inventory/editor?unitId=${u.id}`}
              className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-center">
                  <Building2 size={14} className="text-zinc-500"/>
                </div>
                <div>
                  <p className="text-sm font-bold">{u.unit_name}</p>
                  <p className="text-[10px] text-zinc-500">{u.project_title} · {u.currency} {safeF(u.rent_amount)}</p>
                </div>
              </div>
              <span className={`text-[8px] px-2 py-0.5 rounded border font-black uppercase ${
                u.is_advertised ? 'border-blue-500/30 text-blue-400' : 'border-amber-500/30 text-amber-400'
              }`}>
                {u.is_advertised ? 'Listed' : 'Vacant'}
              </span>
            </Link>
          ))}
          {allUnits.filter(u => !!u.tenant_name).length > 0 && (
            <>
              <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest pt-2 px-1">Occupied Units (edit specs only)</p>
              {allUnits.filter(u => !!u.tenant_name).map(u => (
                <Link key={u.id} href={`/landlord/inventory/editor?unitId=${u.id}`}
                  className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-center">
                      <Building2 size={14} className="text-zinc-500"/>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{u.unit_name}</p>
                      <p className="text-[10px] text-zinc-500">{u.project_title} · {u.tenant_name}</p>
                    </div>
                  </div>
                  <span className="text-[8px] px-2 py-0.5 rounded border border-teal-500/30 text-teal-400 font-black uppercase">Occupied</span>
                </Link>
              ))}
            </>
          )}
        </div>
      </main>
      <Footer/>
    </div>
  );

  // ── Full editor ───────────────────────────────────────────────────────────
  const isVacant    = !unit.tenant_name;
  const isListed    = !!unit.is_advertised;
  const canAdvertise = isVacant && !isListed;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar/>
      <main className="flex-1 max-w-4xl mx-auto px-4 py-10 w-full space-y-8">

        {/* Header */}
        <div>
          <Link href="/landlord/inventory"
            className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-5 w-fit">
            <ArrowLeft size={12}/> Inventory Matrix
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="border-l-2 border-amber-400 pl-4">
              <p className="text-[9px] text-amber-400 uppercase font-black tracking-widest mb-0.5">Unit Editor</p>
              <h1 className="text-2xl font-black uppercase tracking-tight">{unit.unit_name}</h1>
              <p className="text-zinc-500 text-xs mt-0.5">{unit.project_title}</p>
            </div>
            <div className="flex items-center gap-2">
              {isListed && (
                <Link href="/marketplace" target="_blank"
                  className="flex items-center gap-1.5 px-3 py-2 border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 rounded-xl text-[9px] font-black uppercase transition-all">
                  <ExternalLink size={10}/> View Listing
                </Link>
              )}
              <span className={`text-[8px] px-2.5 py-1.5 rounded-lg border font-black uppercase ${
                isListed   ? 'border-blue-500/30  text-blue-400'  :
                isVacant   ? 'border-amber-500/30 text-amber-400' :
                             'border-teal-500/30  text-teal-400'
              }`}>
                {isListed ? 'Listed on Marketplace' : isVacant ? 'Vacant' : 'Occupied'}
              </span>
            </div>
          </div>
        </div>

        {/* Feedback */}
        {saveOk && (
          <div className="flex items-center gap-2 p-4 rounded-xl border border-teal-500/20 bg-teal-500/5 text-teal-400 text-sm font-bold">
            <CheckCircle2 size={16}/> {saveOk}
          </div>
        )}
        {saveErr && (
          <div className="flex items-center gap-2 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold">
            <AlertCircle size={16}/> {saveErr}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* ── LEFT: Photos + Marketing ── */}
          <div className="lg:col-span-3 space-y-6">

            {/* Cover photo */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
              <p className="text-[9px] text-zinc-400 uppercase font-black tracking-widest flex items-center gap-1.5">
                <Camera size={11} className="text-amber-400"/> Cover Photo
              </p>
              <PhotoUploader
                label="Cover Photo"
                hint="Main photo shown on marketplace listing and inventory card"
                value={coverImage}
                onUpload={url => setCoverImage(url)}
                onClear={() => setCoverImage('')}
              />
            </div>

            {/* Gallery */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
              <p className="text-[9px] text-zinc-400 uppercase font-black tracking-widest flex items-center gap-1.5">
                <ImageIcon size={11} className="text-amber-400"/> Photo Gallery ({gallery.length}/8)
              </p>
              {gallery.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {gallery.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-zinc-800 group">
                      <img src={url} alt={`Photo ${idx+1}`} className="w-full h-full object-cover"/>
                      <button onClick={() => removeGalleryPhoto(idx)}
                        className="absolute top-1 right-1 p-1 bg-black/70 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-red-400 hover:bg-red-500/20">
                        <X size={10}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {gallery.length < 8 && (
                <PhotoUploader
                  label={`Add Photo ${gallery.length + 1}`}
                  hint="Add more photos to attract tenants"
                  onUpload={addGalleryPhoto}
                  onClear={() => {}}
                />
              )}
            </div>

            {/* Marketing description */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
              <p className="text-[9px] text-zinc-400 uppercase font-black tracking-widest flex items-center gap-1.5">
                <Tag size={11} className="text-amber-400"/> Marketplace Description
              </p>
              <p className="text-[10px] text-zinc-600">
                Write a compelling description shown to prospective tenants on the marketplace.
                Mention key features, proximity to landmarks, and what makes this unit special.
              </p>
              <textarea
                rows={6}
                value={marketingDesc}
                onChange={e => setMarketingDesc(e.target.value)}
                placeholder="e.g. Spacious 3-bedroom flat with 24hr security, constant water supply, and nearby access to Ikeja Under-Bridge and Lagos State Secretariat. Ideal for professionals and families..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-700 resize-none focus:outline-none focus:border-teal-500/50 transition-colors leading-relaxed"
              />
              <p className="text-[9px] text-zinc-700">{marketingDesc.length}/500 characters</p>
            </div>

            {/* Amenities */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
              <p className="text-[9px] text-zinc-400 uppercase font-black tracking-widest">Amenities</p>
              <div className="flex flex-wrap gap-2">
                {AMENITY_OPTIONS.map(a => (
                  <button key={a} onClick={() => toggleAmenity(a)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase border transition-all ${
                      amenities.includes(a)
                        ? 'bg-teal-500/10 border-teal-500/30 text-teal-400'
                        : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
                    }`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Specs + Fees + Advertise ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Specs */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
              <p className="text-[9px] text-zinc-400 uppercase font-black tracking-widest">Unit Specs</p>

              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">Unit Name</label>
                <input type="text" value={unitName} onChange={e => setUnitName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500/50 transition-colors"/>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">Bedrooms</label>
                  <select value={bedrooms} onChange={e => setBedrooms(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500/50">
                    {['1','2','3','4','5','6'].map(n => <option key={n} value={n}>{n} Bed</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">Bathrooms</label>
                  <select value={bathrooms} onChange={e => setBathrooms(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500/50">
                    {['1','2','3','4'].map(n => <option key={n} value={n}>{n} Bath</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">Size (sqm)</label>
                <input type="number" value={floorArea} onChange={e => setFloorArea(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500/50 transition-colors"/>
              </div>

              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">Furnishing</label>
                <div className="flex gap-2">
                  {['Unfurnished','Semi-Furnished','Fully Furnished'].map(f => (
                    <button key={f} onClick={() => setFurnishing(f)}
                      className={`flex-1 py-2 text-[9px] font-bold uppercase rounded-xl border transition-all ${
                        furnished === f
                          ? 'bg-zinc-800 border-teal-500/40 text-teal-400'
                          : 'border-zinc-800 text-zinc-600 hover:text-zinc-400'
                      }`}>
                      {f.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setParking(!parking)}
                  className={`w-9 h-5 rounded-full transition-colors relative ${parking ? 'bg-teal-500' : 'bg-zinc-800'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${parking ? 'left-4' : 'left-0.5'}`}/>
                </div>
                <span className="text-xs text-zinc-400 font-bold">Parking Available</span>
              </label>
            </div>

            {/* Rent + Fees */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
              <p className="text-[9px] text-zinc-400 uppercase font-black tracking-widest">Rent & Fees</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">Currency</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-amber-400 font-bold focus:outline-none focus:border-teal-500/50">
                    {['NGN','USD','GBP','EUR','GHS','KES'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">Frequency</label>
                  <select value={frequency} onChange={e => setFrequency(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500/50">
                    {['Monthly','Quarterly','Bi-Annual','Annual'].map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">Rent Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-bold">₦</span>
                  <input type="number" value={rentAmount} onChange={e => setRentAmount(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-7 pr-4 py-2.5 text-sm font-bold text-teal-400 focus:outline-none focus:border-teal-500/50 transition-colors"/>
                </div>
              </div>

              {[
                { label: 'Security Deposit', val: deposit,    set: setDeposit    },
                { label: 'Agency Fee',       val: agencyFee,  set: setAgencyFee  },
                { label: 'Caution Fee',      val: cautionFee, set: setCautionFee },
              ].map(({label, val, set}) => (
                <div key={label}>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">{label}</label>
                  <input type="number" value={val} onChange={e => set(e.target.value)}
                    placeholder="0"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500/50 transition-colors"/>
                </div>
              ))}
            </div>

            {/* Save button */}
            <button onClick={handleSave} disabled={saving}
              className="w-full py-3.5 bg-white text-black font-black uppercase text-xs tracking-widest rounded-xl hover:bg-teal-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={13} className="animate-spin"/> Saving…</> : <><Save size={13}/> Save Changes</>}
            </button>

            {/* ── Advertise panel ── */}
            {isVacant && (
              <div className={`p-5 rounded-2xl border space-y-4 ${
                isListed
                  ? 'border-blue-500/20 bg-blue-500/5'
                  : 'border-amber-500/20 bg-amber-500/5'
              }`}>
                <div className="flex items-center gap-2">
                  <Megaphone size={14} className={isListed ? 'text-blue-400' : 'text-amber-400'}/>
                  <p className={`text-[9px] font-black uppercase tracking-widest ${isListed ? 'text-blue-400' : 'text-amber-400'}`}>
                    {isListed ? 'Currently Listed on Marketplace' : 'Advertise on Marketplace'}
                  </p>
                </div>

                {isListed ? (
                  <>
                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                      This unit is visible to prospective tenants on the Nested Ark marketplace.
                      Keep your photos and description updated to attract quality tenants faster.
                    </p>
                    <Link href="/marketplace" target="_blank"
                      className="flex items-center justify-center gap-1.5 py-2.5 border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all">
                      <ExternalLink size={10}/> View Public Listing
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                      Pay a one-time <strong className="text-amber-400">₦5,000 listing fee</strong> to advertise
                      this vacant unit on the Nested Ark Property Marketplace. Instantly visible to thousands of
                      verified prospective tenants.
                    </p>
                    <ul className="space-y-1">
                      {['Instant marketplace visibility', 'SHA-256 verified listing', 'Tenant enquiry via platform', 'Remove any time'].map(f => (
                        <li key={f} className="flex items-center gap-2 text-[10px] text-zinc-500">
                          <CheckCircle2 size={10} className="text-teal-500 shrink-0"/> {f}
                        </li>
                      ))}
                    </ul>

                    {advertiseErr && (
                      <div className="flex items-center gap-2 text-[10px] text-red-400 font-bold">
                        <AlertCircle size={10}/> {advertiseErr}
                      </div>
                    )}

                    {!confirmAdvert ? (
                      <button onClick={() => setConfirmAdvert(true)} disabled={advertising}
                        className="w-full py-3 bg-amber-500 text-black font-black uppercase text-xs tracking-widest rounded-xl hover:bg-amber-400 transition-all flex items-center justify-center gap-2">
                        <Megaphone size={12}/> Advertise This Unit — ₦5,000
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[10px] text-amber-400 font-bold text-center">
                          You'll be redirected to Paystack to pay ₦5,000. Confirm?
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmAdvert(false)}
                            className="flex-1 py-2 border border-zinc-700 text-zinc-500 rounded-xl text-[9px] font-bold hover:border-zinc-500 transition-all">
                            Cancel
                          </button>
                          <button onClick={handleAdvertise} disabled={advertising}
                            className="flex-1 py-2 bg-amber-500 text-black rounded-xl text-[9px] font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1">
                            {advertising ? <Loader2 size={10} className="animate-spin"/> : <Megaphone size={10}/>}
                            Pay & List
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Occupied — no advertise */}
            {!isVacant && (
              <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 text-center">
                <p className="text-[10px] text-zinc-500">This unit is occupied by {unit.tenant_name}.</p>
                <p className="text-[9px] text-zinc-600 mt-1">Marketplace listing is only available for vacant units.</p>
              </div>
            )}

          </div>
        </div>
      </main>
      <Footer/>
    </div>
  );
}


export default function InventoryEditorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={32}/>
      </div>
    }>
      <EditorContent/>
    </Suspense>
  );
}
