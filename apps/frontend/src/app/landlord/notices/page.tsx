'use client';
export const dynamic = 'force-dynamic';
/**
 * apps/frontend/src/app/landlord/notices/page.tsx
 *
 * Tenant dropdown  → GET /api/landlord/tenancies/active  (cross-project, no projectId needed)
 * Notice history   → GET /api/landlord/notices           (cross-project, landlord-scoped)
 * Issue notice     → POST /api/notices/generate
 *
 * If ?tenant=<tenancy_id> is in the URL query string the dropdown is pre-selected.
 */
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import {
  ShieldAlert, FileText, Loader2, AlertCircle, X,
  CheckCircle, ChevronDown, Hash, Building2, ArrowLeft,
} from 'lucide-react';

const safeN = (v: any) => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };

type Tenancy = {
  tenancy_id:    string;
  tenant_name:   string;
  tenant_email:  string;
  unit_name:     string;
  project_title: string;
  project_number:string;
  rent_amount:   string;
  currency:      string;
  vault_balance: string;
  next_due_date: string | null;
};

type Notice = {
  id:                string;
  notice_number:     string;
  notice_type:       string;
  tenant_name:       string;
  tenant_email?:     string;
  unit_name:         string;
  issued_at:         string;
  status:            string;
  response_deadline: string;
  ledger_hash:       string;
};

const NOTICE_TYPES = [
  { value: 'NOTICE_TO_PAY',    label: 'Notice to Pay',    deadline: '7-day deadline',  color: 'amber'  },
  { value: 'NOTICE_TO_QUIT',   label: 'Notice to Quit',   deadline: '30-day deadline', color: 'orange' },
  { value: 'FINAL_WARNING',    label: 'Final Warning',    deadline: '2-day deadline',  color: 'red'    },
  { value: 'EVICTION_WARNING', label: 'Eviction Warning', deadline: '30-day deadline', color: 'red'    },
];

const colorMap: Record<string, string> = {
  amber:  'border-amber-500/30 text-amber-400 bg-amber-500/10',
  orange: 'border-orange-500/30 text-orange-400 bg-orange-500/10',
  red:    'border-red-500/30 text-red-400 bg-red-500/10',
};

// ── Inner content — useSearchParams() is safe inside a Suspense boundary ─────
function LitigationCommandContent() {
  const { loading: authLoading } = useAuth();
  const searchParams  = useSearchParams();
  const preselectedId = searchParams.get('tenant') ?? '';

  const [tenancies,  setTenancies]  = useState<Tenancy[]>([]);
  const [loadingTen, setLoadingTen] = useState(true);
  const [tenErr,     setTenErr]     = useState('');

  const [notices,    setNotices]    = useState<Notice[]>([]);
  const [loadingNot, setLoadingNot] = useState(true);

  const [showForm,   setShowForm]   = useState(false);
  const [selTenancy, setSelTenancy] = useState(preselectedId);
  const [noticeType, setNoticeType] = useState('NOTICE_TO_PAY');
  const [amountOver, setAmountOver] = useState('');
  const [notes,      setNotes]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState('');
  const [submitted,  setSubmitted]  = useState<Notice | null>(null);

  // Load tenancies for dropdown
  useEffect(() => {
    if (authLoading) return;
    api.get('/api/landlord/tenancies/active')
      .then(r => {
        const rows: Tenancy[] = r.data.tenancies ?? r.data.rows ?? r.data ?? [];
        setTenancies(rows);
      })
      .catch(() => setTenErr('Could not load tenants. Please refresh.'))
      .finally(() => setLoadingTen(false));
  }, [authLoading]);

  // Pre-select tenant from ?tenant= URL param once tenancies load
  useEffect(() => {
    if (preselectedId && tenancies.length > 0) {
      const match = tenancies.find(t => t.tenancy_id === preselectedId);
      if (match) { setSelTenancy(preselectedId); setShowForm(true); }
    }
  }, [preselectedId, tenancies]);

  // Load notice history
  useEffect(() => {
    if (authLoading) return;
    api.get('/api/landlord/notices')
      .then(r => setNotices(r.data.notices ?? []))
      .catch(() => setNotices([]))
      .finally(() => setLoadingNot(false));
  }, [authLoading]);

  const handleIssue = async () => {
    if (!selTenancy || !noticeType) { setSubmitErr('Please select a tenant and notice type.'); return; }
    setSubmitting(true); setSubmitErr('');
    try {
      const r = await api.post('/api/notices/generate', {
        tenancy_id:     selTenancy,
        notice_type:    noticeType,
        amount_overdue: amountOver ? parseFloat(amountOver) : undefined,
        notes:          notes || undefined,
      });
      const issued  = r.data;
      const tenant  = tenancies.find(t => t.tenancy_id === selTenancy);
      const newNote: Notice = {
        id:                issued.notice_id,
        notice_number:     issued.notice_number,
        notice_type:       noticeType,
        tenant_name:       tenant?.tenant_name   ?? '',
        unit_name:         tenant?.unit_name     ?? '',
        tenant_email:      tenant?.tenant_email  ?? '',
        issued_at:         new Date().toISOString(),
        status:            'ISSUED',
        response_deadline: issued.deadline,
        ledger_hash:       issued.ledger_hash,
      };
      // Update state BEFORE any browser-native calls so UI is never blocked
      setSubmitted(newNote);
      setNotices(prev => [newNote, ...prev]);
      setShowForm(false);
      setSelTenancy(''); setNoticeType('NOTICE_TO_PAY'); setAmountOver(''); setNotes('');
      // PDF download is fire-and-forget — never allowed to throw into the outer catch
      if (issued.pdf_base64) {
        try {
          const byteArr = Uint8Array.from(atob(issued.pdf_base64), c => c.charCodeAt(0));
          const blob    = new Blob([byteArr], { type: 'application/pdf' });
          const url     = URL.createObjectURL(blob);
          const a       = document.createElement('a');
          a.href = url; a.download = `${issued.notice_number}.pdf`;
          document.body.appendChild(a); a.click();
          setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
        } catch { /* PDF download non-critical — notice already committed to ledger */ }
      }
    } catch (e: any) {
      setSubmitErr(e?.response?.data?.error ?? 'Failed to issue notice. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalNotices = notices.length;
  const servedCount  = notices.filter(n => n.status === 'SERVED').length;
  const issuedCount  = notices.filter(n => n.status === 'ISSUED').length;
  const projectCount = new Set(tenancies.map(t => t.project_number)).size || 1;

  if (authLoading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={28} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-6 py-10 w-full space-y-8">

        <Link href="/landlord/tenants"
          className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
          <ArrowLeft size={13} /> Tenants
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="border-l-2 border-red-500 pl-5">
            <p className="text-[9px] text-red-400 uppercase font-black tracking-[0.25em] mb-1">Landlord · Legal</p>
            <h1 className="text-2xl font-black uppercase tracking-tight">Litigation Command</h1>
            <p className="text-zinc-500 text-xs mt-1">Issue, track and download formal notices — SHA-256 ledgered</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setSubmitted(null); setSubmitErr(''); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 font-black text-[10px] uppercase tracking-wider rounded-xl hover:bg-red-500/20 transition-all flex-shrink-0"
          >
            <ShieldAlert size={13} /> Issue Notice
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Notices',   value: totalNotices },
            { label: 'Served',          value: servedCount  },
            { label: 'Overdue Tenants', value: issuedCount  },
            { label: 'Properties',      value: projectCount },
          ].map(s => (
            <div key={s.label} className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 text-center">
              <p className="text-2xl font-black font-mono text-white">{s.value}</p>
              <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Quick Issue</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {NOTICE_TYPES.map(nt => (
              <button key={nt.value}
                onClick={() => { setNoticeType(nt.value); setShowForm(true); setSubmitted(null); }}
                className={`p-3 rounded-xl border text-left transition-all hover:scale-[1.02] ${colorMap[nt.color]}`}
              >
                <p className="font-black text-xs uppercase tracking-tight">{nt.label}</p>
                <p className="text-[8px] mt-0.5 opacity-70">{nt.deadline}</p>
              </button>
            ))}
          </div>
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl p-7 w-full max-w-lg space-y-5 shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-contain">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-red-400 uppercase font-black tracking-widest mb-0.5">Litigation Command</p>
                  <h2 className="text-base font-black uppercase tracking-tight">Issue Legal Notice</h2>
                </div>
                <button onClick={() => setShowForm(false)}
                  className="p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600 transition-all">
                  <X size={14} />
                </button>
              </div>

              <div>
                <label className="block text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-2">
                  Select Tenant <span className="text-red-400">*</span>
                </label>
                {loadingTen ? (
                  <div className="flex items-center gap-2 text-zinc-600 text-xs py-3">
                    <Loader2 size={12} className="animate-spin" /> Loading tenants…
                  </div>
                ) : tenErr ? (
                  <p className="text-red-400 text-xs">{tenErr}</p>
                ) : tenancies.length === 0 ? (
                  <div className="p-3 rounded-xl border border-zinc-800 text-zinc-500 text-xs flex items-center gap-2">
                    <Building2 size={14} /> No active tenancies found. Onboard a tenant first.
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selTenancy}
                      onChange={e => setSelTenancy(e.target.value)}
                      className="w-full bg-[#050505] border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs appearance-none pr-8 focus:border-red-500/40 focus:outline-none"
                    >
                      <option value="">— Choose tenant —</option>
                      {tenancies.map(t => (
                        <option key={t.tenancy_id} value={t.tenancy_id}>
                          {t.tenant_name} · {t.unit_name} ({t.project_title})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  </div>
                )}
              </div>

              {selTenancy && (() => {
                const t = tenancies.find(x => x.tenancy_id === selTenancy);
                if (!t) return null;
                return (
                  <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/30 text-xs space-y-1">
                    <p className="font-bold text-white">{t.tenant_name}</p>
                    <p className="text-zinc-500">{t.unit_name} · {t.project_title}</p>
                    <p className="text-zinc-500">Rent: <span className="text-white font-mono">{t.currency || 'NGN'} {safeN(t.rent_amount).toLocaleString()}</span></p>
                    {t.next_due_date && (
                      <p className="text-zinc-500">Next due: <span className="text-amber-400">{new Date(t.next_due_date).toLocaleDateString('en-GB')}</span></p>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="block text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-2">
                  Notice Type <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {NOTICE_TYPES.map(nt => (
                    <button key={nt.value} type="button"
                      onClick={() => setNoticeType(nt.value)}
                      className={`p-3 rounded-xl border text-left transition-all ${noticeType === nt.value ? colorMap[nt.color] + ' ring-1 ring-current' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                    >
                      <p className="font-black text-[10px] uppercase tracking-tight">{nt.label}</p>
                      <p className="text-[8px] mt-0.5 opacity-70">{nt.deadline}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-2">
                  Amount Overdue (₦) — optional
                </label>
                <input type="number" value={amountOver} onChange={e => setAmountOver(e.target.value)}
                  placeholder="Leave blank to use rent amount"
                  className="w-full bg-[#050505] border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:border-red-500/40 focus:outline-none placeholder:text-zinc-700" />
              </div>

              <div>
                <label className="block text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-2">
                  Additional Notes (optional)
                </label>
                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional context for this notice…"
                  className="w-full bg-[#050505] border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs font-sans resize-none focus:border-red-500/40 focus:outline-none placeholder:text-zinc-700" />
              </div>

              <p className="text-[8px] text-zinc-600 text-center">⚖️ SHA-256 hashed · emailed as signed PDF · immutably ledgered</p>

              {submitErr && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs">
                  <AlertCircle size={12} /> {submitErr}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-zinc-800 rounded-xl text-zinc-500 text-xs font-bold uppercase tracking-wider hover:border-zinc-700 hover:text-white transition-all">
                  Cancel
                </button>
                <button onClick={handleIssue} disabled={submitting || !selTenancy}
                  className="flex-1 py-2.5 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {submitting
                    ? <><Loader2 size={12} className="animate-spin" /> Issuing…</>
                    : <><ShieldAlert size={12} /> Issue Notice</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {submitted && (
          <div className="p-5 rounded-2xl border border-teal-500/30 bg-teal-500/5 space-y-4 shadow-lg">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={18} className="text-teal-400" />
              </div>
              <div>
                <p className="font-black text-sm text-teal-400 uppercase tracking-tight">Notice Issued Successfully</p>
                <p className="text-[9px] text-zinc-500 mt-0.5">Committed to the immutable ledger · SHA-256 hashed</p>
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <p className="text-zinc-600 uppercase font-bold text-[7px] tracking-widest mb-1">Notice Number</p>
                <p className="text-white font-mono text-[10px]">{submitted.notice_number}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <p className="text-zinc-600 uppercase font-bold text-[7px] tracking-widest mb-1">Response Deadline</p>
                <p className="text-amber-400 text-[10px]">{submitted.response_deadline}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <p className="text-zinc-600 uppercase font-bold text-[7px] tracking-widest mb-1">Served To</p>
                <p className="text-white text-[10px]">{submitted.tenant_name}</p>
                {submitted.tenant_email && (
                  <p className="text-zinc-500 text-[9px] mt-0.5 truncate">{submitted.tenant_email}</p>
                )}
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <p className="text-zinc-600 uppercase font-bold text-[7px] tracking-widest mb-1">Property Unit</p>
                <p className="text-white text-[10px]">{submitted.unit_name}</p>
              </div>
            </div>

            {/* Email sent confirmation */}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20">
              <CheckCircle size={11} className="text-teal-400 flex-shrink-0" />
              <p className="text-[10px] text-teal-300">
                Signed PDF notice emailed to <span className="font-bold">{submitted.tenant_email || submitted.tenant_name}</span> and recorded on the Nested Ark immutable ledger.
              </p>
            </div>

            {/* Ledger hash */}
            <div className="flex items-start gap-2 pt-1 border-t border-teal-500/20">
              <Hash size={10} className="text-teal-500 mt-0.5 flex-shrink-0" />
              <p className="font-mono text-[8px] text-zinc-600 break-all">{submitted.ledger_hash}</p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setSubmitted(null); setShowForm(true); }}
                className="flex-1 py-2 rounded-xl border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 text-[9px] font-bold uppercase tracking-wider transition-all">
                Issue Another
              </button>
              <Link href="/landlord/tenants"
                className="flex-1 py-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20 text-[9px] font-bold uppercase tracking-wider transition-all text-center">
                ← Back to Tenants
              </Link>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Notice History ({totalNotices})</p>

          {loadingNot ? (
            <div className="flex items-center gap-2 text-zinc-600 text-xs py-6 justify-center">
              <Loader2 size={14} className="animate-spin" /> Loading notices…
            </div>
          ) : notices.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-zinc-800 rounded-2xl space-y-3">
              <FileText className="text-zinc-700 mx-auto" size={28} />
              <p className="text-zinc-500 text-xs font-bold">No notices issued yet</p>
              <p className="text-zinc-700 text-[10px]">Notices appear here once issued. Each is SHA-256 hashed and court-admissible.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notices.map(n => {
                const nt = NOTICE_TYPES.find(x => x.value === n.notice_type);
                return (
                  <div key={n.id}
                    className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800 bg-zinc-900/10 hover:border-zinc-700 transition-all">
                    <div className="flex items-center gap-4">
                      <span className={`text-[8px] px-2 py-1 rounded border font-black uppercase ${nt ? colorMap[nt.color] : 'border-zinc-700 text-zinc-500'}`}>
                        {nt?.label ?? n.notice_type}
                      </span>
                      <div>
                        <p className="font-bold text-xs text-white">{n.tenant_name} · {n.unit_name}</p>
                        <p className="text-[9px] text-zinc-600 font-mono mt-0.5">{n.notice_number} · Due {n.response_deadline}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${n.status === 'SERVED' ? 'border-teal-500/30 text-teal-400' : 'border-amber-500/30 text-amber-400'}`}>
                        {n.status}
                      </span>
                      <p className="text-[8px] text-zinc-700 mt-1">{new Date(n.issued_at).toLocaleDateString('en-GB')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-6 justify-center pt-4 border-t border-zinc-900">
          {['SHA-256 Hashed', 'Court-Admissible PDF', 'Immutable Ledger'].map(s => (
            <p key={s} className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s}</p>
          ))}
        </div>

      </main>
      <Footer />
    </div>
  );
}

// ── Export: Suspense boundary required by Next.js for useSearchParams() ───────
export default function LandlordNoticesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
    }>
      <LitigationCommandContent />
    </Suspense>
  );
}
