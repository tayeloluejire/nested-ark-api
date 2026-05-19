'use client';
/**
 * /landlord/receipts
 * 
 * Behaviour:
 *   ?tenancy_id=<id>  → show that specific tenant's receipts directly (NO redirect)
 *   0 projects        → prompt to submit
 *   1 project, no tenancy_id → show that project's receipts directly (no redirect)
 *   2+ projects, no tenancy_id → project picker
 */
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { Receipt, Building2, Loader2, Plus, ChevronRight, ArrowLeft, Hash, User } from 'lucide-react';

const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();

interface Project {
  id: string; project_number: string; title: string;
  location: string; country: string; status: string;
}

interface RentReceipt {
  id: string;
  receipt_number: string;
  tenant_name: string;
  unit_name?: string;
  amount: number;
  currency: string;
  payment_date: string;
  status: string;
  payment_method?: string;
  ledger_hash?: string;
  tenancy_id?: string;
}

// ── Inner component — useSearchParams() needs Suspense boundary ───────────────
function LandlordReceiptsContent() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const tenancyId   = searchParams.get('tenancy_id') ?? '';

  const { loading: authLoading } = useAuth();

  const [projects,     setProjects]     = useState<Project[]>([]);
  const [loadingProj,  setLoadingProj]  = useState(true);

  // Tenant-scoped receipt view state
  const [receipts,     setReceipts]     = useState<RentReceipt[]>([]);
  const [loadingRec,   setLoadingRec]   = useState(false);
  const [receiptsErr,  setReceiptsErr]  = useState('');
  const [tenantName,   setTenantName]   = useState('');

  // ── Load projects (always needed to resolve project id) ─────────────────────
  useEffect(() => {
    if (authLoading) return;
    api.get('/api/projects/my')
      .then(res => {
        const list: Project[] = res.data.projects ?? [];
        setProjects(list);

        // Only auto-redirect when NO tenancy_id is present AND exactly 1 project
        if (!tenancyId && list.length === 1) {
          router.replace(`/projects/${list[0].id}/rental-management?tab=receipts`);
        }
      })
      .catch(() => setProjects([]))
      .finally(() => setLoadingProj(false));
  }, [authLoading, router, tenancyId]);

  // ── Load tenant-scoped receipts when tenancy_id is present ──────────────────
  useEffect(() => {
    if (!tenancyId || authLoading) return;
    setLoadingRec(true);
    setReceiptsErr('');
    api.get(`/api/landlord/receipts?tenancy_id=${tenancyId}`)
      .then(r => {
        const d = r.data;
        const rows: RentReceipt[] = Array.isArray(d) ? d : (d?.receipts ?? d?.payments ?? []);
        setReceipts(rows);
        // Grab tenant name from first receipt for display
        if (rows.length > 0) setTenantName(rows[0].tenant_name ?? '');
      })
      .catch(e => {
        const status = e?.response?.status;
        if (status && status !== 404) {
          setReceiptsErr(e?.response?.data?.error ?? 'Could not load receipts.');
        } else {
          setReceipts([]); // 404 = no receipts yet, fine
        }
      })
      .finally(() => setLoadingRec(false));
  }, [tenancyId, authLoading]);

  // ── Shared loading spinner ───────────────────────────────────────────────────
  if (authLoading || loadingProj) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={28} />
    </div>
  );

  // ── TENANT-SCOPED VIEW — ?tenancy_id=<id> ───────────────────────────────────
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
              <p className="text-[9px] text-amber-400 uppercase font-black tracking-[0.25em] mb-1">Payment Ledger</p>
              <h1 className="text-2xl font-black uppercase tracking-tight">
                {tenantName ? `${tenantName}'s Receipts` : 'Receipts'}
              </h1>
              {tenantName && (
                <div className="flex items-center gap-1.5 mt-1">
                  <User size={10} className="text-zinc-600" />
                  <p className="text-zinc-500 text-xs">{tenantName}</p>
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {receiptsErr && (
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/30 bg-red-500/5 text-red-400 text-xs">
              {receiptsErr}
            </div>
          )}

          {/* Loading */}
          {loadingRec ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="animate-spin text-amber-500" size={22} />
            </div>

          ) : receipts.length === 0 ? (
            <div className="py-14 text-center border border-dashed border-zinc-800 rounded-3xl space-y-3">
              <Receipt className="text-zinc-700 mx-auto" size={28} />
              <p className="text-zinc-500 text-xs font-black uppercase">No receipts yet</p>
              <p className="text-zinc-700 text-[10px]">
                Rent payments will appear here once {tenantName || 'this tenant'} pays through their vault.
              </p>
            </div>

          ) : (
            <div className="space-y-2">
              {receipts.map(r => (
                <div key={r.id}
                  className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800 bg-zinc-900/10 hover:border-zinc-700 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Receipt size={14} className="text-amber-400" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-bold text-xs text-white">
                        {r.unit_name ?? r.tenant_name}
                      </p>
                      <p className="text-[9px] text-zinc-500 font-mono">
                        {r.receipt_number} · {new Date(r.payment_date).toLocaleDateString('en-GB')}
                      </p>
                      {r.payment_method && (
                        <p className="text-[9px] text-zinc-600 uppercase font-bold">{r.payment_method}</p>
                      )}
                      {r.ledger_hash && (
                        <p className="text-[8px] text-zinc-700 font-mono flex items-center gap-1 truncate max-w-[200px]">
                          <Hash size={8} className="shrink-0" />{r.ledger_hash.slice(0, 24)}…
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="font-black text-sm text-white">
                      {r.currency} {safeF(r.amount)}
                    </p>
                    <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${
                      r.status === 'PAID' || r.status === 'SUCCESS'
                        ? 'border-teal-500/30 text-teal-400'
                        : 'border-amber-500/30 text-amber-400'
                    }`}>
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  // ── NO PROJECTS ──────────────────────────────────────────────────────────────
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
            <p className="text-zinc-500 text-sm mt-2">Submit your first property project to start seeing rent receipts and payment history.</p>
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

  // ── 1 PROJECT — redirecting (spinner while router.replace fires) ─────────────
  if (projects.length === 1) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={28} />
    </div>
  );

  // ── MULTI-PROJECT PICKER ─────────────────────────────────────────────────────
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

// ── Export with Suspense boundary (required for useSearchParams) ──────────────
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
