'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FileUploader from '@/components/FileUploader';
import api from '@/lib/api';
import { ShieldCheck, CheckCircle2, Clock, AlertCircle, Loader2, User, FileText, Camera } from 'lucide-react';

const ID_TYPES = [
  { id: 'NIN',             label: 'NIN',              desc: 'National Identity Number' },
  { id: 'BVN',             label: 'BVN',              desc: 'Bank Verification Number' },
  { id: 'PASSPORT',        label: 'Passport',         desc: 'International Passport' },
  { id: 'DRIVERS_LICENSE', label: "Driver's Licence", desc: "Valid Driver's Licence" },
  { id: 'NATIONAL_ID',     label: 'National ID',      desc: 'National ID Card' },
];

export default function KYCPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [kycStatus,     setKycStatus]     = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [submitting,    setSubmitting]    = useState(false);
  const [form, setForm] = useState({
    full_name: '', date_of_birth: '', nationality: 'Nigerian', id_type: 'NIN',
    id_number: '', address: '', city: '', country: 'Nigeria',
    id_document_url: '', selfie_url: '',
  });

  useEffect(() => { if (!authLoading && !user) router.replace('/login'); }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      api.get('/api/kyc/status').then(r => {
        setKycStatus(r.data);
        if (r.data.record) setForm(f => ({
          ...f,
          full_name:       r.data.record.full_name       || user.full_name || '',
          id_type:         r.data.record.id_type         || 'NIN',
          id_document_url: r.data.record.id_document_url || '',
          selfie_url:      r.data.record.selfie_url      || '',
        }));
      }).catch(() => {}).finally(() => setStatusLoading(false));
      if (user.full_name) setForm(f => ({ ...f, full_name: user.full_name }));
    }
  }, [user]);

  if (authLoading || !user) return (
    <div className="h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={32} />
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.id_number) { alert('Full name and ID number are required'); return; }
    if (!form.id_document_url) { alert('Please upload your ID document before submitting'); return; }
    setSubmitting(true);
    try {
      await api.post('/api/kyc/submit', form);
      const r = await api.get('/api/kyc/status');
      setKycStatus(r.data);
      alert('KYC submitted successfully. Verification takes 1-3 business days.');
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Submission failed');
    } finally { setSubmitting(false); }
  };

  const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string; msg: string }> = {
    VERIFIED:      { icon: CheckCircle2, color: 'text-teal-500',  bg: 'bg-teal-500/5 border-teal-500/30', label: 'KYC Verified',        msg: 'Your identity is verified. You can make investments without restrictions.' },
    PENDING:       { icon: Clock,        color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/30', label: 'Under Review',       msg: 'Your KYC is being reviewed. This takes 1-3 business days.' },
    REJECTED:      { icon: AlertCircle, color: 'text-red-400',   bg: 'bg-red-500/5 border-red-500/30',     label: 'Rejected — Resubmit', msg: kycStatus?.record?.rejection_reason || 'Your submission was rejected. Please resubmit with valid documents.' },
    NOT_SUBMITTED: { icon: ShieldCheck, color: 'text-zinc-400',  bg: 'bg-zinc-800/30 border-zinc-700',     label: 'Not Submitted',       msg: 'Complete KYC to unlock full investment capabilities and comply with AML regulations.' },
  };

  const currentStatus = kycStatus?.kyc_status || 'NOT_SUBMITTED';
  const cfg           = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.NOT_SUBMITTED;
  const StatusIcon    = cfg.icon;
  const canSubmit     = currentStatus === 'NOT_SUBMITTED' || currentStatus === 'REJECTED';

  const idHint: Record<string, string> = {
    NIN:             'Photo of your NIN slip or NIN card — front side clearly visible',
    BVN:             'Photo of any bank-issued document showing your BVN',
    PASSPORT:        'Photo of your passport data page — full page, all text readable',
    DRIVERS_LICENSE: "Photo of your driver's licence — front side",
    NATIONAL_ID:     'Clear photo or scan of your National ID card',
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto px-6 py-12 w-full">

        <header className="mb-10 border-l-2 border-teal-500 pl-6">
          <p className="text-[10px] text-teal-500 uppercase font-bold tracking-[0.2em] mb-2">Identity Verification</p>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic">KYC Compliance</h1>
          <p className="text-zinc-500 text-sm mt-1">Anti-money laundering (AML) compliance — required for infrastructure investment.</p>
        </header>

        {/* Status banner */}
        {!statusLoading && (
          <div className={`flex items-start gap-3 p-4 rounded-xl border mb-8 ${cfg.bg}`}>
            <StatusIcon size={18} className={`${cfg.color} flex-shrink-0 mt-0.5`} />
            <div>
              <p className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</p>
              <p className="text-zinc-400 text-xs mt-0.5">{cfg.msg}</p>
            </div>
          </div>
        )}

        {/* What KYC unlocks */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: ShieldCheck, label: 'AML Compliance', desc: 'Required by regulation' },
            { icon: FileText,    label: 'Full Access',    desc: 'No investment limits' },
            { icon: Camera,      label: 'Faster Payouts', desc: 'Verified accounts get priority' },
          ].map(item => { const Icon = item.icon; return (
            <div key={item.label} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/20 text-center">
              <Icon size={16} className="text-teal-500 mx-auto mb-2" />
              <p className="text-[10px] font-bold uppercase tracking-widest">{item.label}</p>
              <p className="text-[9px] text-zinc-600 mt-1">{item.desc}</p>
            </div>
          ); })}
        </div>

        {/* ── KYC Form ── */}
        {canSubmit && (
          <form onSubmit={handleSubmit} className="space-y-6 p-8 rounded-3xl border border-zinc-800 bg-zinc-900/20">
            <h2 className="text-lg font-bold uppercase tracking-tight flex items-center gap-2">
              <User size={16} className="text-teal-500" /> Identity Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">Full Legal Name *</label>
                <input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                  placeholder="As it appears on your ID"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">Date of Birth</label>
                <input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">Nationality</label>
                <input value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })}
                  placeholder="e.g. Nigerian"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors" />
              </div>
            </div>

            {/* ID type selector */}
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-3">ID Type *</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                {ID_TYPES.map(t => (
                  <button key={t.id} type="button" onClick={() => setForm({ ...form, id_type: t.id })}
                    className={`p-3 rounded-xl border text-left transition-all ${form.id_type === t.id ? 'border-teal-500 bg-teal-500/10 text-white' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}>
                    <p className="text-[10px] font-bold uppercase tracking-widest">{t.label}</p>
                    <p className="text-[9px] text-zinc-600 mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
              <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">ID Number *</label>
              <input required value={form.id_number} onChange={e => setForm({ ...form, id_number: e.target.value })}
                placeholder={form.id_type === 'BVN' ? '11-digit BVN' : form.id_type === 'NIN' ? '11-digit NIN' : 'ID number'}
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors font-mono" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">City</label>
                <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Lagos"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">Country</label>
                <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} placeholder="Nigeria"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors" />
              </div>
            </div>

            {/* ── Document upload section ── */}
            <div className="space-y-5 border-t border-zinc-800 pt-6">
              <div>
                <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest mb-1 flex items-center gap-2">
                  <Camera size={12} className="text-teal-500" /> Document Upload
                </p>
                <p className="text-[10px] text-zinc-600 leading-relaxed mb-5">
                  Tap the button below to take a photo with your phone camera, or select a file from your gallery or computer.
                  Your documents are stored encrypted in a secure cloud vault — never on our servers.
                </p>
              </div>

              {/* ID document upload — replaces the old URL input */}
              <FileUploader
                label="ID Document"
                hint={idHint[form.id_type] || 'Clear photo or scan of your ID document'}
                accept="image,pdf"
                folder="kyc-documents"
                required
                disabled={submitting}
                value={form.id_document_url}
                onUpload={url => setForm(f => ({ ...f, id_document_url: url }))}
              />

              {/* Selfie upload — replaces old selfie_url input */}
              <FileUploader
                label="Selfie / Liveness Photo (recommended)"
                hint="Take a clear selfie holding your ID next to your face. This significantly speeds up verification."
                accept="image"
                folder="kyc-selfies"
                disabled={submitting}
                value={form.selfie_url}
                onUpload={url => setForm(f => ({ ...f, selfie_url: url }))}
              />
            </div>

            {/* Consent */}
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-500 leading-relaxed">
              By submitting, you confirm that all information provided is accurate and that you consent to identity
              verification for AML compliance purposes under applicable financial regulations (Nigeria MLAPMA 2022,
              FATF Recommendations). Documents are stored encrypted and used solely for KYC verification.
            </div>

            <button type="submit" disabled={submitting || !form.id_document_url}
              className="w-full py-4 bg-teal-500 text-black font-bold uppercase text-xs tracking-widest rounded-xl hover:bg-teal-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting
                ? <><Loader2 className="animate-spin" size={16} /> Submitting…</>
                : <><ShieldCheck size={14} /> Submit for Verification</>
              }
            </button>

            {!form.id_document_url && !submitting && (
              <p className="text-[10px] text-zinc-600 text-center">
                Upload your ID document above to enable submission
              </p>
            )}
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
