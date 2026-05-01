'use client';
export const dynamic = 'force-dynamic';
/**
 * /landlord/onboard/[unitId]/page.tsx
 * DEVELOPER (landlord) role only — middleware enforces this.
 *
 * Real API: POST /api/tenant/onboard
 * Body: { unitId, fullName, email, phone, pattern,
 *         selfie_url?, former_address?, reason_for_quit?,
 *         former_landlord_contact?, guarantor_json?, digital_signature_url? }
 *
 * Backend creates: tenancy record + flex_pay_vault + system_ledger entry.
 * If user account with that email already exists as TENANT role, it is
 * auto-linked via tenant_user_id. Otherwise landlord sends invite link
 * via GET /api/rental/invite-link/:unitId after onboarding.
 *
 * Unit loaded via: GET /api/rental/units/:projectId (filter by id)
 */
import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  Loader2, AlertCircle, CheckCircle2, User, Mail, Phone,
  Building2, ArrowLeft, Send, Copy, MessageCircle, Calendar,
} from 'lucide-react';

const PATTERNS = ['MONTHLY', 'WEEKLY', 'QUARTERLY'];

function OnboardContent() {
  const { unitId } = useParams<{ unitId: string }>();
  const router = useRouter();

  const [unit,    setUnit]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [done,    setDone]    = useState<any>(null); // onboard result
  const [error,   setError]   = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [copied,  setCopied]  = useState(false);

  const [form, setForm] = useState({
    fullName:               '',
    email:                  '',
    phone:                  '',
    pattern:                'MONTHLY',
    reason_for_quit:        '',
    former_landlord_contact:'',
    selfie_url:             '',
    digital_signature_url:  '',
  });

  // Load unit info
  useEffect(() => {
    if (!unitId) return;
    // Use /api/rental/management/:projectId is not available for single unit;
    // use /api/rental/invite-link/:unitId which returns unit context
    api.get(`/api/rental/invite-link/${unitId}`)
      .then(r => setUnit(r.data.unit ?? r.data))
      .catch(() => {
        // fallback: just show unitId and proceed
        setUnit({ id: unitId, unit_name: 'Selected Unit' });
      })
      .finally(() => setLoading(false));
  }, [unitId]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      setError('Full name and email are required.'); return;
    }
    setSaving(true); setError('');
    try {
      const res = await api.post('/api/tenant/onboard', {
        unitId,
        fullName:               form.fullName.trim(),
        email:                  form.email.trim().toLowerCase(),
        phone:                  form.phone.trim() || undefined,
        pattern:                form.pattern,
        reason_for_quit:        form.reason_for_quit || undefined,
        former_landlord_contact:form.former_landlord_contact || undefined,
        selfie_url:             form.selfie_url || undefined,
        digital_signature_url:  form.digital_signature_url || undefined,
      });
      setDone(res.data);
      // Also fetch invite link for sharing
      const linkRes = await api.get(`/api/rental/invite-link/${unitId}`);
      setInviteLink(linkRes.data.url ?? linkRes.data.invite_url ?? '');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to onboard tenant. Please try again.');
    } finally { setSaving(false); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(inviteLink); } catch { prompt('Copy:', inviteLink); }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white"><Navbar />
      <div className="flex items-center justify-center py-40"><Loader2 className="animate-spin text-teal-500" size={28} /></div>
    <Footer /></div>
  );

  // Success state
  if (done) return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-xl mx-auto px-6 py-16 space-y-8 w-full">
        <div className="text-center space-y-4">
          <CheckCircle2 className="text-teal-500 mx-auto" size={48} />
          <h1 className="text-2xl font-black uppercase tracking-tighter">Tenant Onboarded!</h1>
          <p className="text-zinc-500 text-sm">
            {form.fullName} has been registered to {unit?.unit_name || 'the unit'}.
            Vault and tenancy record created successfully.
          </p>
        </div>

        {/* Share invite link */}
        {inviteLink && (
          <div className="p-5 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-3">
            <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest">Share Login Invite</p>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Send this link to the tenant. They click it to set their password and access their dashboard.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={copyLink}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[9px] font-black uppercase transition-all ${copied ? 'border-teal-500/40 bg-teal-500/10 text-teal-400' : 'border-zinc-700 text-zinc-400 hover:text-white'}`}>
                {copied ? <CheckCircle2 size={11}/> : <Copy size={11}/>} {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent(`Your Nested Ark tenant account is ready!\n\nClick to activate: ${inviteLink}`)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] rounded-xl text-[9px] font-black uppercase hover:bg-[#25D366]/20 transition-all">
                <MessageCircle size={11}/> WhatsApp
              </a>
              <a href={`mailto:${form.email}?subject=Your Nested Ark Tenant Account&body=Your account is ready. Click to activate: ${inviteLink}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl text-[9px] font-black uppercase hover:bg-blue-500/20 transition-all">
                <Send size={11}/> Email
              </a>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => router.push('/landlord/tenants')}
            className="flex-1 py-3 bg-teal-500 text-black rounded-xl font-black text-xs uppercase tracking-widest hover:bg-teal-400 transition-all">
            View All Tenants
          </button>
          <button onClick={() => { setDone(null); setForm({fullName:'',email:'',phone:'',pattern:'MONTHLY',reason_for_quit:'',former_landlord_contact:'',selfie_url:'',digital_signature_url:''}); }}
            className="flex-1 py-3 border border-zinc-800 text-zinc-500 rounded-xl font-bold text-xs uppercase tracking-widest hover:text-white transition-all">
            Onboard Another
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto px-6 py-12 space-y-8 w-full">

        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
          <ArrowLeft size={13} /> Back
        </button>

        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Landlord · Onboarding</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Onboard Tenant</h1>
          {unit && (
            <p className="text-zinc-500 text-sm mt-1 flex items-center gap-1.5">
              <Building2 size={12} /> {unit.unit_name}
            </p>
          )}
        </div>

        {unit && (
          <div className="p-4 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-1">
            <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest">Unit</p>
            <p className="font-bold text-sm">{unit.unit_name} {unit.unit_type ? `· ${unit.unit_type}` : ''}</p>
            {unit.rent_amount && (
              <p className="text-[10px] text-zinc-400">
                {unit.currency || 'NGN'} {Number(unit.rent_amount).toLocaleString()}/month
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="space-y-5">
          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest border-b border-zinc-800 pb-2">
            Tenant Details
          </p>

          {/* Full name */}
          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Full Name *</label>
            <div className="relative">
              <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input value={form.fullName} onChange={e => set('fullName', e.target.value)}
                placeholder="e.g. Adaeze Okafor"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none" />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Email Address *</label>
            <div className="relative">
              <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="tenant@email.com"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none" />
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Phone</label>
            <div className="relative">
              <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="+234 800 000 0000"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none" />
            </div>
          </div>

          {/* Payment pattern */}
          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Payment Pattern</label>
            <div className="flex gap-2">
              {PATTERNS.map(p => (
                <button key={p} onClick={() => set('pattern', p)}
                  className={`flex-1 py-3 rounded-xl border text-xs font-black uppercase tracking-wide transition-all ${form.pattern === p ? 'border-teal-500/40 bg-teal-500/10 text-teal-400' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>
                  {p}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-zinc-700">Controls Flex-Pay vault installment frequency</p>
          </div>

          {/* KYC fields (optional) */}
          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest border-b border-zinc-800 pb-2 pt-2">
            KYC / Background (Optional)
          </p>

          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Reason for leaving previous address</label>
            <textarea value={form.reason_for_quit} onChange={e => set('reason_for_quit', e.target.value)} rows={2}
              placeholder="e.g. Relocating for work, lease expired…"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none resize-none" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Former Landlord Contact</label>
            <input value={form.former_landlord_contact} onChange={e => set('former_landlord_contact', e.target.value)}
              placeholder="Phone or email of previous landlord"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={() => router.back()}
            className="flex-1 py-3 border border-zinc-800 rounded-xl text-zinc-500 font-bold text-xs uppercase tracking-widest hover:border-zinc-600 hover:text-zinc-300 transition-all">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-3 bg-teal-500 text-black rounded-xl font-black text-xs uppercase tracking-widest hover:bg-teal-400 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {saving ? 'Creating Tenancy…' : 'Onboard Tenant'}
          </button>
        </div>

      </main>
      <Footer />
    </div>
  );
}

export default function LandlordOnboardPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={28} /></div>}>
      <OnboardContent />
    </Suspense>
  );
}
