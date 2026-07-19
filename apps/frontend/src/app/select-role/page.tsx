'use client';
/**
 * app/select-role/page.tsx
 *
 * Shown after EVERY Google sign-in — both brand-new accounts (which have no
 * role yet) and returning users (per product decision: always confirm role
 * choice, even for accounts that already picked one before). A returning
 * user with an existing role sees it pre-selected and can confirm with one
 * click, or change it.
 *
 * Route this in from GoogleSignInButton's onNeedsRole callback, or directly
 * via router.push('/select-role') — both the login and register pages can
 * share this same screen.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/lib/AuthContext';
import { Loader2, Home, Building2, ShieldCheck, AlertCircle } from 'lucide-react';

const ROLE_OPTIONS: { value: 'TENANT' | 'DEVELOPER'; label: string; desc: string; icon: any }[] = [
  { value: 'TENANT', label: 'Residential Tenant', desc: 'Flex-Pay rent, savings vaults, property search.', icon: Home },
  { value: 'DEVELOPER', label: 'Property Landlord', desc: 'Manage properties, tenants, rent collection.', icon: Building2 },
];

export default function SelectRolePage() {
  const { user, setRole } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<string>(user?.role || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await setRole(selected as any); // setRole handles the redirect itself
    } catch (ex: any) {
      setError(ex?.response?.data?.error ?? 'Could not save your role. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-[440px] space-y-8">
        <div className="text-center space-y-3">
          <Image src="/nested_ark_icon.png" alt="Nested Ark" width={48} height={48} priority className="mx-auto" />
          <h1 className="text-sm font-black uppercase tracking-[0.2em]">Nested Ark <span className="text-teal-500">OS</span></h1>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Confirm Your Account Type</p>
        </div>

        <div className="border-l-2 border-teal-500 pl-5">
          <h2 className="text-2xl font-black uppercase tracking-tighter">
            {user?.role ? 'Confirm Your Role' : 'Select Your Role'}
          </h2>
          <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
            {user?.role
              ? 'Confirm your account type to continue.'
              : 'Choose how you\u2019ll use Nested Ark.'}
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-bold flex items-start gap-2">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <div className="space-y-3">
          {ROLE_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const isSelected = selected === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelected(opt.value)}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3 ${
                  isSelected
                    ? 'border-teal-500 bg-teal-500/5'
                    : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                }`}
              >
                <Icon size={20} className={isSelected ? 'text-teal-500 flex-shrink-0 mt-0.5' : 'text-zinc-500 flex-shrink-0 mt-0.5'} />
                <div>
                  <p className={`text-sm font-bold ${isSelected ? 'text-teal-500' : 'text-white'}`}>{opt.label}</p>
                  <p className="text-zinc-500 text-xs mt-1">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleConfirm}
          disabled={busy || !selected}
          className="w-full py-4 bg-white text-black font-black uppercase tracking-[0.15em] text-xs rounded-xl hover:bg-teal-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy ? <><Loader2 className="animate-spin" size={14} /> Saving…</> : <><ShieldCheck size={14} /> Continue</>}
        </button>
      </div>
    </div>
  );
}
