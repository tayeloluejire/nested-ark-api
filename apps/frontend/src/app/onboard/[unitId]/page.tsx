'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import {
  ShieldCheck, CheckCircle, Wallet, Calendar, User,
  Phone, Mail, Loader2, ArrowRight, Home, Lock
} from 'lucide-react';

const PATTERNS = [
  {
    key: 'WEEKLY',
    label: 'Weekly',
    icon: '📅',
    desc: 'Pay a small amount every week. Great if you earn daily or weekly income.',
    best: 'Artisans · Market traders · Freelancers',
  },
  {
    key: 'MONTHLY',
    label: 'Monthly',
    icon: '🗓️',
    desc: 'Pay once a month — aligned to your salary or business cycle.',
    best: 'Salaried workers · Business owners',
  },
  {
    key: 'QUARTERLY',
    label: 'Quarterly',
    icon: '📆',
    desc: 'Pay every 3 months. Good for landlords who allow bi-annual schedules.',
    best: 'Directors · Seasonal earners · Diaspora',
  },
];

interface Form {
  fullName: string;
  email: string;
  phone: string;
  pattern: string;
}

export default function TenantOnboardingPage() {
  const { unitId } = useParams<{ unitId: string }>();
  const router     = useRouter();

  const [step,     setStep]     = useState(1);
  const [form,     setForm]     = useState<Form>({ fullName: '', email: '', phone: '', pattern: 'MONTHLY' });
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [tenancyId, setTenancyId] = useState('');

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const validateStep1 = () => {
    if (!form.fullName.trim()) { setError('Full name is required.'); return false; }
    if (!form.email.trim() || !form.email.includes('@')) { setError('Valid email is required.'); return false; }
    setError(''); return true;
  };

  const handleComplete = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.post('/api/tenant/onboard', {
        unitId,
        fullName: form.fullName.trim(),
        email:    form.email.trim().toLowerCase(),
        phone:    form.phone.trim(),
        pattern:  form.pattern,
      });
      setTenancyId(res.data.tenancy_id ?? '');
      setStep(3);
    } catch (ex: any) {
      setError(ex?.response?.data?.error ?? 'Onboarding failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">

        {/* Header brand */}
        <div className="text-center space-y-1">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase">
            ⬡ Nested Ark OS
          </p>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Tenant Onboarding Portal</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black transition-all ${
                s < step  ? 'bg-teal-500 text-black' :
                s === step ? 'border-2 border-teal-500 text-teal-400' :
                'border border-zinc-700 text-zinc-700'
              }`}>
                {s < step ? <CheckCircle size={10} /> : s}
              </div>
              {s < 3 && <div className={`w-8 h-px transition-all ${s < step ? 'bg-teal-500' : 'bg-zinc-800'}`} />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-[32px] p-8 space-y-6">

          {/* ── STEP 1: Profile ─────────────────────────────────────────── */}
          {step === 1 && (
            <>
              <div className="space-y-1">
                <h1 className="text-2xl font-black uppercase tracking-tighter italic">Welcome Home.</h1>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Your landlord has invited you to Nested Ark — a verified digital tenancy platform.
                  Set up your profile to activate your payment vault.
                </p>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <User size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input
                    className="w-full bg-black border border-zinc-800 pl-10 pr-4 py-4 rounded-xl text-sm text-white focus:border-teal-500 outline-none transition-colors placeholder:text-zinc-700"
                    placeholder="Full Name"
                    value={form.fullName}
                    onChange={set('fullName')}
                  />
                </div>
                <div className="relative">
                  <Mail size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input
                    type="email"
                    className="w-full bg-black border border-zinc-800 pl-10 pr-4 py-4 rounded-xl text-sm text-white focus:border-teal-500 outline-none transition-colors placeholder:text-zinc-700"
                    placeholder="Email Address"
                    value={form.email}
                    onChange={set('email')}
                  />
                </div>
                <div className="relative">
                  <Phone size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input
                    type="tel"
                    className="w-full bg-black border border-zinc-800 pl-10 pr-4 py-4 rounded-xl text-sm text-white focus:border-teal-500 outline-none transition-colors placeholder:text-zinc-700"
                    placeholder="Phone Number (optional)"
                    value={form.phone}
                    onChange={set('phone')}
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-400 font-bold">{error}</p>
              )}

              {/* Trust badges */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <ShieldCheck size={14} className="text-teal-500 flex-shrink-0" />
                <p className="text-[9px] text-zinc-500 leading-relaxed">
                  Your data is encrypted and never shared. Secured by the Nested Ark ledger.
                </p>
              </div>

              <button
                onClick={() => { if (validateStep1()) setStep(2); }}
                className="w-full py-4 bg-teal-500 text-black font-black uppercase text-xs tracking-[0.3em] rounded-2xl hover:bg-white transition-all flex items-center justify-center gap-2">
                Continue <ArrowRight size={13} />
              </button>
            </>
          )}

          {/* ── STEP 2: Payment Rhythm ───────────────────────────────────── */}
          {step === 2 && (
            <>
              <div className="space-y-1">
                <h1 className="text-2xl font-black uppercase tracking-tighter italic">Payment Rhythm</h1>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  How would you like to build your Ark Rent Vault?
                  Your landlord receives the same total — you just pay in a way that fits your income.
                </p>
              </div>

              <div className="space-y-3">
                {PATTERNS.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, pattern: p.key }))}
                    className={`w-full p-5 rounded-2xl border text-left transition-all space-y-2 ${
                      form.pattern === p.key
                        ? 'border-teal-500 bg-teal-500/5'
                        : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{p.icon}</span>
                        <span className="font-black text-sm uppercase tracking-tight">{p.label} Payments</span>
                      </div>
                      {form.pattern === p.key && (
                        <CheckCircle size={14} className="text-teal-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">{p.desc}</p>
                    <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest">{p.best}</p>
                  </button>
                ))}
              </div>

              {/* Vault explainer */}
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 text-[9px] text-zinc-500">
                  <Wallet size={10} className="text-teal-500" />
                  <span className="font-bold uppercase tracking-widest">How the Rent Vault works</span>
                </div>
                <p className="text-[9px] text-zinc-600 leading-relaxed">
                  Your payments accumulate in a secure Ark Vault. Once the vault reaches your
                  yearly rent amount, your landlord can cash out — or receive monthly drawdowns.
                  Every contribution is SHA-256 hashed on the immutable ledger.
                </p>
              </div>

              {error && (
                <p className="text-xs text-red-400 font-bold">{error}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="py-4 border border-zinc-700 text-zinc-400 font-bold text-xs uppercase tracking-widest rounded-2xl hover:border-zinc-500 hover:text-white transition-all">
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="py-4 bg-teal-500 text-black font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-white transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="animate-spin" size={14} /> : 'Activate Vault'}
                </button>
              </div>
            </>
          )}

          {/* ── STEP 3: Success ──────────────────────────────────────────── */}
          {step === 3 && (
            <div className="text-center space-y-6 py-4">
              <div className="relative inline-block">
                <div className="w-20 h-20 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle size={36} className="text-teal-500" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center">
                  <ShieldCheck size={11} className="text-black" />
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-black uppercase tracking-tighter italic">Setup Complete!</h1>
                <p className="text-zinc-500 text-xs leading-relaxed max-w-xs mx-auto">
                  Welcome to Nested Ark, <strong className="text-white">{form.fullName}</strong>.
                  Your digital tenancy is active and your Rent Vault has been initialized.
                </p>
              </div>

              {/* What happens next */}
              <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 text-left space-y-3">
                <p className="text-[9px] text-teal-500 uppercase font-bold tracking-widest">What happens next</p>
                {[
                  { icon: Mail,          text: `A welcome email + receipt has been sent to ${form.email}` },
                  { icon: Wallet,        text: `Your ${form.pattern.toLowerCase()} payment schedule is active` },
                  { icon: Bell,          text: 'Rent reminders will be sent automatically before each due date' },
                  { icon: Lock,          text: 'All payments are SHA-256 hashed on the immutable ledger' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <item.icon size={12} className="text-teal-500/70 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-zinc-400 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>

              {/* Ledger confirmation */}
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-[8px] text-zinc-600 text-left break-all">
                STATUS: ACTIVE · VAULT: INITIALIZED · PATTERN: {form.pattern}<br />
                LEDGER: IMMUTABLE HASH WRITTEN · ARK VERIFIED ✓
              </div>

              <div className="space-y-3">
                <a
                  href={`https://nested-ark-frontend.vercel.app/tenant/flex-pay/${tenancyId || ''}`}
                  className="flex items-center justify-center gap-2 w-full py-4 bg-teal-500 text-black font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-white transition-all">
                  <Wallet size={13} /> View My Rent Vault
                </a>
                <p className="text-[9px] text-zinc-700 text-center">
                  Your dedicated payment link has been sent to your email.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer trust marks */}
        <div className="flex justify-center gap-4 text-[8px] text-zinc-800">
          <span className="flex items-center gap-1"><ShieldCheck size={8} /> SHA-256 Ledger</span>
          <span className="flex items-center gap-1"><Lock size={8} /> Paystack Secured</span>
          <span className="flex items-center gap-1"><Home size={8} /> Nested Ark OS</span>
        </div>
      </div>
    </div>
  );
}
