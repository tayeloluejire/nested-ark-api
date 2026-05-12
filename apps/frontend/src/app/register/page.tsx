'use client';
export const dynamic = 'force-dynamic';
/**
 * src/app/register/page.tsx
 *
 * Handles two modes:
 * 1. TENANT INVITE mode: ?token=UUID&unit=UUID&email=...&role=TENANT
 *    - Pre-fills email, locks role to TENANT
 *    - After register → calls POST /api/rental/consume-invite → /tenant/dashboard
 *
 * 2. NORMAL mode: user selects their role
 *    - After register → role-based redirect
 */
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import { Loader2, AlertCircle, ShieldCheck, Building2, Home } from 'lucide-react';

const ROLES = [
  { id: 'LANDLORD',        label: '🏠 Property Landlord',       sub: 'Rental Management',       desc: 'Own residential or commercial rental units. Onboard tenants, manage Flex-Pay vaults, issue legal notices.', dbRole: 'DEVELOPER', accountType: 'LANDLORD' },
  { id: 'INFRASTRUCTURE',  label: '🏗️ Infrastructure Developer', sub: 'Project Submission',       desc: 'Submit roads, bridges, energy, housing projects. Manage milestones, contractors, and investor bids.',       dbRole: 'DEVELOPER', accountType: 'INFRASTRUCTURE' },
  { id: 'DIASPORA',        label: '🌍 Diaspora Developer',       sub: 'Remote Investment',        desc: 'Invest in and build infrastructure from abroad. Same powers as infrastructure developer — diaspora-flagged.',  dbRole: 'DEVELOPER', accountType: 'DIASPORA' },
  { id: 'INVESTOR',        label: '📈 Investor',                 sub: 'Portfolio & ROI',          desc: 'Browse vetted projects, commit capital, track returns, and receive rental income distributions.',             dbRole: 'INVESTOR',  accountType: 'INVESTOR' },
  { id: 'CONTRACTOR',      label: '🔧 Contractor',               sub: 'Milestone Delivery',       desc: 'Bid on project milestones. Receive escrow-backed payments on verified completion.',                          dbRole: 'CONTRACTOR', accountType: 'CONTRACTOR' },
  { id: 'SUPPLIER',        label: '📦 Supply Partner',           sub: 'Materials & Logistics',    desc: 'Supply materials and services to infrastructure projects listed on the platform.',                            dbRole: 'SUPPLIER',  accountType: 'SUPPLIER' },
  { id: 'BANK',            label: '🏦 Bank / Financier',         sub: 'Project Finance',          desc: 'Co-fund large infrastructure projects. Access verified project documentation and financial models.',          dbRole: 'BANK',      accountType: 'BANK' },
] as const;

function RegisterContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { register, loading: authLoading } = useAuth();

  // Invite mode params
  const inviteToken = searchParams.get('token') ?? '';
  const inviteUnit  = searchParams.get('unit')  ?? '';
  const inviteEmail = searchParams.get('email') ?? '';
  const forceRole   = searchParams.get('role')  ?? '';
  const isTenantInvite = forceRole === 'TENANT' && !!inviteToken;

  const [selectedRole, setSelectedRole] = useState<typeof ROLES[number] | null>(null);
  const [form, setForm] = useState({ full_name: '', email: inviteEmail, phone: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Pre-select TENANT role and lock if invite
  useEffect(() => {
    if (isTenantInvite) {
      setForm(f => ({ ...f, email: inviteEmail }));
    }
  }, [isTenantInvite, inviteEmail]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async () => {
    if (!form.full_name.trim() || !form.email.trim() || !form.password) {
      setError('Full name, email, and password are required.'); return;
    }
    if (!isTenantInvite && !selectedRole) {
      setError('Please select your account type.'); return;
    }

    setSubmitting(true); setError('');
    try {
      if (isTenantInvite) {
        // Register with TENANT role
        await register({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          password: form.password,
          role: 'TENANT',
          accountType: 'TENANT',
        });
        // Consume the invite to link tenancy
        await api.post('/api/rental/consume-invite', { tenancy_id: inviteToken });
        router.push('/tenant/dashboard');
      } else {
        const role = selectedRole!;
        await register({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          password: form.password,
          role: role.dbRole as any,
          accountType: role.accountType as any,
        });
        // AuthContext handles roleHomePath redirect
      }
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Registration failed. Please try again.');
      setSubmitting(false);
    }
  };

  if (authLoading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      {/* Top bar */}
      <div className="border-b border-zinc-900 bg-black/80 px-6 py-3 flex items-center gap-3">
        <div className="w-6 h-6 bg-teal-500 rounded-md flex items-center justify-center">
          <span className="text-black font-black text-[9px]">NA</span>
        </div>
        <span className="font-black uppercase text-xs tracking-widest">Nested Ark</span>
        <Link href="/login" className="ml-auto text-[10px] text-zinc-500 hover:text-white transition-colors font-bold uppercase tracking-widest">Sign In</Link>
      </div>

      <main className="flex-1 max-w-xl mx-auto px-6 py-12 w-full space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mx-auto">
            {isTenantInvite ? <Home size={24} className="text-teal-400" /> : <ShieldCheck size={24} className="text-teal-400" />}
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight">Create Account</h1>
          {isTenantInvite
            ? <p className="text-zinc-500 text-sm">Complete your tenant registration to activate your tenancy.</p>
            : <p className="text-zinc-500 text-sm">Tenant? Your landlord will send you an invite link.</p>
          }
        </div>

        {/* Role picker — only for non-tenant-invite */}
        {!isTenantInvite && (
          <div>
            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-4">I am a…</p>
            <div className="space-y-2">
              {ROLES.map(role => (
                <button key={role.id} onClick={() => setSelectedRole(role)}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    selectedRole?.id === role.id
                      ? 'border-teal-500/60 bg-teal-500/10'
                      : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700'
                  }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-sm">{role.label}</p>
                      <p className="text-[9px] text-teal-500 uppercase font-bold tracking-widest mt-0.5">{role.sub}</p>
                      <p className="text-zinc-500 text-[10px] mt-1 leading-relaxed">{role.desc}</p>
                    </div>
                    {selectedRole?.id === role.id && (
                      <div className="w-4 h-4 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="w-2 h-2 rounded-full bg-black" />
                      </div>
                    )}
                  </div>
                  <p className="text-[8px] text-zinc-700 font-mono mt-2">DB role: {role.dbRole} · Account type: {role.accountType}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tenant badge if invite mode */}
        {isTenantInvite && (
          <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/5 flex items-center gap-3">
            <Home size={18} className="text-teal-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-black text-teal-400 uppercase tracking-widest">Tenant Account</p>
              <p className="text-zinc-500 text-[10px] mt-0.5">Your account will be linked to your tenancy after registration.</p>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          {[
            { name: 'full_name', label: 'Full Name *', placeholder: 'e.g. Amaka Okonkwo', type: 'text' },
            { name: 'email',     label: 'Email *',      placeholder: 'you@email.com',       type: 'email', locked: isTenantInvite && !!inviteEmail },
            { name: 'phone',     label: 'Phone',        placeholder: '+234 801 234 5678',   type: 'tel' },
            { name: 'password',  label: 'Password *',   placeholder: '••••••••',            type: 'password' },
          ].map(f => (
            <div key={f.name}>
              <label className="block text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-2">{f.label}</label>
              <input
                name={f.name} type={f.type}
                value={form[f.name as keyof typeof form]}
                onChange={handleChange}
                placeholder={f.placeholder}
                readOnly={f.locked}
                className={`w-full bg-zinc-900 border border-zinc-800 px-4 py-3.5 rounded-xl text-sm outline-none focus:border-teal-500 transition-colors ${f.locked ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14} className="flex-shrink-0" /> {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={submitting || (!isTenantInvite && !selectedRole)}
          className="w-full py-4 bg-teal-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {submitting ? <><Loader2 size={16} className="animate-spin" /> Creating Account…</> : 'Create Account'}
        </button>

        <p className="text-center text-zinc-600 text-xs">
          Already have an account?{' '}
          <Link href="/login" className="text-teal-500 hover:underline font-bold">Sign In</Link>
        </p>

        <p className="text-center text-zinc-700 text-[9px]">
          Government · Admin · Verifier accounts are assigned by system admin. Contact nestedark@gmail.com
        </p>

      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
