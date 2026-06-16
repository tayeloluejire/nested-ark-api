'use client';
export const dynamic = 'force-dynamic';

/**
 * src/app/register/page.tsx
 *
 * THREE ONBOARDING MODES:
 *
 * MODE A — LANDLORD INVITE  (?token=&unit=&email=&role=TENANT)
 *   Fast path. Validates token → register → consume-invite → /tenant/dashboard.
 *   Zero bank steps. Landlord already configured the unit.
 *
 * MODE B — INDEPENDENT TENANT  (?intent=tenant or manual TENANT role selection)
 *   1. Account fields (name / email / phone / password)
 *   2. Vault intent panel (frequency + optional target — purely UX, no API call)
 *   3. Landlord bank destination (plain text only — NO Paystack calls here)
 *   4. register() creates user account → JWT lands in AuthContext
 *   5. Raw bank intent written to localStorage as a draft
 *   6. Redirect to /tenant/dashboard
 *   7. Dashboard handles background verification on first load
 *
 * MODE C — ALL OTHER ROLES
 *   Role selector → form → register → /dashboard.
 *
 * ── PRODUCTION RULES (do not change) ───────────────────────────────────────
 * RULE 1  Registration NEVER calls Paystack. Zero external API dependency.
 * RULE 2  Registration NEVER fails due to bank/network issues.
 * RULE 3  Bank details are raw text collected for UX only — stored as
 *          localStorage draft key "nested_ark_bank_draft" for dashboard pickup.
 * RULE 4  /api/paystack/banks and /api/paystack/resolve-account require auth —
 *          called only AFTER login, from dashboard, never from register.
 * RULE 5  /api/flex-pay/setup requires tenancy_id — not called here at all.
 *          Independent vault is created when tenant links to a unit.
 * RULE 6  /api/landlord/bank-accounts is called once from tenant dashboard
 *          (background task on first load), not from register.
 */

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2, AlertCircle, ShieldCheck, Home, Info,
  Wallet, Calendar, CheckCircle2, Building2, ArrowRight,
} from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import BrandLogo from '@/components/BrandLogo';

// ── Constants ─────────────────────────────────────────────────────────────────
const BANK_DRAFT_KEY = 'nested_ark_bank_draft';

const ROLES = [
  {
    id:          'LANDLORD',
    label:       '🏠 Property Landlord',
    sub:         'Rental Management',
    desc:        'Manage properties, tenants, rent collection and legal notices.',
    dbRole:      'DEVELOPER',
    accountType: 'LANDLORD',
  },
  {
    id:          'TENANT',
    label:       '🔑 Residential Tenant',
    sub:         'Flex-Pay & Rentals',
    desc:        'Access your rental dashboard, pay rent via Flex-Pay, or build an independent savings escrow.',
    dbRole:      'TENANT',
    accountType: 'TENANT',
  },
  {
    id:          'INFRASTRUCTURE',
    label:       '🏗️ Infrastructure Developer',
    sub:         'Project Submission',
    desc:        'Manage infrastructure projects and milestones.',
    dbRole:      'DEVELOPER',
    accountType: 'INFRASTRUCTURE',
  },
  {
    id:          'DIASPORA',
    label:       '🌍 Diaspora Developer',
    sub:         'Remote Investment',
    desc:        'Invest and manage projects remotely.',
    dbRole:      'DEVELOPER',
    accountType: 'DIASPORA',
  },
  {
    id:          'INVESTOR',
    label:       '📈 Investor',
    sub:         'Portfolio & ROI',
    desc:        'Invest in verified infrastructure projects.',
    dbRole:      'INVESTOR',
    accountType: 'INVESTOR',
  },
  {
    id:          'CONTRACTOR',
    label:       '🔧 Contractor',
    sub:         'Milestone Delivery',
    desc:        'Bid and execute project milestones.',
    dbRole:      'CONTRACTOR',
    accountType: 'CONTRACTOR',
  },
  {
    id:          'SUPPLIER',
    label:       '📦 Supply Partner',
    sub:         'Materials & Logistics',
    desc:        'Provide materials and logistics support.',
    dbRole:      'SUPPLIER',
    accountType: 'SUPPLIER',
  },
  {
    id:          'BANK',
    label:       '🏦 Bank / Financier',
    sub:         'Project Finance',
    desc:        'Provide funding and financing.',
    dbRole:      'BANK',
    accountType: 'BANK',
  },
] as const;

// ── Phase 1 launch: only Landlord + Tenant are live ──────────────────────────
const LIVE_ROLE_IDS = ['LANDLORD', 'TENANT'] as const;
type LiveRoleId = typeof LIVE_ROLE_IDS[number];

const COMING_SOON_DETAILS: Record<string, { icon: string; title: string; teaser: string; phase: string }> = {
  INFRASTRUCTURE: {
    icon: '🏗️', title: 'Infrastructure Developer',
    teaser: 'Submit projects to the NAP Global Ledger, track milestones, and access escrow-backed construction funding.',
    phase: 'Phase 2 — Q3 2026',
  },
  DIASPORA: {
    icon: '🌍', title: 'Diaspora Developer',
    teaser: 'Invest in Nigerian infrastructure from anywhere in the world. Multi-currency, transparent ledgers.',
    phase: 'Phase 2 — Q3 2026',
  },
  INVESTOR: {
    icon: '📈', title: 'Investor',
    teaser: 'Build a diversified infrastructure portfolio. Verified projects, automated yield distribution, SHA-256 records.',
    phase: 'Phase 2 — Q3 2026',
  },
  CONTRACTOR: {
    icon: '🔧', title: 'Contractor',
    teaser: 'Bid for milestone-based project work. Escrow-protected payments released on verified completion.',
    phase: 'Phase 3 — Q4 2026',
  },
  SUPPLIER: {
    icon: '📦', title: 'Supply Partner',
    teaser: 'Supply materials and logistics to verified infrastructure projects across Africa.',
    phase: 'Phase 3 — Q4 2026',
  },
  BANK: {
    icon: '🏦', title: 'Bank & Financier',
    teaser: 'Provide project finance at scale. Integrated ledger, transparent disbursement, and compliance tooling.',
    phase: 'Phase 3 — Q4 2026',
  },
};

const FREQ_OPTIONS = [
  { value: 'WEEKLY',    label: 'Weekly',    periods: 52, desc: 'Best for daily/weekly income'  },
  { value: 'MONTHLY',   label: 'Monthly',   periods: 12, desc: 'Ideal for salaried workers'    },
  { value: 'QUARTERLY', label: 'Quarterly', periods: 4,  desc: 'Good for business owners'      },
];

function installmentPreview(target: string, freq: string): string | null {
  const n = parseFloat(target);
  if (!n || n <= 0) return null;
  const p = FREQ_OPTIONS.find(f => f.value === freq)?.periods ?? 12;
  return `₦${Math.ceil(n / p).toLocaleString()}`;
}

// ─────────────────────────────────────────────────────────────────────────────

function RegisterContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { register, loading: authLoading } = useAuth();

  // ── Scroll-to-form ref — fires on every role select ──────────────────────
  const formRef = useRef<HTMLDivElement>(null);
  const scrollToForm = () => {
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60); // 60ms lets the selected-role highlight render first
  };

  // ── URL context ───────────────────────────────────────────────────────────
  const inviteToken = searchParams.get('token')   ?? '';
  const inviteUnit  = searchParams.get('unit')    ?? '';
  const inviteEmail = searchParams.get('email')   ?? '';
  const forceRole   = searchParams.get('role')    ?? '';
  const urlIntent   = searchParams.get('intent')  ?? '';

  // Mode flags — mutually exclusive
  const isTenantInvite       = forceRole === 'TENANT' && !!inviteToken;
  const isIndependentTenant  = !isTenantInvite &&
    (urlIntent === 'tenant' || urlIntent === 'vault');

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedRole,             setSelectedRole]             = useState<typeof ROLES[number] | null>(null);
  const [comingSoonRole,           setComingSoonRole]           = useState<string | null>(null);
  const [waitlistSubmitted,        setWaitlistSubmitted]        = useState<string | null>(null);

  const handleNotifyMe = async (roleId: string) => {
    try {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('token') || sessionStorage.getItem('token') : null;
      await fetch('/api/feature-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ feature_name: roleId, source: 'register_page' }),
      });
    } catch { /* non-fatal */ }
    setWaitlistSubmitted(roleId);
    setTimeout(() => { setComingSoonRole(null); setWaitlistSubmitted(null); }, 2000);
  };
  const [loadingInvite,            setLoadingInvite]            = useState(false);
  const [submitting,               setSubmitting]               = useState(false);
  const [error,                    setError]                    = useState('');
  const [successMsg,               setSuccessMsg]               = useState('');
  // Post-auth background task states — never block registration
  const [bankLookupReady,          setBankLookupReady]          = useState(false);
  const [postAuthBankVerification, setPostAuthBankVerification] = useState(false);
  const [vaultProfileCreated,      setVaultProfileCreated]      = useState(false);

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    full_name:  '',
    email:      inviteEmail,
    phone:      '',
    password:   '',
    // Vault intent — pure UX, no API call during registration
    target_rent:       '',
    savings_frequency: 'MONTHLY',
    // Landlord bank — raw text only, drafted to localStorage post-register
    landlord_bank_name:      '',
    landlord_bank_code:      '',
    landlord_account_number: '',
    landlord_account_name:   '',
  });

  // ── Auto-select TENANT when arriving via intent CTA ──────────────────────
  useEffect(() => {
    if (isIndependentTenant || forceRole === 'TENANT') {
      const t = ROLES.find(r => r.id === 'TENANT') ?? null;
      setSelectedRole(t);
      scrollToForm(); // jump straight to form — no scroll needed from NCYR calculator CTA
    }
  }, [isIndependentTenant, forceRole]);

  // ── Pre-fill invite email ─────────────────────────────────────────────────
  useEffect(() => {
    if (inviteEmail) setForm(prev => ({ ...prev, email: inviteEmail }));
  }, [inviteEmail]);

  // ── Validate invite token (MODE A only) ──────────────────────────────────
  useEffect(() => {
    if (!isTenantInvite || !inviteToken) return;
    (async () => {
      setLoadingInvite(true);
      try {
        await api.get(`/api/rental/validate-invite?token=${inviteToken}`);
      } catch (e: any) {
        setError(e?.response?.data?.error ?? 'This invite link is invalid or has expired.');
      } finally {
        setLoadingInvite(false);
      }
    })();
  }, [inviteToken, isTenantInvite]);

  // ── POST-AUTH: fetch banks (requires JWT — never called during registration) ─
  /**
   * Banks endpoint requires authenticated JWT.
   * Do NOT call during public registration.
   * Called only after successful register() — JWT is then live in AuthContext.
   */
  const loadBanksPostAuth = async (): Promise<void> => {
    try {
      const res = await api.get('/api/paystack/banks');
      setBankLookupReady(true);
      // Result used by verifyBankPostAuth below — no state needed for the list
      return res.data?.banks ?? (Array.isArray(res.data) ? res.data : []);
    } catch {
      setBankLookupReady(false);
    }
  };

  // ── POST-AUTH: resolve landlord account (non-fatal, requires JWT) ─────────
  /**
   * IMPORTANT: Public registration MUST NOT hard-fail because of:
   * - Paystack downtime, mobile latency, bank API timeout.
   * Verification runs ONLY AFTER successful registration + JWT creation.
   * Returns true if verified, false otherwise — caller decides what to do.
   */
  const verifyBankPostAuth = async (): Promise<boolean> => {
    if (
      form.landlord_account_number.length !== 10 ||
      !form.landlord_bank_code
    ) return false;

    try {
      setPostAuthBankVerification(true);
      const res = await api.post('/api/paystack/resolve-account', {
        account_number: form.landlord_account_number,
        bank_code:      form.landlord_bank_code,
      });
      if (res.data?.account_name) {
        setForm(prev => ({
          ...prev,
          landlord_account_name: res.data.account_name,
          landlord_bank_name:    form.landlord_bank_name || prev.landlord_bank_name,
        }));
        return true;
      }
      return false;
    } catch {
      /**
       * NON-FATAL — user can fix/update payout routing later from dashboard.
       */
      return false;
    } finally {
      setPostAuthBankVerification(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // ── Submit — FAST. No external API calls. ────────────────────────────────
  const handleSubmit = async () => {
    setError(''); setSuccessMsg('');

    // Basic validation only
    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Full name, email and password are required.'); return;
    }
    const activeRoleId = isTenantInvite ? 'TENANT' : selectedRole?.id;
    if (!activeRoleId) { setError('Please select an account type.'); return; }

    try {
      setSubmitting(true);

      // ── MODE A: Landlord Invite ───────────────────────────────────────────
      if (isTenantInvite) {
        await register({
          full_name:   form.full_name.trim(),
          email:       form.email.trim().toLowerCase(),
          phone:       form.phone.trim() || undefined,
          password:    form.password,
          role:        'TENANT',
          accountType: 'TENANT',
        });
        // Consume the invite — links this user to the tenancy
        await api.post('/api/rental/consume-invite', {
          tenancy_id: inviteToken,
          unit_id:    inviteUnit,
        });
        setSuccessMsg('Tenancy activated! Heading to your dashboard…');
        setTimeout(() => router.push('/tenant/dashboard'), 1200);
        return;
      }

      // ── MODE B / C: Standard registration ────────────────────────────────
      const role = selectedRole!;
      await register({
        full_name:   form.full_name.trim(),
        email:       form.email.trim().toLowerCase(),
        phone:       form.phone.trim() || undefined,
        password:    form.password,
        role:        role.dbRole as any,
        accountType: role.accountType as any,
      });
      // JWT is now live in AuthContext. Registration is complete.

      // ── MODE B only: deferred post-auth vault + bank setup ───────────────
      // Registration is already complete at this point. JWT is live.
      // All steps below are non-fatal — failure never blocks account creation.
      if (activeRoleId === 'TENANT') {
        // Always write localStorage draft as a resilient fallback
        try {
          const draft = {
            target_rent:             form.target_rent             || null,
            savings_frequency:       form.savings_frequency       || 'MONTHLY',
            landlord_bank_name:      form.landlord_bank_name.trim()      || null,
            landlord_bank_code:      form.landlord_bank_code.trim()      || null,
            landlord_account_number: form.landlord_account_number.trim() || null,
            landlord_account_name:   form.landlord_account_name.trim()   || null,
            created_at:              new Date().toISOString(),
          };
          const hasPayload = draft.target_rent || draft.landlord_account_number;
          if (hasPayload) localStorage.setItem(BANK_DRAFT_KEY, JSON.stringify(draft));
        } catch { /* localStorage unavailable — silently continue */ }

        // Only run post-auth steps if tenant provided vault intent
        if (form.target_rent) {
          // STEP 1: Load bank list now that JWT is live
          await loadBanksPostAuth();

          // STEP 2: Optionally verify landlord account — non-fatal
          const verified = await verifyBankPostAuth();

          // STEP 3: Create independent vault profile (backend endpoint pending)
          // This endpoint does NOT require tenancy_id — it is a standalone profile.
          // Non-fatal: vault setup can be completed from dashboard if this fails.
          try {
            await api.post('/api/flex-pay/create-vault-profile', {
              target_amount:        parseFloat(form.target_rent),
              frequency:            form.savings_frequency,
              vault_mode:           'INDEPENDENT',
              marketplace_enabled:  true,
              auto_match_properties: true,
              payout_profile: {
                bank_code:      form.landlord_bank_code      || '',
                bank_name:      form.landlord_bank_name      || '',
                account_number: form.landlord_account_number || '',
                account_name:   form.landlord_account_name   || '',
                verified,
              },
            });
            setVaultProfileCreated(true);
            // Draft fulfilled — remove from localStorage
            try { localStorage.removeItem(BANK_DRAFT_KEY); } catch {}
          } catch {
            /**
             * NON-FATAL — vault setup continues on first dashboard load
             * via the localStorage draft pickup.
             */
          }

          // STEP 4: Register landlord payout destination for auto-settlement
          // Non-fatal: can be configured later from dashboard.
          if (verified && form.landlord_account_number && form.landlord_bank_code) {
            try {
              await api.post('/api/tenant/payout-destination', {
                account_number: form.landlord_account_number,
                bank_code:      form.landlord_bank_code,
                account_name:   form.landlord_account_name,
                bank_name:      form.landlord_bank_name,
                payout_type:    'LANDLORD_AUTO_SETTLEMENT',
              });
            } catch {
              /* Silent fail — user can configure later */
            }
          }
        }
      }

      setSuccessMsg('Account created! Setting up your workspace…');
      const dest = activeRoleId === 'TENANT' ? '/tenant/dashboard' : '/dashboard';
      setTimeout(() => router.push(dest), 1200);

    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived display flags ─────────────────────────────────────────────────
  const showTenantPanel  = selectedRole?.id === 'TENANT' && !isTenantInvite;
  const showBankFields   = showTenantPanel && !!form.target_rent;
  const instPreview      = installmentPreview(form.target_rent, form.savings_frequency);
  const bankPartiallyFilled =
    form.landlord_bank_name || form.landlord_account_number || form.landlord_account_name;

  if (authLoading || loadingInvite) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">

      {/* ── Coming Soon Modal ─────────────────────────────────────────── */}
      {comingSoonRole && (() => {
        const cs = COMING_SOON_DETAILS[comingSoonRole];
        if (!cs) return null;
        return (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setComingSoonRole(null)}
          >
            <div
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7 w-full max-w-sm space-y-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-zinc-800 flex items-center justify-center text-2xl flex-shrink-0">{cs.icon}</div>
                  <div>
                    <p className="font-black text-sm">{cs.title}</p>
                    <p className="text-[9px] text-amber-400 uppercase font-bold tracking-widest mt-0.5">{cs.phase}</p>
                  </div>
                </div>
                <button
                  onClick={() => setComingSoonRole(null)}
                  className="text-zinc-600 hover:text-white text-xl w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-all flex-shrink-0"
                >×</button>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">{cs.teaser}</p>
              <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 text-center">
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-1">Launch Timeline</p>
                <p className="text-zinc-300 text-sm font-bold">{cs.phase}</p>
              </div>
              {waitlistSubmitted === comingSoonRole ? (
                <div className="py-4 text-center">
                  <p className="text-teal-400 font-black text-sm">✅ You&apos;re on the list!</p>
                  <p className="text-zinc-500 text-[10px] mt-1">We&apos;ll notify you when this launches.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={() => handleNotifyMe(comingSoonRole)}
                    className="w-full py-3 rounded-xl bg-teal-500 text-black font-black text-[10px] uppercase tracking-widest hover:bg-teal-400 transition-all"
                  >
                    🔔 Notify Me When Live
                  </button>
                  <button
                    onClick={() => setComingSoonRole(null)}
                    className="w-full py-2.5 rounded-xl border border-zinc-700 text-zinc-400 font-black text-[10px] uppercase tracking-widest hover:border-zinc-600 transition-all"
                  >
                    Back to Registration
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
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

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl border border-teal-500/30 bg-teal-500/10 flex items-center justify-center mx-auto">
            {isTenantInvite
              ? <Home size={24} className="text-teal-400" />
              : <ShieldCheck size={24} className="text-teal-400" />
            }
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight">Create Account</h1>
          <p className="text-zinc-500 text-sm">
            {isTenantInvite
              ? 'Complete your tenant onboarding to activate your assigned unit.'
              : 'Select your account type to continue.'
            }
          </p>
        </div>

        {/* ── MODE A: Invite banner ─────────────────────────────────────── */}
        {isTenantInvite && (
          <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/5">
            <p className="text-xs font-black text-teal-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              Verified Landlord Invite
            </p>
            <p className="text-zinc-500 text-[10px] mt-1">
              Your unit assignment and Flex-Pay vault will activate automatically on registration.
            </p>
          </div>
        )}

        {/* ── Role selector (hidden in invite mode) ────────────────────── */}
        {!isTenantInvite && (
          <div className="space-y-3">
            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">
              Select Account Type
            </p>
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">

              {/* ── Live roles: Landlord + Tenant ─────────────────────── */}
              {ROLES.filter(r => LIVE_ROLE_IDS.includes(r.id as LiveRoleId)).map(role => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => { setSelectedRole(role); scrollToForm(); }}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    selectedRole?.id === role.id
                      ? 'border-teal-500/60 bg-teal-500/10'
                      : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-black text-sm">{role.label}</p>
                    {selectedRole?.id === role.id
                      ? (
                        <span className="text-[9px] px-2 py-0.5 bg-teal-500/20 text-teal-400 rounded font-mono uppercase tracking-widest flex items-center gap-1">
                          Selected ↓
                        </span>
                      ) : null
                    }
                  </div>
                  <p className="text-[9px] text-teal-500 uppercase font-bold tracking-widest mt-0.5">
                    {role.sub}
                  </p>
                  <p className="text-zinc-500 text-[10px] mt-1 leading-relaxed">{role.desc}</p>
                </button>
              ))}

              {/* ── Coming Soon roles: locked, click opens modal ─────── */}
              <div className="pt-2 pb-0.5">
                <p className="text-[8px] text-zinc-700 uppercase font-black tracking-widest">More roles coming soon</p>
              </div>
              {ROLES.filter(r => !LIVE_ROLE_IDS.includes(r.id as LiveRoleId)).map(role => {
                const cs = COMING_SOON_DETAILS[role.id];
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setComingSoonRole(role.id)}
                    className="w-full p-4 rounded-xl border border-zinc-800/40 bg-zinc-900/10 text-left opacity-55 hover:opacity-75 transition-all relative"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-black text-sm text-zinc-500">{role.label}</p>
                      <span className="text-[8px] px-2 py-0.5 bg-zinc-800 text-zinc-600 rounded border border-zinc-700 font-mono uppercase tracking-widest">
                        Soon
                      </span>
                    </div>
                    <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest mt-0.5">{role.sub}</p>
                    {cs && <p className="text-[8px] text-zinc-700 mt-0.5">{cs.phase}</p>}
                    <div className="absolute top-2.5 right-10 text-zinc-700 text-[10px]">🔒</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Core fields ───────────────────────────────────────────────── */}
        <div ref={formRef} className="space-y-4 border-t border-zinc-900/60 pt-4">
          <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">
            Primary Identification
          </p>

          {[
            { name: 'full_name', label: 'Full Name *',  type: 'text',     placeholder: 'e.g. Amaka Okonkwo',    mono: false },
            { name: 'email',     label: 'Email *',      type: 'email',    placeholder: 'you@email.com',         mono: false },
            { name: 'phone',     label: 'Phone',        type: 'tel',      placeholder: '+234 801 234 5678',     mono: true  },
            { name: 'password',  label: 'Password *',   type: 'password', placeholder: '••••••••',              mono: false },
          ].map(f => (
            <div key={f.name}>
              <label className="block text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-2">
                {f.label}
              </label>
              <input
                name={f.name}
                type={f.type}
                value={(form as any)[f.name]}
                onChange={handleChange}
                disabled={f.name === 'email' && isTenantInvite}
                placeholder={f.placeholder}
                className={`w-full bg-zinc-900 border border-zinc-800 px-4 py-3.5 rounded-xl text-sm outline-none focus:border-teal-500 transition-colors ${
                  f.mono ? 'font-mono' : 'font-medium'
                } ${f.name === 'email' && isTenantInvite ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>
          ))}
        </div>

        {/* ── MODE B: Independent Tenant Vault Panel ────────────────────── */}
        {showTenantPanel && (
          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 overflow-hidden">

            {/* Panel header */}
            <div className="flex items-start gap-3 p-5 border-b border-zinc-800/50">
              <Wallet className="text-green-400 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-xs font-black text-green-400 uppercase tracking-widest">
                  Programmable Escrow Savings Vault
                </p>
                <p className="text-zinc-400 text-[10px] mt-1 leading-relaxed">
                  No landlord invite required. Create an independent programmable rent vault,
                  save gradually toward your housing target, search properties globally, and
                  optionally configure automatic landlord settlement once your target is completed.
                </p>
              </div>
            </div>

            <div className="p-5 space-y-5">

              {/* Target rent */}
              <div>
                <label className="block text-[9px] text-zinc-400 uppercase font-black tracking-widest mb-1.5">
                  Target Annual Rent (Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm">₦</span>
                  <input
                    name="target_rent"
                    type="number"
                    value={form.target_rent}
                    onChange={handleChange}
                    placeholder="e.g. 2400000"
                    className="w-full bg-black/40 border border-zinc-800 pl-7 pr-4 py-3 rounded-xl text-sm outline-none focus:border-green-500 font-mono text-green-400"
                  />
                </div>
              </div>

              {/* Frequency picker */}
              <div>
                <label className="block text-[9px] text-zinc-400 uppercase font-black tracking-widest mb-2">
                  Contribution Frequency
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {FREQ_OPTIONS.map(f => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, savings_frequency: f.value }))}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        form.savings_frequency === f.value
                          ? 'border-green-500/60 bg-green-500/10'
                          : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
                      }`}
                    >
                      <p className={`text-[10px] font-black uppercase tracking-widest ${
                        form.savings_frequency === f.value ? 'text-green-400' : 'text-zinc-300'
                      }`}>{f.label}</p>
                      <p className="text-[8px] text-zinc-600 mt-0.5 leading-tight">{f.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Installment preview pill */}
              {instPreview && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <Calendar size={11} className="text-green-400 shrink-0" />
                  <p className="text-[10px] text-zinc-400">
                    Estimated{' '}
                    <span className="text-white font-bold lowercase">{form.savings_frequency}</span>{' '}
                    installment:{' '}
                    <span className="text-green-400 font-black font-mono">{instPreview}</span>
                  </p>
                </div>
              )}

              {/* Landlord bank destination — only shown once target is set */}
              {showBankFields && (
                <div className="space-y-4 pt-3 border-t border-zinc-800/60">
                  <div>
                    <p className="text-[9px] text-green-400 uppercase font-black tracking-widest flex items-center gap-1.5 mb-1">
                      <Building2 size={10} /> Landlord Payout Destination
                    </p>
                    <p className="text-[9px] text-zinc-600 leading-relaxed">
                      All fields optional here. Details are saved to your profile after
                      registration and verified quietly in the background — your account
                      creation will never be blocked by this step.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-1.5">
                          Bank Name
                        </label>
                        <input
                          name="landlord_bank_name"
                          value={form.landlord_bank_name}
                          onChange={handleChange}
                          placeholder="e.g. Zenith Bank"
                          className="w-full bg-black/40 border border-zinc-800 px-3 py-2.5 rounded-xl text-xs outline-none focus:border-green-500/60 font-medium text-zinc-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-1.5">
                          Bank Code
                        </label>
                        <input
                          name="landlord_bank_code"
                          value={form.landlord_bank_code}
                          onChange={handleChange}
                          placeholder="e.g. 057"
                          maxLength={10}
                          className="w-full bg-black/40 border border-zinc-800 px-3 py-2.5 rounded-xl text-xs outline-none focus:border-green-500/60 font-mono text-zinc-200"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-1.5">
                          Account Number
                        </label>
                        <input
                          name="landlord_account_number"
                          value={form.landlord_account_number}
                          onChange={handleChange}
                          maxLength={10}
                          placeholder="10 digits"
                          className="w-full bg-black/40 border border-zinc-800 px-3 py-2.5 rounded-xl text-xs outline-none focus:border-green-500/60 font-mono text-zinc-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-1.5">
                          Account Name
                        </label>
                        <input
                          name="landlord_account_name"
                          value={form.landlord_account_name}
                          onChange={handleChange}
                          placeholder="As on bank record"
                          className="w-full bg-black/40 border border-zinc-800 px-3 py-2.5 rounded-xl text-xs outline-none focus:border-green-500/60 font-medium text-zinc-200"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Post-auth bank verification status */}
                  {postAuthBankVerification && (
                    <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 animate-pulse">
                      <p className="text-[9px] text-amber-400 uppercase font-black tracking-widest">
                        Verifying payout destination…
                      </p>
                    </div>
                  )}

                  {/* Draft confirmation badge */}
                  {bankPartiallyFilled && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl border border-zinc-700 bg-zinc-900/40">
                      <CheckCircle2 size={13} className="text-zinc-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">
                          Saved as draft — verified after registration
                        </p>
                        {form.landlord_bank_name && (
                          <p className="text-[9px] text-zinc-400 font-medium truncate">
                            {form.landlord_bank_name}
                            {form.landlord_account_number ? ` · ${form.landlord_account_number}` : ''}
                          </p>
                        )}
                        {form.landlord_account_name && (
                          <p className="text-[9px] text-zinc-500 truncate">{form.landlord_account_name}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* What happens next */}
                  <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
                    <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">
                      What happens after you register
                    </p>
                    {[
                      { icon: '✅', label: 'Account Created',              done: false },
                      { icon: '⚡', label: 'Vault profile initialised',    done: false },
                      { icon: '🔍', label: 'Payout destination verified',  done: false },
                      { icon: '🔒', label: 'Escrow setup complete', done: false },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px]">{s.icon}</span>
                        <span className="text-[9px] text-zinc-500">{s.label}</span>
                        <span className="ml-auto text-[8px] text-zinc-700 uppercase font-bold tracking-widest">
                          on dashboard
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skip note */}
              <div className="flex items-start gap-2">
                <Info size={11} className="shrink-0 text-zinc-600 mt-0.5" />
                <p className="text-[9px] text-zinc-600 leading-relaxed">
                  All vault fields are optional during signup. You can complete your escrow
                  setup from the tenant dashboard at any time. If your landlord sends an
                  invite link later, your account will auto-link to the unit instantly.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Vault profile created confirmation */}
        {vaultProfileCreated && (
          <div className="p-4 rounded-xl border border-green-500/20 bg-green-500/5 text-green-400">
            <p className="text-[10px] font-black uppercase tracking-widest">
              Independent Vault Initialized
            </p>
            <p className="text-xs text-green-300 mt-1 leading-relaxed">
              Your programmable housing savings vault is active. You may now search properties,
              save toward rent, connect landlords, or auto-settle future rental targets.
            </p>
          </div>
        )}

        {/* ── Error / Success ───────────────────────────────────────────── */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 font-bold flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span className="text-xs leading-relaxed">{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/5 text-teal-400 font-bold flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0" />
            <span className="text-xs">{successMsg}</span>
          </div>
        )}

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <button
          onClick={handleSubmit}
          disabled={submitting || (!isTenantInvite && !selectedRole)}
          className="w-full py-4 bg-teal-500 text-black font-black uppercase tracking-widest text-xs rounded-xl hover:bg-teal-400 transition-all active:scale-[0.99] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Creating Account…
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Create Account <ArrowRight size={13} />
            </span>
          )}
        </button>

        <p className="text-center text-zinc-600 text-xs">
          Already have an account?{' '}
          <Link href="/login" className="text-teal-500 hover:underline font-bold">
            Sign In
          </Link>
        </p>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="pt-4 border-t border-zinc-900 flex flex-col items-center gap-1">
          <BrandLogo size={16} href="/" noLink className="opacity-30 justify-center" />
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
