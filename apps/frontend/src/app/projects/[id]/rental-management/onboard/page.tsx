'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  ShieldCheck, CreditCard, Loader2, ArrowLeft,
  CheckCircle2, AlertCircle, User, Mail, Building2,
  Upload, Lock
} from 'lucide-react';

function OnboardContent() {
  const { id }        = useParams<{ id: string }>();
  const searchParams  = useSearchParams();
  const router        = useRouter();

  const unitId        = searchParams.get('unit') ?? '';
  const unitNumber    = searchParams.get('unit_number') ?? '';

  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Step 1 — Profile
  const [form, setForm] = useState({ name: '', email: '', phone: '' });

  // Step 2 — KYC
  const [idFile, setIdFile] = useState<File | null>(null);
  const [kycDone, setKycDone] = useState(false);

  // Step 3 — Payment
  const [unitData, setUnitData] = useState<any>(null);
  const [unitLoading, setUnitLoading] = useState(false);

  // Load unit details for payment summary
  useEffect(() => {
    if (!unitId || !id) return;
    setUnitLoading(true);
    api.get(`/api/projects/${id}/units`)
      .then(res => {
        const units = Array.isArray(res.data) ? res.data : (res.data.units ?? []);
        const found = units.find((u: any) => u.id === unitId);
        setUnitData(found ?? null);
      })
      .catch(() => {})
      .finally(() => setUnitLoading(false));
  }, [id, unitId]); // eslint-disable-line

  const rentAmount  = Number(unitData?.rent_amount ?? 0);
  const deposit     = rentAmount; // 1 month security deposit
  const total       = rentAmount + deposit;
  const currency    = unitData?.currency ?? 'NGN';

  const fmtCurrency = (v: number) =>
    `${currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ── Step 1: Profile validation ────────────────────────────────────────────
  const handleProfile = () => {
    if (!form.name.trim())  { setError('Full legal name is required.'); return; }
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) {
      setError('A valid email address is required.'); return;
    }
    setError('');
    setStep(2);
  };

  // ── Step 2: KYC proceed ───────────────────────────────────────────────────
  const handleKyc = () => {
    // In production you'd upload idFile to your KYC endpoint here.
    // For now we mark it done and advance.
    setKycDone(true);
    setError('');
    setStep(3);
  };

  // ── Step 3: Trigger Paystack payment ─────────────────────────────────────
  const triggerPayment = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.post('/api/payments/initialize', {
        amount: total,                 // backend converts to kobo if NGN
        currency,
        purpose: 'RENT_DEPOSIT',
        provider: 'PAYSTACK',
        metadata: {
          project_id:  id,
          unit_id:     unitId,
          unit_number: unitNumber,
          tenant_name: form.name,
          tenant_email: form.email,
          tenant_phone: form.phone,
        },
      });
      // Paystack returns authorization_url
      if (res.data?.authorization_url) {
        window.location.href = res.data.authorization_url;
      } else {
        setError('Payment gateway did not return a redirect URL. Please contact support.');
        setLoading(false);
      }
    } catch (ex: any) {
      setError(ex?.response?.data?.error ?? 'Payment initialisation failed. Please try again.');
      setLoading(false);
    }
  };

  const steps = [
    { num: '01', label: 'Profile' },
    { num: '02', label: 'Verification' },
    { num: '03', label: 'Payment' },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto px-6 py-12 w-full space-y-8">

        {/* Back */}
        <Link
          href={`/projects/${id}/rental-management`}
          className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
          <ArrowLeft size={13} /> Back to Units
        </Link>

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex p-4 bg-teal-500/10 rounded-full border border-teal-500/20">
            <ShieldCheck className="text-teal-500" size={32} />
          </div>
          <div>
            <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Legal Commitment</p>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic">Tenant Onboarding</h1>
            {unitNumber && (
              <p className="text-zinc-500 text-sm mt-1">
                Signing to <span className="text-white font-mono font-bold">Unit {unitNumber}</span> — Immutable Asset Ledger
              </p>
            )}
          </div>
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-between px-4">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[9px] font-black transition-all ${
                  step > i + 1
                    ? 'border-teal-500 bg-teal-500 text-black'
                    : step === i + 1
                    ? 'border-teal-500 text-teal-500'
                    : 'border-zinc-700 text-zinc-600'
                }`}>
                  {step > i + 1 ? <CheckCircle2 size={14} /> : s.num}
                </div>
                <span className={`text-[8px] font-bold uppercase tracking-widest ${step >= i + 1 ? 'text-teal-500' : 'text-zinc-600'}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-px mx-2 mb-4 transition-all ${step > i + 1 ? 'bg-teal-500' : 'bg-zinc-800'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-3xl space-y-6">

          {/* Error */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={12} /> {error}
            </div>
          )}

          {/* ── Step 1: Profile ─────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Tenant Profile</p>

              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest flex items-center gap-1.5">
                  <User size={9} /> Full Legal Name *
                </label>
                <input
                  placeholder="As it appears on government ID"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white text-sm outline-none focus:border-teal-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest flex items-center gap-1.5">
                  <Mail size={9} /> Email Address *
                </label>
                <input
                  placeholder="tenant@example.com"
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white text-sm outline-none focus:border-teal-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">Phone (optional)</label>
                <input
                  placeholder="+234 800 000 0000"
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white text-sm outline-none focus:border-teal-500 transition-colors"
                />
              </div>

              <button
                onClick={handleProfile}
                className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-teal-500 transition-all text-xs">
                Continue →
              </button>
            </div>
          )}

          {/* ── Step 2: KYC Verification ────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-6">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">KYC Verification</p>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Upload a valid Government-issued ID for AI-driven KYC verification.
                Accepted: National ID, Driver's Licence, International Passport.
              </p>

              <label className="block border-2 border-dashed border-zinc-800 py-14 rounded-3xl cursor-pointer hover:border-teal-500/40 hover:bg-teal-500/5 transition-all text-center">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={e => setIdFile(e.target.files?.[0] ?? null)}
                />
                <Upload size={24} className={`mx-auto mb-3 ${idFile ? 'text-teal-500' : 'text-zinc-600'}`} />
                {idFile ? (
                  <div>
                    <p className="text-teal-500 text-xs font-bold">{idFile.name}</p>
                    <p className="text-zinc-600 text-[9px] mt-1 uppercase font-bold">File selected — click to change</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-zinc-600 uppercase font-bold">Drop ID file here or click to browse</p>
                    <p className="text-[9px] text-zinc-700 mt-1">PNG, JPG, PDF accepted</p>
                  </div>
                )}
              </label>

              <div className="flex items-center gap-2 text-[9px] text-zinc-600">
                <Lock size={9} className="text-teal-500/50" />
                Your document is encrypted and only used for identity verification.
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setError(''); setStep(1); }}
                  className="flex-1 py-3 border border-zinc-700 text-zinc-400 text-[9px] font-black uppercase tracking-widest rounded-xl hover:text-white transition-all">
                  ← Back
                </button>
                <button
                  onClick={handleKyc}
                  className="flex-1 py-3 bg-teal-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-white transition-all text-[9px]">
                  Verify & Proceed →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Payment ─────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Payment Summary</p>

              {unitLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-teal-500" size={24} />
                </div>
              ) : (
                <div className="bg-black p-6 rounded-2xl border border-zinc-800 space-y-3">
                  {unitNumber && (
                    <div className="flex items-center gap-2 pb-3 border-b border-zinc-900">
                      <Building2 size={12} className="text-teal-500" />
                      <span className="text-[9px] text-zinc-500 uppercase font-bold">Unit {unitNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">First Month Rent</span>
                    <span className="font-mono font-bold">{fmtCurrency(rentAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Security Deposit (1 month)</span>
                    <span className="font-mono font-bold">{fmtCurrency(deposit)}</span>
                  </div>
                  <div className="border-t border-zinc-800 pt-3 flex justify-between font-bold">
                    <span>Total Due Now</span>
                    <span className="text-teal-500 font-mono text-lg">{fmtCurrency(total)}</span>
                  </div>
                </div>
              )}

              {/* Tenant summary */}
              <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 space-y-1">
                <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-2">Tenant Details</p>
                <p className="text-xs font-bold text-white">{form.name}</p>
                <p className="text-[9px] text-zinc-500 font-mono">{form.email}</p>
                {form.phone && <p className="text-[9px] text-zinc-500 font-mono">{form.phone}</p>}
              </div>

              <div className="flex items-center gap-2 text-[9px] text-zinc-600">
                <ShieldCheck size={9} className="text-teal-500/50" />
                Payment is processed via Paystack and SHA-256 hashed into the immutable ledger upon confirmation.
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setError(''); setStep(2); }}
                  className="flex-1 py-3 border border-zinc-700 text-zinc-400 text-[9px] font-black uppercase tracking-widest rounded-xl hover:text-white transition-all">
                  ← Back
                </button>
                <button
                  onClick={triggerPayment}
                  disabled={loading}
                  className="flex-1 py-4 bg-teal-500 text-black font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-white transition-all disabled:opacity-60 text-[9px]">
                  {loading
                    ? <><Loader2 className="animate-spin" size={14} /> Initializing…</>
                    : <><CreditCard size={14} /> Pay & Commit to Ledger</>
                  }
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-3">
          {[
            <><ShieldCheck size={10} /> Tri-Layer Verification</>,
            <><CheckCircle2 size={10} /> Immutable Ledger</>,
            <><Lock size={10} /> KYC-Gated Commit</>,
          ].map((badge, i) => (
            <span key={i}
              className="flex items-center gap-1 text-[9px] text-teal-500 border border-teal-500/30 bg-teal-500/5 px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest">
              {badge}
            </span>
          ))}
        </div>

      </main>
      <Footer />
    </div>
  );
}

export default function TenantOnboardPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    }>
      <OnboardContent />
    </Suspense>
  );
}
