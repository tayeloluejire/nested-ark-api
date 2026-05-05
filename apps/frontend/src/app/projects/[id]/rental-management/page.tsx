'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';
import {
  Building2, Landmark, Send, ArrowLeft, CheckCircle2,
  Loader2, PlusCircle, Trash2, Home
} from 'lucide-react';

interface Unit {
  id: string;
  unit_name: string;
  rent_amount: number;
  security_deposit: number;
  specs: string;
  bank_name: string;
  account_number: string;
  status: string;
}

const EMPTY_FORM = {
  unit_name: '',
  rent_amount: '',
  security_deposit: '',
  service_charge: '',
  agency_fee: '',
  legal_fee: '',
  caution_fee: '',
  specs: '',
  bedrooms: '',
  bathrooms: '',
  size_sqm: '',
  floor: '',
  furnishing: 'unfurnished',
  amenities: '',
  bank_name: '',
  account_number: '',
  account_name: '',
  bank_code: '',
  currency: 'NGN',
  payment_frequency: 'monthly',
};

export default function RentalManagementPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [existingUnits, setExistingUnits] = useState<Unit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [projectTitle, setProjectTitle] = useState('');

  useEffect(() => {
    // Load project info
    api.get(`/api/projects/${params.id}`)
      .then(res => setProjectTitle(res.data?.title || 'Project'))
      .catch(() => {});

    // Load existing units
    api.get(`/api/rental/units?project_id=${params.id}`)
      .then(res => setExistingUnits(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoadingUnits(false));
  }, [params.id]);

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    setError('');
    if (!form.unit_name.trim()) { setError('Unit name is required.'); return; }
    if (!form.rent_amount || isNaN(Number(form.rent_amount))) { setError('Valid rent amount is required.'); return; }
    if (!form.bank_name.trim()) { setError('Bank name is required for settlement.'); return; }
    if (!form.account_number.trim()) { setError('Account number is required for settlement.'); return; }

    setSubmitting(true);
    try {
      await api.post(`/api/rental/units/${params.id}`, {
        ...form,
        rent_amount: Number(form.rent_amount),
        security_deposit: Number(form.security_deposit) || 0,
        service_charge: Number(form.service_charge) || 0,
        agency_fee: Number(form.agency_fee) || 0,
        legal_fee: Number(form.legal_fee) || 0,
        caution_fee: Number(form.caution_fee) || 0,
      });

      // Reload units
      const res = await api.get(`/api/rental/units?project_id=${params.id}`);
      setExistingUnits(Array.isArray(res.data) ? res.data : []);
      setForm({ ...EMPTY_FORM });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create unit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-8">
      {/* Header */}
      <header className="border-b border-zinc-800 pb-6">
        <Link
          href="/projects/my"
          className="text-zinc-500 text-xs uppercase font-bold flex items-center gap-2 mb-4 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} /> My Properties
        </Link>
        <p className="text-[10px] text-teal-500 uppercase font-black tracking-widest mb-1">
          Rental Management
        </p>
        <h1 className="text-2xl md:text-3xl font-black uppercase italic">{projectTitle}</h1>
        <p className="text-zinc-500 text-xs mt-1">Deploy and configure apartment units for this property</p>
      </header>

      {/* Success Banner */}
      {success && (
        <div className="flex items-center gap-3 bg-teal-500/10 border border-teal-500/30 rounded-2xl p-4 text-teal-400">
          <CheckCircle2 size={20} />
          <p className="font-bold text-sm">Unit added to ledger successfully! You can now onboard tenants.</p>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-400 text-sm font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Existing Units */}
      {!loadingUnits && existingUnits.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
          <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
            <Home size={14} className="text-teal-500" /> Existing Units ({existingUnits.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {existingUnits.map((unit) => (
              <div key={unit.id} className="bg-black border border-zinc-800 rounded-2xl p-4 flex justify-between items-center">
                <div>
                  <p className="font-black uppercase text-sm">{unit.unit_name}</p>
                  <p className="text-zinc-500 text-xs font-mono">₦{Number(unit.rent_amount || 0).toLocaleString()} / mo</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{unit.specs || 'No specs'}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${unit.status === 'occupied' ? 'bg-teal-500/10 text-teal-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {unit.status || 'Vacant'}
                  </span>
                  <Link
                    href={`/landlord/onboard/${unit.id}`}
                    className="text-[9px] font-black uppercase text-teal-500 border border-teal-500/30 px-2 py-1 rounded hover:bg-teal-500/10 transition-colors"
                  >
                    Onboard Tenant
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Unit Form */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <PlusCircle className="text-teal-500" size={20} />
          <h2 className="text-lg font-black uppercase italic">Deploy New Unit</h2>
        </div>

        {/* Apartment Specs */}
        <section className="bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-3xl space-y-5">
          <div className="flex items-center gap-2 text-teal-500 mb-2">
            <Building2 size={18} />
            <h3 className="text-xs font-black uppercase tracking-widest">Apartment Specs & Identity</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              value={form.unit_name}
              onChange={e => set('unit_name', e.target.value)}
              placeholder="Unit Name / Number  (e.g. Apt 4B, Flat 2)"
              className="col-span-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors"
            />
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Bedrooms</label>
              <input
                value={form.bedrooms}
                onChange={e => set('bedrooms', e.target.value)}
                placeholder="e.g. 2"
                type="number"
                min="0"
                className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Bathrooms</label>
              <input
                value={form.bathrooms}
                onChange={e => set('bathrooms', e.target.value)}
                placeholder="e.g. 1"
                type="number"
                min="0"
                className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Size (sqm)</label>
              <input
                value={form.size_sqm}
                onChange={e => set('size_sqm', e.target.value)}
                placeholder="e.g. 75"
                type="number"
                min="0"
                className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Floor / Level</label>
              <input
                value={form.floor}
                onChange={e => set('floor', e.target.value)}
                placeholder="e.g. Ground, 1st, 3rd"
                className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Furnishing</label>
              <select
                value={form.furnishing}
                onChange={e => set('furnishing', e.target.value)}
                className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors"
              >
                <option value="unfurnished">Unfurnished</option>
                <option value="semi-furnished">Semi-Furnished</option>
                <option value="fully-furnished">Fully Furnished</option>
              </select>
            </div>
            <textarea
              value={form.amenities}
              onChange={e => set('amenities', e.target.value)}
              placeholder="Amenities: e.g. balcony, parking, CCTV, generator, swimming pool..."
              className="col-span-full bg-black border border-zinc-800 p-4 rounded-xl h-20 outline-none focus:border-teal-500 text-sm resize-none transition-colors"
            />
            <textarea
              value={form.specs}
              onChange={e => set('specs', e.target.value)}
              placeholder="Additional specs / description..."
              className="col-span-full bg-black border border-zinc-800 p-4 rounded-xl h-20 outline-none focus:border-teal-500 text-sm resize-none transition-colors"
            />
          </div>
        </section>

        {/* Fees & Rent */}
        <section className="bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-3xl space-y-5">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <span className="text-sm">₦</span>
            <h3 className="text-xs font-black uppercase tracking-widest">Rent, Fees & Payment Terms</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Currency</label>
              <select
                value={form.currency}
                onChange={e => set('currency', e.target.value)}
                className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-amber-500 text-sm transition-colors"
              >
                <option value="NGN">NGN — Nigerian Naira</option>
                <option value="USD">USD — US Dollar</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GHS">GHS — Ghanaian Cedi</option>
                <option value="KES">KES — Kenyan Shilling</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Payment Frequency</label>
              <select
                value={form.payment_frequency}
                onChange={e => set('payment_frequency', e.target.value)}
                className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-amber-500 text-sm transition-colors"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="bi-annual">Bi-Annual (6 months)</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Rent Amount *</label>
              <input
                value={form.rent_amount}
                onChange={e => set('rent_amount', e.target.value)}
                placeholder="e.g. 250000"
                type="number"
                min="0"
                className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-amber-500 text-sm transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Security Deposit</label>
              <input
                value={form.security_deposit}
                onChange={e => set('security_deposit', e.target.value)}
                placeholder="e.g. 250000"
                type="number"
                min="0"
                className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-amber-500 text-sm transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Service Charge</label>
              <input
                value={form.service_charge}
                onChange={e => set('service_charge', e.target.value)}
                placeholder="e.g. 50000"
                type="number"
                min="0"
                className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-amber-500 text-sm transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Agency Fee</label>
              <input
                value={form.agency_fee}
                onChange={e => set('agency_fee', e.target.value)}
                placeholder="e.g. 25000"
                type="number"
                min="0"
                className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-amber-500 text-sm transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Legal Fee</label>
              <input
                value={form.legal_fee}
                onChange={e => set('legal_fee', e.target.value)}
                placeholder="e.g. 25000"
                type="number"
                min="0"
                className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-amber-500 text-sm transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Caution Fee</label>
              <input
                value={form.caution_fee}
                onChange={e => set('caution_fee', e.target.value)}
                placeholder="e.g. 25000"
                type="number"
                min="0"
                className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-amber-500 text-sm transition-colors"
              />
            </div>
          </div>

          {/* Fee Summary */}
          {form.rent_amount && (
            <div className="bg-black border border-zinc-800 rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase text-zinc-500 mb-3 tracking-widest">Tenant Move-In Total (Est.)</p>
              <div className="space-y-1.5 text-xs font-mono">
                {[
                  { label: `Rent (${form.payment_frequency})`, val: form.rent_amount },
                  { label: 'Security Deposit', val: form.security_deposit },
                  { label: 'Service Charge', val: form.service_charge },
                  { label: 'Agency Fee', val: form.agency_fee },
                  { label: 'Legal Fee', val: form.legal_fee },
                  { label: 'Caution Fee', val: form.caution_fee },
                ].filter(i => Number(i.val) > 0).map(i => (
                  <div key={i.label} className="flex justify-between text-zinc-400">
                    <span>{i.label}</span>
                    <span>{form.currency} {Number(i.val).toLocaleString()}</span>
                  </div>
                ))}
                <div className="border-t border-zinc-800 pt-2 mt-2 flex justify-between font-black text-white">
                  <span>TOTAL</span>
                  <span className="text-teal-400">
                    {form.currency} {[
                      form.rent_amount, form.security_deposit, form.service_charge,
                      form.agency_fee, form.legal_fee, form.caution_fee
                    ].reduce((a, v) => a + (Number(v) || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Bank / Settlement Details */}
        <section className="bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-3xl space-y-5">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <Landmark size={18} />
            <h3 className="text-xs font-black uppercase tracking-widest">Settlement Bank Details</h3>
          </div>
          <p className="text-zinc-500 text-xs">Rent payments collected via Paystack escrow will settle to this account after release.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Bank Name *</label>
              <input
                value={form.bank_name}
                onChange={e => set('bank_name', e.target.value)}
                placeholder="e.g. Guaranty Trust Bank"
                className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-amber-500 text-sm transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Account Number *</label>
              <input
                value={form.account_number}
                onChange={e => set('account_number', e.target.value)}
                placeholder="10-digit account number"
                maxLength={10}
                className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-amber-500 text-sm transition-colors font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Account Name</label>
              <input
                value={form.account_name}
                onChange={e => set('account_name', e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-amber-500 text-sm transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Bank Code (optional)</label>
              <input
                value={form.bank_code}
                onChange={e => set('bank_code', e.target.value)}
                placeholder="e.g. 058 (GTB)"
                className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-amber-500 text-sm transition-colors font-mono"
              />
            </div>
          </div>
        </section>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-5 bg-teal-500 text-black font-black uppercase italic text-sm rounded-2xl hover:bg-teal-400 hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {submitting ? (
            <><Loader2 className="animate-spin" size={20} /> Deploying Unit…</>
          ) : (
            <><Send size={18} /> Add Unit to Ledger</>
          )}
        </button>

        <p className="text-center text-zinc-600 text-xs">
          After adding a unit, you can immediately invite tenants to complete KYC and pay via the secure escrow flow.
        </p>
      </div>
    </div>
  );
}
