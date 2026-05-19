@'
'use client';
export const dynamic = 'force-dynamic';
/**
 * /projects/[id]/rental-management/page.tsx
 *
 * BACKEND ENDPOINTS (verified from index.ts):
 * GET  /api/projects/:id
 * → { project: { id, title, ... } }
 * GET  /api/rental/units/:projectId
 * → { success: true, units: [ { id, unit_name, rent_amount, currency, status, tenant_name, tenancy_status, description } ] }
 * POST /api/rental/units
 * body: { project_id, unit_name, rent_amount }
 */
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { 
  Building2, Plus, Loader2, AlertCircle, CheckCircle2, 
  Layers, Receipt, Send, ChevronRight, Hash, UserPlus
} from 'lucide-react';

const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();

interface Unit {
  id: string; unit_name: string; rent_amount: any; currency: string;
  status: string; tenant_name: string | null; tenancy_status: string | null;
  description: string;
}

interface Project {
  id: string; title: string; project_number: string;
  location: string; country: string;
}

interface RentalReceipt {
  id: string; tenant_name: string; unit_name: string;
  amount_ngn: any; period_label: string; paid_at: string;
  ledger_hash: string; paystack_ref: string;
}

function RentalManagementContent({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') === 'receipts' ? 'receipts' : 'units';

  const [project, setProject] = useState<Project | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [receipts, setReceipts] = useState<RentalReceipt[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [unitName, setUnitName] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [submitting, setSubmitting] = useState(false);
  const [successUnit, setSuccessUnit] = useState<any>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const pRes = await api.get(`/api/projects/${projectId}`);
      setProject(pRes.data.project);

      const uRes = await api.get(`/api/rental/units/${projectId}`);
      setUnits(uRes.data.units ?? []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load project details');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadReceipts = useCallback(async () => {
    setReceiptsLoading(true);
    try {
      const res = await api.get(`/api/rental/receipts/${projectId}`);
      setReceipts(res.data.receipts ?? []);
    } catch {
      setReceipts([]);
    } finally {
      setReceiptsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeTab === 'receipts') {
      loadReceipts();
    }
  }, [activeTab, loadReceipts]);

  const handleSubmit = async () => {
    if (!unitName.trim() || !rentAmount.trim()) return;
    setSubmitting(false);
    setError(null);
    setSuccessUnit(null);
    
    try {
      const res = await api.post('/api/rental/units', {
        project_id: projectId,
        unit_name: unitName.trim(),
        rent_amount: Number(rentAmount),
        currency
      });
      setSuccessUnit(res.data.unit);
      setUnitName('');
      setRentAmount('');
      
      const uRes = await api.get(`/api/rental/units/${projectId}`);
      setUnits(uRes.data.units ?? []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to write unit to immutable ledger');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-teal-500 selection:text-black">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 pt-32 pb-24 space-y-8">
        
        {/* Header Block */}
        <div className="border border-zinc-900 bg-zinc-950/40 p-8 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 blur-[120px] rounded-full" />
          <div className="flex items-center gap-3 text-zinc-500 text-xs font-mono uppercase tracking-widest mb-3">
            <Layers size={12} className="text-teal-500" />
            <span>Project Ledger Integration</span>
            <span>·</span>
            <span>{project?.project_number}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase">{project?.title}</h1>
          <p className="text-xs text-zinc-500 mt-1 uppercase tracking-tight">{project?.location}, {project?.country}</p>
        </div>

        {/* Dynamic URL Tab Navigation System */}
        <div className="flex bg-zinc-950 border border-zinc-900 p-1.5 rounded-2xl max-w-sm">
          <Link 
            href={`/projects/${projectId}/rental-management?tab=units`}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'units' 
                ? 'bg-teal-500 text-black shadow-lg shadow-teal-500/10' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Building2 size={14} />
            Units Structural
          </Link>
          <Link 
            href={`/projects/${projectId}/rental-management?tab=receipts`}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'receipts' 
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Receipt size={14} />
            Receipts Ledger
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-start gap-3">
            <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-red-200/80 font-medium">{error}</p>
          </div>
        )}

        {/* ── TAB CONTENT 1: RECEIPTS LEDGER ──────────────────────────────── */}
        {activeTab === 'receipts' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">Rental Inflows & Clearances</h2>
              <span className="text-[10px] font-mono text-zinc-600 uppercase">{receipts.length} Recorded Ledger Inflows</span>
            </div>

            {receiptsLoading ? (
              <div className="py-12 border border-zinc-950 bg-zinc-950/20 rounded-3xl flex items-center justify-center">
                <Loader2 className="animate-spin text-amber-500" size={24} />
              </div>
            ) : receipts.length === 0 ? (
              <div className="py-12 border border-dashed border-zinc-900 rounded-3xl text-center space-y-2">
                <p className="text-xs text-zinc-500">No rental contributions or cleared receipts found on this project ledger.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {receipts.map(r => (
                  <div key={r.id} className="border border-zinc-900 bg-zinc-950/40 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white uppercase tracking-tight font-sans">{r.tenant_name}</span>
                        <span className="text-[9px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold">{r.unit_name}</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-tight">{r.period_label}</p>
                      <p className="text-[9px] text-zinc-600 truncate max-w-md">REF: {r.paystack_ref} · HASH: {r.ledger_hash}</p>
                    </div>
                    <div className="text-left md:text-right flex-shrink-0 space-y-1">
                      <p className="text-sm font-black text-amber-400">₦{safeF(r.amount_ngn)}</p>
                      <p className="text-[9px] text-zinc-500">{new Date(r.paid_at).toLocaleDateString('en-GB')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── TAB CONTENT 2: UNITS STRUCTURAL ─────────────────────────────── */}
        {activeTab === 'units' && (
          <>
            {successUnit && (
              <div className="p-5 bg-teal-500/5 border border-teal-500/20 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-teal-400 flex-shrink-0 mt-0.5" size={18} />
                  <div>
                    <h4 className="text-xs font-black uppercase text-teal-400 tracking-wider">Unit Deployed To Infrastructure Ledger</h4>
                    <p className="text-xs text-zinc-400 mt-0.5">Unit "{successUnit.unit_name}" is active. Proceed to bind a tenant profile.</p>
                  </div>
                </div>
                <Link 
                  href={`/landlord/onboard/${successUnit.id}`}
                  className="px-4 py-2 bg-teal-500 text-black text-xs font-black uppercase tracking-wider rounded-xl hover:bg-teal-400 transition-all text-center flex items-center justify-center gap-2"
                >
                  <UserPlus size={14} /> Onboard Tenant
                </Link>
              </div>
            )}

            {/* List Units */}
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-900 pb-2">Active Asset Configuration</h2>
              {units.length === 0 ? (
                <div className="py-12 border border-dashed border-zinc-900 rounded-3xl text-center">
                  <p className="text-xs text-zinc-500">No active structures configured for this project asset space.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {units.map(u => (
                    <div key={u.id} className="border border-zinc-900 bg-zinc-950/20 p-5 rounded-2xl flex flex-col justify-between gap-4 hover:border-zinc-800 transition-all relative">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-sm uppercase tracking-tight">{u.unit_name}</h3>
                            <p className="text-xs text-teal-400 font-bold mt-1">₦{safeF(u.rent_amount)} <span className="text-[10px] text-zinc-500 font-normal">/ cycle</span></p>
                          </div>
                          <span className={`text-[8px] px-2 py-0.5 rounded border font-mono font-bold tracking-wider ${
                            u.status === 'OCCUPIED' ? 'border-teal-500/30 text-teal-400 bg-teal-500/5' : 'border-zinc-800 text-zinc-500'
                          }`}>{u.status}</span>
                        </div>
                      </div>

                      <div className="border-t border-zinc-900/60 pt-3 flex items-center justify-between text-xs">
                        {u.tenant_name ? (
                          <div>
                            <p className="text-[9px] text-zinc-500 uppercase font-mono">Bounded Tenant</p>
                            <p className="font-medium text-zinc-300 mt-0.5">{u.tenant_name}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-600 italic">No tenant assigned</span>
                        )}

                        {!u.tenant_name && (
                          <Link href={`/landlord/onboard/${u.id}`} className="flex items-center gap-1 text-[10px] text-teal-500 font-bold uppercase tracking-wider hover:text-teal-400 transition-colors">
                            Setup Flex-Pay <ChevronRight size={14} />
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Creation Form */}
            <div className="border border-zinc-900 bg-zinc-950/20 p-6 md:p-8 rounded-3xl space-y-6">
              <div className="space-y-1">
                <h3 className="font-black text-sm uppercase tracking-wider">Provision New Unit</h3>
                <p className="text-xs text-zinc-500">Append structural assets to this ledger project instance</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Unit Name / Identifier</label>
                  <input 
                    type="text" placeholder="e.g. APARTMENT 4B, SUITE 102"
                    value={unitName} onChange={e => setUnitName(e.target.value)}
                    className="w-full bg-black border border-zinc-900 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors uppercase font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Rent Amount (Per Cycle)</label>
                  <input 
                    type="number" placeholder="e.g. 2500000"
                    value={rentAmount} onChange={e => setRentAmount(e.target.value)}
                    className="w-full bg-black border border-zinc-900 p-4 rounded-xl outline-none focus:border-teal-500 text-sm transition-colors font-mono"
                  />
                </div>
              </div>

              <button
                onClick={handleSubmit} disabled={submitting}
                className="w-full py-5 bg-teal-500 text-black font-black uppercase italic text-sm rounded-2xl hover:bg-teal-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {submitting ? <><Loader2 className="animate-spin" size={20} /> Deploying Unit…</> : <><Send size={18} /> Add Unit to Ledger</>}
              </button>
            </div>
          </>
        )}

      </main>
      <Footer />
    </div>
  );
}

export default function RentalManagementPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    }>
      <RentalManagementContent projectId={params.id} />
    </Suspense>
  );
}
'@ | Out-File -FilePath 'apps/frontend/src/app/projects/[id]/rental-management/page.tsx' -Encoding utf8