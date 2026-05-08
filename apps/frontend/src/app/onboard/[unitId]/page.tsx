'use client';
export const dynamic = 'force-dynamic';
/**
 * /onboard/[unitId]/page.tsx — Tenant-facing invite page
 *
 * This is the PUBLIC page tenants land on when they click the landlord's invite link.
 * It replaces the broken 4-step KYC+payment page that was calling:
 *   POST /api/rental/onboard  ← DOES NOT EXIST → 404
 *
 * CORRECT FLOW (verified against index.ts):
 *
 *   Step 1: Load unit via GET /api/rental/invite-link/:unitId
 *           → { url, whatsapp_link, unit_name, project_title }
 *
 *   Step 2: Tenant fills name / email / phone
 *
 *   Step 3: POST /api/tenant/onboard
 *           body: { unitId, fullName, email, phone, pattern }
 *           → { success, tenancy_id, vault_id, frequency,
 *                installment_amount, message, ledger_hash }
 *           Backend creates tenancy + flex_pay_vault + ledger entry
 *           and sends the tenant their invite link to set a password
 *
 *   Step 4: Success — show vault details, link to /tenant/dashboard
 *
 * NOTE: There is NO Paystack payment here. Payments happen via /tenant/pay
 * after the tenant activates their account via the invite link.
 */
import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import {
  CheckCircle2, Loader2, AlertCircle, Building2,
  ShieldCheck, ChevronRight, User, Mail, Phone,
  ArrowRight, Home,
} from 'lucide-react';

const safeF = (v: any) => { const n = Number(v); return (v == null || isNaN(n)) ? '0' : n.toLocaleString(); };

const STEPS = ['Your Unit', 'Your Details', 'Confirm'];

function OnboardContent() {
  const { unitId } = useParams<{ unitId: string }>();

  const [inviteData, setInviteData] = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [step,       setStep]       = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState<any>(null);
  const [error,      setError]      = useState('');

  const [form, setForm] = useState({
    fullName: '',
    email:    '',
    phone:    '',
    pattern:  'MONTHLY',
  });

  // Load unit info from invite-link endpoint
  useEffect(() => {
    if (!unitId) return;
    api.get(`/api/rental/invite-link/${unitId}`)
      .then(r => setInviteData(r.data))
      .catch(e => setError(e?.response?.data?.error ?? 'Invalid or expired invite link.'))
      .finally(() => setLoading(false));
  }, [unitId]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setError('');
    if (!form.fullName.trim()) { setError('Full name is required.'); return; }
    if (!form.email.trim())    { setError('Email address is required.'); return; }

    setSubmitting(true);
    try {
      // POST /api/tenant/onboard — the correct endpoint (verified in index.ts)
      const res = await api.post('/api/tenant/onboard', {
        unitId,
        fullName: form.fullName.trim(),
        email:    form.email.trim().toLowerCase(),
        phone:    form.phone.trim() || undefined,
        pattern:  form.pattern,
      });
      setDone(res.data);
    } catch (e: any) {
      setError(
        e?.response?.data?.error ??
        e?.response?.data?.message ??
        `Error ${e?.response?.status ?? ''}: Onboarding failed. Please try again.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="animate-spin text-teal-500 mx-auto" size={36} />
        <p className="text-zinc-500 text-sm">Loading your tenancy details…</p>
      </div>
    </div>
  );

  // ── Invalid link ──────────────────────────────────────────────────────────
  if (error && !inviteData) return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center gap-6 p-6">
      <AlertCircle className="text-red-500" size={56} />
      <div className="text-center">
        <h2 className="font-black uppercase text-xl mb-2">Invalid Invite</h2>
        <p className="text-zinc-400 text-sm max-w-sm">{error}</p>
      </div>
      <Link href="/"
        className="text-teal-500 text-xs font-bold uppercase border border-teal-500/30 px-6 py-3 rounded-xl hover:bg-teal-500/10 transition-colors">
        Go to Nested Ark
      </Link>
    </div>
  );

  // ── Success ───────────────────────────────────────────────────────────────
  if (done) return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Brand header */}
      <div className="border-b border-zinc-900 px-4 py-4 flex items-center justify-between max-w-lg mx-auto">
        <div>
          <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest">Nested Ark OS</p>
          <p className="text-xs font-black uppercase">Tenant Portal</p>
        </div>
        <ShieldCheck className="text-teal-500" size={22} />
      </div>

      <div className="max-w-lg mx-auto px-4 py-10 space-y-8 text-center">
        <CheckCircle2 className="text-teal-500 mx-auto" size={64} />

        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter">You're Registered!</h1>
          <p className="text-zinc-400 text-sm mt-2">
            Your tenancy for{' '}
            <span className="text-teal-400 font-bold">{inviteData?.unit_name ?? 'your unit'}</span>{' '}
            has been created.
          </p>
        </div>

        {/* Vault info */}
        {done.installment_amount && (
          <div className="bg-zinc-900 border border-teal-500/20 rounded-3xl p-6 text-left space-y-3">
            <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest">
              Flex-Pay Vault Active
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-black font-mono text-teal-400">
                  NGN {safeF(done.installment_amount)}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">per installment · {done.frequency}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-zinc-500 uppercase font-black">Status</p>
                <p className="text-teal-400 font-bold text-sm">Active</p>
              </div>
            </div>
          </div>
        )}

        {/* What happens next */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-left space-y-4">
          <p className="text-[9px] text-zinc-400 uppercase font-black tracking-widest">What Happens Next</p>
          {[
            { n: '01', text: 'Check your email for an activation link to set your password.' },
            { n: '02', text: 'Log in to your Tenant Dashboard to view your vault and payment schedule.' },
            { n: '03', text: 'Make your first installment via Paystack to start building your rent.' },
          ].map(s => (
            <div key={s.n} className="flex items-start gap-3">
              <div className="w-7 h-7 bg-teal-500/10 border border-teal-500/30 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-[9px] font-black text-teal-500">{s.n}</span>
              </div>
              <p className="text-zinc-400 text-xs leading-relaxed pt-1">{s.text}</p>
            </div>
          ))}
        </div>

        {done.ledger_hash && (
          <div className="flex items-center justify-center gap-2 text-[9px] text-teal-500">
            <ShieldCheck size={10} />
            <span className="font-mono">{done.ledger_hash.slice(0, 24)}…</span>
            <span className="text-zinc-600">SHA-256 Ledger Hash</span>
          </div>
        )}

        <Link href="/tenant/dashboard"
          className="w-full flex items-center justify-center gap-2 py-4 bg-teal-500 text-black font-black uppercase text-sm rounded-2xl hover:bg-teal-400 transition-all">
          Go to Tenant Dashboard <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );

  // ── Main Flow ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Brand header */}
      <div className="border-b border-zinc-900 px-4 py-4 flex items-center justify-between">
        <div>
          <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest">Nested Ark OS</p>
          <p className="text-xs font-black uppercase">Tenant Onboarding</p>
        </div>
        <ShieldCheck className="text-teal-500" size={22} />
      </div>

      <div className="max-w-lg mx-auto px-4 md:px-6 py-8 space-y-8">

        {/* Progress steps */}
        <div className="flex items-center">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                  i < step  ? 'bg-teal-500 text-black' :
                  i === step ? 'bg-teal-500/20 border-2 border-teal-500 text-teal-400' :
                               'bg-zinc-900 border border-zinc-800 text-zinc-600'
                }`}>
                  {i < step ? <CheckCircle2 size={14} /> : i + 1}
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

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-400">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="font-bold text-sm">{error}</p>
          </div>
        )}

        {/* ── STEP 0: Unit Details ── */}
        {step === 0 && inviteData && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black uppercase italic">
                {inviteData.unit_name ?? 'Your Unit'}
              </h1>
              {inviteData.project_title && (
                <p className="text-zinc-500 text-xs mt-1">
                  {inviteData.project_title}
                </p>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <Building2 size={14} className="text-teal-500" /> About This Tenancy
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={16} className="text-teal-500 shrink-0" />
                  <p className="text-zinc-300">Your rent is held in <span className="text-teal-400 font-bold">Paystack escrow</span> until key handover is confirmed.</p>
                </div>
                <div className="flex items-center gap-3">
                  <Home size={16} className="text-teal-500 shrink-0" />
                  <p className="text-zinc-300">Flex-Pay lets you pay in <span className="text-teal-400 font-bold">weekly, monthly or quarterly</span> installments.</p>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-teal-500 shrink-0" />
                  <p className="text-zinc-300">Every payment is <span className="text-teal-400 font-bold">SHA-256 hashed</span> and court-admissible.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(1)}
              className="w-full py-5 bg-teal-500 text-black font-black uppercase italic text-sm rounded-2xl hover:bg-teal-400 transition-all flex items-center justify-center gap-3"
            >
              Continue to Registration <ChevronRight size={18} />
            </button>

            <p className="text-center text-zinc-600 text-xs">
              🔒 Your details are encrypted and used only for tenancy verification.
            </p>
          </div>
        )}

        {/* ── STEP 1: Personal Details ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black uppercase italic">Your Details</h2>
              <p className="text-zinc-500 text-xs mt-1">
                We need a few details to create your tenancy and Flex-Pay vault.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-black block">Full Legal Name *</label>
                <div className="relative">
                  <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input value={form.fullName} onChange={e => set('fullName', e.target.value)}
                    placeholder="As on your ID"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-black block">Email Address *</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                    placeholder="you@email.com"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors" />
                </div>
                <p className="text-[9px] text-zinc-600">
                  Your account activation link will be sent here.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-400 uppercase font-black block">Phone Number</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                    placeholder="+234 800 000 0000"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] text-zinc-400 uppercase font-black block">
                  Preferred Payment Frequency
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: 'WEEKLY',    label: 'Weekly',    sub: 'Every 7 days'  },
                    { v: 'MONTHLY',   label: 'Monthly',   sub: 'Once a month'  },
                    { v: 'QUARTERLY', label: 'Quarterly', sub: 'Every 3 months'},
                  ].map(opt => (
                    <button key={opt.v} onClick={() => set('pattern', opt.v)}
                      className={`p-3 rounded-xl border text-left transition-all ${form.pattern === opt.v ? 'border-teal-500 bg-teal-500/10' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'}`}>
                      <p className={`text-xs font-black uppercase ${form.pattern === opt.v ? 'text-teal-400' : 'text-zinc-400'}`}>
                        {opt.label}
                      </p>
                      <p className="text-[9px] text-zinc-600 mt-0.5">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (!form.fullName.trim()) { setError('Full name is required.'); return; }
                if (!form.email.trim())    { setError('Email is required.'); return; }
                setError('');
                setStep(2);
              }}
              className="w-full py-5 bg-teal-500 text-black font-black uppercase italic text-sm rounded-2xl hover:bg-teal-400 transition-all flex items-center justify-center gap-3"
            >
              Review &amp; Confirm <ChevronRight size={18} />
            </button>

            <button onClick={() => setStep(0)}
              className="w-full py-2 text-zinc-600 text-xs font-bold uppercase hover:text-zinc-400 transition-colors">
              ← Back
            </button>
          </div>
        )}

        {/* ── STEP 2: Confirm & Submit ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black uppercase italic">Confirm Details</h2>
              <p className="text-zinc-500 text-xs mt-1">
                Review before submitting — a vault and tenancy will be created.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-3">
              <p className="text-[9px] text-zinc-400 uppercase font-black tracking-widest mb-3">Summary</p>
              {[
                { label: 'Name',      value: form.fullName  },
                { label: 'Email',     value: form.email     },
                { label: 'Phone',     value: form.phone || '—' },
                { label: 'Frequency', value: form.pattern   },
                { label: 'Unit',      value: inviteData?.unit_name ?? '—' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-zinc-800/60 last:border-0">
                  <span className="text-[10px] text-zinc-500 uppercase font-black">{row.label}</span>
                  <span className="text-sm font-bold text-white">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-500 leading-relaxed">
              By submitting, you confirm that your details are accurate and agree to the Nested Ark
              tenancy terms. Your Flex-Pay vault will be created and an activation email will be sent.
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-5 bg-teal-500 text-black font-black uppercase italic text-sm rounded-2xl hover:bg-teal-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {submitting
                ? <><Loader2 className="animate-spin" size={20} /> Creating Tenancy…</>
                : <><ShieldCheck size={18} /> Confirm &amp; Register</>
              }
            </button>

            <button onClick={() => setStep(1)}
              className="w-full py-2 text-zinc-600 text-xs font-bold uppercase hover:text-zinc-400 transition-colors">
              ← Edit Details
            </button>

            <p className="text-center text-zinc-600 text-xs">
              🔒 Secured by Nested Ark · Paystack Escrow · SHA-256 Ledger
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

export default function TenantOnboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={36} />
      </div>
    }>
      <OnboardContent />
    </Suspense>
  );
}
