'use client';
/**
 * apps/frontend/src/app/landlord/receipts/page.tsx
 *
 * Behaviour:
 *   ?tenancy_id=<id>     → fetch THIS tenant's contributions and display directly (NO redirect)
 *   0 projects           → prompt to submit first project
 *   1 project, no param  → redirect to project rental-management?tab=receipts
 *   2+ projects, no param → project picker
 *
 * Backend endpoint for tenant receipts:
 *   GET /api/flex-pay/contributions/:tenancyId
 *   → { success: true, contributions: [ { id, amount_ngn, period_label,
 *       paid_at, ledger_hash, status, paystack_ref } ] }
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

// Matches /api/flex-pay/contributions/:tenancyId response rows
interface Contribution {
  id: string;
  amount_ngn: number;
  period_label: string;
  paid_at: string;
  ledger_hash: string;
  status: string;
  paystack_ref?: string;
}

// ── Inner component — useSearchParams() requires Suspense boundary ────────────
function LandlordReceiptsContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const tenancyId    = searchParams.get('tenancy_id') ?? '';

  const { loading: authLoading } = useAuth();

  const [projects,      setProjects]      = useState<Project[]>([]);
  const [loadingProj,   setLoadingProj]   = useState(true);

  // Tenant-scoped receipt state
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [tenantLabel,   setTenantLabel]   = useState('');
  const [loadingRec,    setLoadingRec]    = useState(false);
  const [receiptsErr,   setReceiptsErr]   = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // ── Load projects (resolves redirect / picker logic) ─────────────────────
  useEffect(() => {
    if (authLoading) return;
    api.get('/api/projects/my')
      .then(res => {
        const list: Project[] = res.data.projects ?? [];
        setProjects(list);
        // Only auto-redirect when no tenancy_id is in the URL AND exactly 1 project
        if (!tenancyId && list.length === 1) {
          router.replace(`/projects/${list[0].id}/rental-management?tab=receipts`);
        }
      })
      .catch(() => setProjects([]))
      .finally(() => setLoadingProj(false));
  }, [authLoading, router, tenancyId]);

  // ── Fetch contributions for the specific tenant ───────────────────────────
  useEffect(() => {
    if (!tenancyId || authLoading) return;
    setLoadingRec(true);
    setReceiptsErr('');
    // GET /api/flex-pay/contributions/:tenancyId
    api.get(`/api/flex-pay/contributions/${tenancyId}`)
      .then(r => {
        const rows: Contribution[] = r.data?.contributions ?? [];
        setContributions(rows);
        // Also try to pull a display name from the tenancies active endpoint
        api.get('/api/landlord/tenancies/active')
          .then(tr => {
            const tenancies: any[] = tr.data?.tenancies ?? tr.data?.rows ?? [];
            const match = tenancies.find((t: any) => t.tenancy_id === tenancyId);
            if (match) setTenantLabel(`${match.tenant_name} · ${match.unit_name}`);
          })
          .catch(() => {}); // label is non-critical
      })
      .catch(e => {
        const status = e?.response?.status;
        if (status && status !== 404) {
          setReceiptsErr(e?.response?.data?.error ?? 'Could not load receipts.');
        } else {
          setContributions([]); // 404 = no payments yet
        }
      })
      .finally(() => setLoadingRec(false));
  }, [tenancyId, authLoading]);

  // ── Download individual receipt PDF/HTML from backend ────────────────────
  const handleDownloadReceipt = async (contributionId: string, paystackRef: string) => {
    try {
      setDownloadingId(contributionId);
      const res = await api.get(`/api/flex-pay/receipt/${contributionId}`, {
        responseType: 'blob',
      });
      const contentType = res.headers['content-type'] ?? 'application/pdf';
      const ext  = contentType.includes('pdf') ? 'pdf' : 'html';
      const blob = new Blob([res.data], { type: contentType });
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `ARK-Receipt-${paystackRef || contributionId.slice(0, 8)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 200);
    } catch {
      /* Non-critical — receipt may not yet exist if puppeteer unavailable on server */
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Shared loading state ──────────────────────────────────────────────────
  if (authLoading || loadingProj) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={28} />
    </div>
  );

  // ── TENANT-SCOPED VIEW — when ?tenancy_id= is present ────────────────────
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
                {tenantLabel ? `${tenantLabel}` : 'Tenant Receipts'}
              </h1>
              <p className="text-zinc-600 text-xs mt-0.5">
                Flex-Pay contributions · SHA-256 ledgered
              </p>
            </div>
          </div>

          {/* Error */}
          {receiptsErr && (
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/30 bg-red-500/5 text-red-400 text-xs">
              <AlertCircle size={14} className="shrink-0" /> {receiptsErr}
            </div>
          )}

          {/* Loading */}
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
              {contributions.map(c => (
                <div key={c.id}
                  className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800 bg-zinc-900/10 hover:border-zinc-700 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Receipt size={14} className="text-amber-400" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-bold text-xs text-white">
                        {c.period_label || new Date(c.paid_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-[9px] text-zinc-500 font-mono">
                        {new Date(c.paid_at).toLocaleDateString('en-GB')}
                        {c.paystack_ref && <> · ref: {c.paystack_ref.slice(0, 16)}…</>}
                      </p>
                      {c.ledger_hash && (
                        <p className="text-[8px] text-zinc-700 font-mono flex items-center gap-1 truncate max-w-[220px]">
                          <Hash size={8} className="shrink-0" />{c.ledger_hash.slice(0, 28)}…
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

          {/* Ledger trust badges */}
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
              Submit your first property project to start seeing rent receipts and payment history.
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

  // ── 1 PROJECT — spinner while router.replace fires ────────────────────────
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
          {projects.map(p => (
            <Link key={p.id} href={`/projects/${p.id}/rental-management?tab=receipts`}
              className="flex items-center justify-between p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 group-hover:border-amber-500/30">
                  <Receipt size={16} className="text-amber-400" />
                </div>
                <div>
                  <p className="font-bold text-sm uppercase tracking-tight">{p.title}</p>
                  <p className="text-[9px] text-zinc-500 mt-0.5">{p.project_number} · {p.location}, {p.country}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${
                  p.status === 'ACTIVE' ? 'border-teal-500/40 text-teal-500' : 'border-zinc-700 text-zinc-500'
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

// ── Export with Suspense boundary ─────────────────────────────────────────────
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
