'use client';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home, User, Mail, Phone, Shield, CheckCircle2,
  ArrowRight, Loader2, Building2, Wallet, FileText,
  ChevronRight, Lock, Eye, EyeOff, AlertCircle,
} from 'lucide-react';
import api from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface OnboardForm {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
  unit_id: string;
  ref: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step indicators
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Identity',  icon: User      },
  { id: 2, label: 'Security',  icon: Lock      },
  { id: 3, label: 'Vault',     icon: Wallet    },
  { id: 4, label: 'Confirmed', icon: CheckCircle2 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Inner component — uses useSearchParams safely inside Suspense
// ─────────────────────────────────────────────────────────────────────────────
function OnboardContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const refParam    = searchParams.get('ref')     ?? '';
  const unitParam   = searchParams.get('unit_id') ?? '';
  const unitName    = searchParams.get('unit')    ?? '';
  const landlordId  = searchParams.get('landlord') ?? '';

  const [step,      setStep]      = useState(1);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [showConf,  setShowConf]  = useState(false);
  const [done,      setDone]      = useState(false);

  const [form, setForm] = useState<OnboardForm>({
    full_name:        '',
    email:            '',
    phone:            '',
    password:         '',
    confirm_password: '',
    unit_id:          unitParam,
    ref:              refParam,
  });

  const set = (k: keyof OnboardForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  // ── Step 1 validation ──
  const step1Valid =
    form.full_name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
    form.phone.trim().length >= 7;

  // ── Step 2 validation ──
  const step2Valid =
    form.password.length >= 8 &&
    form.password === form.confirm_password;

  // ── Submit ──
  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/register', {
        full_name: form.full_name.trim(),
        email:     form.email.toLowerCase().trim(),
        phone:     form.phone.trim(),
        password:  form.password,
        role:      'TENANT',
        unit_id:   form.unit_id   || undefined,
        ref:       form.ref       || undefined,
        landlord_id: landlordId   || undefined,
      });
      setDone(true);
      setStep(4);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    setError('');
    setStep(s => s + 1);
  };

  const Field = ({
    label, id, type = 'text', value, onChange, placeholder, required = true,
    suffix,
  }: {
    label: string; id: string; type?: string; value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string; required?: boolean;
    suffix?: React.ReactNode;
  }) => (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest block">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-teal-500/60 focus:ring-1 focus:ring-teal-500/20 transition-all pr-10"
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black flex flex-col">

      {/* ── Top bar ── */}
      <div className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-teal-500 rounded rotate-45 flex-shrink-0" />
          <span className="text-white font-black text-sm uppercase tracking-tighter">
            Nested Ark <span className="text-teal-500">OS</span>
          </span>
        </Link>
        <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-[0.2em]">
          Tenant Onboarding
        </p>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">

          {/* Unit banner (if invite link carried unit info) */}
          {unitName && (
            <div className="mb-6 flex items-center gap-3 p-4 rounded-2xl border border-teal-500/20 bg-teal-500/5">
              <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
                <Home size={16} className="text-teal-500" />
              </div>
              <div>
                <p className="text-[9px] text-teal-500 uppercase font-black tracking-[0.2em]">Your Unit</p>
                <p className="text-sm font-bold text-white">{decodeURIComponent(unitName)}</p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="mb-8">
            <p className="text-[9px] text-teal-500 uppercase font-black tracking-[0.25em] mb-2">
              {done ? 'Welcome aboard' : 'Step ' + step + ' of 3'}
            </p>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">
              {step === 1 && 'Create Your Profile'}
              {step === 2 && 'Secure Your Account'}
              {step === 3 && 'Activate Flex-Pay Vault'}
              {step === 4 && 'You\'re In'}
            </h1>
            <p className="text-sm text-zinc-500 mt-1.5">
              {step === 1 && 'Tell us who you are — your landlord has been expecting you.'}
              {step === 2 && 'Set a strong password to protect your tenancy account.'}
              {step === 3 && 'Review and confirm — your vault activates instantly.'}
              {step === 4 && 'Your Nested Ark tenant account is live.'}
            </p>
          </div>

          {/* ── Step indicator ── */}
          {!done && (
            <div className="flex items-center gap-0 mb-8">
              {STEPS.slice(0, 3).map((s, i) => {
                const Icon = s.icon;
                const active    = step === s.id;
                const completed = step > s.id;
                return (
                  <div key={s.id} className="flex items-center flex-1">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all ${
                      active    ? 'bg-teal-500/10 border border-teal-500/30' :
                      completed ? 'border border-teal-500/20' :
                                  'border border-transparent opacity-40'
                    }`}>
                      <Icon size={11} className={completed || active ? 'text-teal-500' : 'text-zinc-600'} />
                      <span className={`text-[9px] font-black uppercase tracking-widest ${
                        active ? 'text-teal-400' : completed ? 'text-teal-600' : 'text-zinc-600'
                      }`}>{s.label}</span>
                    </div>
                    {i < 2 && <div className={`flex-1 h-px mx-1 ${step > s.id ? 'bg-teal-500/30' : 'bg-zinc-800'}`} />}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="mb-5 flex items-start gap-2 p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Step 1: Identity ── */}
          {step === 1 && (
            <div className="space-y-4">
              <Field
                label="Full Name" id="full_name"
                value={form.full_name} onChange={set('full_name')}
                placeholder="e.g. Taiwo Ejire"
              />
              <Field
                label="Email Address" id="email" type="email"
                value={form.email} onChange={set('email')}
                placeholder="you@example.com"
              />
              <Field
                label="Phone Number" id="phone" type="tel"
                value={form.phone} onChange={set('phone')}
                placeholder="+234 800 000 0000"
              />
              <button
                onClick={nextStep}
                disabled={!step1Valid}
                className="w-full mt-2 flex items-center justify-center gap-2 py-4 rounded-2xl bg-teal-500 text-black text-[11px] font-black uppercase tracking-[0.2em] hover:bg-teal-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* ── Step 2: Security ── */}
          {step === 2 && (
            <div className="space-y-4">
              <Field
                label="Password" id="password" type={showPass ? 'text' : 'password'}
                value={form.password} onChange={set('password')}
                placeholder="Minimum 8 characters"
                suffix={
                  <button type="button" onClick={() => setShowPass(v => !v)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />
              <Field
                label="Confirm Password" id="confirm_password" type={showConf ? 'text' : 'password'}
                value={form.confirm_password} onChange={set('confirm_password')}
                placeholder="Repeat your password"
                suffix={
                  <button type="button" onClick={() => setShowConf(v => !v)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                    {showConf ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />

              {/* Password strength hints */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { ok: form.password.length >= 8,                        label: '8+ characters'    },
                  { ok: /[A-Z]/.test(form.password),                      label: 'Uppercase letter'  },
                  { ok: /[0-9]/.test(form.password),                      label: 'Number'            },
                  { ok: form.password === form.confirm_password && !!form.confirm_password, label: 'Passwords match' },
                ].map(h => (
                  <div key={h.label} className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide ${h.ok ? 'text-teal-500' : 'text-zinc-700'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${h.ok ? 'bg-teal-500' : 'bg-zinc-800'}`} />
                    {h.label}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-4 rounded-2xl border border-zinc-800 text-zinc-400 text-[11px] font-black uppercase tracking-[0.2em] hover:border-zinc-600 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={nextStep}
                  disabled={!step2Valid}
                  className="flex-[2] flex items-center justify-center gap-2 py-4 rounded-2xl bg-teal-500 text-black text-[11px] font-black uppercase tracking-[0.2em] hover:bg-teal-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Confirm & Activate ── */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Summary card */}
              <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 space-y-3">
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-[0.25em]">Your Account Summary</p>
                {[
                  { icon: User,     label: 'Name',  value: form.full_name },
                  { icon: Mail,     label: 'Email', value: form.email },
                  { icon: Phone,    label: 'Phone', value: form.phone },
                  ...(unitName ? [{ icon: Home, label: 'Unit', value: decodeURIComponent(unitName) }] : []),
                ].map(row => {
                  const Icon = row.icon;
                  return (
                    <div key={row.label} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                        <Icon size={12} className="text-teal-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-wide">{row.label}</p>
                        <p className="text-xs font-bold text-white truncate">{row.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* What you get */}
              <div className="p-4 rounded-2xl border border-teal-500/15 bg-teal-500/5">
                <p className="text-[9px] text-teal-500 uppercase font-black tracking-[0.25em] mb-3">What activates now</p>
                <div className="space-y-2">
                  {[
                    { icon: Wallet,    text: 'Flex-Pay Vault — pay rent in instalments'    },
                    { icon: FileText,  text: 'Digital receipts — court-admissible records'  },
                    { icon: Shield,    text: 'Encrypted tenancy ledger'                      },
                    { icon: Building2, text: 'Direct line to your landlord & property team' },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <div key={item.text} className="flex items-center gap-2.5">
                        <Icon size={11} className="text-teal-500 flex-shrink-0" />
                        <span className="text-[10px] text-zinc-400">{item.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-4 rounded-2xl border border-zinc-800 text-zinc-400 text-[11px] font-black uppercase tracking-[0.2em] hover:border-zinc-600 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-[2] flex items-center justify-center gap-2 py-4 rounded-2xl bg-teal-500 text-black text-[11px] font-black uppercase tracking-[0.2em] hover:bg-teal-400 transition-all disabled:opacity-60"
                >
                  {loading ? <><Loader2 size={14} className="animate-spin" /> Activating…</> : <>Activate Vault <ArrowRight size={14} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Done ── */}
          {step === 4 && done && (
            <div className="text-center space-y-6">
              <div className="flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
                  <CheckCircle2 size={40} className="text-teal-500" />
                </div>
              </div>
              <div>
                <p className="text-white font-black text-lg">Account Live, {form.full_name.split(' ')[0]}.</p>
                <p className="text-zinc-500 text-sm mt-1">Your Flex-Pay vault is active and your tenancy ledger has been initialised.</p>
              </div>
              <div className="space-y-2">
                <Link
                  href="/login"
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-teal-500 text-black text-[11px] font-black uppercase tracking-[0.2em] hover:bg-teal-400 transition-all"
                >
                  Go to Tenant Dashboard <ChevronRight size={14} />
                </Link>
                <Link
                  href="/"
                  className="w-full flex items-center justify-center py-3 rounded-2xl border border-zinc-800 text-zinc-500 text-[11px] font-bold uppercase tracking-[0.15em] hover:border-zinc-600 hover:text-zinc-300 transition-all"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          )}

          {/* ── Sign-in prompt ── */}
          {step < 4 && (
            <p className="mt-6 text-center text-[10px] text-zinc-600">
              Already have an account?{' '}
              <Link href="/login" className="text-teal-500 hover:text-teal-400 font-bold transition-colors">
                Sign in →
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* ── Footer strip ── */}
      <div className="border-t border-zinc-900 px-6 py-4 flex items-center justify-between">
        <p className="text-[8px] text-zinc-700 uppercase tracking-[0.2em]">
          © 2026 Impressions &amp; Impacts Ltd · Nested Ark OS
        </p>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
          <span className="text-[8px] text-zinc-700 uppercase tracking-[0.15em]">Secured · Encrypted</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ✅ Exported page — wraps OnboardContent in Suspense
//    This is the ONLY fix required for the Vercel build error:
//    "useSearchParams() should be wrapped in a suspense boundary at page /onboard"
// ─────────────────────────────────────────────────────────────────────────────
export default function OnboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 bg-teal-500 rounded rotate-45 animate-pulse" />
            <p className="text-teal-500 text-[10px] font-black uppercase tracking-[0.25em] animate-pulse">
              Loading…
            </p>
          </div>
        </div>
      }
    >
      <OnboardContent />
    </Suspense>
  );
}
