'use client';
export const dynamic = 'force-dynamic';

/**
 * src/app/register/page.tsx
 *
 * MODES:
 *
 * 1. TENANT INVITE FLOW
 *    /register?token=UUID&unit=UUID&email=x&role=TENANT
 *
 *    -> locks role to TENANT
 *    -> registers tenant
 *    -> consumes invite
 *    -> redirects to /tenant/dashboard
 *
 * 2. STANDARD FLOW
 *    -> normal role registration
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertCircle, ShieldCheck, Home } from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';

const ROLES = [
  {
    id: 'LANDLORD',
    label: '🏠 Property Landlord',
    sub: 'Rental Management',
    desc: 'Manage properties, tenants, rent collection and legal notices.',
    dbRole: 'DEVELOPER',
    accountType: 'LANDLORD',
  },
  {
    id: 'INFRASTRUCTURE',
    label: '🏗️ Infrastructure Developer',
    sub: 'Project Submission',
    desc: 'Manage infrastructure projects and milestones.',
    dbRole: 'DEVELOPER',
    accountType: 'INFRASTRUCTURE',
  },
  {
    id: 'DIASPORA',
    label: '🌍 Diaspora Developer',
    sub: 'Remote Investment',
    desc: 'Invest and manage projects remotely.',
    dbRole: 'DEVELOPER',
    accountType: 'DIASPORA',
  },
  {
    id: 'INVESTOR',
    label: '📈 Investor',
    sub: 'Portfolio & ROI',
    desc: 'Invest in verified infrastructure projects.',
    dbRole: 'INVESTOR',
    accountType: 'INVESTOR',
  },
  {
    id: 'CONTRACTOR',
    label: '🔧 Contractor',
    sub: 'Milestone Delivery',
    desc: 'Bid and execute project milestones.',
    dbRole: 'CONTRACTOR',
    accountType: 'CONTRACTOR',
  },
  {
    id: 'SUPPLIER',
    label: '📦 Supply Partner',
    sub: 'Materials & Logistics',
    desc: 'Provide materials and logistics support.',
    dbRole: 'SUPPLIER',
    accountType: 'SUPPLIER',
  },
  {
    id: 'BANK',
    label: '🏦 Bank / Financier',
    sub: 'Project Finance',
    desc: 'Provide funding and financing.',
    dbRole: 'BANK',
    accountType: 'BANK',
  },
] as const;

function RegisterContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const { register, loading: authLoading } = useAuth();

  // Invite params
  const inviteToken = searchParams.get('token') ?? '';
  const inviteUnit = searchParams.get('unit') ?? '';
  const inviteEmail = searchParams.get('email') ?? '';
  const forceRole = searchParams.get('role') ?? '';

  const isTenantInvite =
    forceRole === 'TENANT' &&
    !!inviteToken;

  const [selectedRole, setSelectedRole] =
    useState<typeof ROLES[number] | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    email: inviteEmail,
    phone: '',
    password: '',
  });

  const [loadingInvite, setLoadingInvite] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  /**
   * Pre-fill invite email
   */
  useEffect(() => {
    if (isTenantInvite && inviteEmail) {
      setForm(prev => ({
        ...prev,
        email: inviteEmail,
      }));
    }
  }, [inviteEmail, isTenantInvite]);

  /**
   * Validate tenant invite token
   */
  useEffect(() => {
    const validateInvite = async () => {
      if (!isTenantInvite) return;

      try {
        setLoadingInvite(true);

        await api.get(
          `/api/rental/validate-invite?token=${inviteToken}`
        );
      } catch (e: any) {
        setError(
          e?.response?.data?.error ||
          'This tenant invite is invalid or expired.'
        );
      } finally {
        setLoadingInvite(false);
      }
    };

    validateInvite();
  }, [inviteToken, isTenantInvite]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async () => {
    setError('');
    setSuccessMessage('');

    if (
      !form.full_name.trim() ||
      !form.email.trim() ||
      !form.password.trim()
    ) {
      setError('Full name, email and password are required.');
      return;
    }

    if (!isTenantInvite && !selectedRole) {
      setError('Please select an account type.');
      return;
    }

    try {
      setSubmitting(true);

      /**
       * TENANT INVITE FLOW
       */
      if (isTenantInvite) {

        await register({
          full_name: form.full_name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || undefined,
          password: form.password,
          role: 'TENANT',
          accountType: 'TENANT',
        });

        /**
         * Consume invite
         * This links tenancy to the newly created tenant account
         */
        await api.post('/api/rental/consume-invite', {
          tenancy_id: inviteToken,
          unit_id: inviteUnit,
        });

        setSuccessMessage(
          'Tenant account activated successfully. Redirecting...'
        );

        setTimeout(() => {
          router.push('/tenant/dashboard');
        }, 1200);

        return;
      }

      /**
       * NORMAL FLOW
       */
      const role = selectedRole!;

      await register({
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        role: role.dbRole as any,
        accountType: role.accountType as any,
      });

      /**
       * AuthContext handles redirects
       */
    } catch (e: any) {
      setError(
        e?.response?.data?.error ||
        e?.message ||
        'Registration failed.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Global loading
   */
  if (authLoading || loadingInvite) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2
          className="animate-spin text-teal-500"
          size={32}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">

      {/* HEADER */}
      <div className="border-b border-zinc-900 bg-black/80 px-6 py-3 flex items-center gap-3">
        <div className="w-6 h-6 rounded-md bg-teal-500 flex items-center justify-center">
          <span className="text-black text-[9px] font-black">
            NA
          </span>
        </div>

        <span className="font-black uppercase text-xs tracking-widest">
          Nested Ark
        </span>

        <Link
          href="/login"
          className="ml-auto text-[10px] text-zinc-500 hover:text-white uppercase font-bold tracking-widest"
        >
          Sign In
        </Link>
      </div>

      <main className="flex-1 max-w-xl mx-auto px-6 py-12 w-full space-y-8">

        {/* TITLE */}
        <div className="text-center space-y-2">

          <div className="w-14 h-14 rounded-2xl border border-teal-500/30 bg-teal-500/10 flex items-center justify-center mx-auto">
            {isTenantInvite ? (
              <Home size={24} className="text-teal-400" />
            ) : (
              <ShieldCheck size={24} className="text-teal-400" />
            )}
          </div>

          <h1 className="text-2xl font-black uppercase tracking-tight">
            Create Account
          </h1>

          {isTenantInvite ? (
            <p className="text-zinc-500 text-sm">
              Complete your tenant onboarding to activate your tenancy.
            </p>
          ) : (
            <p className="text-zinc-500 text-sm">
              Select your account type to continue.
            </p>
          )}
        </div>

        {/* TENANT BADGE */}
        {isTenantInvite && (
          <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/5">
            <p className="text-xs font-black text-teal-400 uppercase tracking-widest">
              Tenant Invite
            </p>

            <p className="text-zinc-500 text-[10px] mt-1">
              Your tenancy will automatically connect after registration.
            </p>
          </div>
        )}

        {/* ROLE PICKER */}
        {!isTenantInvite && (
          <div className="space-y-3">

            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">
              Select Account Type
            </p>

            {ROLES.map(role => (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={`w-full p-4 rounded-xl border text-left transition-all ${
                  selectedRole?.id === role.id
                    ? 'border-teal-500/60 bg-teal-500/10'
                    : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700'
                }`}
              >
                <p className="font-black text-sm">
                  {role.label}
                </p>

                <p className="text-[9px] text-teal-500 uppercase font-bold tracking-widest mt-1">
                  {role.sub}
                </p>

                <p className="text-zinc-500 text-[10px] mt-1">
                  {role.desc}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* FORM */}
        <div className="space-y-4">

          <div>
            <label className="block text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-2">
              Full Name *
            </label>

            <input
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              placeholder="e.g. Amaka Okonkwo"
              className="w-full bg-zinc-900 border border-zinc-800 px-4 py-3.5 rounded-xl text-sm outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-2">
              Email *
            </label>

            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              readOnly={isTenantInvite}
              placeholder="you@email.com"
              className={`w-full bg-zinc-900 border border-zinc-800 px-4 py-3.5 rounded-xl text-sm outline-none focus:border-teal-500 ${
                isTenantInvite
                  ? 'opacity-60 cursor-not-allowed'
                  : ''
              }`}
            />
          </div>

          <div>
            <label className="block text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-2">
              Phone
            </label>

            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="+234 801 234 5678"
              className="w-full bg-zinc-900 border border-zinc-800 px-4 py-3.5 rounded-xl text-sm outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-2">
              Password *
            </label>

            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full bg-zinc-900 border border-zinc-800 px-4 py-3.5 rounded-xl text-sm outline-none focus:border-teal-500"
            />
          </div>

        </div>

        {/* ERROR */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* SUCCESS */}
        {successMessage && (
          <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/5 text-teal-400 text-sm font-bold">
            {successMessage}
          </div>
        )}

        {/* SUBMIT */}
        <button
          onClick={handleSubmit}
          disabled={
            submitting ||
            (!isTenantInvite && !selectedRole)
          }
          className="w-full py-4 bg-teal-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all disabled:opacity-50"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Creating Account...
            </span>
          ) : (
            'Create Account'
          )}
        </button>

        <p className="text-center text-zinc-600 text-xs">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-teal-500 hover:underline font-bold"
          >
            Sign In
          </Link>
        </p>

      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
          <Loader2
            className="animate-spin text-teal-500"
            size={32}
          />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}