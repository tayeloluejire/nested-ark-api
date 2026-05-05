'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';
import {
  CheckCircle2, Loader2, Building2, ShieldCheck,
  CreditCard, FileText, ChevronRight, AlertCircle,
  User, Mail, Phone, MapPin, Briefcase, Camera
} from 'lucide-react';

interface Unit {
  id: string;
  unit_name: string;
  rent_amount: number;
  security_deposit: number;
  service_charge: number;
  agency_fee: number;
  legal_fee: number;
  caution_fee: number;
  specs: string;
  bedrooms: string;
  bathrooms: string;
  currency: string;
  payment_frequency: string;
  project_title?: string;
  project_location?: string;
}

const STEPS = ['Unit Details', 'KYC Verification', 'Lease Review', 'Secure Payment'];

export default function TenantOnboardPage({ params }: { params: { unitId: string } }) {
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [kycForm, setKycForm] = useState({
    full_name: '', email: '', phone: '', nin: '',
    bvn: '', employer: '', monthly_income: '',
    address: '', id_type: 'nin', guarantor_name: '', guarantor_phone: '',
  });
  const [leaseAccepted, setLeaseAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [paymentInitialized, setPaymentInitialized] = useState(false);

  useEffect(() => {
    api.get(`/api/rental/units/${params.unitId}`)
      .then(res => setUnit(res.data))
      .catch(() => setError('Unable to load unit details. This invite link may be invalid.'))
      .finally(() => setLoading(false));
  }, [params.unitId]);

  const setKyc = (key: string, val: string) => setKycForm(f => ({ ...f, [key]: val }));

  const totalMoveIn = unit
    ? [unit.rent_amount, unit.security_deposit, unit.service_charge, unit.agency_fee, unit.legal_fee, unit.caution_fee]
        .reduce((a, v) => a + (Number(v) || 0), 0)
    : 0;

  const handleKycSubmit = async () => {
    setError('');
    if (!kycForm.full_name) { setError('Full name is required.'); return; }
    if (!kycForm.email) { setError('Email address is required.'); return; }
    if (!kycForm.phone) { setError('Phone number is required.'); return; }
    setStep(2); // Move to lease review
  };

  const handlePayment = async () => {
    if (!unit || !leaseAccepted) return;
    setError('');
    setSubmitting(true);
    try {
      // Submit KYC + initiate payment
      const res = await api.post('/api/rental/onboard', {
        unit_id: params.unitId,
        ...kycForm,
        total_amount: totalMoveIn,
      });

      const { payment_url } = res.data;
      if (payment_url) {
        window.location.href = payment_url;
      } else {
        setPaymentInitialized(true);
        setStep(3);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Payment initialization failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-black">
      <div className="text-center space-y-4">
        <Loader2 className="animate-spin text-teal-500 mx-auto" size={40} />
        <p className="text-zinc-500 text-sm">Loading your tenancy details…</p>
      </div>
    </div>
  );

  if (error && !unit) return (
    <div className="flex flex-col h-screen items-center justify-center gap-6 bg-black p-6">
      <AlertCircle className="text-red-500" size={56} />
      <div className="text-center">
        <h2 className="font-black uppercase text-xl mb-2">Invalid Invite</h2>
        <p className="text-zinc-400 text-sm max-w-sm">{error}</p>
      </div>
      <Link href="/" className="text-teal-500 text-xs font-bold uppercase border border-teal-500/30 px-6 py-3 rounded-xl">
        Go to Nested Ark
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-black">
      {/* Brand Header */}
      <div className="border-b border-zinc-900 px-4 md:px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest">Nested Ark OS</p>
          <p className="text-xs font-black uppercase">Tenant Onboarding</p>
        </div>
        <ShieldCheck className="text-teal-500" size={24} />
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                  i < step ? 'bg-teal-500 text-black' :
                  i === step ? 'bg-teal-500/20 border-2 border-teal-500 text-teal-400' :
                  'bg-zinc-900 border border-zinc-800 text-zinc-600'
                }`}>
                  {i < step ? <CheckCircle2 size={16} /> : i + 1}
                </div>
                <p className={`text-[8px] font-black uppercase mt-1 hidden sm:block text-center ${i <= step ? 'text-teal-400' : 'text-zinc-600'}`}>
                  {label}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${i < step ? 'bg-teal-500' : 'bg-zinc-800'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 0: Unit Details */}
        {step === 0 && unit && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black uppercase italic">{unit.unit_name}</h1>
              {unit.project_title && <p className="text-zinc-500 text-xs mt-1">{unit.project_title}{unit.project_location ? ` · ${unit.project_location}` : ''}</p>}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                <Building2 size={14} className="text-teal-500" /> Apartment Details
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {unit.bedrooms && (
                  <div className="bg-black border border-zinc-800 rounded-xl p-3">
                    <p className="text-[9px] text-zinc-500 uppercase font-black">Bedrooms</p>
                    <p className="font-black">{unit.bedrooms}</p>
                  </div>
                )}
                {unit.bathrooms && (
                  <div className="bg-black border border-zinc-800 rounded-xl p-3">
                    <p className="text-[9px] text-zinc-500 uppercase font-black">Bathrooms</p>
                    <p className="font-black">{unit.bathrooms}</p>
                  </div>
                )}
              </div>
              {unit.specs && <p className="text-zinc-400 text-sm">{unit.specs}</p>}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">Move-In Fees Breakdown</h2>
              <div className="space-y-2 text-sm font-mono">
                {[
                  { label: `Rent (${unit.payment_frequency || 'monthly'})`, val: unit.rent_amount },
                  { label: 'Security Deposit', val: unit.security_deposit },
                  { label: 'Service Charge', val: unit.service_charge },
                  { label: 'Agency Fee', val: unit.agency_fee },
                  { label: 'Legal Fee', val: unit.legal_fee },
                  { label: 'Caution Fee', val: unit.caution_fee },
                ].filter(i => Number(i.val) > 0).map(item => (
                  <div key={item.label} className="flex justify-between text-zinc-400">
                    <span>{item.label}</span>
                    <span>{unit.currency || 'NGN'} {Number(item.val).toLocaleString()}</span>
                  </div>
                ))}
                <div className="border-t border-zinc-800 pt-3 mt-3 flex justify-between font-black text-white">
                  <span>TOTAL MOVE-IN</span>
                  <span className="text-teal-400">{unit.currency || 'NGN'} {totalMoveIn.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(1)}
              className="w-full py-5 bg-teal-500 text-black font-black uppercase italic text-sm rounded-2xl hover:bg-teal-400 transition-all flex items-center justify-center gap-3"
            >
              Proceed to KYC Verification <ChevronRight size={18} />
            </button>

            <p className="text-center text-zinc-600 text-xs">
              🔒 Payments are held in secure escrow until your keys are confirmed received.
            </p>
          </div>
        )}

        {/* Step 1: KYC */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black uppercase italic flex items-center gap-3">
                <ShieldCheck className="text-teal-500" size={24} /> KYC Verification
              </h2>
              <p className="text-zinc-500 text-xs mt-1">Your information is encrypted and only used to verify your identity.</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-400 text-sm font-bold">⚠️ {error}</div>
            )}

            <section className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4">
              <h3 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
                <User size={12} className="text-teal-500" /> Personal Information
              </h3>
              <input value={kycForm.full_name} onChange={e => setKyc('full_name', e.target.value)}
                placeholder="Full Legal Name *" className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input value={kycForm.email} onChange={e => setKyc('email', e.target.value)}
                  placeholder="Email Address *" type="email" className="bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors" />
                <input value={kycForm.phone} onChange={e => setKyc('phone', e.target.value)}
                  placeholder="Phone Number *" type="tel" className="bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors" />
              </div>
              <input value={kycForm.address} onChange={e => setKyc('address', e.target.value)}
                placeholder="Current Residential Address" className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors" />
            </section>

            <section className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4">
              <h3 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
                <ShieldCheck size={12} className="text-teal-500" /> Government ID
              </h3>
              <select value={kycForm.id_type} onChange={e => setKyc('id_type', e.target.value)}
                className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors">
                <option value="nin">National Identity Number (NIN)</option>
                <option value="bvn">Bank Verification Number (BVN)</option>
                <option value="passport">International Passport</option>
                <option value="drivers_license">Driver's License</option>
                <option value="voters_card">Voter's Card</option>
              </select>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input value={kycForm.nin} onChange={e => setKyc('nin', e.target.value)}
                  placeholder="NIN Number" className="bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm font-mono transition-colors" />
                <input value={kycForm.bvn} onChange={e => setKyc('bvn', e.target.value)}
                  placeholder="BVN (optional)" className="bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm font-mono transition-colors" />
              </div>
            </section>

            <section className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4">
              <h3 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
                <Briefcase size={12} className="text-teal-500" /> Employment & Income
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input value={kycForm.employer} onChange={e => setKyc('employer', e.target.value)}
                  placeholder="Employer / Business Name" className="bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors" />
                <input value={kycForm.monthly_income} onChange={e => setKyc('monthly_income', e.target.value)}
                  placeholder="Monthly Net Income" type="number" className="bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors" />
              </div>
            </section>

            <section className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4">
              <h3 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
                <User size={12} className="text-amber-500" /> Guarantor (Recommended)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input value={kycForm.guarantor_name} onChange={e => setKyc('guarantor_name', e.target.value)}
                  placeholder="Guarantor Full Name" className="bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-amber-500 text-sm transition-colors" />
                <input value={kycForm.guarantor_phone} onChange={e => setKyc('guarantor_phone', e.target.value)}
                  placeholder="Guarantor Phone" type="tel" className="bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-amber-500 text-sm transition-colors" />
              </div>
            </section>

            <button
              onClick={handleKycSubmit}
              className="w-full py-5 bg-teal-500 text-black font-black uppercase italic text-sm rounded-2xl hover:bg-teal-400 transition-all flex items-center justify-center gap-3"
            >
              Save & Review Lease <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Step 2: Lease Review */}
        {step === 2 && unit && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black uppercase italic flex items-center gap-3">
                <FileText className="text-teal-500" size={24} /> Lease Agreement
              </h2>
              <p className="text-zinc-500 text-xs mt-1">Review the terms before completing payment.</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-400 text-sm font-bold">⚠️ {error}</div>
            )}

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-h-80 overflow-y-auto">
              <h3 className="font-black uppercase text-sm mb-4">STANDARD TENANCY AGREEMENT</h3>
              <div className="text-zinc-400 text-xs space-y-3 leading-relaxed">
                <p><strong className="text-white">TENANT:</strong> {kycForm.full_name} ({kycForm.email})</p>
                <p><strong className="text-white">PROPERTY:</strong> {unit.unit_name}{unit.project_title ? ` — ${unit.project_title}` : ''}</p>
                <p><strong className="text-white">RENT:</strong> {unit.currency || 'NGN'} {Number(unit.rent_amount).toLocaleString()} payable {unit.payment_frequency || 'monthly'}</p>
                <p><strong className="text-white">SECURITY DEPOSIT:</strong> {unit.currency || 'NGN'} {Number(unit.security_deposit || 0).toLocaleString()} (refundable, subject to condition)</p>
                <p>The tenant agrees to: (1) Pay rent as stipulated via the Nested Ark escrow system; (2) Maintain the property in good condition; (3) Not sublet without landlord's written consent; (4) Comply with all building rules; (5) Give 30 days notice before vacating.</p>
                <p>The landlord agrees to: (1) Maintain the property in habitable condition; (2) Release security deposit within 30 days of vacating, less deductions; (3) Provide quiet enjoyment of the premises.</p>
                <p>All payments are processed via Paystack escrow and released to the landlord upon confirmed key handover. Nested Ark OS serves as the neutral ledger.</p>
                <p className="text-zinc-600">By checking the box below, you agree to these terms and authorize Nested Ark OS to process your payment of {unit.currency || 'NGN'} {totalMoveIn.toLocaleString()} via Paystack.</p>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={leaseAccepted}
                onChange={e => setLeaseAccepted(e.target.checked)}
                className="mt-1 w-5 h-5 rounded accent-teal-500"
              />
              <span className="text-sm text-zinc-300">
                I have read and agree to the Tenancy Agreement and authorize payment of{' '}
                <span className="text-teal-400 font-black">{unit.currency || 'NGN'} {totalMoveIn.toLocaleString()}</span> to complete my tenancy.
              </span>
            </label>

            <button
              onClick={handlePayment}
              disabled={!leaseAccepted || submitting}
              className="w-full py-5 bg-teal-500 text-black font-black uppercase italic text-sm rounded-2xl hover:bg-teal-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {submitting ? (
                <><Loader2 className="animate-spin" size={18} /> Initializing Secure Payment…</>
              ) : (
                <><CreditCard size={18} /> Pay & Confirm Tenancy</>
              )}
            </button>

            <p className="text-center text-zinc-600 text-xs">
              🔒 Secured by Paystack · Funds held in escrow until key handover is confirmed
            </p>
          </div>
        )}

        {/* Step 3: Payment Initialized */}
        {step === 3 && (
          <div className="text-center space-y-6 py-10">
            <CheckCircle2 className="mx-auto text-teal-500" size={72} />
            <div>
              <h2 className="text-2xl font-black uppercase italic">Payment Initiated!</h2>
              <p className="text-zinc-500 text-sm mt-2">Your payment is being processed securely via Paystack.</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-left space-y-2 text-sm">
              <p className="text-zinc-400">✅ KYC details received</p>
              <p className="text-zinc-400">✅ Lease agreement accepted</p>
              <p className="text-zinc-400">⏳ Payment processing…</p>
              <p className="text-zinc-600 text-xs mt-3">You will receive a confirmation email once payment is confirmed and your tenancy is activated.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
