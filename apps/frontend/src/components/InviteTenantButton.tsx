'use client';

import { useState } from 'react';
import { MessageCircle, Copy, CheckCircle2, Loader2, Share2 } from 'lucide-react';
import api from '@/lib/api';

interface InviteTenantButtonProps {
  unitId: string;
  unitName?: string;
  compact?: boolean;
}

export default function InviteTenantButton({
  unitId,
  unitName,
  compact = false,
}: InviteTenantButtonProps) {
  const [loading,  setLoading]  = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [link,     setLink]     = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [error,    setError]    = useState('');

  const generateInvite = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get(`/api/rental/invite-link/${unitId}`);
      const { url, whatsapp_link } = res.data;
      setLink(url);
      // Open WhatsApp automatically
      window.open(whatsapp_link, '_blank');
      setShowMenu(true);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not generate invite link.');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: show the link
      prompt('Copy this link and share it with your tenant:', link);
    }
  };

  const shareNative = async () => {
    if (!link) return;
    if (navigator.share) {
      await navigator.share({
        title:  'Nested Ark — Tenant Onboarding',
        text:   `You've been invited to onboard as a tenant${unitName ? ` for ${unitName}` : ''}. Click to set up your profile and payment vault.`,
        url:    link,
      });
    } else {
      copyLink();
    }
  };

  if (compact) {
    return (
      <button
        onClick={generateInvite}
        disabled={loading}
        title={`Invite tenant via WhatsApp${unitName ? ` — ${unitName}` : ''}`}
        className="p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:border-teal-500/40 hover:text-teal-400 transition-all disabled:opacity-50">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
      </button>
    );
  }

  return (
    <div className="relative">
      {!showMenu ? (
        <button
          onClick={generateInvite}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-teal-500/40 hover:bg-teal-500/5 transition-all text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed">
          {loading
            ? <Loader2 size={13} className="animate-spin text-teal-500" />
            : <MessageCircle size={13} className="text-teal-500" />}
          {loading ? 'Generating…' : 'Invite via WhatsApp'}
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {/* WhatsApp re-send */}
          <button
            onClick={generateInvite}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-[#25D366]/20 transition-all disabled:opacity-50">
            <MessageCircle size={12} /> WhatsApp
          </button>

          {/* Copy link */}
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:border-zinc-600 hover:text-white transition-all">
            {copied
              ? <><CheckCircle2 size={12} className="text-teal-500" /> Copied!</>
              : <><Copy size={12} /> Copy Link</>}
          </button>

          {/* Native share (mobile) */}
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={shareNative}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:border-zinc-600 hover:text-white transition-all">
              <Share2 size={12} /> Share
            </button>
          )}

          {/* Reset */}
          <button
            onClick={() => { setShowMenu(false); setLink(''); }}
            className="text-[9px] text-zinc-700 hover:text-zinc-500 transition-colors font-bold uppercase tracking-widest">
            ×
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-[9px] text-red-400 font-bold">{error}</p>
      )}

      {/* Link preview (when generated) */}
      {showMenu && link && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-[8px] text-zinc-600 truncate max-w-xs">
          {link}
        </div>
      )}
    </div>
  );
}
