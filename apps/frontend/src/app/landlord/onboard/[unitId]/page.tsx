'use client';
export const dynamic = 'force-dynamic';
/**
 * src/app/landlord/onboard/[unitId]/page.tsx
 *
 * HARDENED VERSION — production-grade existence guard.
 *
 * Ghost-ID problem solved:
 *   - Verifies unit exists in DB BEFORE rendering any form
 *   - Handles null / undefined / empty object from backend
 *   - Shows clear recovery UI if unit is stale/missing
 *   - Never redirects to onboard/:id until backend INSERT confirmed
 *
 * AuthContext alignment:
 *   - Uses `loading` (NOT `isLoading`) from useAuth()
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import {
  Loader2, AlertCircle, Home, ArrowLeft,
  User, Mail, Phone, Building2, CheckCircle2,
  ChevronRight, ShieldCheck
} from 'lucide-react';

// ── Defensive helpers ──────────────────────────────────────────────────────
const safeF = (v: any) => Number(v ?? 0).toLocaleString();

// ── Types ──────────────────────────────────────────────────────────────────
interface Unit {
  id: string;
  unit_name: string;
  unit_type?: string;
  floor_number?: number;
  bedrooms?: number;
  bathrooms?: number;
  size_sqm?: number;
  rent_amount: number;
  currency?: string;
  project_title?: string;
  project_id?: string;
  status?: string;
}

interface OnboardForm {
  tenant_name: string;
  tenant_email: string;
  tenant_phone: string;
  move_in_date: string;
  payment_frequency: string;
  deposit_amount: string;
}

const EMPTY_FORM: OnboardForm = {
  tenant_name: '',
  tenant_email: '',
  tenant_phone: '',
  move_in_date: '',
  payment_frequency: 'monthly',
  deposit_amount: '',
};

// ── Component ──────────────────────────────────────────────────────────────
export default function OnboardTenantPage() {
  const params   = useParams();
  const router   = useRouter();
  // ✅ AuthContext uses `loading`, NOT `isLoading`
  const { user, loading: authLoading } = useAuth();

  const unitId = Array.isArray(params?.unitId)
    ? params.unitId[0]
    : params?.unitId ?? '';

  // ── State ────────────────────────────────────────────────────────────────
  const [unit,        setUnit]        = useState<Unit | null>(null);
  const [unitLoading, setUnitLoading] = useState(true);
  const [unitError,   setUnitError]   = useState('');

  const [form,        setForm]        = useState<OnboardForm>(EMPTY_FORM);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success,     setSuccess]     = useState(false);
  const [inviteLink,  setInviteLink]  = useState('');

  // ── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  // ── HARDENED unit fetch with existence guard ─────────────────────────────
  const loadUnit = useCallback(async () => {
    if (!unitId) {
      setUnitError('No unit ID provided in URL.');
      setUnitLoading(false);
      return;
    }

    try {
      setUnitLoading(true);
      setUnitError('');

      // ✅ Use /single/:unitId — the dedicated per-unit lookup endpoint.
      // /api/rental/units/:id is a project-list route (takes projectId), NOT a unit lookup.
      const res = await api.get(`/api/rental/units/single/${unitId}`);

      // Backend may return:  null | undefined | {} | { unit: {...} } | {...}
      const foundUnit: Unit | null =
        res?.data?.unit?.id  ? res.data.unit  :
        res?.data?.id        ? res.data        :
        null;

      if (!foundUnit || !foundUnit.id) {
        setUnit(null);
        setUnitError(
          `Unit ID ${unitId.slice(0, 8)}… does not exist in the database. ` +
          `It was likely created during an earlier session when the backend endpoint was broken.`
        );
        return;
      }

      setUnit(foundUnit);

      // Pre-fill deposit as one month's rent
      setForm(f => ({
        ...f,
        deposit_amount: String(foundUnit.rent_amount ?? ''),
      }));

    } catch (err: any) {
      console.error('[OnboardPage] Failed to load unit:', err);
      setUnit(null);
      setUnitError(
        err?.response?.data?.error ??
        err?.response?.data?.message ??
        'Unable to load unit from database. The record may have been deleted.'
      );
    } finally {
      setUnitLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    if (!authLoading && user) loadUnit();
  }, [authLoading, user, loadUnit]);

  // ── Form handlers ────────────────────────────────────────────────────────
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async () => {
    if (!unit) return;

    // Basic validation
    if (!form.tenant_name.trim()) { setSubmitError('Tenant name is required.'); return; }
    if (!form.tenant_email.trim()) { setSubmitError('Tenant email is required.'); return; }
    if (!form.move_in_date) { setSubmitError('Move-in date is required.'); return; }

    try {
      setSubmitting(true);
      setSubmitError('');

      const res = await api.post('/api/rental/onboard-tenant', {
        unit_id:           unit.id,
        tenant_name:       form.tenant_name.trim(),
        tenant_email:      form.tenant_email.trim(),
        tenant_phone:      form.tenant_phone.trim(),
        move_in_date:      form.move_in_date,
        payment_frequency: form.payment_frequency,
        deposit_amount:    Number(form.deposit_amount) || 0,
      });

      const link = res?.data?.invite_link ?? res?.data?.onboard_url ?? '';
      setInviteLink(link);
      setSuccess(true);

    } catch (err: any) {
      console.error('[OnboardPage] Submit failed:', err);
      setSubmitError(
        err?.response?.data?.error ??
        err?.response?.data?.message ??
        'Failed to onboard tenant. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading states ────────────────────────────────────────────────────────
  if (authLoading || unitLoading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={32} />
    </div>
  );

  // ── GHOST-ID RECOVERY UI ─────────────────────────────────────────────────
  if (!unit) return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <AlertCircle size={28} className="text-red-400" />
          </div>

          <div>
            <h1 className="text-xl font-black uppercase tracking-tight mb-2">Unit Not Found</h1>
            <p className="text-zinc-500 text-sm leading-relaxed">{unitError}</p>
          </div>

          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/30 text-left space-y-3">
            <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">What to do:</p>
            {[
              'Go to My Projects → click your project',
              'Click Add Unit → fill in all details',
              'Click Add Unit to Ledger',
              'Click Onboard Tenant on the new unit',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-400 text-[9px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-zinc-400 text-xs">{step}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Link
              href="/projects/my"
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-teal-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all"
            >
              <Home size={14} /> Go to My Projects
            </Link>
            <button
              onClick={() => router.back()}
              className="px-4 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:border-zinc-600 transition-all"
            >
              <ArrowLeft size={14} />
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );

  // ── SUCCESS UI ────────────────────────────────────────────────────────────
  if (success) {
    const whatsappUrl = inviteLink
      ? `https://wa.me/${form.tenant_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
          `Hello ${form.tenant_name},\n\nYou have been invited to onboard as a tenant at ${unit?.unit_name || 'your new unit'} via Nested Ark OS.\n\nPlease click the link below to complete your KYC, sign your tenancy agreement, and set up your Flex-Pay vault:\n\n${inviteLink}\n\nThis is a secure, one-time link. Contact your landlord if you have any questions.`
        )}`
      : '';
    const emailUrl = inviteLink
      ? `mailto:${form.tenant_email}?subject=${encodeURIComponent('Your Nested Ark Tenancy Invite')}&body=${encodeURIComponent(
          `Dear ${form.tenant_name},\n\nYou have been invited to onboard as a tenant at ${unit?.unit_name || 'your unit'} via Nested Ark OS.\n\nPlease use the secure link below to complete your onboarding:\n\n${inviteLink}\n\nThis link contains your unique tenant token. Please do not share it with others.\n\nBest regards,\nNested Ark OS`
        )}`
      : '';
    const smsUrl = inviteLink
      ? `sms:${form.tenant_phone}?body=${encodeURIComponent(
          `Hi ${form.tenant_name}, your Nested Ark tenancy invite for ${unit?.unit_name || 'your unit'}: ${inviteLink}`
        )}`
      : '';

    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-6 py-20">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 size={28} className="text-teal-400" />
            </div>

            <div>
              <h1 className="text-xl font-black uppercase tracking-tight mb-2">Tenant Onboarded</h1>
              <p className="text-zinc-500 text-sm">
                {form.tenant_name} has been invited to {unit?.unit_name}.
                An onboarding link has been generated.
              </p>
            </div>

            {inviteLink && (
              <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/5 text-left">
                <p className="text-[10px] text-zinc-500 uppercase font-black mb-2">Invite Link</p>
                <p className="font-mono text-xs text-teal-400 break-all mb-3">{inviteLink}</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(inviteLink); }}
                  className="w-full py-2 text-[10px] font-black uppercase border border-teal-500/30 text-teal-400 rounded-lg hover:bg-teal-500/10 transition-colors"
                >
                  📋 Copy Link
                </button>
              </div>
            )}

            {/* Share Buttons */}
            <div className="space-y-2">
              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Send Invite Via</p>
              <div className="grid grid-cols-3 gap-2">
                {whatsappUrl && (
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.116.553 4.103 1.523 5.824L0 24l6.336-1.498A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.013-1.376l-.36-.214-3.732.882.934-3.611-.235-.372A9.818 9.818 0 0 1 2.182 12C2.182 6.58 6.58 2.182 12 2.182c5.42 0 9.818 4.398 9.818 9.818 0 5.42-4.398 9.818-9.818 9.818z"/></svg>
                    <span className="text-[9px] font-black uppercase">WhatsApp</span>
                  </a>
                )}
                {emailUrl && (
                  <a href={emailUrl}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all">
                    <Mail size={20} />
                    <span className="text-[9px] font-black uppercase">Email</span>
                  </a>
                )}
                {smsUrl && (
                  <a href={smsUrl}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all">
                    <Phone size={20} />
                    <span className="text-[9px] font-black uppercase">SMS</span>
                  </a>
                )}
              </div>
            </div>

            <Link
              href="/landlord/tenants"
              className="flex items-center justify-center gap-2 py-3 bg-teal-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all"
            >
              View All Tenants <ChevronRight size={14} />
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── MAIN ONBOARDING FORM ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto px-6 py-12 w-full space-y-8">

        {/* Header */}
        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">
            Landlord · Tenant Onboarding
          </p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Onboard Tenant</h1>
          <p className="text-zinc-500 text-xs mt-1">
            Onboarding into <span className="text-white font-bold">{unit.unit_name}</span>
            {unit.project_title && <> · {unit.project_title}</>}
          </p>
        </div>

        {/* Unit summary card */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
            <Building2 size={20} className="text-teal-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black uppercase truncate">{unit.unit_name}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {unit.unit_type ?? 'Unit'}
              {unit.bedrooms != null && ` · ${unit.bedrooms}BR`}
              {unit.size_sqm != null && ` · ${unit.size_sqm}m²`}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-black text-teal-400 font-mono text-sm">
              {unit.currency ?? 'NGN'} {safeF(unit.rent_amount)}
            </p>
            <p className="text-[9px] text-zinc-500">/ month</p>
          </div>
        </div>

        {/* Form fields */}
        <div className="space-y-5">

          {/* Tenant Name */}
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-2">
              Tenant Full Name *
            </label>
            <div className="relative">
              <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                name="tenant_name"
                value={form.tenant_name}
                onChange={handleChange}
                placeholder="e.g. Amaka Okonkwo"
                className="w-full bg-zinc-900 border border-zinc-800 pl-11 pr-4 py-3.5 rounded-xl text-sm outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>

          {/* Tenant Email */}
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-2">
              Tenant Email *
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                name="tenant_email"
                type="email"
                value={form.tenant_email}
                onChange={handleChange}
                placeholder="tenant@email.com"
                className="w-full bg-zinc-900 border border-zinc-800 pl-11 pr-4 py-3.5 rounded-xl text-sm outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>

          {/* Tenant Phone */}
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-2">
              Phone Number
            </label>
            <div className="relative">
              <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                name="tenant_phone"
                value={form.tenant_phone}
                onChange={handleChange}
                placeholder="+234 801 234 5678"
                className="w-full bg-zinc-900 border border-zinc-800 pl-11 pr-4 py-3.5 rounded-xl text-sm outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>

          {/* Move-in Date */}
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-2">
              Move-in Date *
            </label>
            <input
              name="move_in_date"
              type="date"
              value={form.move_in_date}
              onChange={handleChange}
              className="w-full bg-zinc-900 border border-zinc-800 px-4 py-3.5 rounded-xl text-sm outline-none focus:border-teal-500 transition-colors"
            />
          </div>

          {/* Payment Frequency */}
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-2">
              Payment Frequency
            </label>
            <select
              name="payment_frequency"
              value={form.payment_frequency}
              onChange={handleChange}
              className="w-full bg-zinc-900 border border-zinc-800 px-4 py-3.5 rounded-xl text-sm outline-none focus:border-teal-500 transition-colors"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="biannual">Bi-annual</option>
              <option value="annual">Annual</option>
            </select>
          </div>

          {/* Deposit */}
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-2">
              Security Deposit ({unit.currency ?? 'NGN'})
            </label>
            <input
              name="deposit_amount"
              type="number"
              value={form.deposit_amount}
              onChange={handleChange}
              placeholder="0"
              className="w-full bg-zinc-900 border border-zinc-800 px-4 py-3.5 rounded-xl text-sm outline-none focus:border-teal-500 transition-colors font-mono"
            />
          </div>
        </div>

        {/* Error */}
        {submitError && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14} className="flex-shrink-0" /> {submitError}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-4 bg-teal-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting
            ? <><Loader2 size={16} className="animate-spin" /> Onboarding Tenant…</>
            : <><ShieldCheck size={16} /> Onboard Tenant &amp; Send Invite</>
          }
        </button>

        <p className="text-[10px] text-zinc-600 text-center">
          Tenant will receive an email invite to complete KYC and sign their tenancy agreement.
        </p>

      </main>
      <Footer />
    </div>
  );
}
