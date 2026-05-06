'use client';
export const dynamic = 'force-dynamic';
/**
 * /projects/[id]/rental-management/page.tsx
 * Add units to a project. After adding, landlord is directed to
 * /landlord/onboard/[unitId] (NOT the public /onboard route).
 *
 * APIs:
 *   GET  /api/projects/:id                     — project title
 *   GET  /api/rental/units?project_id=:id      — existing units
 *   POST /api/rental/units/:projectId          — create unit
 */
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  Building2, Landmark, Send, ArrowLeft, CheckCircle2,
  Loader2, PlusCircle, Home, AlertCircle,
} from 'lucide-react';

const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();

interface Unit {
  id: string; unit_name: string; rent_amount: number;
  currency?: string; status?: string; tenant_name?: string; specs?: string;
}

const EMPTY = {
  unit_name: '', rent_amount: '', security_deposit: '', service_charge: '',
  agency_fee: '', legal_fee: '', caution_fee: '', specs: '', bedrooms: '',
  bathrooms: '', size_sqm: '', floor: '', furnishing: 'unfurnished', amenities: '',
  bank_name: '', account_number: '', account_name: '', bank_code: '',
  currency: 'NGN', payment_frequency: 'monthly',
};

export default function RentalManagementPage({ params }: { params: { id: string } }) {
  const [form,         setForm]         = useState({ ...EMPTY });
  const [submitting,   setSubmitting]   = useState(false);
  const [newUnitId,    setNewUnitId]    = useState<string | null>(null);
  const [error,        setError]        = useState('');
  const [units,        setUnits]        = useState<Unit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [projectTitle, setProjectTitle] = useState('');

  useEffect(() => {
    api.get(`/api/projects/${params.id}`)
      .then(r => setProjectTitle(r.data?.title ?? r.data?.project?.title ?? ''))
      .catch(() => {});
    reloadUnits();
  }, [params.id]);

  const reloadUnits = () => {
    setLoadingUnits(true);
    // Correct endpoint: /api/rental/units/:projectId (path param, not query string)
    api.get(`/api/rental/units/${params.id}`)
      .then(r => { const d = r.data; setUnits(Array.isArray(d) ? d : (d.units ?? [])); })
      .catch(() => {})
      .finally(() => setLoadingUnits(false));
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const totalMoveIn = ['rent_amount','security_deposit','service_charge','agency_fee','legal_fee','caution_fee']
    .reduce((a, k) => a + safeN((form as any)[k]), 0);

  const handleSubmit = async () => {
    setError('');
    if (!form.unit_name.trim())       { setError('Unit name is required.'); return; }
    if (safeN(form.rent_amount) <= 0) { setError('Valid rent amount is required.'); return; }
    if (!form.bank_name.trim())       { setError('Bank name is required for settlement.'); return; }
    if (!form.account_number.trim())  { setError('Account number is required.'); return; }

    setSubmitting(true);
    try {
      // Correct endpoint: /api/rental/project/:projectId/units
      const res = await api.post(`/api/rental/project/${params.id}/units`, {
        ...form,
        rent_amount: safeN(form.rent_amount), security_deposit: safeN(form.security_deposit),
        service_charge: safeN(form.service_charge), agency_fee: safeN(form.agency_fee),
        legal_fee: safeN(form.legal_fee), caution_fee: safeN(form.caution_fee),
      });
      const id = res.data?.unit?.id ?? res.data?.id ?? null;
      setNewUnitId(id);
      reloadUnits();
      setForm({ ...EMPTY });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.response?.data?.message ?? 'Failed to create unit.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto p-4 md:p-6 space-y-8 w-full">

        <header className="border-b border-zinc-800 pb-6">
          <Link href="/projects/my"
            className="text-zinc-500 text-xs uppercase font-bold flex items-center gap-2 mb-4 hover:text-white transition-colors">
            <ArrowLeft size={14} /> My Projects
          </Link>
          <p className="text-[10px] text-teal-500 uppercase font-black tracking-widest mb-1">Rental Management</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase italic">{projectTitle || 'Property'}</h1>
          <p className="text-zinc-500 text-xs mt-1">Deploy and configure apartment units for this property</p>
        </header>

        {newUnitId && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-teal-500/10 border border-teal-500/30 rounded-2xl p-4">
            <div className="flex items-center gap-3 flex-1">
              <CheckCircle2 size={20} className="text-teal-400 shrink-0" />
              <p className="font-bold text-sm text-teal-300">Unit added to ledger! Onboard a tenant now.</p>
            </div>
            <Link href={`/landlord/onboard/${newUnitId}`}
              className="bg-teal-500 text-black font-black uppercase text-xs px-5 py-2.5 rounded-xl hover:bg-teal-400 transition-colors shrink-0">
              Onboard Tenant →
            </Link>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-400">
            <AlertCircle size={18} className="shrink-0" />
            <p className="font-bold text-sm">{error}</p>
          </div>
        )}

        {/* Existing units */}
        {!loadingUnits && units.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
              <Home size={14} className="text-teal-500" /> Existing Units ({units.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {units.map(u => (
                <div key={u.id} className="bg-black border border-zinc-800 rounded-2xl p-4 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="font-black uppercase text-sm truncate">{u.unit_name}</p>
                    <p className="text-zinc-500 text-xs font-mono">{u.currency || 'NGN'} {safeF(u.rent_amount)} / mo</p>
                    {u.specs && <p className="text-[10px] text-zinc-600 truncate">{u.specs}</p>}
                    {u.tenant_name && <p className="text-teal-400 text-[10px] font-mono truncate">👤 {u.tenant_name}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${u.status?.toLowerCase() === 'occupied' ? 'bg-teal-500/10 text-teal-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {u.status || 'Vacant'}
                    </span>
                    <Link href={`/landlord/onboard/${u.id}`}
                      className="text-[9px] font-black uppercase text-teal-500 border border-teal-500/30 px-2 py-1 rounded hover:bg-teal-500/10 transition-colors whitespace-nowrap">
                      Onboard Tenant
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add unit form */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <PlusCircle className="text-teal-500" size={20} />
            <h2 className="text-lg font-black uppercase italic">Deploy New Unit</h2>
          </div>

          {/* Specs */}
          <section className="bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-3xl space-y-5">
            <div className="flex items-center gap-2 text-teal-500 mb-2">
              <Building2 size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest">Apartment Specs &amp; Identity</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input value={form.unit_name} onChange={e => set('unit_name', e.target.value)}
                placeholder="Unit Name / Number  (e.g. Apt 4B, Flat 2)"
                className="col-span-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors" />
              {[
                { k: 'bedrooms',  label: 'Bedrooms',   type: 'number' },
                { k: 'bathrooms', label: 'Bathrooms',  type: 'number' },
                { k: 'size_sqm',  label: 'Size (sqm)', type: 'number' },
                { k: 'floor',     label: 'Floor',      type: 'text'   },
              ].map(f => (
                <div key={f.k}>
                  <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">{f.label}</label>
                  <input value={(form as any)[f.k]} onChange={e => set(f.k, e.target.value)}
                    type={f.type} min={f.type === 'number' ? '0' : undefined}
                    placeholder="—"
                    className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors" />
                </div>
              ))}
              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Furnishing</label>
                <select value={form.furnishing} onChange={e => set('furnishing', e.target.value)}
                  className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors">
                  <option value="unfurnished">Unfurnished</option>
                  <option value="semi-furnished">Semi-Furnished</option>
                  <option value="fully-furnished">Fully Furnished</option>
                </select>
              </div>
              <textarea value={form.amenities} onChange={e => set('amenities', e.target.value)}
                placeholder="Amenities: balcony, parking, CCTV, generator…"
                className="col-span-full bg-black border border-zinc-800 p-4 rounded-xl h-16 outline-none focus:border-teal-500 text-sm resize-none transition-colors" />
              <textarea value={form.specs} onChange={e => set('specs', e.target.value)}
                placeholder="Additional notes…"
                className="col-span-full bg-black border border-zinc-800 p-4 rounded-xl h-14 outline-none focus:border-teal-500 text-sm resize-none transition-colors" />
            </div>
          </section>

          {/* Fees */}
          <section className="bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-3xl space-y-5">
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <span className="font-black">₦</span>
              <h3 className="text-xs font-black uppercase tracking-widest">Rent, Fees &amp; Payment Terms</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Currency</label>
                <select value={form.currency} onChange={e => set('currency', e.target.value)}
                  className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-amber-500 text-sm transition-colors">
                  {['NGN','USD','GBP','EUR','GHS','KES','AED','ZAR'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Payment Frequency</label>
                <select value={form.payment_frequency} onChange={e => set('payment_frequency', e.target.value)}
                  className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-amber-500 text-sm transition-colors">
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="bi-annual">Bi-Annual</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              {[
                { k: 'rent_amount',      label: 'Rent Amount *'    },
                { k: 'security_deposit', label: 'Security Deposit' },
                { k: 'service_charge',   label: 'Service Charge'   },
                { k: 'agency_fee',       label: 'Agency Fee'       },
                { k: 'legal_fee',        label: 'Legal Fee'        },
                { k: 'caution_fee',      label: 'Caution Fee'      },
              ].map(f => (
                <div key={f.k}>
                  <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">{f.label}</label>
                  <input value={(form as any)[f.k]} onChange={e => set(f.k, e.target.value)}
                    type="number" min="0" placeholder="0"
                    className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-amber-500 text-sm transition-colors" />
                </div>
              ))}
            </div>
            {safeN(form.rent_amount) > 0 && (
              <div className="bg-black border border-zinc-800 rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase text-zinc-500 mb-3 tracking-widest">Tenant Move-In Total (Est.)</p>
                <div className="space-y-1.5 text-xs font-mono">
                  {[
                    { label: `Rent (${form.payment_frequency})`, k: 'rent_amount' },
                    { label: 'Security Deposit',                  k: 'security_deposit' },
                    { label: 'Service Charge',                    k: 'service_charge' },
                    { label: 'Agency Fee',                        k: 'agency_fee' },
                    { label: 'Legal Fee',                         k: 'legal_fee' },
                    { label: 'Caution Fee',                       k: 'caution_fee' },
                  ].filter(i => safeN((form as any)[i.k]) > 0).map(i => (
                    <div key={i.label} className="flex justify-between text-zinc-400">
                      <span>{i.label}</span>
                      <span>{form.currency} {safeF((form as any)[i.k])}</span>
                    </div>
                  ))}
                  <div className="border-t border-zinc-800 pt-2 mt-2 flex justify-between font-black text-white">
                    <span>TOTAL MOVE-IN</span>
                    <span className="text-teal-400">{form.currency} {safeF(totalMoveIn)}</span>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Bank */}
          <section className="bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-3xl space-y-5">
            <div className="flex items-center gap-2 text-amber-400 mb-1">
              <Landmark size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest">Settlement Bank Details</h3>
            </div>
            <p className="text-zinc-500 text-xs">Rent collected via Paystack escrow will settle to this account after key-handover confirmation.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { k: 'bank_name',       label: 'Bank Name *',         placeholder: 'e.g. Guaranty Trust Bank', mono: false },
                { k: 'account_number',  label: 'Account Number *',    placeholder: '10-digit account number',  mono: true  },
                { k: 'account_name',    label: 'Account Name',        placeholder: 'e.g. John Doe',            mono: false },
                { k: 'bank_code',       label: 'Sort Code (optional)',placeholder: 'e.g. 058',                 mono: true  },
              ].map(f => (
                <div key={f.k}>
                  <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">{f.label}</label>
                  <input value={(form as any)[f.k]} onChange={e => set(f.k, e.target.value)}
                    placeholder={f.placeholder} maxLength={f.k === 'account_number' ? 10 : undefined}
                    className={`w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-amber-500 text-sm transition-colors ${f.mono ? 'font-mono' : ''}`} />
                </div>
              ))}
            </div>
          </section>

          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-5 bg-teal-500 text-black font-black uppercase italic text-sm rounded-2xl hover:bg-teal-400 hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3">
            {submitting
              ? <><Loader2 className="animate-spin" size={20} /> Deploying Unit…</>
              : <><Send size={18} /> Add Unit to Ledger</>
            }
          </button>

          <p className="text-center text-zinc-600 text-xs">
            After adding a unit, click "Onboard Tenant" to register a tenant and set up their Flex-Pay vault.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
