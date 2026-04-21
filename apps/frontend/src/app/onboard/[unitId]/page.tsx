'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import api from '@/lib/api';

// ── Defensive numeric helpers — never crash on undefined/null/NaN ──────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();
const safeD = (v: any, d = 2): string => safeN(v).toFixed(d);


// API calls use relative URLs — proxied to Render by next.config.js rewrites (no CORS)

// ── Types ─────────────────────────────────────────────────────────────────────
interface UnitInfo {
  unit_name: string;
  project_title: string;
  project_number: string;
  rent_amount: number;
  currency: string;
}

interface FormData {
  // Step 1 – Identity
  fullName: string;
  email: string;
  phone: string;
  selfieDataUrl: string;
  // Step 2 – History
  formerAddress: string;
  reasonForLeaving: string;
  formerLandlordContact: string;
  // Step 3 – Security / Guarantor
  guarantorName: string;
  guarantorPhone: string;
  guarantorWorkId: string;
  guarantorRelationship: string;
  // Step 4 – Financial
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  // Step 5 – Signature
  signatureDataUrl: string;
}

const REASONS = [
  'Rent Increase',
  'Relocation / Job Change',
  'Property Sold',
  'Lease Expired',
  'Maintenance Issues',
  'Family / Personal Reasons',
  'Upgrade / Downsize',
  'Other',
];

const STEPS = [
  { id: 1, label: 'Identity',   icon: '🪪' },
  { id: 2, label: 'History',    icon: '🏘️' },
  { id: 3, label: 'Security',   icon: '🛡️' },
  { id: 4, label: 'Financial',  icon: '💳' },
  { id: 5, label: 'Signature',  icon: '✍️' },
];

export default function OnboardPage() {
  const params   = useParams();
  const router   = useRouter();
  const unitId   = params?.unitId as string;

  const [step,       setStep]       = useState(1);
  const [unit,       setUnit]       = useState<UnitInfo | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);

  const [form, setForm] = useState<FormData>({
    fullName: '', email: '', phone: '', selfieDataUrl: '',
    formerAddress: '', reasonForLeaving: '', formerLandlordContact: '',
    guarantorName: '', guarantorPhone: '', guarantorWorkId: '', guarantorRelationship: '',
    frequency: 'MONTHLY',
    signatureDataUrl: '',
  });

  // Signature canvas
  const sigCanvas    = useRef<HTMLCanvasElement>(null);
  const sigDrawing   = useRef(false);
  const sigLastPoint = useRef<{ x: number; y: number } | null>(null);

  // Camera stream
  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);

  // ── Load unit info ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!unitId) return;
    api.get(`/api/rental/invite-link/${unitId}`)
      .then(res => {
        const d = res.data;
        setUnit({
          unit_name:      d.unit_name      || 'Your Unit',
          project_title:  d.project_title  || 'Nested Ark Project',
          project_number: d.project_number || '',
          rent_amount:    d.rent_amount    || 0,
          currency:       d.currency       || 'NGN',
        });
      })
      .catch(() => setUnit({ unit_name: 'Your Unit', project_title: 'Nested Ark', project_number: '', rent_amount: 0, currency: 'NGN' }))
      .finally(() => setLoading(false));
  }, [unitId]);

  // ── Cleanup camera on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  // ── Form helpers ──────────────────────────────────────────────────────────
  const set = (key: keyof FormData, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // ── Camera / Selfie ───────────────────────────────────────────────────────
  async function openCamera() {
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      alert('Camera permission denied. Please allow camera access or upload a photo instead.');
      setCameraOpen(false);
    }
  }

  function captureSelfie() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 320;
    canvas.height = video.videoHeight || 240;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    set('selfieDataUrl', canvas.toDataURL('image/jpeg', 0.8));
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCameraOpen(false);
  }

  function removeSelfie() {
    set('selfieDataUrl', '');
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCameraOpen(false);
  }

  // ── Signature canvas ──────────────────────────────────────────────────────
  function sigStart(e: React.PointerEvent<HTMLCanvasElement>) {
    sigDrawing.current = true;
    const rect  = sigCanvas.current!.getBoundingClientRect();
    sigLastPoint.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function sigMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!sigDrawing.current || !sigCanvas.current) return;
    const ctx   = sigCanvas.current.getContext('2d')!;
    const rect  = sigCanvas.current.getBoundingClientRect();
    const x     = e.clientX - rect.left;
    const y     = e.clientY - rect.top;
    const last  = sigLastPoint.current || { x, y };
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#14b8a6';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.stroke();
    sigLastPoint.current = { x, y };
  }

  function sigEnd() {
    sigDrawing.current = false;
    sigLastPoint.current = null;
    if (sigCanvas.current) set('signatureDataUrl', sigCanvas.current.toDataURL('image/png'));
  }

  function clearSignature() {
    const canvas = sigCanvas.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    set('signatureDataUrl', '');
  }

  // ── Step validation ───────────────────────────────────────────────────────
  function canProceed(): boolean {
    switch (step) {
      case 1: return !!form.fullName.trim() && !!form.email.trim() && !!form.phone.trim();
      case 2: return !!form.formerAddress.trim() && !!form.reasonForLeaving;
      case 3: return !!form.guarantorName.trim() && !!form.guarantorPhone.trim();
      case 4: return !!form.frequency;
      case 5: return !!form.signatureDataUrl;
      default: return true;
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      // Upload selfie & signature as base64 strings — backend stores as-is or to cloud
      const body = {
        unitId,
        fullName:             form.fullName.trim(),
        email:                form.email.toLowerCase().trim(),
        phone:                form.phone.trim(),
        pattern:              form.frequency,
        selfie_url:           form.selfieDataUrl || null,
        former_address:       form.formerAddress,
        reason_for_quit:      form.reasonForLeaving,
        former_landlord_contact: form.formerLandlordContact || null,
        guarantor_json: {
          name:         form.guarantorName,
          phone:        form.guarantorPhone,
          work_id:      form.guarantorWorkId || null,
          relationship: form.guarantorRelationship || null,
        },
        digital_signature_url: form.signatureDataUrl || null,
      };

      await api.post('/api/tenant/onboard', body);
      setDone(true);
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="mb-4">
        <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">{label}</label>
        {children}
      </div>
    );
  }

  function Input({ field, placeholder, type = 'text' }: { field: keyof FormData; placeholder?: string; type?: string }) {
    return (
      <input
        type={type}
        value={form[field] as string}
        onChange={e => set(field, e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-teal-500 transition"
      />
    );
  }

  // ── Done screen ───────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6">🏠</div>
          <h1 className="text-2xl font-black text-white mb-3">Welcome Aboard!</h1>
          <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
            Your digital tenancy for <strong className="text-teal-400">{unit?.unit_name}</strong> at{' '}
            <strong className="text-white">{unit?.project_title}</strong> is now active.<br /><br />
            Check your email and WhatsApp for your official Tenancy Handbook and vault details.
          </p>
          <div className="bg-zinc-900 border border-teal-800 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-2">What happens next</p>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li>✅ Tenancy created &amp; ledger hash recorded</li>
              <li>📧 Welcome email sent with Tenancy Handbook</li>
              <li>💬 WhatsApp confirmation dispatched</li>
              <li>🔐 Your Flex-Pay vault is active</li>
            </ul>
          </div>
          <button
            onClick={() => router.push('/tenant/dashboard')}
            className="w-full bg-teal-500 hover:bg-teal-400 text-black font-bold py-3 rounded-lg transition text-sm"
          >
            Go to My Tenant Dashboard →
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-teal-500 text-sm animate-pulse">Loading your tenancy details…</div>
      </div>
    );
  }

  // ── Progress bar ──────────────────────────────────────────────────────────
  const pct = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-zinc-900 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo size={24} showText={false} />
          <div>
            <p className="text-xs text-teal-500 font-bold uppercase tracking-widest">Nested Ark</p>
            <p className="text-sm font-bold text-white">{unit?.unit_name}</p>
            <p className="text-xs text-zinc-500">{unit?.project_title}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">Step {step} of {STEPS.length}</p>
          <p className="text-xs font-bold text-teal-400">{STEPS[step - 1].icon} {STEPS[step - 1].label}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1 bg-zinc-900">
        <div
          className="h-1 bg-teal-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="flex justify-between px-4 py-3 border-b border-zinc-900">
        {STEPS.map(s => (
          <button
            key={s.id}
            onClick={() => s.id < step && setStep(s.id)}
            className={`flex flex-col items-center gap-1 ${s.id < step ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border
              ${s.id === step  ? 'bg-teal-500 border-teal-500 text-black'  :
                s.id < step    ? 'bg-zinc-700 border-zinc-600 text-teal-400' :
                                 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>
              {s.id < step ? '✓' : s.id}
            </div>
            <span className={`text-[10px] hidden sm:block ${s.id === step ? 'text-teal-400' : 'text-zinc-600'}`}>
              {s.label}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6">

        {/* ── Step 1: Identity ── */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-black mb-1">Your Identity</h2>
            <p className="text-zinc-500 text-sm mb-6">Let us know who you are. This is your official tenancy profile.</p>

            <Field label="Full Legal Name *">
              <Input field="fullName" placeholder="e.g. Oluwaseun Adeyemi" />
            </Field>
            <Field label="Email Address *">
              <Input field="email" type="email" placeholder="your@email.com" />
            </Field>
            <Field label="Phone Number (WhatsApp) *">
              <Input field="phone" type="tel" placeholder="+234 800 000 0000" />
            </Field>

            <Field label="Selfie / Profile Photo">
              {form.selfieDataUrl ? (
                <div className="relative w-28 h-28">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.selfieDataUrl} alt="Selfie" className="w-28 h-28 rounded-full object-cover border-2 border-teal-500" />
                  <button onClick={removeSelfie} className="absolute -top-2 -right-2 bg-red-600 text-white w-6 h-6 rounded-full text-xs font-bold">✕</button>
                </div>
              ) : cameraOpen ? (
                <div className="space-y-3">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl border border-zinc-700" />
                  <div className="flex gap-3">
                    <button onClick={captureSelfie} className="flex-1 bg-teal-500 text-black font-bold py-2 rounded-lg text-sm">📸 Capture</button>
                    <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setCameraOpen(false); }} className="flex-1 bg-zinc-800 text-zinc-300 py-2 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button onClick={openCamera} className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm py-3 rounded-lg hover:border-teal-500 transition">
                    📷 Open Camera
                  </button>
                  <label className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm py-3 rounded-lg hover:border-teal-500 transition cursor-pointer text-center">
                    📁 Upload Photo
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => set('selfieDataUrl', ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                </div>
              )}
              <p className="text-xs text-zinc-600 mt-2">Optional but recommended for secure verification.</p>
            </Field>
          </div>
        )}

        {/* ── Step 2: History ── */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-black mb-1">Rental History</h2>
            <p className="text-zinc-500 text-sm mb-6">This helps your landlord understand your background.</p>

            <Field label="Former / Current Address *">
              <textarea
                value={form.formerAddress}
                onChange={e => set('formerAddress', e.target.value)}
                placeholder="e.g. 14 Bourdillon Road, Ikoyi, Lagos"
                rows={3}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-teal-500 transition resize-none"
              />
            </Field>

            <Field label="Primary Reason for Leaving *">
              <select
                value={form.reasonForLeaving}
                onChange={e => set('reasonForLeaving', e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500 transition"
              >
                <option value="">Select a reason…</option>
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>

            <Field label="Former Landlord Contact (Optional)">
              <Input field="formerLandlordContact" placeholder="Name & phone number" />
              <p className="text-xs text-zinc-600 mt-1">May be used for reference checks.</p>
            </Field>
          </div>
        )}

        {/* ── Step 3: Security / Guarantor ── */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-black mb-1">Guarantor Details</h2>
            <p className="text-zinc-500 text-sm mb-6">A guarantor stands surety for your tenancy obligations.</p>

            <Field label="Guarantor Full Name *">
              <Input field="guarantorName" placeholder="e.g. Dr. Bola Tinubu-Smith" />
            </Field>
            <Field label="Guarantor Phone *">
              <Input field="guarantorPhone" type="tel" placeholder="+234 800 000 0000" />
            </Field>
            <Field label="Guarantor Work ID / Employer">
              <Input field="guarantorWorkId" placeholder="Company name or ID number" />
            </Field>
            <Field label="Relationship to You">
              <select
                value={form.guarantorRelationship}
                onChange={e => set('guarantorRelationship', e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500 transition"
              >
                <option value="">Select relationship…</option>
                <option>Employer / Colleague</option>
                <option>Parent / Guardian</option>
                <option>Sibling</option>
                <option>Spouse / Partner</option>
                <option>Friend</option>
                <option>Other Family</option>
              </select>
            </Field>

            <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 mt-2">
              <p className="text-xs text-amber-400 font-bold uppercase tracking-widest mb-1">⚠️ Important</p>
              <p className="text-xs text-amber-200 leading-relaxed">
                Your guarantor may be contacted in the event of a rental dispute, non-payment, or legal proceeding. Ensure they are aware and have consented.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 4: Financial ── */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-black mb-1">Payment Rhythm</h2>
            <p className="text-zinc-500 text-sm mb-6">Choose how you want to build your rent vault. All plans target the same annual amount.</p>

            {unit && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">Annual Rent</p>
                <p className="text-2xl font-black text-teal-400 font-mono">
                  {unit.currency} {safeF(unit.rent_amount)}
                </p>
                <p className="text-xs text-zinc-500 mt-1">{unit.unit_name} · {unit.project_title}</p>
              </div>
            )}

            <div className="space-y-3">
              {([
                { val: 'WEEKLY',    label: 'Weekly',    periods: 52, icon: '⚡', desc: 'Smallest amounts, easiest to manage' },
                { val: 'MONTHLY',   label: 'Monthly',   periods: 12, icon: '📅', desc: 'Most popular, aligned with salary cycles' },
                { val: 'QUARTERLY', label: 'Quarterly', periods: 4,  icon: '📦', desc: 'Fewer transactions, higher single amount' },
              ] as const).map(opt => {
                const installment = unit ? Math.ceil(unit.rent_amount / opt.periods) : 0;
                const selected    = form.frequency === opt.val;
                return (
                  <button
                    key={opt.val}
                    onClick={() => set('frequency', opt.val)}
                    className={`w-full text-left p-4 rounded-xl border transition ${
                      selected ? 'border-teal-500 bg-teal-950' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{opt.icon}</span>
                        <div>
                          <p className={`font-bold text-sm ${selected ? 'text-teal-300' : 'text-white'}`}>{opt.label}</p>
                          <p className="text-xs text-zinc-500">{opt.desc}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-black font-mono text-sm ${selected ? 'text-teal-400' : 'text-zinc-300'}`}>
                          {unit ? `${unit.currency} ${safeF(installment)}` : '—'}
                        </p>
                        <p className="text-xs text-zinc-600">per {opt.label.toLowerCase().replace('ly', '')}</p>
                      </div>
                    </div>
                    {selected && (
                      <div className="mt-2 pt-2 border-t border-teal-900">
                        <p className="text-xs text-teal-400">✓ Selected — your Flex-Pay vault will be set to {opt.label.toLowerCase()} installments</p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-500 leading-relaxed">
              <strong className="text-white">The 48-Hour Rule:</strong> If your vault is not funded 48 hours after the due date, the system automatically escalates to a formal Notice to Pay. Your vault is your responsibility.
            </div>
          </div>
        )}

        {/* ── Step 5: Signature ── */}
        {step === 5 && (
          <div>
            <h2 className="text-xl font-black mb-1">Digital Signature</h2>
            <p className="text-zinc-500 text-sm mb-4">
              By signing below, you confirm you have read and agree to the Tenancy Handbook and obligations set out by Nested Ark Infrastructure OS.
            </p>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4 text-xs text-zinc-400 leading-relaxed space-y-2">
              <p>✅ I confirm the information provided is accurate and truthful.</p>
              <p>✅ I acknowledge the 48-hour payment rule and the legal consequences of non-payment.</p>
              <p>✅ I consent to my guarantor being contacted if necessary.</p>
              <p>✅ I agree that this digital signature is legally binding under applicable tenancy law.</p>
            </div>

            <div className="border border-zinc-700 rounded-xl overflow-hidden mb-3">
              <div className="bg-zinc-900 px-3 py-2 text-xs text-zinc-500 flex justify-between items-center">
                <span>Sign in the space below</span>
                <button onClick={clearSignature} className="text-red-400 hover:text-red-300 text-xs">Clear</button>
              </div>
              <canvas
                ref={sigCanvas}
                width={560}
                height={160}
                className="w-full bg-zinc-950 cursor-crosshair touch-none"
                onPointerDown={sigStart}
                onPointerMove={sigMove}
                onPointerUp={sigEnd}
                onPointerLeave={sigEnd}
              />
            </div>

            {!form.signatureDataUrl && (
              <p className="text-xs text-amber-400">⚠️ Please draw your signature above to continue.</p>
            )}

            <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-2">Summary</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-zinc-500">Name</span><span className="text-white font-bold">{form.fullName}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Email</span><span className="text-zinc-300">{form.email}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Unit</span><span className="text-zinc-300">{unit?.unit_name}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Payment</span><span className="text-teal-400 font-bold">{form.frequency}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Guarantor</span><span className="text-zinc-300">{form.guarantorName || '—'}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="mt-4 bg-red-950 border border-red-800 rounded-xl p-4 text-sm text-red-300">
            ❌ {error}
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-300 font-bold py-3 rounded-lg text-sm hover:border-zinc-500 transition"
            >
              ← Back
            </button>
          )}

          {step < STEPS.length ? (
            <button
              onClick={() => canProceed() && setStep(s => s + 1)}
              disabled={!canProceed()}
              className={`flex-1 font-bold py-3 rounded-lg text-sm transition ${
                canProceed()
                  ? 'bg-teal-500 hover:bg-teal-400 text-black'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !canProceed()}
              className={`flex-1 font-bold py-3 rounded-lg text-sm transition ${
                !submitting && canProceed()
                  ? 'bg-teal-500 hover:bg-teal-400 text-black'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              {submitting ? '⏳ Activating Vault…' : '🏠 Complete Onboarding'}
            </button>
          )}
        </div>

        <p className="text-center text-xs text-zinc-700 mt-6">
          Secured by Nested Ark Infrastructure OS · Tri-Layer Verification 🔒
        </p>
      </div>
    </div>
  );
}
