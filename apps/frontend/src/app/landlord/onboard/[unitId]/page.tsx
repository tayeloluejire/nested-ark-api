'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import {
  ArrowLeft, Send, Copy, CheckCircle2, MessageCircle,
  Mail, Link2, Loader2, Building2, User, Phone,
  AlertCircle, ChevronRight
} from 'lucide-react';

interface Unit {
  id: string;
  unit_name: string;
  rent_amount: number;
  security_deposit: number;
  service_charge: number;
  agency_fee: number;
  legal_fee: number;
  caution_fee: number;
  specs: string;
  status: string;
  bedrooms: string;
  bathrooms: string;
  currency: string;
  payment_frequency: string;
  project_id: string;
  project_title?: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nested-ark-api.vercel.app';

export default function OnboardTenantPage({ params }: { params: { unitId: string } }) {
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailForm, setEmailForm] = useState({ name: '', email: '', phone: '' });
  const [sendError, setSendError] = useState('');
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'email' | 'link'>('whatsapp');

  const inviteLink = `${BASE_URL}/onboard/${params.unitId}`;

  useEffect(() => {
    api.get(`/api/rental/units/${params.unitId}`)
      .then(res => setUnit(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.unitId]);

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const openWhatsApp = () => {
    if (!unit) return;
    const fees = [
      unit.rent_amount && `Rent: ${unit.currency} ${Number(unit.rent_amount).toLocaleString()} / ${unit.payment_frequency || 'month'}`,
      unit.security_deposit && `Security Deposit: ${unit.currency} ${Number(unit.security_deposit).toLocaleString()}`,
      unit.agency_fee && `Agency Fee: ${unit.currency} ${Number(unit.agency_fee).toLocaleString()}`,
      unit.legal_fee && `Legal Fee: ${unit.currency} ${Number(unit.legal_fee).toLocaleString()}`,
    ].filter(Boolean).join('%0A');

    const text = [
      `🏠 *Nested Ark OS — Tenancy Invitation*`,
      ``,
      `Hello,`,
      ``,
      `You have been invited to complete your lease for:`,
      `*${unit.unit_name}*${unit.project_title ? ` at ${unit.project_title}` : ''}`,
      unit.specs ? `📐 ${unit.specs}` : null,
      ``,
      `*Move-In Fees:*`,
      fees,
      ``,
      `Please complete your *AI KYC verification* and secure your tenancy via our blockchain-ledger escrow system:`,
      ``,
      `🔗 ${inviteLink}`,
      ``,
      `_Powered by Nested Ark OS · Impressions & Impacts Ltd_`,
    ].filter(v => v !== null).join('%0A');

    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const sendEmailInvite = async () => {
    setSendError('');
    if (!emailForm.email) { setSendError('Email address is required.'); return; }
    setSending(true);
    try {
      await api.post('/api/rental/invite', {
        unit_id: params.unitId,
        tenant_name: emailForm.name,
        tenant_email: emailForm.email,
        tenant_phone: emailForm.phone,
        invite_link: inviteLink,
      });
      setSent(true);
      setEmailForm({ name: '', email: '', phone: '' });
      setTimeout(() => setSent(false), 5000);
    } catch (e: any) {
      setSendError(e?.response?.data?.message || 'Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const totalMoveIn = unit
    ? [unit.rent_amount, unit.security_deposit, unit.service_charge, unit.agency_fee, unit.legal_fee, unit.caution_fee]
        .reduce((a, v) => a + (Number(v) || 0), 0)
    : 0;

  if (loading) return (
    <div className="flex h-96 items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={32} />
    </div>
  );

  if (!unit) return (
    <div className="flex flex-col h-96 items-center justify-center gap-4">
      <AlertCircle className="text-red-500" size={48} />
      <p className="text-zinc-400 font-bold">Unit not found or could not be loaded.</p>
      <Link href="/projects/my" className="text-teal-500 text-xs font-bold uppercase border border-teal-500/30 px-6 py-3 rounded-xl">
        Back to My Properties
      </Link>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-8">
      {/* Header */}
      <header className="border-b border-zinc-800 pb-6">
        <Link
          href="/projects/my"
          className="text-zinc-500 text-xs uppercase font-bold flex items-center gap-2 mb-4 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} /> My Properties
        </Link>
        <p className="text-[10px] text-teal-500 uppercase font-black tracking-widest mb-1">Tenant Onboarding</p>
        <h1 className="text-2xl md:text-3xl font-black uppercase italic">{unit.unit_name}</h1>
        {unit.project_title && <p className="text-zinc-500 text-xs mt-1">{unit.project_title}</p>}
      </header>

      {/* Unit Summary */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
          <Building2 size={14} className="text-teal-500" /> Unit Summary
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Rent', val: `${unit.currency || 'NGN'} ${Number(unit.rent_amount || 0).toLocaleString()}`, sub: `per ${unit.payment_frequency || 'month'}` },
            { label: 'Security Deposit', val: `${unit.currency || 'NGN'} ${Number(unit.security_deposit || 0).toLocaleString()}` },
            { label: 'Agency Fee', val: `${unit.currency || 'NGN'} ${Number(unit.agency_fee || 0).toLocaleString()}` },
            { label: 'Legal Fee', val: `${unit.currency || 'NGN'} ${Number(unit.legal_fee || 0).toLocaleString()}` },
            { label: 'Specs', val: unit.specs || `${unit.bedrooms || '?'} Bed / ${unit.bathrooms || '?'} Bath` },
            { label: 'Total Move-In', val: `${unit.currency || 'NGN'} ${totalMoveIn.toLocaleString()}`, highlight: true },
          ].map(item => (
            <div key={item.label} className={`bg-black border rounded-2xl p-4 ${item.highlight ? 'border-teal-500/40' : 'border-zinc-800'}`}>
              <p className="text-[10px] text-zinc-500 uppercase font-black mb-1">{item.label}</p>
              <p className={`font-black text-sm ${item.highlight ? 'text-teal-400' : 'text-white'}`}>{item.val}</p>
              {item.sub && <p className="text-zinc-600 text-[10px]">{item.sub}</p>}
            </div>
          ))}
        </div>

        {unit.status === 'occupied' && (
          <div className="mt-4 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-amber-400 text-sm font-bold">
            <AlertCircle size={18} />
            This unit is currently occupied. Inviting a new tenant will queue them for the next available date.
          </div>
        )}
      </div>

      {/* Invite Tabs */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
        <div className="flex border-b border-zinc-800">
          {([
            { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={14} /> },
            { id: 'email', label: 'Email', icon: <Mail size={14} /> },
            { id: 'link', label: 'Copy Link', icon: <Link2 size={14} /> },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-4 text-xs font-black uppercase flex items-center justify-center gap-2 transition-colors ${
                activeTab === tab.id
                  ? 'bg-teal-500/10 text-teal-400 border-b-2 border-teal-500'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 md:p-8">
          {/* WhatsApp Tab */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-4">
              <p className="text-zinc-400 text-sm">
                Opens WhatsApp with a pre-filled invitation message containing unit details, move-in fees, and the secure onboarding link.
              </p>
              <div className="bg-black border border-zinc-800 rounded-2xl p-4 text-xs font-mono text-zinc-500 space-y-1">
                <p className="text-zinc-300 font-bold">Preview:</p>
                <p>🏠 Nested Ark OS — Tenancy Invitation</p>
                <p>You have been invited to complete your lease for:</p>
                <p className="text-teal-400">*{unit.unit_name}*</p>
                <p>Rent: {unit.currency || 'NGN'} {Number(unit.rent_amount).toLocaleString()} / {unit.payment_frequency || 'month'}</p>
                <p>🔗 {inviteLink.substring(0, 45)}...</p>
              </div>
              <button
                onClick={openWhatsApp}
                className="w-full py-4 bg-green-500 text-black font-black uppercase text-sm rounded-2xl hover:bg-green-400 transition-colors flex items-center justify-center gap-3"
              >
                <MessageCircle size={18} /> Open in WhatsApp
              </button>
            </div>
          )}

          {/* Email Tab */}
          {activeTab === 'email' && (
            <div className="space-y-4">
              {sent && (
                <div className="flex items-center gap-3 bg-teal-500/10 border border-teal-500/30 rounded-2xl p-4 text-teal-400 text-sm font-bold">
                  <CheckCircle2 size={18} /> Invitation email sent successfully!
                </div>
              )}
              {sendError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-400 text-sm font-bold">
                  ⚠️ {sendError}
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Tenant Name</label>
                  <input
                    value={emailForm.name}
                    onChange={e => setEmailForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Amaka Johnson"
                    className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Email Address *</label>
                  <input
                    value={emailForm.email}
                    onChange={e => setEmailForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="tenant@email.com"
                    type="email"
                    className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1.5">Phone (optional)</label>
                  <input
                    value={emailForm.phone}
                    onChange={e => setEmailForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+234 800 000 0000"
                    type="tel"
                    className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors"
                  />
                </div>
              </div>
              <button
                onClick={sendEmailInvite}
                disabled={sending}
                className="w-full py-4 bg-teal-500 text-black font-black uppercase text-sm rounded-2xl hover:bg-teal-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {sending ? <><Loader2 className="animate-spin" size={18} /> Sending…</> : <><Send size={18} /> Send Email Invitation</>}
              </button>
            </div>
          )}

          {/* Link Tab */}
          {activeTab === 'link' && (
            <div className="space-y-4">
              <p className="text-zinc-400 text-sm">
                Share this link directly with your prospective tenant. They will be guided through KYC verification and secure payment.
              </p>
              <div className="flex items-center gap-3 bg-black border border-zinc-800 rounded-2xl p-4">
                <Link2 size={16} className="text-zinc-500 shrink-0" />
                <span className="text-xs font-mono text-zinc-300 flex-1 break-all">{inviteLink}</span>
                <button
                  onClick={copyLink}
                  className={`shrink-0 p-2 rounded-xl transition-colors ${copied ? 'bg-teal-500/20 text-teal-400' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                >
                  {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <button
                onClick={copyLink}
                className="w-full py-4 bg-zinc-800 text-white font-black uppercase text-sm rounded-2xl hover:bg-zinc-700 transition-colors flex items-center justify-center gap-3"
              >
                {copied ? <><CheckCircle2 size={18} className="text-teal-400" /> Copied!</> : <><Copy size={18} /> Copy Onboarding Link</>}
              </button>
              <p className="text-zinc-600 text-xs text-center">
                The tenant will complete KYC, sign digitally, then pay via Paystack escrow.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Onboarding Flow Steps */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-5">Tenant Onboarding Flow</h2>
        <div className="space-y-3">
          {[
            { step: '01', label: 'Receive Invite Link', desc: 'Tenant receives WhatsApp message, email, or direct link' },
            { step: '02', label: 'AI KYC Verification', desc: 'Identity document upload and automated verification' },
            { step: '03', label: 'Review Lease Terms', desc: 'Digital lease agreement with all fees displayed' },
            { step: '04', label: 'Secure Payment via Escrow', desc: 'Paystack payment held in escrow until keys are handed over' },
            { step: '05', label: 'Ledger Updated', desc: 'Tenancy confirmed, unit marked occupied on-chain' },
          ].map((item, i) => (
            <div key={item.step} className="flex items-start gap-4">
              <div className="shrink-0 w-8 h-8 bg-teal-500/10 border border-teal-500/30 rounded-xl flex items-center justify-center">
                <span className="text-[9px] font-black text-teal-500">{item.step}</span>
              </div>
              <div className="pt-1">
                <p className="text-sm font-black uppercase">{item.label}</p>
                <p className="text-zinc-500 text-xs">{item.desc}</p>
              </div>
              {i < 4 && <ChevronRight className="text-zinc-700 shrink-0 mt-1 ml-auto" size={14} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
