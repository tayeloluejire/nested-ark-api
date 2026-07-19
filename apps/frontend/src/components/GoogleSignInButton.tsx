'use client';
/**
 * components/GoogleSignInButton.tsx
 *
 * Drop-in Google Sign-In button using Google Identity Services (GIS).
 * Renders Google's own button UI (no custom styling needed — GIS handles
 * rendering), then hands the resulting ID token to AuthContext.loginWithGoogle().
 *
 * SETUP REQUIRED (see accompanying setup notes):
 *   1. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to your frontend env vars (Vercel).
 *   2. Add GOOGLE_CLIENT_ID (same value) to the backend env vars (Render).
 *   3. In Google Cloud Console, add your production + preview URLs to
 *      "Authorized JavaScript origins" for this OAuth client.
 *
 * Usage: <GoogleSignInButton onNeedsRole={() => router.push('/select-role')} />
 * Drop this directly into both /login and /register pages, near the
 * existing email/password form.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { Loader2 } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleSignInButtonProps {
  /** Called after a successful Google sign-in that still needs role selection. */
  onNeedsRole?: () => void;
}

export default function GoogleSignInButton({ onNeedsRole }: GoogleSignInButtonProps) {
  const { loginWithGoogle } = useAuth();
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) {
      console.warn('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set — Google Sign-In button will not render.');
      return;
    }

    const handleCredentialResponse = async (response: { credential: string }) => {
      setBusy(true);
      setError('');
      try {
        const { needsRoleSelection } = await loginWithGoogle(response.credential);
        if (needsRoleSelection) {
          if (onNeedsRole) onNeedsRole();
          else router.push('/select-role');
        } else {
          // loginWithGoogle already persisted auth state; role is already
          // known (returning, auto-linked user) — go straight to dashboard.
          router.push('/dashboard');
        }
      } catch (ex: any) {
        setError(ex?.response?.data?.error ?? 'Google sign-in failed. Please try again.');
      } finally {
        setBusy(false);
      }
    };

    const initializeGoogle = () => {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 360,
      });
    };

    if (window.google) {
      initializeGoogle();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogle;
      document.body.appendChild(script);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (!clientId) return null; // Fails quietly in an environment where it's not configured yet

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 my-4">
        <div className="h-px flex-1 bg-zinc-800" />
        <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">or</span>
        <div className="h-px flex-1 bg-zinc-800" />
      </div>
      <div className="flex justify-center">
        <div ref={buttonRef} />
      </div>
      {busy && (
        <div className="flex items-center justify-center gap-2 mt-3 text-zinc-500 text-xs">
          <Loader2 className="animate-spin" size={14} /> Signing you in…
        </div>
      )}
      {error && (
        <p className="text-red-400 text-xs font-bold text-center mt-3">{error}</p>
      )}
    </div>
  );
}
