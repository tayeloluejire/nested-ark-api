'use client';
export const dynamic = 'force-dynamic';
/**
 * apps/frontend/src/app/landlord/receipts/page.tsx
 *
 * Behaviour:
 *   ?tenancy_id=<id>      → fetch THIS tenant's contributions, display directly (NO redirect)
 *   0 projects            → prompt to submit first project
 *   1 project, no param   → redirect to project rental-management?tab=receipts
 *   2+ projects, no param → project picker
 */
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import {
  Receipt, Building2, Loader2, Plus, ChevronRight,
  ArrowLeft, Hash, AlertCircle, Download, X, PenLine,
} from 'lucide-react';

const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();

interface Project {
  id: string; project_number: string; title: string;
  location: string; country: string; status: string;
}

interface Contribution {
  id: string;
  amount_ngn: number;
  period_label: string;
  paid_at: string;
  ledger_hash: string;
  status: string;
  paystack_ref: string;       // coerced to '' on ingest if absent
  payment_channel?: string;   // FLEX_PAY | MANUAL_ENTRY | BANK_TRANSFER | CASH etc.
  notes?: string;
}

interface ManualLogForm {
  amount_ngn: string;
  period_label: string;
  paid_at: string;
  payment_channel: string;
  notes: string;
}

function LandlordReceiptsContent() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const tenancyId     = searchParams.get('tenancy_id') ?? '';

  const { loading: authLoading } = useAuth();

  const [projects,      setProjects]      = useState<Project[]>([]);
  const [loadingProj,   setLoadingProj]   = useState(true);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [tenantLabel,   setTenantLabel]   = useState<string>('');
  const [loadingRec,    setLoadingRec]    = useState(false);
  const [receiptsErr,   setReceiptsErr]   = useState<string>('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // ── Manual log modal state ────────────────────────────────────────────────
  const [showLogModal,  setShowLogModal]  = useState(false);
  const [logForm,       setLogForm]       = useState<ManualLogForm>({
    amount_ngn: '', period_label: '', paid_at: '', payment_channel: 'CASH', notes: '',
  });
  const [logSaving,     setLogSaving]     = useState(false);
  const [logErr,        setLogErr]        = useState('');

  // ── Load projects (redirect / picker logic) ───────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    api.get('/api/projects/my')
      .then(res => {
        const list: Project[] = res.data.projects ?? [];
        setProjects(list);
        // Only auto-redirect when no tenancy_id param AND exactly 1 project
        if (!tenancyId && list.length === 1) {
          router.replace(`/projects/${list[0].id}/rental-management?tab=receipts`);
        }
      })
      .catch(() => setProjects([]))
      .finally(() => setLoadingProj(false));
  }, [authLoading, router, tenancyId]);

  // ── Fetch this tenant's contributions ────────────────────────────────────
  const fetchContributions = () => {
    if (!tenancyId || authLoading) return;
    setLoadingRec(true);
    setReceiptsErr('');
    api.get(`/api/flex-pay/contributions/${tenancyId}`)
      .then(r => {
        const rows: Contribution[] = (r.data?.contributions ?? []).map((c: any) => ({
          ...c,
          paystack_ref: String(c.paystack_ref ?? ''),
          payment_channel: c.payment_channel ?? 'FLEX_PAY',
        }));
        setContributions(rows);
        api.get('/api/landlord/tenancies/active')
          .then(tr => {
            const list: any[] = tr.data?.tenancies ?? tr.data?.rows ?? [];
            const match = list.find((t: any) => String(t.tenancy_id) === tenancyId);
            if (match) {
              setTenantLabel(
                String(match.tenant_name ?? '') + ' · ' + String(match.unit_name ?? '')
              );
            }
          })
          .catch(() => {});
      })
      .catch((e: any) => {
        const status: number | undefined = e?.response?.status;
        if (status && status !== 404) {
          setReceiptsErr(e?.response?.data?.error ?? 'Could not load receipts.');
        } else {
          setContributions([]);
        }
      })
      .finally(() => setLoadingRec(false));
  };

  useEffect(() => { fetchContributions(); }, [tenancyId, authLoading]);

  // ── Download receipt PDF/HTML ─────────────────────────────────────────────
  const handleDownloadReceipt = async (contributionId: string, paystackRef: string): Promise<void> => {
    try {
      setDownloadingId(contributionId);
      const res = await api.get(`/api/flex-pay/receipt/${contributionId}`, {
        responseType: 'blob',
      });
      const contentType: string = res.headers['content-type'] ?? 'application/pdf';
      const ext  = contentType.includes('pdf') ? 'pdf' : 'html';
      const blob = new Blob([res.data as BlobPart], { type: contentType });
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `ARK-Receipt-${paystackRef || contributionId.slice(0, 8)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 200);
    } catch (_err) {
      // Non-critical
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Submit manual log ─────────────────────────────────────────────────────
  const handleManualLog = async () => {
    setLogErr('');
    if (!logForm.amount_ngn || !logForm.period_label || !logForm.paid_at) {
      setLogErr('Amount, period, and date paid are required.');
      return;
    }
    setLogSaving(true);
    try {
      await api.post('/api/flex-pay/manual-log', {
        tenancy_id:      tenancyId,
        amount_ngn:      parseFloat(logForm.amount_ngn),
        period_label:    logForm.period_label,
        paid_at:         logForm.paid_at,
        payment_channel: logForm.payment_channel,
        notes:           logForm.notes,
      });
      setShowLogModal(false);
      setLogForm({ amount_ngn: '', period_label: '', paid_at: '', payment_channel: 'CASH', notes: '' });
      fetchContributions(); // refresh ledger
    } catch (e: any) {
      setLogErr(e?.response?.data?.error ?? 'Could not save receipt. Try again.');
    } finally {
      setLogSaving(false);
    }
  };

  // ── Loading spinner ───────────────────────────────────────────────────────
  if (authLoading || loadingProj) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={28} />
    </div>
  );

  // ── Channel badge helper ─────────────────────────────────────────────────
  const channelBadge = (channel: string | undefined) => {
    switch (channel) {
      case 'MANUAL_ENTRY':
      case 'CASH':
      case 'BANK_TRANSFER':
      case 'CHEQUE':
        return (
          <span className="text-[7px] px-1.5 py-0.5 rounded border border-purple-500/30 text-purple-400 font-bold uppercase">
            {channel?.replace('_', ' ') ?? 'OFFLINE'}
          </span>
        );
      default:
        return null; // FLEX_PAY entries need no badge — status badge already shows
    }
  };

  // ── TENANT-SCOPED VIEW ────────────────────────────────────────────────────
  if (tenancyId) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-2xl mx-auto px-6 py-12 w-full space-y-8">

          {/* Header */}
          <div>
            <Link href="/landlord/tenants"
              className="text-zinc-500 text-xs uppercase font-bold flex items-center gap-2 mb-5 hover:text-white transition-colors">
              <ArrowLeft size={14} /> Back to Tenants
            </Link>
            <div className="border-l-2 border-amber-500 pl-5">
              <p className="text-[9px] text-amber-400 uppercase font-black tracking-[0.25em] mb-1">
                Payment Ledger
              </p>
              <h1 className="text-2xl font-black uppercase tracking-tight">
                {tenantLabel || 'Tenant Receipts'}
              </h1>
              <p className="text-zinc-600 text-xs mt-0.5">
                Flex-Pay contributions · SHA-256 ledgered
              </p>
            </div>
          </div>

          {/* Error banner */}
          {receiptsErr && (
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/30 bg-red-500/5 text-red-400 text-xs">
              <AlertCircle size={14} className="shrink-0" /> {receiptsErr}
            </div>
          )}

          {/* Body */}
          {loadingRec ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="animate-spin text-amber-500" size={22} />
            </div>

          ) : contributions.length === 0 ? (
            /* ── Enhanced empty state with manual log CTA ── */
            <div className="py-14 text-center border border-dashed border-zinc-800 rounded-3xl space-y-4">
              <Receipt className="text-zinc-700 mx-auto" size={28} />
              <p className="text-zinc-500 text-xs font-black uppercase">No Digital Vault Payments Yet</p>
              <p className="text-zinc-700 text-[10px] max-w-xs mx-auto leading-relaxed">
                Automated records appear here once the tenant pays via their Flex-Pay vault.
                If they have paid cash, bank transfer, or any offline channel, log it below.
              </p>
              <div className="pt-1">
                <button
                  onClick={() => setShowLogModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-900 border border-zinc-700 text-amber-400 hover:text-amber-300 hover:border-amber-500/40 rounded-xl text-xs font-bold transition-all"
                >
                  <PenLine size={12} /> Log Past / Offline Receipt
                </button>
              </div>
            </div>

          ) : (
            <div className="space-y-2">
              {/* Log button even when payments exist */}
              <div className="flex justify-end mb-1">
                <button
                  onClick={() => setShowLogModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-amber-400 hover:border-amber-500/40 rounded-lg text-[9px] font-bold uppercase transition-all"
                >
                  <PenLine size={10} /> Log Offline Receipt
                </button>
              </div>

              {contributions.map((c: Contribution) => (
                <div key={c.id}
                  className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800 bg-zinc-900/10 hover:border-zinc-700 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Receipt size={14} className="text-amber-400" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-bold text-xs text-white">
                        {c.period_label ||
                          new Date(c.paid_at).toLocaleDateString('en-GB', {
                            month: 'long', year: 'numeric',
                          })}
                      </p>
                      <p className="text-[9px] text-zinc-500 font-mono">
                        {c.paid_at ? new Date(c.paid_at).toLocaleDateString('en-GB') : '—'}
                        {c.paystack_ref && <> · ref: {c.paystack_ref.slice(0, 16)}…</>}
                      </p>
                      {c.ledger_hash && (
                        <p className="text-[8px] text-zinc-700 font-mono flex items-center gap-1 truncate max-w-[220px]">
                          <Hash size={8} className="shrink-0" />
                          {c.ledger_hash.slice(0, 28)}…
                        </p>
                      )}
                      {c.notes && (
                        <p className="text-[8px] text-zinc-600 italic">{c.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <p className="font-black text-sm text-white">
                      NGN {safeF(c.amount_ngn)}
                    </p>
                    <div className="flex items-center justify-end gap-1">
                      <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${
                        c.status === 'SUCCESS'
                          ? 'border-teal-500/30 text-teal-400'
                          : c.status === 'MANUAL_ENTRY'
                          ? 'border-purple-500/30 text-purple-400'
                          : c.status === 'PENDING'
                          ? 'border-amber-500/30 text-amber-400'
                          : 'border-zinc-700 text-zinc-500'
                      }`}>
                        {c.status}
                      </span>
                      {channelBadge(c.payment_channel)}
                    </div>
                    {c.status !== 'MANUAL_ENTRY' && (
                      <div>
                        <button
                          onClick={() => handleDownloadReceipt(c.id, c.paystack_ref)}
                          disabled={downloadingId === c.id}
                          className="mt-1 flex items-center gap-1 text-[8px] font-bold uppercase text-amber-400 border border-amber-500/20 px-2 py-1 rounded-lg hover:bg-amber-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {downloadingId === c.id
                            ? <><Loader2 size={9} className="animate-spin" /> Generating…</>
                            : <><Download size={9} /> Receipt</>
                          }
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Trust badges */}
          <div className="flex items-center gap-6 justify-center pt-4 border-t border-zinc-900">
            {['SHA-256 Hashed', 'Paystack Verified', 'Immutable Ledger'].map(s => (
              <p key={s} className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s}</p>
            ))}
          </div>
        </main>
        <Footer />

        {/* ── Manual Receipt Log Modal ────────────────────────────────────── */}
        {showLogModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4">
            <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-5">
              {/* Modal header */}
              <div className="flex items-start justify-between">
                <div className="border-l-2 border-purple-500 pl-4">
                  <p className="text-[9px] text-purple-400 uppercase font-black tracking-[0.2em]">Offline Record</p>
                  <h2 className="text-base font-black uppercase tracking-tight">Log Past Receipt</h2>
                  <p className="text-zinc-600 text-[10px] mt-0.5">SHA-256 hashed · appended to immutable ledger</p>
                </div>
                <button onClick={() => { setShowLogModal(false); setLogErr(''); }}
                  className="text-zinc-600 hover:text-white transition-colors mt-1">
                  <X size={16} />
                </button>
              </div>

              {/* Form fields */}
              <div className="space-y-3">
                {/* Amount */}
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block mb-1">
                    Amount (NGN) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 150000"
                    value={logForm.amount_ngn}
                    onChange={e => setLogForm(f => ({ ...f, amount_ngn: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-amber-500/50 transition-colors"
                  />
                </div>

                {/* Period label */}
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block mb-1">
                    Period / Month <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. January 2025"
                    value={logForm.period_label}
                    onChange={e => setLogForm(f => ({ ...f, period_label: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-amber-500/50 transition-colors"
                  />
                </div>

                {/* Date paid */}
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block mb-1">
                    Date Paid <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={logForm.paid_at}
                    onChange={e => setLogForm(f => ({ ...f, paid_at: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                  />
                </div>

                {/* Payment channel */}
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block mb-1">
                    Payment Method
                  </label>
                  <select
                    value={logForm.payment_channel}
                    onChange={e => setLogForm(f => ({ ...f, payment_channel: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Paid via GTB transfer, confirmed by teller slip"
                    value={logForm.notes}
                    onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-700 resize-none focus:outline-none focus:border-amber-500/50 transition-colors"
                  />
                </div>
              </div>

              {/* Error */}
              {logErr && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/5 text-red-400 text-xs">
                  <AlertCircle size={12} className="shrink-0" /> {logErr}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setShowLogModal(false); setLogErr(''); }}
                  className="flex-1 py-2.5 border border-zinc-800 rounded-xl text-zinc-500 text-xs font-bold uppercase hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleManualLog}
                  disabled={logSaving}
                  className="flex-1 py-2.5 bg-amber-500 text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {logSaving ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : 'Save to Ledger'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── NO PROJECTS ───────────────────────────────────────────────────────────
  if (projects.length === 0) return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto">
            <Building2 size={28} className="text-zinc-600" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">No Projects Yet</h1>
            <p className="text-zinc-500 text-sm mt-2">
              Submit your first property project to start seeing rent receipts.
            </p>
          </div>
          <Link href="/projects/submit"
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all">
            <Plus size={13} /> Submit Your First Project
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );

  // ── 1 PROJECT — spinner while redirect fires ──────────────────────────────
  if (projects.length === 1) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={28} />
    </div>
  );

  // ── MULTI-PROJECT PICKER ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto px-6 py-12 w-full space-y-8">
        <div className="border-l-2 border-amber-500 pl-5">
          <p className="text-[9px] text-amber-400 uppercase font-black tracking-[0.25em] mb-1">Payment Ledger</p>
          <h1 className="text-2xl font-black uppercase tracking-tight">Receipts &amp; Ledger</h1>
          <p className="text-zinc-500 text-sm mt-1">Select the property whose payment history you want to view</p>
        </div>
        <div className="space-y-3">
          {projects.map((p: Project) => (
            <Link key={p.id}
              href={`/projects/${p.id}/rental-management?tab=receipts`}
              className="flex items-center justify-between p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 group-hover:border-amber-500/30">
                  <Receipt size={16} className="text-amber-400" />
                </div>
                <div>
                  <p className="font-bold text-sm uppercase tracking-tight">{p.title}</p>
                  <p className="text-[9px] text-zinc-500 mt-0.5">
                    {p.project_number} · {p.location}, {p.country}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${
                  p.status === 'ACTIVE'
                    ? 'border-teal-500/40 text-teal-500'
                    : 'border-zinc-700 text-zinc-500'
                }`}>{p.status}</span>
                <ChevronRight size={16} className="text-zinc-600 group-hover:text-amber-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ── Suspense boundary (required for useSearchParams in Next.js App Router) ────
export default function LandlordReceiptsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
    }>
      <LandlordReceiptsContent />
    </Suspense>
  );
}
/**
 * apps/frontend/src/app/landlord/receipts/page.tsx
 *
 * Behaviour:
 *   ?tenancy_id=<id>      → fetch THIS tenant's contributions, display directly (NO redirect)
 *   0 projects            → prompt to submit first project
 *   1 project, no param   → redirect to project rental-management?tab=receipts
 *   2+ projects, no param → project picker
 */
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import {
  Receipt, Building2, Loader2, Plus, ChevronRight,
  ArrowLeft, Hash, AlertCircle, Download,
} from 'lucide-react';

const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();

interface Project {
  id: string; project_number: string; title: string;
  location: string; country: string; status: string;
}

interface Contribution {
  id: string;
  amount_ngn: number;
  period_label: string;
  paid_at: string;
  ledger_hash: string;
  status: string;
  paystack_ref: string; // non-optional — coerced to '' on ingest if absent
}

function LandlordReceiptsContent() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const tenancyId     = searchParams.get('tenancy_id') ?? '';

  const { loading: authLoading } = useAuth();

  const [projects,      setProjects]      = useState<Project[]>([]);
  const [loadingProj,   setLoadingProj]   = useState(true);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [tenantLabel,   setTenantLabel]   = useState<string>('');
  const [loadingRec,    setLoadingRec]    = useState(false);
  const [receiptsErr,   setReceiptsErr]   = useState<string>('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // ── Load projects (redirect / picker logic) ───────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    api.get('/api/projects/my')
      .then(res => {
        const list: Project[] = res.data.projects ?? [];
        setProjects(list);
        // Only auto-redirect when no tenancy_id param AND exactly 1 project
        if (!tenancyId && list.length === 1) {
          router.replace(`/projects/${list[0].id}/rental-management?tab=receipts`);
        }
      })
      .catch(() => setProjects([]))
      .finally(() => setLoadingProj(false));
  }, [authLoading, router, tenancyId]);

  // ── Fetch this tenant's contributions ────────────────────────────────────
  useEffect(() => {
    if (!tenancyId || authLoading) return;
    setLoadingRec(true);
    setReceiptsErr('');
    api.get(`/api/flex-pay/contributions/${tenancyId}`)
      .then(r => {
        // Normalise paystack_ref to string so the interface stays non-optional
        const rows: Contribution[] = (r.data?.contributions ?? []).map((c: any) => ({
          ...c,
          paystack_ref: String(c.paystack_ref ?? ''),
        }));
        setContributions(rows);
        // Resolve tenant display label — non-critical, fails silently
        api.get('/api/landlord/tenancies/active')
          .then(tr => {
            const list: any[] = tr.data?.tenancies ?? tr.data?.rows ?? [];
            const match = list.find((t: any) => String(t.tenancy_id) === tenancyId);
            if (match) {
              setTenantLabel(
                String(match.tenant_name ?? '') + ' · ' + String(match.unit_name ?? '')
              );
            }
          })
          .catch(() => {});
      })
      .catch((e: any) => {
        const status: number | undefined = e?.response?.status;
        if (status && status !== 404) {
          setReceiptsErr(e?.response?.data?.error ?? 'Could not load receipts.');
        } else {
          setContributions([]); // 404 = no payments yet
        }
      })
      .finally(() => setLoadingRec(false));
  }, [tenancyId, authLoading]);

  // ── Download receipt PDF/HTML ─────────────────────────────────────────────
  const handleDownloadReceipt = async (contributionId: string, paystackRef: string): Promise<void> => {
    try {
      setDownloadingId(contributionId);
      const res = await api.get(`/api/flex-pay/receipt/${contributionId}`, {
        responseType: 'blob',
      });
      const contentType: string = res.headers['content-type'] ?? 'application/pdf';
      const ext  = contentType.includes('pdf') ? 'pdf' : 'html';
      const blob = new Blob([res.data as BlobPart], { type: contentType });
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `ARK-Receipt-${paystackRef || contributionId.slice(0, 8)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 200);
    } catch (_err) {
      // Non-critical — receipt generation may be unavailable
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Loading spinner ───────────────────────────────────────────────────────
  if (authLoading || loadingProj) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={28} />
    </div>
  );

  // ── TENANT-SCOPED VIEW ────────────────────────────────────────────────────
  if (tenancyId) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-2xl mx-auto px-6 py-12 w-full space-y-8">

          {/* Header */}
          <div>
            <Link href="/landlord/tenants"
              className="text-zinc-500 text-xs uppercase font-bold flex items-center gap-2 mb-5 hover:text-white transition-colors">
              <ArrowLeft size={14} /> Back to Tenants
            </Link>
            <div className="border-l-2 border-amber-500 pl-5">
              <p className="text-[9px] text-amber-400 uppercase font-black tracking-[0.25em] mb-1">
                Payment Ledger
              </p>
              <h1 className="text-2xl font-black uppercase tracking-tight">
                {tenantLabel || 'Tenant Receipts'}
              </h1>
              <p className="text-zinc-600 text-xs mt-0.5">
                Flex-Pay contributions · SHA-256 ledgered
              </p>
            </div>
          </div>

          {/* Error banner */}
          {receiptsErr && (
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/30 bg-red-500/5 text-red-400 text-xs">
              <AlertCircle size={14} className="shrink-0" /> {receiptsErr}
            </div>
          )}

          {/* Body */}
          {loadingRec ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="animate-spin text-amber-500" size={22} />
            </div>

          ) : contributions.length === 0 ? (
            <div className="py-14 text-center border border-dashed border-zinc-800 rounded-3xl space-y-3">
              <Receipt className="text-zinc-700 mx-auto" size={28} />
              <p className="text-zinc-500 text-xs font-black uppercase">No payments yet</p>
              <p className="text-zinc-700 text-[10px]">
                Rent contributions will appear here once this tenant pays through their Flex-Pay vault.
              </p>
            </div>

          ) : (
            <div className="space-y-2">
              {contributions.map((c: Contribution) => (
                <div key={c.id}
                  className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800 bg-zinc-900/10 hover:border-zinc-700 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Receipt size={14} className="text-amber-400" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-bold text-xs text-white">
                        {c.period_label ||
                          new Date(c.paid_at).toLocaleDateString('en-GB', {
                            month: 'long', year: 'numeric',
                          })}
                      </p>
                      <p className="text-[9px] text-zinc-500 font-mono">
                        {new Date(c.paid_at).toLocaleDateString('en-GB')}
                        {c.paystack_ref && <> · ref: {c.paystack_ref.slice(0, 16)}…</>}
                      </p>
                      {c.ledger_hash && (
                        <p className="text-[8px] text-zinc-700 font-mono flex items-center gap-1 truncate max-w-[220px]">
                          <Hash size={8} className="shrink-0" />
                          {c.ledger_hash.slice(0, 28)}…
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <p className="font-black text-sm text-white">
                      NGN {safeF(c.amount_ngn)}
                    </p>
                    <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${
                      c.status === 'SUCCESS'
                        ? 'border-teal-500/30 text-teal-400'
                        : c.status === 'PENDING'
                        ? 'border-amber-500/30 text-amber-400'
                        : 'border-zinc-700 text-zinc-500'
                    }`}>
                      {c.status}
                    </span>
                    <div>
                      <button
                        onClick={() => handleDownloadReceipt(c.id, c.paystack_ref)}
                        disabled={downloadingId === c.id}
                        className="mt-1 flex items-center gap-1 text-[8px] font-bold uppercase text-amber-400 border border-amber-500/20 px-2 py-1 rounded-lg hover:bg-amber-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {downloadingId === c.id
                          ? <><Loader2 size={9} className="animate-spin" /> Generating…</>
                          : <><Download size={9} /> Receipt</>
                        }
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Trust badges */}
          <div className="flex items-center gap-6 justify-center pt-4 border-t border-zinc-900">
            {['SHA-256 Hashed', 'Paystack Verified', 'Immutable Ledger'].map(s => (
              <p key={s} className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s}</p>
            ))}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── NO PROJECTS ───────────────────────────────────────────────────────────
  if (projects.length === 0) return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto">
            <Building2 size={28} className="text-zinc-600" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">No Projects Yet</h1>
            <p className="text-zinc-500 text-sm mt-2">
              Submit your first property project to start seeing rent receipts.
            </p>
          </div>
          <Link href="/projects/submit"
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all">
            <Plus size={13} /> Submit Your First Project
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );

  // ── 1 PROJECT — spinner while redirect fires ──────────────────────────────
  if (projects.length === 1) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={28} />
    </div>
  );

  // ── MULTI-PROJECT PICKER ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto px-6 py-12 w-full space-y-8">
        <div className="border-l-2 border-amber-500 pl-5">
          <p className="text-[9px] text-amber-400 uppercase font-black tracking-[0.25em] mb-1">Payment Ledger</p>
          <h1 className="text-2xl font-black uppercase tracking-tight">Receipts &amp; Ledger</h1>
          <p className="text-zinc-500 text-sm mt-1">Select the property whose payment history you want to view</p>
        </div>
        <div className="space-y-3">
          {projects.map((p: Project) => (
            <Link key={p.id}
              href={`/projects/${p.id}/rental-management?tab=receipts`}
              className="flex items-center justify-between p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 group-hover:border-amber-500/30">
                  <Receipt size={16} className="text-amber-400" />
                </div>
                <div>
                  <p className="font-bold text-sm uppercase tracking-tight">{p.title}</p>
                  <p className="text-[9px] text-zinc-500 mt-0.5">
                    {p.project_number} · {p.location}, {p.country}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${
                  p.status === 'ACTIVE'
                    ? 'border-teal-500/40 text-teal-500'
                    : 'border-zinc-700 text-zinc-500'
                }`}>{p.status}</span>
                <ChevronRight size={16} className="text-zinc-600 group-hover:text-amber-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ── Suspense boundary (required for useSearchParams in Next.js App Router) ────
export default function LandlordReceiptsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
    }>
      <LandlordReceiptsContent />
    </Suspense>
  );
}
