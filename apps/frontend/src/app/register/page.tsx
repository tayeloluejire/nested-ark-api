'use client';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import api from '@/lib/api';
import { useAuth, getRoleRoute, UserRole } from '@/lib/AuthContext';
import { Loader2, Eye, EyeOff, CheckCircle2, Mail, ShieldCheck, Globe } from 'lucide-react';


// ── 7 self-registerable roles (ADMIN is system-assigned only) ─────────────────
const ROLES = [
  {
    value: 'DEVELOPER',
    emoji: '🏠',
    label: 'Developer / Owner',
    desc: 'Post projects, upload 2D/3D plans, hire contractors and track builds from anywhere',
    group: 'Project & Execution',
    highlight: true,
  },
  {
    value: 'INVESTOR',
    emoji: '💰',
    label: 'Investor',
    desc: 'Fund infrastructure projects, earn 12% p.a. yield, track via immutable ledger',
    group: 'Capital & Oversight',
  },
  {
    value: 'CONTRACTOR',
    emoji: '🏗',
    label: 'Contractor',
    desc: 'Browse project IDs, submit bids by trade, claim milestones and get paid',
    group: 'Project & Execution',
  },
  {
    value: 'VERIFIER',
    emoji: '🔍',
    label: 'Verifier / Auditor',
    desc: 'Independent site inspections, photo & drone verification, escrow release authority',
    group: 'Project & Execution',
  },
  {
    value: 'SUPPLIER',
    emoji: '🚚',
    label: 'Supplier',
    desc: 'Supply materials, issue QR dispatch codes, confirm deliveries on-chain',
    group: 'Project & Execution',
  },
  {
    value: 'BANK',
    emoji: '🏦',
    label: 'Bank / Institution',
    desc: 'Institutional capital, tranche management, AML compliance, risk overview',
    group: 'Capital & Oversight',
  },
  {
    value: 'GOVERNMENT',
    emoji: '🏛',
    label: 'Government / Agency',
    desc: 'Sponsor public projects, approve milestones, authorize escrow releases',
    group: 'Capital & Oversight',
  },
];

const GROUP_LABELS: Record<string, string> = {
  'Project & Execution': '🏗 Project & Execution',
  'Capital & Oversight': '💼 Capital & Oversight',
};

type Phase = 'form' | 'verify_sent';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [form,       setForm]       = useState({ full_name: '', email: '', password: '', role: 'DEVELOPER' });
  const [showPw,     setShowPw]     = useState(false);
  const [busy,       setBusy]       = useState(false);
  const [error,      setError]      = useState('');
  const [phase,      setPhase]      = useState<Phase>('form');
  const [sentTo,     setSentTo]     = useState('');
  const [isDiaspora, setIsDiaspora] = useState(false);

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setBusy(true);
    try {
      await register(form.email, form.password, form.full_name, form.role);
      setSentTo(form.email);
      setPhase('verify_sent');
    } catch (ex: any) {
      console.error('Registration Error:', ex);
      setError(ex?.response?.data?.error ?? 'Registration failed. Please try again.');
    } finally { setBusy(false); }
  };

  // ── Verification sent screen ──────────────────────────────────────────────
  if (phase === 'verify_sent') return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-[420px] text-center space-y-6">
        <Image src="/nested_ark_icon.png" alt="Nested Ark" width={48} height={48} priority
          className="mx-auto" style={{ width: '48px', height: 'auto' }} />
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-teal-500/10 animate-ping" />
          <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-teal-500/20 border-2 border-teal-500/30">
            <Mail className="text-teal-500" size={32} />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter">Check Your Email</h2>
          <p className="text-teal-500 text-sm mt-1">Account created — verification required</p>
        </div>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Verification link sent to <strong className="text-white">{sentTo}</strong>. Click it to activate your operator account.
        </p>
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-2 text-left text-[10px] text-zinc-400">
          {['Check inbox and spam folder', 'Click the Verify My Account button', 'Link expires in 24 hours', 'Sign in once verified to access your command center'].map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 size={10} className="text-teal-500 mt-0.5 flex-shrink-0" /> {s}
            </div>
          ))}
        </div>
        <ResendBlock email={sentTo} />
        <Link href="/login" className="block w-full py-4 bg-white text-black font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-teal-500 transition-all">
          Back to Sign In
        </Link>
        <p className="text-[8px] text-zinc-700 font-mono">
          <ShieldCheck size={9} className="inline text-teal-500/40 mr-1" />
          Impressions &amp; Impacts Ltd · nestedark@gmail.com
        </p>
      </div>
    </div>
  );

  // ── Registration form ─────────────────────────────────────────────────────
  const groups = Array.from(new Set(ROLES.map(r => r.group)));

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-xl mx-auto px-6 py-12 space-y-8">

        {/* Logo */}
        <div className="text-center">
          <Image src="/nested_ark_icon.png" alt="Nested Ark" width={44} height={44} priority
            className="mx-auto mb-3" style={{ width: '44px', height: 'auto' }} />
          <h1 className="text-sm font-black uppercase tracking-[0.2em]">Nested Ark <span className="text-teal-500">OS</span></h1>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-1">Initialize Your Operator Account</p>
        </div>

        {/* Diaspora toggle */}
        <button
          type="button"
          onClick={() => setIsDiaspora(v => !v)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
            isDiaspora
              ? 'border-teal-500/50 bg-teal-500/10 text-teal-400'
              : 'border-zinc-800 bg-zinc-900/20 text-zinc-500 hover:border-zinc-700'
          }`}
        >
          <Globe size={16} className={isDiaspora ? 'text-teal-500' : 'text-zinc-600'} />
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest">
              {isDiaspora ? '✓ Diaspora / International Mode' : 'Registering from the Diaspora?'}
            </p>
            <p className="text-[9px] text-zinc-600 mt-0.5">
              {isDiaspora
                ? 'USD/GBP default · International transfer support enabled'
                : 'Toggle if you are outside Nigeria — enables international investment and currency defaults'}
            </p>
          </div>
          <div className={`w-10 h-5 rounded-full transition-all flex-shrink-0 ${isDiaspora ? 'bg-teal-500' : 'bg-zinc-700'}`}>
            <div className={`w-4 h-4 bg-white rounded-full mt-0.5 transition-all ${isDiaspora ? 'ml-5' : 'ml-0.5'}`} />
          </div>
        </button>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Role selector — grouped */}
          <div className="space-y-4">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-[0.2em]">Select your operator role</p>
            {groups.map(group => (
              <div key={group} className="space-y-2">
                <p className="text-[8px] text-zinc-700 uppercase font-bold tracking-widest pl-1">{GROUP_LABELS[group]}</p>
                <div className="space-y-1.5">
                  {ROLES.filter(r => r.group === group).map(r => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => f('role', r.value)}
                      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border text-left transition-all ${
                        form.role === r.value
                          ? 'border-teal-500 bg-teal-500/10'
                          : r.highlight
                            ? 'border-zinc-700 bg-zinc-900/30 hover:border-zinc-600'
                            : 'border-zinc-800 bg-zinc-900/10 hover:border-zinc-700'
                      }`}
                    >
                      <span className="text-xl flex-shrink-0 w-7 text-center">{r.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-white">{r.label}</p>
                          {r.highlight && (
                            <span className="text-[7px] bg-teal-500/20 text-teal-500 border border-teal-500/30 px-1.5 py-0.5 rounded font-bold uppercase">Popular</span>
                          )}
                          {r.value === 'VERIFIER' && (
                            <span className="text-[7px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold uppercase">Trust Layer</span>
                          )}
                        </div>
                        <p className="text-[9px] text-zinc-500 mt-0.5 leading-relaxed">{r.desc}</p>
                      </div>
                      {form.role === r.value && <CheckCircle2 size={14} className="text-teal-500 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Account fields */}
          <div className="space-y-3 pt-2">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-[0.2em]">Account Details</p>
            <input
              required value={form.full_name} onChange={e => f('full_name', e.target.value)}
              placeholder="Full Name"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white text-sm outline-none focus:border-teal-500 transition-colors"
            />
            <input
              required type="email" value={form.email} onChange={e => f('email', e.target.value)}
              placeholder="Email Address"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white text-sm outline-none focus:border-teal-500 transition-colors"
            />
            <div className="relative">
              <input
                required type={showPw ? 'text' : 'password'} value={form.password}
                onChange={e => f('password', e.target.value)}
                placeholder="Password (min. 8 characters)"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pr-12 text-white text-sm outline-none focus:border-teal-500 transition-colors"
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Email verification notice */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-zinc-900/40 border border-zinc-800 text-[9px] text-zinc-400">
            <Mail size={11} className="text-teal-500 mt-0.5 flex-shrink-0" />
            A verification link will be sent to your email. You must verify before you can invest or withdraw.
          </div>

          <button type="submit" disabled={busy}
            className="w-full py-4 bg-white text-black font-black uppercase tracking-[0.15em] text-xs rounded-xl hover:bg-teal-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <><Loader2 className="animate-spin" size={14} /> Creating Account…</> : 'Activate Connection'}
          </button>
        </form>

        <p className="text-center text-[9px] text-zinc-600 uppercase font-bold tracking-widest">
          Already have an account?{' '}
          <Link href="/login" className="text-teal-500 hover:text-white transition-colors">Sign In</Link>
        </p>
        <div className="text-center text-[8px] text-zinc-700 border-t border-zinc-900 pt-4">
          <ShieldCheck size={9} className="inline text-teal-500/40 mr-1" />
          Impressions &amp; Impacts Ltd · nestedark@gmail.com · Lagos · London · Dubai
        </div>
      </div>
    </div>
  );
}

function ResendBlock({ email }: { email: string }) {
  const [sent,  setSent]  = useState(false);
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');
  const resend = async () => {
    setBusy(true); setError('');
    try { await api.post('/api/auth/resend-verification', { email }); setSent(true); }
    catch { setError('Could not resend. Try again.'); }
    finally { setBusy(false); }
  };
  if (sent) return <p className="text-teal-400 text-xs font-bold">✅ New verification email sent.</p>;
  return (
    <div className="space-y-1">
      <button onClick={resend} disabled={busy}
        className="w-full py-3 border border-zinc-700 text-zinc-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:border-teal-500 hover:text-teal-500 transition-all flex items-center justify-center gap-2">
        {busy ? <Loader2 className="animate-spin" size={12} /> : <Mail size={12} />}
        Resend Verification Email
      </button>
      {error && <p className="text-red-400 text-[10px]">{error}</p>}
    </div>
  );
}
