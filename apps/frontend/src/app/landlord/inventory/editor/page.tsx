'use client';
export const dynamic = 'force-dynamic';
/**
 * /landlord/inventory/editor/page.tsx
 * Unit Editor — edit specs, marketing copy and preview live card
 * API: GET   /api/landlord/units/:unitId
 * PUT   /api/landlord/units/:unitId
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
  BedDouble, Bath, Building2, Sparkles, Image, Info, DollarSign
} from 'lucide-react';

const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any) => safeN(v).toLocaleString();

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
      .catch(() => setFeedback({ type: 'err', msg: 'Could not load unit data from Nest Engine.' }))
      .finally(() => setLoading(false));
  }, [unitId]);

  const set = (key: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.unit_name.trim()) { setFeedback({ type: 'err', msg: 'Unit designation name is required.' }); return; }
    if (!unitId) { setFeedback({ type: 'err', msg: 'No active unit linked. Instantiate from Inventory Matrix.' }); return; }
    setSaving(true); setFeedback(null);
    try {
      await api.put(`/api/landlord/units/${unitId}`, {
        ...form,
        rent_amount: Number(form.rent_amount) || 0,
        bedrooms:    Number(form.bedrooms)    || 1,
        bathrooms:   Number(form.bathrooms)   || 1,
        size_sqm:    Number(form.size_sqm)    || null,
      });
      setFeedback({ type: 'ok', msg: 'Unit cryptographic ledger specifications saved successfully.' });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error ?? 'Specification storage routine failed.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex-1 flex flex-col items-center justify-center py-40 gap-4 text-zinc-500">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-12 h-12 rounded-full border border-teal-500/20 animate-ping" />
        <Loader2 size={24} className="animate-spin text-teal-400 relative z-10" />
      </div>
      <span className="text-xs uppercase font-black tracking-[0.25em] text-zinc-400">Syncing Unit Engine…</span>
    </div>
  );

  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-12 w-full space-y-10">

      {/* Top Navigation & Brand Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-zinc-900 pb-8">
        <div className="space-y-3">
          <Link href="/landlord/inventory"
            className="group flex items-center gap-2 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-colors w-fit">
            <ArrowLeft size={12} className="transform group-hover:-translate-x-1 transition-transform" /> Back To Matrix
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-[10px] text-amber-400 font-mono font-black tracking-[0.2em] uppercase">Core Unit Mutator</p>
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic text-white">
            {form.unit_name ? `Modify: ${form.unit_name}` : 'Unit Specifications'}
          </h1>
          <p className="text-zinc-500 text-xs max-w-xl font-medium leading-relaxed">
            Dynamic hardware console. Adjust engineering configurations on the left-pane controller to dynamically rebuild the user-facing marketplace matrix asset.
          </p>
        </div>

        {/* Floating Matrix Trigger Warning */}
        {!unitId && (
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs font-bold flex items-center gap-3 max-w-sm backdrop-blur-sm">
            <AlertCircle size={18} className="shrink-0 text-amber-400 animate-bounce" />
            <p className="leading-tight">Matrix Lock active. Initialize this dynamic page with an operational query selector.</p>
          </div>
        )}
      </div>

      {/* Global State Feedback Toast Row */}
      {feedback && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs uppercase font-black tracking-widest transition-all duration-300 ${
          feedback.type === 'ok'
            ? 'bg-teal-500/10 border-teal-500/30 text-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.05)]'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {feedback.type === 'ok' ? <CheckCircle2 size={16} className="text-teal-400 animate-pulse" /> : <AlertCircle size={16} />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Dual Pane Layout Context */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* ── Pane A: Core Controller Form Configuration (7 Cols) ─────────────────────────────────────────── */}
        <div className="lg:col-span-7 bg-zinc-950/40 border border-zinc-900 rounded-2xl p-6 md:p-8 space-y-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-900">
            <div className="flex items-center gap-2">
              <Edit3 size={14} className="text-teal-400" />
              <h2 className="text-xs text-zinc-400 font-black uppercase tracking-[0.15em]">Specification Controls</h2>
            </div>
            <span className="text-[9px] font-mono font-bold text-zinc-600 bg-zinc-900 px-2 py-1 rounded">V3 ENGINE</span>
          </div>

          {/* Block Section 1: Core Identification */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest block">Unit Designation Template *</label>
              <div className="relative">
                <input value={form.unit_name} onChange={set('unit_name')}
                  placeholder="e.g. Premium Penthouse, Block A"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all placeholder-zinc-700 font-medium" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest block">Geographic Coordinates / Location</label>
              <div className="relative">
                <MapPin size={14} className="absolute left-4 top-4 text-zinc-600" />
                <input value={form.location} onChange={set('location')}
                  placeholder="e.g. Lekki Phase 1, Lagos"
                  className="w-full bg-black border border-zinc-800 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all placeholder-zinc-700 font-medium" />
              </div>
            </div>
          </div>

          {/* Block Section 2: Financial Matrix System */}
          <div className="bg-black/40 border border-zinc-900/60 p-4 md:p-5 rounded-xl space-y-4">
            <p className="text-[9px] font-mono text-teal-400 uppercase font-black tracking-widest flex items-center gap-1.5">
              <DollarSign size={10} /> Escrow & Valuation Ticker
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Currency Gateway</label>
                <select value={form.currency} onChange={set('currency')}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all cursor-pointer font-semibold font-mono">
                  {['NGN','USD','GBP','EUR','GHS','KES','AED','ZAR'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest block">Rent Financial Amount *</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 font-mono text-sm text-zinc-600 font-bold">{form.currency}</span>
                  <input type="number" value={form.rent_amount} onChange={set('rent_amount')} min="0"
                    placeholder="0.00"
                    className="w-full bg-black border border-zinc-800 rounded-xl pl-14 pr-4 py-3.5 text-sm text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all font-mono font-bold placeholder-zinc-800" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Drawdown / Remittance Frequency Cycle</label>
              <select value={form.payment_frequency} onChange={set('payment_frequency')}
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all cursor-pointer font-bold tracking-wider text-xs">
                <option value="MONTHLY">MONTHLY DRAWDOWN</option>
                <option value="QUARTERLY">QUARTERLY VAULT</option>
                <option value="BI_ANNUAL">BI-ANNUAL AMORTIZATION</option>
                <option value="ANNUAL">ANNUAL CYCLE</option>
              </select>
            </div>
          </div>

          {/* Block Section 3: Spatial Configuration Attributes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest block">Bedrooms</label>
              <select value={form.bedrooms} onChange={set('bedrooms')}
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all font-mono">
                {['1','2','3','4','5','6','7','8'].map(o => <option key={o} value={o}>{o} Bedroom{Number(o) > 1 ? 's' : ''}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest block">Bathrooms</label>
              <select value={form.bathrooms} onChange={set('bathrooms')}
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all font-mono">
                {['1','2','3','4','5'].map(o => <option key={o} value={o}>{o} Bathroom{Number(o) > 1 ? 's' : ''}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest block">Furnishing State</label>
              <select value={form.furnishing} onChange={set('furnishing')}
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3.5 text-xs text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all font-bold tracking-wider">
                <option value="UNFURNISHED">UNFURNISHED</option>
                <option value="SEMI_FURNISHED">SEMI-FURNISHED</option>
                <option value="FULLY_FURNISHED">FULLY FURNISHED</option>
              </select>
            </div>
          </div>

          {/* Block Section 4: Structural Dimensions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest block">Floor Plan Area Size (SQM)</label>
              <div className="relative">
                <input type="number" value={form.size_sqm} onChange={set('size_sqm')} min="0"
                  placeholder="e.g. 120"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all font-mono placeholder-zinc-800" />
                <span className="absolute right-4 top-3.5 text-[10px] text-zinc-600 font-black uppercase tracking-wider">M² Area</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest block">Floor Level Assignment</label>
              <div className="relative">
                <input value={form.floor_level} onChange={set('floor_level')}
                  placeholder="e.g. Penthouse, Level 4"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all placeholder-zinc-700 font-medium" />
              </div>
            </div>
          </div>

          {/* Block Section 5: Media Deployment Node */}
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest block flex items-center gap-1">
              <Image size={10} className="text-teal-400" /> Marketing Asset Cover Image URL <span className="text-zinc-600 normal-case font-medium">(CDN Hosting optimized)</span>
            </label>
            <input value={form.cover_image} onChange={set('cover_image')}
              placeholder="https://images.unsplash.com/your-premium-asset-node"
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3.5 text-xs font-mono text-zinc-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all placeholder-zinc-800" />
          </div>

          {/* Block Section 6: Copywriting & Description Engine */}
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest block flex items-center gap-1">
              <Sparkles size={10} className="text-amber-400" /> High-Conversion Media Copywriting
            </label>
            <textarea value={form.marketing_description} onChange={set('marketing_description')} rows={4}
              placeholder="Inject core architectural details, embedded ecosystem integrations, premium security, or smart utility parameters..."
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all resize-none placeholder-zinc-700 font-medium leading-relaxed" />
          </div>

          {/* Dynamic Mutation Dispatch Action Trigger */}
          <button onClick={handleSave} disabled={saving || !unitId}
            className="w-full py-5 bg-teal-500 text-black font-black text-xs uppercase tracking-[0.25em] rounded-2xl hover:bg-white hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-teal-500 disabled:hover:shadow-none flex items-center justify-center gap-2 mt-4">
            {saving ? (
              <><Loader2 className="animate-spin" size={16} /> Mutating Ledger System…</>
            ) : (
              <><Save size={16} /> Save Specifications & Propagate Matrix</>
            )}
          </button>
        </div>

        {/* ── Pane B: Live Marketplace Asset View Preview (5 Cols) ────────────────────────────────────── */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-28">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-900">
            <div className="flex items-center gap-2">
              <Eye size={14} className="text-teal-400" />
              <p className="text-xs text-zinc-400 font-black uppercase tracking-[0.15em]">Dynamic Asset Sync Preview</p>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">REALTIME</span>
            </div>
          </div>

          {/* Premium Real Estate Asset Display Unit Card */}
          <div className="max-w-md mx-auto w-full bg-zinc-950/80 border border-zinc-900 rounded-3xl overflow-hidden shadow-2xl group transition-all duration-500 hover:border-teal-500/40 hover:shadow-[0_0_50px_rgba(20,184,166,0.03)]">

            {/* Visual Cover Layer Node */}
            <div className="relative aspect-[16/10] bg-zinc-900 overflow-hidden border-b border-zinc-900">
              {form.cover_image ? (
                <img src={form.cover_image} alt="Dynamic Matrix View" className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-zinc-950 to-zinc-900">
                  <Building2 size={36} className="text-zinc-800 transform group-hover:scale-110 transition-transform duration-500" />
                  <p className="text-[9px] text-zinc-600 uppercase font-mono tracking-widest font-bold">Image Pipeline Offline</p>
                </div>
              )}
              
              {/* Top Immutable Badges */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                <span className="flex items-center gap-1.5 bg-black/70 border border-teal-500/40 text-teal-400 text-[9px] px-2.5 py-1 rounded-lg font-black uppercase backdrop-blur-md shadow-lg">
                  <ShieldCheck size={11} className="text-teal-400 animate-pulse" /> Ark Ledger Verified
                </span>
                {form.floor_level && (
                  <span className="bg-zinc-900/90 text-zinc-400 border border-zinc-800 text-[8px] font-mono font-bold px-2 py-0.5 rounded uppercase backdrop-blur-sm">
                    {form.floor_level}
                  </span>
                )}
              </div>

              {/* Float Price Tag Overlay */}
              <div className="absolute bottom-4 right-4">
                <span className="bg-black/90 text-white text-[10px] px-3 py-1.5 rounded-xl font-mono font-black border border-zinc-800 shadow-xl flex items-center gap-1">
                  <span className="text-teal-400">{form.currency}</span> {safeF(form.rent_amount)}
                </span>
              </div>
            </div>

            {/* Core Card Info Layout Content */}
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <h3 className="font-black text-lg uppercase tracking-tight text-white group-hover:text-teal-400 transition-colors truncate">
                  {form.unit_name.trim() || 'UNINSTANTIATED UNIT'}
                </h3>
                <p className="text-[11px] text-zinc-500 font-mono flex items-center gap-1.5 uppercase tracking-wider">
                  <MapPin size={11} className="text-zinc-600 shrink-0" />
                  <span className="truncate">{form.location.trim() || 'Awaiting Geographic Deployment'}</span>
                </p>
              </div>

              {/* Multi-Dimensional Property Parameters Meta Row */}
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-400 font-mono bg-black/60 border border-zinc-900 p-3 rounded-xl">
                <span className="flex items-center gap-1 text-zinc-300 font-bold"><BedDouble size={12} className="text-zinc-500" /> {form.bedrooms} BR</span>
                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                <span className="flex items-center gap-1 text-zinc-300 font-bold"><Bath size={12} className="text-zinc-500" /> {form.bathrooms} BTH</span>
                {form.size_sqm && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-zinc-800" />
                    <span className="text-zinc-300 font-bold">{form.size_sqm} M²</span>
                  </>
                )}
                <span className="ml-auto text-amber-400 text-[9px] uppercase font-black tracking-widest bg-amber-500/5 border border-amber-500/20 px-2 py-0.5 rounded">
                  {form.furnishing.replace('_', ' ')}
                </span>
              </div>

              {/* Live Rendered Marketing Summary */}
              {form.marketing_description.trim() ? (
                <p className="text-[12px] text-zinc-400 font-sans leading-relaxed line-clamp-3 font-medium antialiased pt-1">
                  {form.marketing_description}
                </p>
              ) : (
                <p className="text-[11px] text-zinc-600 italic font-medium pt-1">
                  Enter marketing details inside the left configuration panel to populate customer-facing advertising copy structures...
                </p>
              )}
            </div>

            {/* Bottom Settlement Valuation Analytics Block */}
            <div className="px-6 pb-6 pt-5 border-t border-zinc-900 bg-black/30 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[8px] text-zinc-600 uppercase font-black tracking-widest">Projected Drawdown ({form.payment_frequency})</p>
                <p className="font-mono font-black text-teal-400 text-xl tracking-tighter">
                  {form.currency} {safeF(form.rent_amount)}
                </p>
              </div>
              <button disabled
                className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] font-black uppercase tracking-widest rounded-xl cursor-not-allowed select-none">
                Live Preview Mode
              </button>
            </div>
          </div>

          {/* Dynamic Info Architecture Banner */}
          <div className="max-w-md mx-auto flex items-start gap-3 bg-zinc-950/20 border border-zinc-900 p-4 rounded-xl">
            <Info size={14} className="text-zinc-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-zinc-500 leading-relaxed font-medium uppercase tracking-wider">
              Any specification revisions executed here directly override global catalog records upon submission. Ensure financial figures conform precisely to lease contracts.
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}

export default function UnitEditorPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col antialiased selection:bg-teal-500 selection:text-black">
      <Navbar />
      <Suspense fallback={
        <div className="flex-1 flex flex-col items-center justify-center py-40 gap-4 text-zinc-500 bg-[#050505]">
          <Loader2 size={24} className="animate-spin text-teal-400" />
        </div>
      }>
        <EditorContent />
      </Suspense>
      <Footer />
    </div>
  );
}