'use client';
import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLiveMilestones } from '@/hooks/useLiveSystem';
import api from '@/lib/api';
import {
  CheckCircle2, Clock, ShieldAlert, ArrowUpRight, Lock,
  Activity, RefreshCw, Shield, Camera, Bot, Users,
  AlertTriangle, Upload, Loader2
} from 'lucide-react';

function VerBadge({ label, status, icon: Icon }: { label: string; status: string; icon: any }) {
  const isVerified = status === 'VERIFIED';
  const isRejected = status === 'REJECTED';
  return (
    <div className={`flex flex-col items-center gap-1 p-3 rounded-xl border ${
      isVerified ? 'border-teal-500/40 bg-teal-500/5' :
      isRejected ? 'border-red-500/40 bg-red-500/5' :
      'border-zinc-800 bg-zinc-900/20'
    }`}>
      <div className={`p-1.5 rounded-lg ${isVerified ? 'bg-teal-500/20' : isRejected ? 'bg-red-500/20' : 'bg-zinc-800'}`}>
        <Icon size={12} className={isVerified ? 'text-teal-500' : isRejected ? 'text-red-400' : 'text-zinc-500'} />
      </div>
      <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-wider">{label}</span>
      <div className="flex items-center gap-1">
        <div className={`h-1.5 w-1.5 rounded-full ${isVerified ? 'bg-teal-500 animate-pulse' : isRejected ? 'bg-red-400' : 'bg-zinc-700'}`} />
        <span className={`text-[8px] font-bold uppercase ${isVerified ? 'text-teal-500' : isRejected ? 'text-red-400' : 'text-zinc-600'}`}>
          {status}
        </span>
      </div>
    </div>
  );
}

function EvidenceModal({ milestone, onClose, onSuccess }: { milestone: any; onClose: () => void; onSuccess: () => void }) {
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const submitEvidence = async () => {
    if (!evidenceUrl.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/api/milestones/${milestone.id}/verify/ai`, { evidence_url: evidenceUrl });
      setResult(res.data);
      if (res.data.success) { setTimeout(onSuccess, 1500); }
    } catch (err: any) {
      setResult({ success: false, reason: err?.response?.data?.reason || err?.response?.data?.error || 'Validation failed' });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-8 space-y-6">
        <div>
          <h3 className="text-xl font-bold uppercase tracking-tight">Submit Evidence</h3>
          <p className="text-zinc-500 text-xs mt-1 uppercase tracking-widest">{milestone.title}</p>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
          <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Evidence URL (photo/video)</p>
          <p className="text-[10px] text-zinc-600">Upload to Cloudinary, S3, or any public URL. AI validator will analyse the file.</p>
        </div>
        <div className="space-y-3">
          <input type="url" placeholder="https://your-storage.com/evidence-photo.jpg"
            value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)}
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors" />
          {result && (
            <div className={`p-4 rounded-xl border ${result.success ? 'border-teal-500/30 bg-teal-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
              <p className={`text-xs font-bold uppercase tracking-widest ${result.success ? 'text-teal-500' : 'text-red-400'}`}>
                {result.success ? '✅ AI Validator: Evidence Verified' : `❌ ${result.reason}`}
              </p>
              {result.ai_hash && <p className="text-[9px] text-zinc-600 font-mono mt-1 truncate">Hash: {result.ai_hash}</p>}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={submitEvidence} disabled={submitting || !evidenceUrl}
            className="flex-1 py-3 bg-white text-black font-bold uppercase text-xs tracking-widest rounded-xl hover:bg-teal-500 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="animate-spin" size={14} /> : <><Upload size={12} /> Validate Evidence</>}
          </button>
          <button onClick={onClose} className="px-4 py-3 border border-zinc-700 text-zinc-400 font-bold uppercase text-xs tracking-widest rounded-xl hover:text-white transition-all">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function AuditModal({ milestone, onClose, onSuccess }: { milestone: any; onClose: () => void; onSuccess: () => void }) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitAudit = async (approved: boolean) => {
    setSubmitting(true);
    try {
      await api.post(`/api/milestones/${milestone.id}/verify/human`, { approved, notes });
      onSuccess();
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Audit submission failed');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-8 space-y-6">
        <div>
          <h3 className="text-xl font-bold uppercase tracking-tight">Human Audit</h3>
          <p className="text-zinc-500 text-xs mt-1 uppercase tracking-widest">{milestone.title}</p>
        </div>
        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <p className="text-[10px] text-amber-400 uppercase font-bold tracking-widest">Physical Site Inspection Required</p>
          <p className="text-[10px] text-zinc-500 mt-1">Review evidence, visit site if needed, then approve or reject. This decision is logged immutably.</p>
        </div>
        <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Audit notes, observations, inspection summary..."
          className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors resize-none" />
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => submitAudit(true)} disabled={submitting}
            className="py-3 bg-teal-500 text-black font-bold uppercase text-xs tracking-widest rounded-xl hover:bg-teal-400 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="animate-spin" size={14} /> : <><CheckCircle2 size={12} /> Approve</>}
          </button>
          <button onClick={() => submitAudit(false)} disabled={submitting}
            className="py-3 bg-red-500/20 text-red-400 border border-red-500/30 font-bold uppercase text-xs tracking-widest rounded-xl hover:bg-red-500/30 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            <AlertTriangle size={12} /> Reject
          </button>
        </div>
        <button onClick={onClose} className="w-full py-2 text-zinc-500 text-xs uppercase font-bold tracking-widest hover:text-white transition-all">Cancel</button>
      </div>
    </div>
  );
}

export default function MilestonesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { milestones, isLoading, mutate } = useLiveMilestones();
  const [releasing, setReleasing] = useState<string | null>(null);
  const [evidenceModal, setEvidenceModal] = useState<any>(null);
  const [auditModal, setAuditModal] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  if (authLoading || !user) return <div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={32} /></div>;

  const isGovt = user.role === 'GOVERNMENT' || user.role === 'ADMIN';
  const isContractor = user.role === 'CONTRACTOR';
  const isVerifier = user.role === 'VERIFIER' || isGovt;

  const handleRelease = async (m: any) => {
    const allVerified = m.ai_status === 'VERIFIED' && m.human_status === 'VERIFIED' && m.drone_status === 'VERIFIED';
    const missing = [
      m.ai_status !== 'VERIFIED' && 'AI Validator',
      m.human_status !== 'VERIFIED' && 'Human Auditor',
      m.drone_status !== 'VERIFIED' && 'Drone Capture',
    ].filter(Boolean).join(', ');

    if (!allVerified) {
      const bypass = confirm(`⚠ WARNING: Not all verification layers complete.\nMissing: ${missing}\n\nProceed anyway?`);
      if (!bypass) return;
    } else {
      const ok = confirm(`AUTHORIZE RELEASE of $${Number(m.budget_allocation).toLocaleString()} for "${m.title}"?\n\nAll 3 verification layers passed. This is irreversible.`);
      if (!ok) return;
    }

    setReleasing(m.id);
    try {
      const res = await api.post('/api/milestones/approve-and-release', {
        milestone_id: m.id, actor_role: user.role, skip_drone: !allVerified && m.drone_status !== 'VERIFIED',
      });
      alert(`✅ Funds released. Ledger hash: ${res.data.ledger_hash?.slice(0, 16)}...`);
      mutate();
    } catch (err: any) {
      const gateInfo = err?.response?.data?.gate;
      if (gateInfo) alert(`🔒 BLOCKED: ${err.response.data.error}\nBlocked by: ${gateInfo.blocked_by?.join(', ')}`);
      else alert(err?.response?.data?.error ?? 'Release failed.');
    } finally { setReleasing(null); }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      {evidenceModal && <EvidenceModal milestone={evidenceModal} onClose={() => setEvidenceModal(null)} onSuccess={() => { setEvidenceModal(null); mutate(); }} />}
      {auditModal && <AuditModal milestone={auditModal} onClose={() => setAuditModal(null)} onSuccess={() => { setAuditModal(null); mutate(); }} />}

      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto px-6 py-12">
        <header className="mb-12 border-l-2 border-teal-500 pl-6">
          <div className="flex items-center gap-2 text-teal-500 mb-2">
            <ShieldAlert size={14} />
            <span className="text-[10px] uppercase font-bold tracking-[0.2em]">Secure Terminal // {user.role}</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-black tracking-tighter uppercase italic">Node Payout Schedule</h2>
              <p className="text-zinc-500 text-sm mt-1">Tri-layer verified escrow distribution — AI + Human + Drone</p>
            </div>
            <button onClick={() => mutate()} className="p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-teal-500 hover:border-teal-500/50 transition-all">
              <RefreshCw size={16} />
            </button>
          </div>
        </header>

        <div className="mb-8 p-4 rounded-xl border border-zinc-800 bg-zinc-900/20 grid grid-cols-3 gap-4">
          {[
            { icon: Bot,    label: 'Layer 1: AI Validator', desc: 'pHash analysis detects fake/synthetic images' },
            { icon: Users,  label: 'Layer 2: Human Audit',  desc: 'Physical site inspection by verified auditor' },
            { icon: Camera, label: 'Layer 3: Drone Capture', desc: 'Aerial footage via DJI/Pix4D webhook' },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-3">
              <item.icon size={16} className="text-teal-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest">{item.label}</p>
                <p className="text-[9px] text-zinc-600 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {isLoading && <div className="py-20 text-center"><Loader2 className="animate-spin text-teal-500 mx-auto" size={24} /></div>}

        {!isLoading && milestones.length === 0 && (
          <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl">
            <p className="text-zinc-600 text-xs uppercase tracking-widest font-bold">No active distribution protocols found.</p>
            <p className="text-zinc-700 text-[10px] mt-2 font-mono">Milestones appear once projects are created.</p>
          </div>
        )}

        <div className="grid gap-4">
          {milestones.map((m: any) => {
            const amount = Number(m.budget_allocation);
            const isPaid = m.status === 'PAID' || m.status === 'COMPLETED';
            const allVerified = m.ai_status === 'VERIFIED' && m.human_status === 'VERIFIED' && m.drone_status === 'VERIFIED';
            const canRelease = isGovt && !isPaid;
            const canSubmitEvidence = isContractor && !isPaid && m.ai_status !== 'VERIFIED';
            const canAudit = isVerifier && m.ai_status === 'VERIFIED' && m.human_status !== 'VERIFIED' && !isPaid;

            return (
              <div key={m.id} className={`p-6 rounded-2xl border transition-all ${
                isPaid ? 'border-teal-900/30 bg-teal-950/5' :
                allVerified ? 'border-teal-500/30 bg-teal-500/5' :
                'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700'
              }`}>
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-3 rounded-lg flex-shrink-0 ${
                      isPaid ? 'bg-teal-500 text-black' :
                      allVerified ? 'bg-teal-500/20 text-teal-500' : 'bg-zinc-800 text-zinc-500'
                    }`}>
                      {isPaid ? <CheckCircle2 size={20} /> : allVerified ? <Shield size={20} /> : <Lock size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold tracking-tight uppercase">{m.title}</h3>
                      {m.description && <p className="text-zinc-500 text-xs mt-0.5 line-clamp-1">{m.description}</p>}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className={`text-[9px] px-2 py-0.5 rounded border uppercase font-bold ${
                          isPaid ? 'border-teal-500/50 text-teal-500' :
                          allVerified ? 'border-teal-500/30 text-teal-400' : 'border-zinc-700 text-zinc-500'
                        }`}>{m.status}</span>
                        {allVerified && !isPaid && <span className="text-[9px] text-teal-500 font-bold uppercase">🔓 Release Ready</span>}
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        <VerBadge label="AI Validator" status={m.ai_status || 'PENDING'} icon={Bot} />
                        <VerBadge label="Human Audit" status={m.human_status || 'PENDING'} icon={Users} />
                        <VerBadge label="Drone Capture" status={m.drone_status || 'PENDING'} icon={Camera} />
                      </div>
                      {m.ai_hash && <p className="text-[8px] text-zinc-700 font-mono mt-2 truncate">AI Hash: {m.ai_hash.slice(0, 24)}…</p>}
                    </div>
                  </div>

                  <div className="flex flex-col justify-between items-end gap-4 min-w-[160px]">
                    <div className="text-right">
                      <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Allocation</p>
                      <p className="font-mono text-xl font-light"><span className="text-zinc-500 text-sm mr-1">$</span>{amount.toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col gap-2 w-full">
                      {canSubmitEvidence && (
                        <button onClick={() => setEvidenceModal(m)} className="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 text-white font-bold rounded-xl text-[10px] uppercase tracking-tighter hover:bg-zinc-700 transition-all">
                          <Upload size={12} /> Submit Evidence
                        </button>
                      )}
                      {canAudit && (
                        <button onClick={() => setAuditModal(m)} className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold rounded-xl text-[10px] uppercase tracking-tighter hover:bg-amber-500/30 transition-all">
                          <Users size={12} /> Audit
                        </button>
                      )}
                      {canRelease && (
                        <button onClick={() => handleRelease(m)} disabled={releasing === m.id}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-black font-black rounded-xl text-[10px] uppercase tracking-tighter hover:bg-teal-500 transition-all disabled:opacity-50">
                          {releasing === m.id ? <Activity className="animate-spin" size={12} /> : <><ArrowUpRight size={12} /> Release</>}
                        </button>
                      )}
                      {isPaid && <span className="text-teal-500 flex items-center justify-end gap-1 text-[10px] font-black uppercase tracking-widest"><CheckCircle2 size={12} /> Dispatched</span>}
                      {!isPaid && !canRelease && !canSubmitEvidence && !canAudit && (
                        <span className="text-zinc-600 flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-widest italic"><Clock size={12} /> Awaiting Verification</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
