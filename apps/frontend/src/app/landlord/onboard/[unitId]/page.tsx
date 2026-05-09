'use client';
export const dynamic = 'force-dynamic';
/**
 * /landlord/onboard/[unitId]/page.tsx
 * LANDLORD-ONLY — onboards a tenant to a specific unit.
 *
 * BACKEND (verified from index.ts):
 *
 *   GET /api/rental/invite-link/:unitId
 *   → { url, whatsapp_link, unit_name, project_title, rent_amount, currency }
 *   whatsapp_link is ALREADY fully built by backend — use it directly.
 *   If unit_name is empty the unit doesn't exist in DB → show redirect page.
 *
 *   POST /api/tenant/onboard
 *   body: { unitId, fullName, email, phone?, pattern?,
 *           reason_for_quit?, former_landlord_contact? }
 *   → 201 { success, tenancy_id, vault_id, frequency,
 *            installment_amount, message, ledger_hash }
 *   → 400 missing fields
 *   → 404 unit not found in DB
 *   → 500 DB error
 */
import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  Loader2, AlertCircle, CheckCircle2, User, Mail, Phone,
  Building2, ArrowLeft, Send, Copy, MessageCircle,
  ArrowRight, Home,
} from 'lucide-react';

const safeF = (v: any) => {
  const n = Number(v);
  return v == null || isNaN(n) ? '0' : n.toLocaleString();
};

const PATTERNS = ['MONTHLY', 'WEEKLY', 'QUARTERLY'] as const;

function OnboardContent() {
  const { unitId } = useParams<{ unitId: string }>();
  const router = useRouter();

  const [inviteData, setInviteData]   = useState<any>(null);
  const [unitValid,  setUnitValid]    = useState<boolean | null>(null);
  const [loading,    setLoading]      = useState(true);
  const [saving,     setSaving]       = useState(false);
  const [done,       setDone]         = useState<any>(null);
  const [error,      setError]        = useState('');
  const [copied,     setCopied]       = useState(false);

  const [form, setForm] = useState({
    fullName:                '',
    email:                   '',
    phone:                   '',
    pattern:                 'MONTHLY' as string,
    reason_for_quit:         '',
    former_landlord_contact: '',
  });

  useEffect(() => {
    if (!unitId) return;
    api.get(`/api/rental/invite-link/${unitId}`)
      .then(r => {
        const d = r.data ?? {};
        const unitName = (d.unit_name ?? '').trim();
        const origin = typeof window !== 'undefined'
          ? window.location.origin
          : 'https://nested-ark-api.vercel.app';
        setInviteData({
          url:           d.url           ?? `${origin}/onboard/${unitId}`,
          whatsapp_link: d.whatsapp_link ?? '',
          unit_name:     unitName,
          project_title: d.project_title ?? '',
          rent_amount:   d.rent_amount   ?? null,
          currency:      d.currency      ?? 'NGN',
        });
        // Valid only if backend returned a real unit_name from DB join
        setUnitValid(unitName.length > 0);
      })
      .catch(() => {
        setInviteData(null);
        setUnitValid(false);
      })
      .finally(() => setLoading(false));
  }, [unitId]);

  const set = (k: string, v: string) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setError('');
    if (!form.fullName.trim()) { setError('Full name is required.'); return; }
    if (!form.email.trim())    { setError('Email address is required.'); return; }
    setSaving(true);
    try {
      const res = await api.post('/api/tenant/onboard', {
        unitId,
        fullName:                form.fullName.trim(),
        email:                   form.email.trim().toLowerCase(),
        phone:                   form.phone.trim() || undefined,
        pattern:                 form.pattern,
        reason_for_quit:         form.reason_for_quit        || undefined,
        former_landlord_contact: form.former_landlord_contact || undefined,
      });
      setDone(res.data);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg    = e?.response?.data?.error ?? '';
      if (status === 404) {
        setError(
          'Unit not found in database. This unit ID is invalid or from an old session. ' +
          'Please go to Rental Management, add a fresh unit, and click its "Onboard Tenant" button.'
        );
      } else if (status === 400) {
        setError(`Validation error: ${msg || 'unitId, fullName and email are required.'}`);
      } else {
        setError(msg || `Error ${status ?? ''}: Onboarding failed. Please try again.`);
      }
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    const link = inviteData?.url ?? '';
    try { await navigator.clipboard.writeText(link); } catch { prompt('Copy this link:', link); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Use the backend-built link directly — it already has unit name, rent, and correct URL
  const openWhatsApp = () => {
    if (inviteData?.whatsapp_link) {
      window.open(inviteData.whatsapp_link, '_blank');
    } else {
      const link = inviteData?.url ?? '';
      const text =
        `*Nested Ark — Tenant Onboarding* 🏠\n\n` +
        `You have been invited to set up your digital tenancy.\n\n` +
        `Click to verify your profile and choose your payment schedule:\n${link}\n\n` +
        `_Secured by Nested Ark Infrastructure OS_`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
      <Footer />
    </div>
  );

  // ── Invalid unit — clear redirect ──────────────────────────────────────
  if (unitValid === false) return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-xl mx-auto px-6 py-20 space-y-8 text-center w-full">
        <AlertCircle className="text-amber-400 mx-auto" size={56} />
        <div className="space-y-3">
          <h1 className="text-2xl font-black uppercase tracking-tighter">Unit Not Found</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Unit ID{' '}
            <span className="font-mono text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded">
              {unitId?.slice(0, 8)}…
            </span>{' '}
            does not exist in the database. It was likely created during an earlier
            session when the backend endpoint was broken.
          </p>
          <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-left space-y-2 text-sm">
            <p className="font-black text-white text-xs uppercase tracking-widest">What to do:</p>
            <p className="text-zinc-400">
              1. Go to <span className="text-teal-400 font-bold">My Projects</span> → click your project
            </p>
            <p className="text-zinc-400">
              2. Click <span className="text-teal-400 font-bold">Add Unit</span> → fill in all details
            </p>
            <p className="text-zinc-400">
              3. Click <span className="text-teal-400 font-bold">Add Unit to Ledger</span>
            </p>
            <p className="text-zinc-400">
              4. Click <span className="text-teal-400 font-bold">Onboard Tenant</span> on the new unit
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/projects/my"
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-teal-500 text-black font-black uppercase text-xs rounded-xl hover:bg-teal-400 transition-colors">
            <Home size={14} /> Go to My Projects
          </Link>
          <button onClick={() => router.back()}
            className="flex items-center justify-center gap-2 px-6 py-3.5 border border-zinc-700 text-zinc-400 font-bold uppercase text-xs rounded-xl hover:text-white transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );

  // ── Success ────────────────────────────────────────────────────────────
  if (done) return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-xl mx-auto px-6 py-16 space-y-8 w-full">
        <div className="text-center space-y-3">
          <CheckCircle2 className="text-teal-500 mx-auto" size={56} />
          <h1 className="text-2xl font-black uppercase tracking-tighter">Tenant Onboarded!</h1>
          <p className="text-zinc-500 text-sm">
            <span className="text-white font-bold">{form.fullName}</span> has been registered to{' '}
            <span className="text-teal-400 font-bold">{inviteData?.unit_name}</span>.
          </p>
        </div>

        {/* Vault info */}
        {done.installment_amount && (
          <div className="bg-zinc-900 border border-teal-500/20 rounded-3xl p-6 space-y-4">
            <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest">
              Flex-Pay Vault Active
            </p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-black font-mono text-teal-400">
                  {inviteData?.currency || 'NGN'} {safeF(done.installment_amount)}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {done.frequency} installment
                </p>
              </div>
              {done.ledger_hash && (
                <div className="text-right">
                  <p className="text-[8px] text-zinc-600 uppercase font-black">Ledger Hash</p>
                  <p className="text-[9px] font-mono text-zinc-500">
                    {done.ledger_hash.slice(0, 16)}…
                  </p>
                </div>
              )}
            </div>
            {done.message && (
              <p className="text-[10px] text-zinc-400 leading-relaxed border-t border-zinc-800 pt-3">
                {done.message}
              </p>
            )}
          </div>
        )}

        {/* Share invite */}
        {inviteData?.url && (
          <div className="p-5 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-3">
            <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest">
              Share Login Invite with Tenant
            </p>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Send the activation link so the tenant can set their password and access the dashboard.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={openWhatsApp}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] rounded-xl text-[9px] font-black uppercase hover:bg-[#25D366]/20 transition-all">
                <MessageCircle size={11} /> WhatsApp
              </button>
              <button onClick={copyLink}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[9px] font-black uppercase transition-all ${
                  copied
                    ? 'border-teal-500/40 bg-teal-500/10 text-teal-400'
                    : 'border-zinc-700 text-zinc-400 hover:text-white'
                }`}>
                {copied ? <CheckCircle2 size={11} /> : <Copy size={11} />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <a href={`mailto:${form.email}?subject=Your Nested Ark Tenant Account&body=Your tenancy is confirmed! Access your vault and pay rent here: ${inviteData.url}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl text-[9px] font-black uppercase hover:bg-blue-500/20 transition-all">
                <Send size={11} /> Email
              </a>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Link href="/landlord/tenants"
            className="flex-1 py-3.5 bg-teal-500 text-black rounded-xl font-black text-xs uppercase tracking-widest text-center hover:bg-teal-400 transition-all">
            View All Tenants
          </Link>
          <button
            onClick={() => {
              setDone(null);
              setForm({
                fullName: '', email: '', phone: '', pattern: 'MONTHLY',
                reason_for_quit: '', former_landlord_contact: '',
              });
            }}
            className="flex-1 py-3.5 border border-zinc-800 text-zinc-500 rounded-xl font-bold text-xs uppercase tracking-widest hover:text-white transition-all">
            Onboard Another
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );

  // ── Main Form ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto px-6 py-12 space-y-8 w-full">

        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
          <ArrowLeft size={13} /> Back
        </button>

        {/* Header */}
        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">
            Landlord · Onboarding
          </p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Onboard Tenant</h1>
          {inviteData?.unit_name && (
            <p className="text-zinc-500 text-sm mt-1 flex items-center gap-1.5">
              <Building2 size={12} className="shrink-0" />
              {inviteData.unit_name}
              {inviteData.project_title && ` · ${inviteData.project_title}`}
            </p>
          )}
        </div>

        {/* Unit info card */}
        <div className="p-4 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-3">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest mb-1">Unit</p>
              <p className="font-bold text-sm truncate">{inviteData?.unit_name}</p>
              {inviteData?.project_title && (
                <p className="text-[10px] text-zinc-400 mt-0.5">{inviteData.project_title}</p>
              )}
              {inviteData?.rent_amount && (
                <p className="text-[10px] text-teal-400 font-mono mt-1">
                  {inviteData.currency || 'NGN'} {safeF(inviteData.rent_amount)} / yr
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={openWhatsApp}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] rounded-lg text-[9px] font-black uppercase hover:bg-[#25D366]/20 transition-all">
                <MessageCircle size={10} /> Invite
              </button>
              <button onClick={copyLink}
                className="flex items-center gap-1 px-3 py-1.5 border border-zinc-700 text-zinc-400 rounded-lg text-[9px] font-black uppercase hover:text-white transition-all">
                <Copy size={10} /> {copied ? '✓' : 'Link'}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p>{error}</p>
              {(error.includes('not found') || error.includes('invalid')) && (
                <Link href="/projects/my"
                  className="inline-flex items-center gap-1 mt-2 text-teal-500 text-xs font-black uppercase hover:text-teal-400 transition-colors">
                  <ArrowRight size={10} /> Go to My Projects →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Form fields */}
        <div className="space-y-5">
          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest border-b border-zinc-800 pb-2">
            Tenant Details
          </p>

          {[
            { k: 'fullName', label: 'Full Name *',     type: 'text',  Icon: User,  ph: 'e.g. Adaeze Okafor'   },
            { k: 'email',    label: 'Email Address *', type: 'email', Icon: Mail,  ph: 'tenant@email.com'      },
            { k: 'phone',    label: 'Phone',           type: 'tel',   Icon: Phone, ph: '+234 800 000 0000'     },
          ].map(({ k, label, type, Icon, ph }) => (
            <div key={k} className="space-y-1.5">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">
                {label}
              </label>
              <div className="relative">
                <Icon size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  type={type}
                  value={(form as any)[k]}
                  onChange={e => set(k, e.target.value)}
                  placeholder={ph}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none transition-colors"
                />
              </div>
            </div>
          ))}

          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">
              Payment Pattern
            </label>
            <div className="flex gap-2">
              {PATTERNS.map(p => (
                <button key={p} onClick={() => set('pattern', p)}
                  className={`flex-1 py-3 rounded-xl border text-xs font-black uppercase tracking-wide transition-all ${
                    form.pattern === p
                      ? 'border-teal-500/40 bg-teal-500/10 text-teal-400'
                      : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
                  }`}>
                  {p}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-zinc-700">Controls Flex-Pay vault installment frequency</p>
          </div>

          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest border-b border-zinc-800 pb-2 pt-2">
            KYC / Background (Optional)
          </p>

          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">
              Reason for leaving previous address
            </label>
            <textarea
              value={form.reason_for_quit}
              onChange={e => set('reason_for_quit', e.target.value)}
              rows={2}
              placeholder="e.g. Relocating for work, lease expired…"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none resize-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">
              Former Landlord Contact
            </label>
            <input
              value={form.former_landlord_contact}
              onChange={e => set('former_landlord_contact', e.target.value)}
              placeholder="Phone or email of previous landlord"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button onClick={() => router.back()}
            className="flex-1 py-3.5 border border-zinc-800 rounded-xl text-zinc-500 font-bold text-xs uppercase tracking-widest hover:border-zinc-600 hover:text-zinc-300 transition-all">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-3.5 bg-teal-500 text-black rounded-xl font-black text-xs uppercase tracking-widest hover:bg-teal-400 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Creating Tenancy…</>
              : <><CheckCircle2 size={14} /> Onboard Tenant</>
            }
          </button>
        </div>

      </main>
      <Footer />
    </div>
  );
}

export default function LandlordOnboardPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
    }>
      <OnboardContent />
    </Suspense>
  );
}
