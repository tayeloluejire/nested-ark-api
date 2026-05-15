'use client';
export const dynamic = 'force-dynamic';
/**
 * src/app/landlord/units/editor/page.tsx
 * Landlord unit editor — edit unit spec + live marketplace card preview.
 * Also handles: advertise unit (Paystack), delete unit.
 * API: PUT /api/rental/units/:id, POST /api/rental/marketplace/advertise
 *      DELETE /api/rental/units/:id
 */
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import {
  Edit3, Eye, ShieldCheck, MapPin, BedDouble, Bath,
  Save, Loader2, AlertCircle, CheckCircle2, Megaphone,
  Trash2, ArrowLeft, Building2,
} from 'lucide-react';

const safeF = (v: any) => Number(v ?? 0).toLocaleString();

const AMENITY_OPTIONS = [
  'Air Conditioning','Generator','Water Supply','CCTV','Security','Gym',
  'Swimming Pool','Parking','Elevator','Solar Power','Smart Meter','Intercom',
  'Serviced','Gated Estate','Boys Quarters','Garden',
];

function EditorContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const unitId       = searchParams.get('unit') ?? '';

  const [unit,     setUnit]     = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  // Form state — mirrors rental_units columns
  const [form, setForm] = useState({
    unit_name:             '',
    unit_type:             '',
    rent_amount:           '',
    currency:              'NGN',
    payment_frequency:     'ANNUAL',
    bedrooms:              '',
    bathrooms:             '',
    size_sqm:              '',
    floor_number:          '',
    furnished:             false,
    parking:               false,
    security_deposit:      '',
    agency_fee:            '',
    legal_fee:             '',
    caution_fee:           '',
    service_charge:        '',
    marketing_description: '',
    cover_image:           '',
    amenities:             [] as string[],
  });

  useEffect(() => {
    if (!unitId) { setLoading(false); return; }
    api.get(`/api/rental/units/single/${unitId}`)
      .then(r => {
        const u = r.data.unit ?? r.data;
        setUnit(u);
        setForm({
          unit_name:             u.unit_name ?? '',
          unit_type:             u.unit_type ?? '',
          rent_amount:           String(u.rent_amount ?? ''),
          currency:              u.currency ?? 'NGN',
          payment_frequency:     u.payment_frequency ?? 'ANNUAL',
          bedrooms:              String(u.bedrooms ?? ''),
          bathrooms:             String(u.bathrooms ?? ''),
          size_sqm:              String(u.size_sqm ?? ''),
          floor_number:          String(u.floor_number ?? ''),
          furnished:             u.furnished ?? false,
          parking:               u.parking ?? false,
          security_deposit:      String(u.security_deposit ?? ''),
          agency_fee:            String(u.agency_fee ?? ''),
          legal_fee:             String(u.legal_fee ?? ''),
          caution_fee:           String(u.caution_fee ?? ''),
          service_charge:        String(u.service_charge ?? ''),
          marketing_description: u.marketing_description ?? '',
          cover_image:           u.cover_image ?? '',
          amenities:             Array.isArray(u.amenities) ? u.amenities : [],
        });
      })
      .catch(e => setError(e?.response?.data?.error ?? 'Could not load unit'))
      .finally(() => setLoading(false));
  }, [unitId]);

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.put(`/api/rental/units/${unitId}`, {
        ...form,
        rent_amount:      parseFloat(form.rent_amount) || 0,
        bedrooms:         parseInt(form.bedrooms)      || 0,
        bathrooms:        parseInt(form.bathrooms)     || 0,
        size_sqm:         parseFloat(form.size_sqm)   || null,
        floor_number:     parseInt(form.floor_number)  || null,
        security_deposit: parseFloat(form.security_deposit) || 0,
        agency_fee:       parseFloat(form.agency_fee)  || 0,
        legal_fee:        parseFloat(form.legal_fee)   || 0,
        caution_fee:      parseFloat(form.caution_fee) || 0,
        service_charge:   parseFloat(form.service_charge) || 0,
      });
      setSuccess('Unit specifications saved to ledger.');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Save failed');
    } finally { setSaving(false); }
  };

  const handleAdvertise = async () => {
    setAdLoading(true); setError('');
    try {
      const res = await api.post('/api/rental/marketplace/advertise', { unit_id: unitId });
      if (res.data.authorization_url) {
        window.location.href = res.data.authorization_url;
      }
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Could not initiate listing payment');
      setAdLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete unit "${form.unit_name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/api/rental/units/${unitId}`);
      router.back();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Delete failed');
      setDeleting(false);
    }
  };

  const toggleAmenity = (a: string) => {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(a)
        ? f.amenities.filter(x => x !== a)
        : [...f.amenities, a],
    }));
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={28} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <button onClick={() => router.back()}
              className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-3">
              <ArrowLeft size={12} /> Back
            </button>
            <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest mb-1">Unit Editor</p>
            <h1 className="text-2xl font-black uppercase tracking-tight">
              {unit ? form.unit_name || 'Untitled Unit' : 'New Unit'}
            </h1>
            {unit?.is_advertised && (
              <span className="inline-flex items-center gap-1 mt-2 text-[8px] px-2 py-0.5 rounded border border-teal-500/30 text-teal-400 bg-teal-500/10 font-black uppercase">
                <ShieldCheck size={9} /> Listed on Marketplace
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {unit && !unit.is_advertised && unit.status !== 'OCCUPIED' && (
              <button onClick={handleAdvertise} disabled={adLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black uppercase rounded-xl hover:bg-amber-500/20 transition-all disabled:opacity-60">
                {adLoading ? <Loader2 size={13} className="animate-spin" /> : <Megaphone size={13} />}
                Advertise (₦5,000)
              </button>
            )}
            {unit && unit.status !== 'OCCUPIED' && (
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase rounded-xl hover:bg-red-500/20 transition-all disabled:opacity-60">
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Delete
              </button>
            )}
          </div>
        </div>

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* ── Edit pane ─────────────────────────────────────────────── */}
          <div className="space-y-6">
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest flex items-center gap-1.5 border-b border-zinc-800 pb-3 mb-1">
                <Edit3 size={10} className="text-teal-400" /> Unit Specifications
              </p>

              {/* Name + Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1.5">Unit Name *</label>
                  <input value={form.unit_name} onChange={e => setForm(f => ({...f, unit_name: e.target.value}))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1.5">Unit Type</label>
                  <input value={form.unit_type} onChange={e => setForm(f => ({...f, unit_type: e.target.value}))}
                    placeholder="e.g. Flat, Studio, Duplex"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 transition-colors" />
                </div>
              </div>

              {/* Rent + Frequency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1.5">Rent Amount (NGN) *</label>
                  <input type="number" value={form.rent_amount} onChange={e => setForm(f => ({...f, rent_amount: e.target.value}))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 font-mono transition-colors" />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1.5">Payment Frequency</label>
                  <select value={form.payment_frequency} onChange={e => setForm(f => ({...f, payment_frequency: e.target.value}))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 transition-colors">
                    {['MONTHLY','QUARTERLY','BIANNUAL','ANNUAL'].map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              {/* Beds + Baths + Size + Floor */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { key: 'bedrooms',     label: 'Beds' },
                  { key: 'bathrooms',    label: 'Baths' },
                  { key: 'size_sqm',     label: 'sqm' },
                  { key: 'floor_number', label: 'Floor' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1.5">{f.label}</label>
                    <input type="number" value={(form as any)[f.key]}
                      onChange={e => setForm(prev => ({...prev, [f.key]: e.target.value}))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 font-mono transition-colors" />
                  </div>
                ))}
              </div>

              {/* Toggles */}
              <div className="flex gap-4">
                {[
                  { key: 'furnished', label: 'Furnished' },
                  { key: 'parking',   label: 'Parking' },
                ].map(t => (
                  <button key={t.key} onClick={() => setForm(f => ({...f, [t.key]: !(f as any)[t.key]}))}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase border transition-all ${
                      (form as any)[t.key]
                        ? 'border-teal-500/40 bg-teal-500/10 text-teal-400'
                        : 'border-zinc-700 text-zinc-500 hover:border-zinc-600'
                    }`}>
                    <div className={`w-3 h-3 rounded-full ${(form as any)[t.key] ? 'bg-teal-500' : 'bg-zinc-700'}`} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fees */}
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest border-b border-zinc-800 pb-3 mb-1">
                Fees & Charges
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'security_deposit', label: 'Security Deposit' },
                  { key: 'agency_fee',       label: 'Agency Fee' },
                  { key: 'legal_fee',        label: 'Legal Fee' },
                  { key: 'caution_fee',      label: 'Caution Fee' },
                  { key: 'service_charge',   label: 'Service Charge' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1.5">{f.label}</label>
                    <input type="number" value={(form as any)[f.key]}
                      onChange={e => setForm(prev => ({...prev, [f.key]: e.target.value}))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 font-mono transition-colors" />
                  </div>
                ))}
              </div>
            </div>

            {/* Marketplace fields */}
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest border-b border-zinc-800 pb-3 mb-1">
                Marketplace Presentation
              </p>
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1.5">Cover Image URL</label>
                <input value={form.cover_image} onChange={e => setForm(f => ({...f, cover_image: e.target.value}))}
                  placeholder="https://..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-300 outline-none focus:border-teal-500 font-mono transition-colors" />
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1.5">Marketing Description</label>
                <textarea rows={3} value={form.marketing_description}
                  onChange={e => setForm(f => ({...f, marketing_description: e.target.value}))}
                  placeholder="Describe the unit for prospective tenants…"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 transition-colors resize-none leading-relaxed font-sans" />
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Amenities</label>
                <div className="flex flex-wrap gap-2">
                  {AMENITY_OPTIONS.map(a => (
                    <button key={a} onClick={() => toggleAmenity(a)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                        form.amenities.includes(a)
                          ? 'border-teal-500/40 bg-teal-500/10 text-teal-400'
                          : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
                      }`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Save button */}
            <button onClick={handleSave} disabled={saving}
              className="w-full py-4 bg-teal-500 text-black font-black uppercase tracking-widest rounded-2xl hover:bg-teal-400 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Save size={16} /> Save to Ledger</>}
            </button>
          </div>

          {/* ── Live preview pane ──────────────────────────────────────── */}
          <div className="space-y-4 lg:sticky lg:top-8">
            <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest flex items-center gap-1.5 border-b border-zinc-800 pb-3">
              <Eye size={10} className="text-teal-400" /> Live Marketplace Preview
            </p>
            <div className="bg-zinc-900/30 border border-zinc-700 rounded-2xl overflow-hidden shadow-2xl">
              {/* Image */}
              <div className="relative aspect-video bg-zinc-900 border-b border-zinc-800 overflow-hidden">
                {form.cover_image ? (
                  <img src={form.cover_image} alt="Preview" className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-700">
                    <Building2 size={36} />
                    <span className="text-[9px] font-mono uppercase">No cover image set</span>
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <span className="flex items-center gap-1 bg-teal-500/10 border border-teal-500/30 text-teal-400 text-[8px] px-2 py-0.5 rounded font-black uppercase backdrop-blur-sm">
                    <ShieldCheck size={9} /> Ark Verified
                  </span>
                </div>
                <div className="absolute bottom-3 right-3">
                  <span className="bg-black/80 text-teal-400 font-mono font-bold text-[10px] px-2 py-1 rounded">
                    ₦{safeF(form.rent_amount)} / {form.payment_frequency?.toLowerCase() || 'yr'}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="p-5 space-y-3">
                <h3 className="font-black text-sm uppercase tracking-tight text-white">
                  {form.unit_name || 'Untitled Unit'}
                </h3>
                <p className="text-[10px] text-zinc-500 font-mono flex items-center gap-1 uppercase">
                  <MapPin size={9} />
                  {unit?.project_title || 'Property name'}{unit?.location ? ` · ${unit.location}` : ''}
                </p>

                {/* Specs */}
                <div className="flex items-center gap-4 text-[10px] text-zinc-400 font-mono">
                  {form.bedrooms && <span className="flex items-center gap-1"><BedDouble size={11} className="text-zinc-600" /> {form.bedrooms} BR</span>}
                  {form.bathrooms && <span className="flex items-center gap-1"><Bath size={11} className="text-zinc-600" /> {form.bathrooms} BTH</span>}
                  {form.size_sqm && <span>{form.size_sqm} m²</span>}
                  {form.furnished && <span className="text-amber-400">Furnished</span>}
                  {form.parking && <span className="text-teal-500">Parking</span>}
                </div>

                {/* Fees */}
                {(form.security_deposit || form.agency_fee || form.caution_fee) && (
                  <div className="flex flex-wrap gap-2">
                    {parseFloat(form.security_deposit) > 0 && (
                      <span className="text-[8px] px-2 py-0.5 rounded border border-zinc-700 text-zinc-500 font-mono">
                        Deposit: ₦{safeF(form.security_deposit)}
                      </span>
                    )}
                    {parseFloat(form.agency_fee) > 0 && (
                      <span className="text-[8px] px-2 py-0.5 rounded border border-zinc-700 text-zinc-500 font-mono">
                        Agency: ₦{safeF(form.agency_fee)}
                      </span>
                    )}
                    {parseFloat(form.caution_fee) > 0 && (
                      <span className="text-[8px] px-2 py-0.5 rounded border border-zinc-700 text-zinc-500 font-mono">
                        Caution: ₦{safeF(form.caution_fee)}
                      </span>
                    )}
                  </div>
                )}

                {/* Description */}
                {form.marketing_description && (
                  <p className="text-[11px] text-zinc-400 line-clamp-3 leading-relaxed font-sans">
                    {form.marketing_description}
                  </p>
                )}

                {/* Amenities */}
                {form.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {form.amenities.slice(0, 5).map(a => (
                      <span key={a} className="text-[8px] px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-bold uppercase">
                        {a}
                      </span>
                    ))}
                    {form.amenities.length > 5 && (
                      <span className="text-[8px] px-2 py-0.5 rounded border border-zinc-700 text-zinc-500">
                        +{form.amenities.length - 5} more
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                  <div>
                    <p className="text-[8px] text-zinc-600 uppercase font-bold">Annual Rent</p>
                    <p className="font-mono font-black text-teal-400 text-lg">
                      {form.currency} {safeF(form.rent_amount)}
                    </p>
                  </div>
                  <button className="px-4 py-2 bg-white text-black text-[10px] font-black uppercase rounded-xl opacity-70 cursor-not-allowed">
                    Apply
                  </button>
                </div>
              </div>
            </div>

            {/* Advertise CTA */}
            {unit && !unit.is_advertised && unit.status !== 'OCCUPIED' && (
              <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-2">
                <p className="text-[9px] text-amber-400 uppercase font-black tracking-widest flex items-center gap-1.5">
                  <Megaphone size={10} /> Reach more tenants
                </p>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  List this unit on the Nested Ark public marketplace for a one-time fee of <span className="text-white font-bold">₦5,000</span>. Verified badge included.
                </p>
                <button onClick={handleAdvertise} disabled={adLoading}
                  className="w-full py-2.5 bg-amber-500 text-black font-black text-xs uppercase rounded-xl hover:bg-amber-400 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {adLoading ? <Loader2 size={13} className="animate-spin" /> : <Megaphone size={13} />}
                  Advertise This Unit — ₦5,000
                </button>
              </div>
            )}

            {unit?.is_advertised && (
              <div className="p-4 rounded-2xl border border-teal-500/20 bg-teal-500/5 flex items-center gap-3">
                <ShieldCheck size={18} className="text-teal-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-black text-teal-400 uppercase tracking-widest">Live on Marketplace</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">This unit is visible to all prospective tenants.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
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
      <EditorContent />
    </Suspense>
  );
}
