'use client';
export const dynamic = 'force-dynamic';

/**
 * src/app/register/page.tsx
 *
 * MODES:
 * 1. TENANT INVITE FLOW (via URL params from Landlord)
 * 2. STANDARD FLOW (With Specialized Independent Tenant Escrow Vault + Landlord Paystack Auto-Verification)
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Loader2, AlertCircle, ShieldCheck, Home, Info, 
  Wallet, Building, Calendar, CheckCircle2, Landmark 
} from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import BrandLogo from '@/components/BrandLogo';

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
    id: 'TENANT',
    label: '🔑 Residential Tenant',
    sub: 'Flex-Pay & Rentals',
    desc: 'Access your rental dashboard, pay rent via Flex-Pay, or build an independent savings escrow.',
    dbRole: 'TENANT',
    accountType: 'TENANT',
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

interface BankOption {
  name: string;
  code: string;
}

function RegisterContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const { register, loading: authLoading } = useAuth();

  // Onboarding route context parameters
  const inviteToken = searchParams.get('token') ?? '';
  const inviteUnit  = searchParams.get('unit')  ?? '';
  const inviteEmail = searchParams.get('email') ?? '';
  const forceRole   = searchParams.get('role')  ?? '';
  const intentUnit  = searchParams.get('unit_id') ?? '';
  const urlIntent   = searchParams.get('intent') ?? '';

  const isTenantInvite = (forceRole === 'TENANT' || urlIntent === 'vault') && !!inviteToken;

  const [selectedRole, setSelectedRole] = useState<typeof ROLES[number] | null>(null);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [verifyingBank, setVerifyingBank] = useState(false);
  const [bankResolved, setBankResolved] = useState(false);

  // Expanded registration form state to capture targets and auto-verification rules cleanly
  const [form, setForm] = useState({
    full_name: '',
    email: inviteEmail,
    phone: '',
    password: '',
    // Independent Tenant Escrow Vault Configuration parameters
    target_rent: '',
    savings_frequency: 'MONTHLY',
    landlord_bank_code: '',
    landlord_bank_name: '',
    landlord_account_number: '',
    landlord_account_name: '',
  });

  const [loadingInvite, setLoadingInvite] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Handle default intent initialization
  useEffect(() => {
    if (urlIntent === 'tenant' || urlIntent === 'vault' || forceRole === 'TENANT') {
      const tenantRole = ROLES.find(r => r.id === 'TENANT');
      if (tenantRole) setSelectedRole(tenantRole);
    }
  }, [urlIntent, forceRole]);

  // Fetch available banks list cleanly for independent targeted configuration routes
  useEffect(() => {
    api.get('/api/payouts/banks')
      .then(res => {
        if (res.data?.banks) {
          setBanks(res.data.banks);
        } else if (Array.isArray(res.data)) {
          setBanks(res.data);
        }
      })
      .catch(() => {});
  }, []);

  // Pre-fill fields from route parameters securely
  useEffect(() => {
    if (inviteEmail) {
      setForm(prev => ({ ...prev, email: inviteEmail }));
    }
  }, [inviteEmail]);

  // Validate token payload from the server if it's an invited asset onboarding stream
  useEffect(() => {
    const validateInvite = async () => {
      if (!isTenantInvite) return;
      try {
        setLoadingInvite(true);
        await api.get(`/api/rental/validate-invite?token=${inviteToken}`);
      } catch (e: any) {
        setError(e?.response?.data?.error || 'This tenant invite link is invalid or has expired.');
      } finally {
        setLoadingInvite(false);
      }
    };
    validateInvite();
  }, [inviteToken, isTenantInvite]);

  // Perform surgical, live Landlord Bank Account verification using Paystack lookup infrastructure
  useEffect(() => {
    const verifyLandlordAccount = async () => {
      if (form.landlord_account_number.length === 10 && form.landlord_bank_code) {
        try {
          setVerifyingBank(true);
          setError('');
          setBankResolved(false);

          const matchedBank = banks.find(b => b.code === form.landlord_bank_code);
          const bankName = matchedBank ? matchedBank.name : '';

          const res = await api.post('/api/payouts/resolve-account', {
            account_number: form.landlord_account_number,
            bank_code: form.landlord_bank_code,
          });

          if (res.data?.account_name) {
            setForm(prev => ({
              ...prev,
              landlord_account_name: res.data.account_name,
              landlord_bank_name: bankName,
            }));
            setBankResolved(true);
          }
        } catch (err: any) {
          setError(err?.response?.data?.error || 'Could not verify landlord bank account detail.');
          setBankResolved(false);
        } finally {
          setVerifyingBank(false);
        }
      } else {
        setBankResolved(false);
        setForm(prev => ({ ...prev, landlord_account_name: '' }));
      }
    };

    verifyLandlordAccount();
  }, [form.landlord_account_number, form.landlord_bank_code, banks]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async () => {
    setError('');
    setSuccessMessage('');

    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Full name, email and account access password are required.');
      return;

    }

    const activeRole = isTenantInvite ? 'TENANT' : selectedRole?.id;

    if (!activeRole) {
      setError('Please choose an account type parameter.');
      return;
    }

    // Dynamic runtime configuration validation for custom escrow track
    if (activeRole === 'TENANT' && !isTenantInvite && form.target_rent) {
      if (!form.landlord_bank_code || !form.landlord_account_number) {
        setError('Please fully fill out your landlord bank destination parameters to allow automated payout on completion.');
        return;
      }
      if (!bankResolved) {
        setError('Please verify that the Landlord Bank Account is valid and auto-confirmed before proceeding.');
        return;
      }
    }

    try {
      setSubmitting(true);

      // Pathway A: Verified Direct Tenant Invite
      if (isTenantInvite) {
        await register({
          full_name: form.full_name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || undefined,
          password: form.password,
          role: 'TENANT',
          accountType: 'TENANT',
         });

        await api.post('/api/rental/consume-invite', {
          tenancy_id: inviteToken,
          unit_id: inviteUnit,
        });

        setSuccessMessage('Tenant space connected successfully. Initializing dashboard interface...');
        setTimeout(() => router.push('/tenant/dashboard'), 1200);
        return;
      }

      // Pathway B: Independent Target Escrow Custom Setup or other roles
      const role = selectedRole!;
      await register({
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        role: role.dbRole as any,
        accountType: role.accountType as any,
      });

      // Secure initialization hook for manual targeted escrow setup with pre-resolved settlement targets
      if (activeRole === 'TENANT' && form.target_rent) {
        await api.post('/api/flex-pay/setup', {
          target_amount: parseFloat(form.target_rent),
          frequency: form.savings_frequency,
          unit_id: intentUnit || null,
          custom_escrow: true,
          payout_profile: {
            bank_code: form.landlord_bank_code,
            bank_name: form.landlord_bank_name,
            account_number: form.landlord_account_number,
            account_name: form.landlord_account_name,
          }
        });
      }

      setSuccessMessage('Account created successfully. Configuring environmental permissions...');
      
      const destination = activeRole === 'TENANT' 
        ? '/tenant/dashboard' 
        : activeRole === 'LANDLORD' 
          ? '/rental-management' 
          : '/marketplace';

      setTimeout(() => router.push(destination), 1200);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Registration request processing failure.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loadingInvite) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      {/* ── Top Bar Navigation ─────────────────────────────────────────────── */}
      <div className="border-b border-zinc-900 bg-black/80 px-6 py-3 flex items-center gap-3">
        <BrandLogo size={28} href="/" />
        <Link
          href="/login"
          className="ml-auto text-[10px] text-zinc-500 hover:text-white uppercase font-bold tracking-widest transition-colors"
        >
          Sign In
        </Link>
      </div>

      <main className="flex-1 max-w-xl mx-auto px-6 py-12 w-full space-y-8">
        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl border border-teal-500/30 bg-teal-500/10 flex items-center justify-center mx-auto">
            {isTenantInvite ? (
              <Home size={24} className="text-teal-400" />
            ) : (
              <ShieldCheck size={24} className="text-teal-400" />
            )}
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight">Create Account</h1>
          <p className="text-zinc-500 text-sm">
            {isTenantInvite
              ? 'Complete your tenant onboarding to activate your assigned unit.'
              : 'Select your customized network profile tier to access your node.'}
          </p>
        </div>

        {isTenantInvite && (
          <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/5 backdrop-blur-md">
            <p className="text-xs font-black text-teal-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" /> Verified Landlord Invite
            </p>
            <p className="text-zinc-500 text-[10px] mt-1">
              Your digital lease ledger profile and unit assignment rules will run on instant-link confirmation.
            </p>
          </div>
        )}

        {/* ── Interactive Role Matrix Grid Selector ──────────────────────── */}
        {!isTenantInvite && (
          <div className="space-y-3">
            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Select Account Type</p>
            <div className="grid grid-cols-1 gap-2.5 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
              {ROLES.map(role => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  className={`w-full p-4 rounded-xl border text-left transition-all duration-200 ${
                    selectedRole?.id === role.id
                      ? 'border-teal-500/60 bg-teal-500/10 shadow-[0_0_20px_rgba(20,184,166,0.05)]'
                      : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-black text-sm tracking-wide">{role.label}</p>
                    {selectedRole?.id === role.id && (
                      <span className="text-[9px] px-2 py-0.5 bg-teal-500/20 text-teal-400 rounded-md font-mono uppercase">Selected</span>
                    )}
                  </div>
                  <p className="text-[9px] text-teal-500 uppercase font-bold tracking-widest mt-0.5">{role.sub}</p>
                  <p className="text-zinc-500 text-[10px] mt-1 leading-relaxed">{role.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Fundamental Core User Fields ────────────────────────────────── */}
        <div className="space-y-4 border-t border-zinc-900/60 pt-4">
          <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Primary Identification</p>
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-2">Full Name *</label>
            <input
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              placeholder="e.g. Amaka Okonkwo"
              className="w-full bg-zinc-900 border border-zinc-800 px-4 py-3.5 rounded-xl text-sm outline-none focus:border-teal-500 font-medium transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-2">Email *</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              disabled={isTenantInvite}
              placeholder="you@email.com"
              className={`w-full bg-zinc-900 border border-zinc-800 px-4 py-3.5 rounded-xl text-sm outline-none focus:border-teal-500 font-medium transition-colors ${
                isTenantInvite ? 'opacity-60 cursor-not-allowed bg-zinc-950' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-2">Phone</label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="+234 801 234 5678"
              className="w-full bg-zinc-900 border border-zinc-800 px-4 py-3.5 rounded-xl text-sm outline-none focus:border-teal-500 font-mono transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-2">Password *</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full bg-zinc-900 border border-zinc-800 px-4 py-3.5 rounded-xl text-sm outline-none focus:border-teal-500 transition-colors"
            />
          </div>
        </div>

        {/* ── Robust Independent Tenant Escrow Vault Configuration Feature Block ── */}
        {selectedRole?.id === 'TENANT' && !isTenantInvite && (
          <div className="p-5 rounded-2xl border border-green-500/20 bg-green-500/5 space-y-4 animate-fadeIn">
            <div className="flex items-start gap-3">
              <Wallet className="text-green-400 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-xs font-black text-green-400 uppercase tracking-widest">Programmable Escrow Savings Vault</p>
                <p className="text-zinc-400 text-[10px] mt-0.5 leading-relaxed">
                  No direct landlord invite? Set up an independent target vault. Tell us what you want to save, choose your intervals, and provide your landlord's bank routing details. On target completion, the system automatically runs the lump-sum settlement down the line.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[9px] text-zinc-400 uppercase font-black tracking-widest mb-1.5 flex items-center gap-1">
                  <Wallet size={10} /> Target Annual Rent (Optional)
                </label>
                <input
                  name="target_rent"
                  type="number"
                  value={form.target_rent}
                  onChange={handleChange}
                  placeholder="e.g. 2400000"
                  className="w-full bg-black/40 border border-zinc-800 px-3 py-2.5 rounded-xl text-xs outline-none focus:border-green-500 font-mono text-green-400"
                />
              </div>
              <div>
                <label className="block text-[9px] text-zinc-400 uppercase font-black tracking-widest mb-1.5 flex items-center gap-1">
                  <Calendar size={10} /> Contribution Frequency
                </label>
                <div className="relative z-30">
                  <select
                    name="savings_frequency"
                    value={form.savings_frequency}
                    onChange={handleChange}
                    className="relative block w-full bg-zinc-900 border border-zinc-800 px-3 py-2.5 rounded-xl text-xs outline-none focus:border-green-500 font-bold text-zinc-200 cursor-pointer appearance-none"
                    style={{ appearance: 'auto' }}
                  >
                    <option value="WEEKLY" className="bg-zinc-900 text-zinc-200">Weekly Rhythm</option>
                    <option value="MONTHLY" className="bg-zinc-900 text-zinc-200">Monthly Rhythm</option>
                    <option value="QUARTERLY" className="bg-zinc-900 text-zinc-200">Quarterly Rhythm</option>
                  </select>
                </div>
              </div>
            </div>

            {form.target_rent && (
              <div className="space-y-3 pt-1 border-t border-zinc-800/60 animate-fadeIn">
                <p className="text-[9px] text-green-400 uppercase font-black tracking-widest flex items-center gap-1">
                  <Building size={10} /> Downstream Destination Bank Setup
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Select Bank</label>
                    <div className="relative z-50">
                      <select
                        name="landlord_bank_code"
                        value={form.landlord_bank_code}
                        onChange={handleChange}
                        className="relative block w-full bg-zinc-900 border border-zinc-800 px-3 py-2.5 rounded-xl text-xs outline-none focus:border-green-500 text-zinc-200 cursor-pointer font-medium appearance-none"
                        style={{ appearance: 'auto' }}
                      >
                        <option value="" className="bg-zinc-900 text-zinc-400">-- Choose Bank --</option>
                        {banks.map(b => (
                          <option key={b.code} value={b.code} className="bg-zinc-900 text-zinc-200">
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Account Number</label>
                    <div className="relative z-10">
                      <input
                        name="landlord_account_number"
                        value={form.landlord_account_number}
                        onChange={handleChange}
                        maxLength={10}
                        placeholder="10-Digit Number"
                        className="w-full bg-black/40 border border-zinc-800 px-3 py-2.5 rounded-xl text-xs outline-none focus:border-green-500 font-mono text-zinc-200"
                      />
                      {verifyingBank && (
                        <span className="absolute right-3 top-3 z-20">
                          <Loader2 size={12} className="animate-spin text-teal-400" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Live Paystack Account Resolution Real-time Confirmation Badge View */}
                {form.landlord_account_name && (
                  <div className="p-3 rounded-xl border border-teal-500/20 bg-teal-500/5 flex items-center gap-2.5 animate-fadeIn">
                    {bankResolved ? (
                      <CheckCircle2 size={14} className="text-teal-400 shrink-0" />
                    ) : (
                      <Landmark size={14} className="text-zinc-500 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">Verified Paystack Destination Profile</p>
                      <p className="text-xs font-mono font-bold text-teal-400 uppercase tracking-wide truncate">{form.landlord_account_name}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Feedback Notification and Alert Panels ──────────────────────── */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2 animate-shake">
            <AlertCircle size={14} className="shrink-0" /> <span className="text-xs leading-relaxed">{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/5 text-teal-400 text-sm font-bold animate-fadeIn">
            <span className="text-xs">{successMessage}</span>
          </div>
        )}

        {/* ── Action Control Submission Trigger ───────────────────────────── */}
        <button
          onClick={handleSubmit}
          disabled={submitting || (!isTenantInvite && !selectedRole)}
          className="w-full py-4 bg-teal-500 text-black font-black uppercase tracking-widest text-xs rounded-xl hover:bg-teal-400 transition-all active:scale-[0.99] disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(20,184,166,0.15)]"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Finalizing Node Allocation...
            </span>
          ) : (
            'Create Account'
          )}
        </button>

        <p className="text-center text-zinc-600 text-xs">
          Already have an operational network identity?{' '}
          <Link href="/login" className="text-teal-500 hover:underline font-bold transition-all">Sign In</Link>
        </p>

        {/* ── Compliance Footer Ledger Brand Mark ────────────────────────── */}
        <div className="pt-5 border-t border-zinc-900 flex flex-col items-center gap-1.5">
          <BrandLogo size={16} href="/" noLink className="opacity-20 justify-center" />
          <p className="text-[9px] text-zinc-700 font-mono tracking-widest text-center">
            © 2026 Impressions &amp; Impacts Ltd · All rights reserved
          </p>
        </div>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
          <Loader2 className="animate-spin text-teal-500" size={32} />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}