'use client';
export const dynamic = 'force-dynamic';
/**
 * /landlord/inventory/page.tsx
 * Landlord Inventory Matrix — manage, advertise & onboard legacy units
 * API: GET /api/landlord/units   (all units across all properties)
 * POST /api/landlord/marketplace/advertise-intent  (advertise a vacant unit)
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  Archive, Plus, Megaphone, Edit3, Loader2,
  ArrowLeft, Building2, Users, CheckCircle2,
  AlertCircle, Search, Filter, ShoppingBag, Landmark, ArrowUpRight
} from 'lucide-react';

const safeF = (v: any) => Number(v ?? 0).toLocaleString();

export default function LandlordInventoryPage() {
  const [units,       setUnits]       = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [filter,      setFilter]      = useState<'ALL'|'OCCUPIED'|'VACANT'>('ALL');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback,    setFeedback]    = useState<{type:'ok'|'err'; msg:string} | null>(null);

  useEffect(() => { fetchUnits(); }, []);

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/landlord/units');
      // Normalize incoming structure cleanly if nested or alternative payload formats arrive
      let data = res.data?.units ?? res.data ?? [];
      if (!Array.isArray(data) && typeof data === 'object') {
        data = Object.values(data).flat();
      }
      setUnits(Array.isArray(data) ? data : []);
    } catch { 
      setUnits([]); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleAdvertise = async (unitId: string) => {
    setProcessingId(unitId);
    setFeedback(null);
    try {
      const res = await api.post('/api/landlord/marketplace/advertise-intent', { unit_id: unitId });
      if (res.data?.authorization_url) {
        window.location.href = res.data.authorization_url;
      } else {
        setFeedback({ type: 'ok', msg: 'Unit listed on marketplace successfully.' });
        fetchUnits();
      }
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error ?? 'Advertisement placement failed.' });
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = units.filter(u => {
    const matchSearch = !search ||
      u.unit_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.project_title?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'ALL' ||
      (filter === 'OCCUPIED' && (u.tenant_name || u.status?.toUpperCase() === 'OCCUPIED')) ||
      (filter === 'VACANT'   && (!u.tenant_name && u.status?.toUpperCase() !== 'OCCUPIED'));
    return matchSearch && matchFilter;
  });

  const vacantCount   = units.filter(u => !u.tenant_name && u.status?.toUpperCase() !== 'OCCUPIED').length;
  const occupiedCount = units.filter(u => u.tenant_name || u.status?.toUpperCase() === 'OCCUPIED').length;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans selection:bg-teal-500 selection:text-black">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-10 w-full space-y-8">

        {/* Top Breadcrumb/Back link */}
        <div>
          <Link href="/projects/my"
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-teal-400 text-xs font-bold uppercase tracking-widest transition-colors mb-6 group">
            <ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" /> Back to Portfolio
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-900 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
                <p className="text-[9px] text-teal-400 font-mono font-black tracking-widest uppercase">
                  Real-Time Asset Ledger
                </p>
              </div>
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter italic">
                Unit Inventory <span className="text-zinc-700 font-light">Matrix</span>
              </h1>
              <p className="text-zinc-500 text-sm mt-1 max-w-xl">
                Global operational console for tenant assignment, programmatic vault matching, and live decentralized digital infrastructure oversight.
              </p>
            </div>
            
            <Link href="/onboard"
              className="flex items-center gap-2 px-5 py-3 bg-teal-500 text-black text-xs font-black uppercase tracking-wider rounded-xl hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0 shadow-[0_0_25px_rgba(20,184,166,0.1)]">
              <Plus size={14} strokeWidth={3} /> Register Asset Unit
            </Link>
          </div>
        </div>

        {/* Metric Metrics Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Consolidated Assets', value: units.length, color: 'text-white', border: 'border-zinc-800' },
            { label: 'Active Occupancy',   value: occupiedCount, color: 'text-teal-400', border: 'border-teal-500/10' },
            { label: 'Available Pipeline',   value: vacantCount, color: 'text-amber-400', border: 'border-amber-500/10' },
            { label: 'Yield Performance',  value: units.length ? `${Math.round((occupiedCount/units.length)*100)}%` : '0%', color: 'text-blue-400', border: 'border-blue-500/10' },
          ].map(s => (
            <div key={s.label} className={`p-5 rounded-2xl border ${s.border} bg-gradient-to-br from-zinc-900/40 to-zinc-900/10 backdrop-blur-sm relative overflow-hidden group`}>
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Landmark size={24} className="text-zinc-400" />
              </div>
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">{s.label}</p>
              <p className={`text-3xl font-black font-mono mt-2 tracking-tight ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter Operations Console */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-zinc-900/10 p-3 border border-zinc-900 rounded-2xl backdrop-blur-md">
          <div className="flex gap-2 p-1 bg-zinc-950 rounded-xl border border-zinc-900 w-full md:w-auto">
            {(['ALL','OCCUPIED','VACANT'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex-1 md:flex-none px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
                  filter === f
                    ? 'bg-teal-500 text-black font-black shadow-[0_0_15px_rgba(20,184,166,0.2)]'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/50'
                }`}>
                {f}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filter by property identifier or keyword..."
              className="w-full bg-zinc-950 border border-zinc-900 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-200 outline-none focus:border-teal-500/50 focus:bg-black transition-all font-medium placeholder-zinc-600" />
          </div>
        </div>

        {/* Operational Diagnostics Alerts */}
        {feedback && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-bold uppercase tracking-wider ${
            feedback.type === 'ok'
              ? 'bg-teal-500/5 border-teal-500/20 text-teal-400'
              : 'bg-red-500/5 border-red-500/20 text-red-400'
          }`}>
            {feedback.type === 'ok' ? <CheckCircle2 size={16} className="text-teal-400 animate-bounce" /> : <AlertCircle size={16} className="text-red-400" />}
            <span>{feedback.msg}</span>
          </div>
        )}

        {/* Master Inventory Grid Output */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3 text-zinc-600">
            <Loader2 size={24} className="animate-spin text-teal-400" />
            <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Syncing Deployed Ledgers…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/5 max-w-2xl mx-auto space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-zinc-900 flex items-center justify-center mx-auto border border-zinc-800">
              <Building2 className="text-zinc-500" size={20} />
            </div>
            <div className="space-y-1">
              <p className="text-zinc-300 font-black uppercase text-xs tracking-wider">No Listed Units Found</p>
              <p className="text-zinc-500 text-xs max-w-sm mx-auto leading-relaxed">
                {units.length === 0
                  ? 'All structural systems are clear. Deploy units via your asset dashboard to begin tracking programmatic yield.'
                  : 'The current filter constraint returned zero records. Refine your system search parameter.'}
              </p>
            </div>
            {units.length === 0 && (
              <Link href="/projects/my"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-900 border border-zinc-800 hover:border-teal-500/40 text-white hover:text-teal-400 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all mt-2">
                Go to My Projects <ArrowUpRight size={12} />
              </Link>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/20 overflow-hidden backdrop-blur-md">
            {/* Table Header Structure */}
            <div className="hidden md:grid grid-cols-6 px-6 py-4 bg-zinc-950 border-b border-zinc-900 text-[9px] text-zinc-500 font-black uppercase tracking-widest">
              <div className="col-span-2">Unit/Property Identifier</div>
              <div>Financial Baseline</div>
              <div>Tenancy Status</div>
              <div>Marketplace Exposure</div>
              <div className="text-right">Management</div>
            </div>

            {/* Live Synchronized Row Parser */}
            {filtered.map((unit, i) => (
              <div key={unit.id || i}
                className={`grid grid-cols-2 md:grid-cols-6 gap-4 px-6 py-5 items-center border-b border-zinc-900 hover:bg-zinc-900/20 transition-all ${
                  i === filtered.length - 1 ? 'border-b-0' : ''
                }`}>

                {/* Column 1: Asset Core Details */}
                <div className="col-span-2 md:col-span-2 space-y-1">
                  <p className="text-sm font-black text-white uppercase tracking-tight">{unit.unit_name || `Unit Model ${i+1}`}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-zinc-400 font-medium">{unit.project_title || 'Legacy Infrastructure Asset'}</p>
                    {unit.size_sqm > 0 && (
                      <span className="text-[9px] text-zinc-600 font-mono bg-zinc-900 px-1.5 py-0.5 rounded">
                        {unit.size_sqm}m²
                      </span>
                    )}
                  </div>
                </div>

                {/* Column 2: Financial Metrics */}
                <div>
                  <p className="text-[9px] text-zinc-600 uppercase font-black md:hidden mb-1">Financial Baseline</p>
                  <p className="font-mono text-sm font-black text-white tracking-tight">
                    {unit.currency || 'NGN'} {safeF(unit.rent_amount)}
                  </p>
                  <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mt-0.5">
                    per {unit.payment_frequency?.toLowerCase() || 'year'}
                  </p>
                </div>

                {/* Column 3: Telemetry Tenancy Status */}
                <div>
                  <p className="text-[9px] text-zinc-600 uppercase font-black md:hidden mb-1">Tenancy Status</p>
                  {unit.tenant_name || unit.status?.toUpperCase() === 'OCCUPIED' ? (
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1.5 bg-teal-500/5 text-teal-400 border border-teal-500/20 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider">
                        <Users size={10} strokeWidth={2.5} /> Active Lease
                      </span>
                      {unit.tenant_name && <p className="text-[10px] text-zinc-400 font-medium pl-1 truncate max-w-[150px]">{unit.tenant_name}</p>}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-amber-500/5 text-amber-400 border border-amber-500/20 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider">
                      Unassigned / Vacant
                    </span>
                  )}
                </div>

                {/* Column 4: Marketplace Routing Control */}
                <div>
                  <p className="text-[9px] text-zinc-600 uppercase font-black md:hidden mb-1">Market Exposure</p>
                  {!(unit.tenant_name || unit.status?.toUpperCase() === 'OCCUPIED') ? (
                    unit.is_advertised ? (
                      <Link href="/marketplace"
                        className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-blue-500/20 transition-all">
                        <ShoppingBag size={10} /> Live Asset
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleAdvertise(unit.id)}
                        disabled={processingId !== null}
                        className="flex items-center gap-1.5 bg-zinc-900 hover:bg-amber-500 text-zinc-400 hover:text-black border border-zinc-800 hover:border-amber-500 transition-all px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider disabled:opacity-50">
                        {processingId === unit.id
                          ? <Loader2 size={10} className="animate-spin" />
                          : <Megaphone size={10} />
                        }
                        Expose Offer
                      </button>
                    )
                  ) : (
                    <span className="text-[10px] text-zinc-700 font-mono tracking-widest">—</span>
                  )}
                </div>

                {/* Column 5: Action Targets */}
                <div className="flex gap-2 justify-end w-full">
                  <Link
                    href={`/landlord/inventory/editor?unitId=${unit.id}`}
                    title="Edit Properties Spec"
                    className="p-2 border border-zinc-900 bg-zinc-950/40 hover:border-teal-500/40 hover:text-teal-400 rounded-lg text-zinc-500 transition-all">
                    <Edit3 size={13} />
                  </Link>
                  {unit.project_id && (
                    <Link
                      href={`/projects/${unit.project_id}/rental-management`}
                      title="View System Ledger"
                      className="p-2 border border-zinc-900 bg-zinc-950/40 hover:border-zinc-700 hover:text-white rounded-lg text-zinc-500 transition-all">
                      <Building2 size={13} />
                    </Link>
                  )}
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