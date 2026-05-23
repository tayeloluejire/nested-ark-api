'use client';
export const dynamic = 'force-dynamic';
/**
 * /landlord/inventory/editor/page.tsx
 * Unit Editor — edit specs, marketing copy and preview live card
 * API: GET  /api/landlord/units/:unitId
 *      PUT  /api/landlord/units/:unitId
 * Query param: ?unitId=<uuid>  (pre-loads the unit for editing)
 */
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  Edit3, Eye, ShieldCheck, MapPin, Layers, Save,
  ArrowLeft, Loader2, CheckCircle2, AlertCircle,
  BedDouble, Bath, Building2,
} from 'lucide-react';

const safeF = (v: any) => Number(v ?? 0).toLocaleString();

function EditorContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const unitId       = searchParams.get('unitId');

  const [loading,  setLoading]  = useState(!!unitId);
  const [saving,   setSaving]   = useState(false);
  const [feedback, setFeedback] = useState<{type:'ok'|'err'; msg:string} | null>(null);

  const [form, setForm] = useState({
    unit_name:             '',
    rent_amount:           '',
    location:              '',
    bedrooms:              '1',
    bathrooms:             '1',
    size_sqm:              '',
    floor_level:           '',
    furnishing:            'UNFURNISHED',
    marketing_description: '',
    cover_image:           '',
    currency:              'NGN',
    payment_frequency:     'ANNUAL',
  });

  useEffect(() => {
    if (!unitId) return;
    api.get(`/api/landlord/units/${unitId}`)
      .then(res => {
        const u = res.data?.unit ?? res.data;
        if (u) setForm({
          unit_name:             u.unit_name             || '',
          rent_amount:           String(u.rent_amount    || ''),
          location:              u.location              || '',
          bedrooms:              String(u.bedrooms       || 1),
          bathrooms:             String(u.bathrooms      || 1),
          size_sqm:              String(u.size_sqm       || ''),
          floor_level:           u.floor_level           || '',
          furnishing:            u.furnishing            || 'UNFURNISHED',
          marketing_description: u.marketing_description || '',
          cover_image:           u.cover_image           || '',
          currency:              u.currency              || 'NGN',
          payment_frequency:     u.payment_frequency     || 'ANNUAL',
        });
      })
      .catch(() => setFeedback({ type: 'err', msg: 'Could not load unit data.' }))
      .finally(() => setLoading(false));
  }, [unitId]);

  const set = (key: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.unit_name.trim()) { setFeedback({ type: 'err', msg: 'Unit name is required.' }); return; }
    if (!unitId) { setFeedback({ type: 'err', msg: 'No unit selected. Open from Inventory Matrix.' }); return; }
    setSaving(true); setFeedback(null);
    try {
      await api.put(`/api/landlord/units/${unitId}`, {
        ...form,
        rent_amount: Number(form.rent_amount) || 0,
        bedrooms:    Number(form.bedrooms)    || 1,
        bathrooms:   Number(form.bathrooms)   || 1,
        size_sqm:    Number(form.size_sqm)    || null,
      });
      setFeedback({ type: 'ok', msg: 'Unit specifications saved successfully.' });
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error ?? 'Save failed. Try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center py-32 gap-3 text-zinc-500">
      <Loader2 size={20} className="animate-spin text-teal-400" />
      <span className="text-xs uppercase font-bold tracking-widest">Loading unit…</span>
    </div>
  );

  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-10 w-full space-y-6">

      {/* Header */}
      <div>
        <Link href="/landlord/inventory"
          className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-6 w-fit">
          <ArrowLeft size={12} /> Inventory Matrix
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <Edit3 size={16} className="text-amber-400" />
          <p className="text-[9px] text-amber-400 font-mono font-black tracking-widest uppercase">Unit Editor</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter italic">
          {unitId ? 'Edit Unit Specifications' : 'Unit Editor'}
        </h1>
        <p className="text-zinc-500 text-sm mt-2">
          Real-time dual-pane: edit specs on the left, preview the marketplace card on the right.
        </p>
        {!unitId && (
          <div className="mt-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={14} /> Open this page from the Inventory Matrix with a unit selected to edit.
          </div>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`p-4 rounded-xl border flex items-center gap-2 text-sm font-bold ${
          feedback.type === 'ok'
            ? 'bg-teal-500/10 border-teal-500/20 text-teal-400'
            : 'bg-red-500/5 border-red-500/20 text-red-400'
        }`}>
          {feedback.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {feedback.msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

        {/* ── Pane A: Editor ─────────────────────────────────────────── */}
        <div className="bg-zinc-900/20 border border-zinc-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-900">
            <Edit3 size={12} className="text-amber-400" />
            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Mutation Controls</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Unit Name *</label>
            <input value={form.unit_name} onChange={set('unit_name')}
              placeholder="e.g. Alpha Courts, Flat 3B"
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Currency</label>
              <select value={form.currency} onChange={set('currency')}
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors">
                {['NGN','USD','GBP','EUR','GHS','KES','AED','ZAR'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Frequency</label>
              <select value={form.payment_frequency} onChange={set('payment_frequency')}
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors">
                {['MONTHLY','QUARTERLY','BI_ANNUAL','ANNUAL'].map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Rent Amount *</label>
            <input type="number" value={form.rent_amount} onChange={set('rent_amount')} min="0"
              placeholder="e.g. 750000"
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors font-mono" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Location</label>
            <input value={form.location} onChange={set('location')}
              placeholder="e.g. Lekki Phase 1, Lagos"
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Bedrooms',   key: 'bedrooms',   opts: ['1','2','3','4','5','6'] },
              { label: 'Bathrooms',  key: 'bathrooms',  opts: ['1','2','3','4'] },
              { label: 'Furnishing', key: 'furnishing', opts: ['UNFURNISHED','SEMI_FURNISHED','FULLY_FURNISHED'] },
            ].map(({ label, key, opts }) => (
              <div key={key} className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">{label}</label>
                <select value={(form as any)[key]} onChange={set(key)}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors">
                  {opts.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Size (sqm)</label>
              <input type="number" value={form.size_sqm} onChange={set('size_sqm')} min="0"
                placeholder="e.g. 85"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Floor Level</label>
              <input value={form.floor_level} onChange={set('floor_level')}
                placeholder="e.g. Ground, 2nd"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">
              Cover Image URL <span className="text-zinc-700 normal-case">(optional)</span>
            </label>
            <input value={form.cover_image} onChange={set('cover_image')}
              placeholder="https://…"
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-400 focus:border-teal-500 outline-none transition-colors text-xs" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block">Marketing Description</label>
            <textarea value={form.marketing_description} onChange={set('marketing_description')} rows={3}
              placeholder="Describe features, amenities, and why tenants will love this unit…"
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors resize-none" />
          </div>

          <button onClick={handleSave} disabled={saving || !unitId}
            className="w-full py-4 bg-teal-500 text-black font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-white transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="animate-spin" size={14} /> Saving…</> : <><Save size={14} /> Save Specifications</>}
          </button>
        </div>

        {/* ── Pane B: Live Preview ────────────────────────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-24">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-900">
            <Eye size={12} className="text-teal-400" />
            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Live Marketplace Preview</p>
          </div>

          <div className="max-w-md mx-auto bg-zinc-900/30 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl group transition-all duration-300 hover:border-teal-500/30">

            {/* Cover */}
            <div className="relative aspect-video bg-zinc-900 border-b border-zinc-800 overflow-hidden">
              {form.cover_image ? (
                <img src={form.cover_image} alt="Preview" className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <Building2 size={28} className="text-zinc-700" />
                  <p className="text-[9px] text-zinc-700 uppercase font-mono">No image URL set</p>
                </div>
              )}
              <span className="absolute top-3 right-3 flex items-center gap-1 bg-teal-500/10 border border-teal-500/30 text-teal-400 text-[8px] px-2 py-0.5 rounded font-black uppercase backdrop-blur-sm">
                <ShieldCheck size={9} /> Ark Verified
              </span>
              <div className="absolute bottom-3 right-3">
                <span className="bg-black/80 text-white text-[9px] px-2 py-1 rounded font-mono font-bold">
                  {form.currency} {safeF(form.rent_amount)} / {form.payment_frequency.toLowerCase()}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-5">
              <h3 className="font-black text-sm uppercase tracking-tight text-white truncate">
                {form.unit_name || 'UNIT NAME'}
              </h3>
              <p className="text-[10px] text-zinc-500 font-mono mt-1 flex items-center gap-1 uppercase">
                <MapPin size={9} className="text-zinc-600" />
                {form.location || 'Location not set'}
              </p>

              <div className="flex items-center gap-4 mt-3 text-[10px] text-zinc-400 font-mono border-y border-zinc-800 py-2 my-3">
                <span className="flex items-center gap-1"><BedDouble size={10} /> {form.bedrooms} BR</span>
                <span className="flex items-center gap-1"><Bath size={10} /> {form.bathrooms} BTH</span>
                {form.size_sqm && <span>{form.size_sqm} m²</span>}
                <span className="text-amber-400 uppercase text-[8px]">{form.furnishing.replace('_', ' ')}</span>
              </div>

              {form.marketing_description && (
                <p className="text-[11px] text-zinc-400 line-clamp-3 leading-relaxed font-sans">
                  {form.marketing_description}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 border-t border-zinc-800 pt-4 flex items-center justify-between">
              <div>
                <p className="text-[8px] text-zinc-600 uppercase font-bold">Annual Rent</p>
                <p className="font-mono font-black text-teal-400 text-lg">
                  {form.currency} {safeF(form.rent_amount)}
                </p>
              </div>
              <button disabled
                className="px-4 py-2 bg-zinc-800 text-zinc-500 text-[10px] font-black uppercase rounded-xl cursor-not-allowed">
                Preview Only
              </button>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}

export default function UnitEditorPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center py-32 gap-3 text-zinc-500">
          <Loader2 size={20} className="animate-spin text-teal-400" />
        </div>
      }>
        <EditorContent />
      </Suspense>
      <Footer />
    </div>
  );
}
