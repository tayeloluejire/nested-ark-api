'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  Building2, Users, Gavel, FileText, Loader2, AlertCircle,
  Plus, X, Home, Shield, TrendingUp, Download, RefreshCw, 
  Edit3, Save, Trash2, Camera, Bath, BedDouble, Maximize2, 
  Car, ChevronRight, CheckCircle2, Receipt
} from 'lucide-react';

// ── Defensive numeric helpers ──────────────────────────────────────────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string  => safeN(v).toLocaleString();

function RentalManagementContent() {
  const { id: projectId } = useParams();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'units';

  // 1. ALL HOOKS AT TOP LEVEL (Prevents Error #321)
  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ units: 0, expected: 0 });
  const [units, setUnits] = useState<any[]>([]);
  const [tenancies, setTenancies] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // 2. DATA LOADING LOGIC
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [sumRes, unitRes, tenRes, recRes] = await Promise.all([
        api.get(`/api/rental/project/${projectId}/summary`),
        api.get(`/api/rental/project/${projectId}/units`),
        api.get(`/api/rental/project/${projectId}/tenancies`),
        api.get(`/api/rental/project/${projectId}/receipts`)
      ]);
      setSummary(sumRes.data);
      setUnits(unitRes.data);
      setTenancies(tenRes.data);
      setReceipts(recRes.data);
    } catch (err) {
      console.error("Failed to load rental data:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // 3. REGISTRATION LOGIC
  const handleSaveUnit = async (formData: any) => {
    try {
      const response = await api.post('/api/rental/units', {
        project_id: projectId,
        unit_name: formData.unitName,
        category: formData.category,
        current_rent: formData.rentAmount
      });

      if (response.data) {
        setIsAddModalOpen(false);
        load(); // Refresh everything
      }
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to save unit.");
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
    <div className="min-h-screen bg-[#050505] text-white selection:bg-teal-500/30">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Header Section */}
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Link href={`/projects/${projectId}`} className="text-zinc-500 hover:text-white transition-colors">
                <Building2 size={16} />
              </Link>
              <ChevronRight size={12} className="text-zinc-700" />
              <span className="text-[10px] font-black uppercase tracking-widest text-teal-500 bg-teal-500/10 px-2 py-1 rounded">Rental Terminal</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase">Rental Command Centre</h1>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl min-w-[140px]">
              <p className="text-[8px] text-zinc-500 uppercase font-black mb-1">Total Units</p>
              <p className="text-2xl font-black font-mono">{summary.units}</p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl min-w-[140px]">
              <p className="text-[8px] text-zinc-500 uppercase font-black mb-1">Annual Yield</p>
              <p className="text-2xl font-black font-mono text-teal-400">₦{safeF(summary.expected)}</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800 mb-10 overflow-x-auto no-scrollbar">
          {[
            { id: 'units', label: 'Apartment Inventory', icon: Building2 },
            { id: 'tenants', label: 'Tenancy Ledger', icon: Users },
            { id: 'receipts', label: 'Revenue/Receipts', icon: Receipt },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                tab === t.id ? 'bg-teal-500 text-black shadow-lg shadow-teal-500/20' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <t.icon size={12} /> {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content: Units */}
        {tab === 'units' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
                Infrastructure Nodes ({units.length})
              </p>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-teal-500/20"
              >
                <Plus size={11} /> Register New Unit
              </button>
            </div>

            {units.length === 0 ? (
              <div className="py-24 text-center border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/10">
                <Building2 className="mx-auto text-zinc-800 mb-4" size={48} />
                <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Inventory Empty</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {units.map((unit) => (
                  <div key={unit.id} className="group relative bg-zinc-900/30 border border-zinc-800 rounded-3xl overflow-hidden hover:border-teal-500/50 transition-all">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-tighter ${
                          unit.status === 'vacant' ? 'bg-teal-500/10 text-teal-500' : 'bg-amber-500/10 text-amber-500'
                        }`}>
                          {unit.status}
                        </div>
                        <p className="text-[10px] font-mono text-zinc-600 uppercase">{unit.category}</p>
                      </div>
                      <h3 className="text-2xl font-black uppercase tracking-tighter mb-1">{unit.unit_name}</h3>
                      <p className="text-2xl font-mono font-black text-white mb-6">₦{safeF(unit.current_rent)}<span className="text-[10px] text-zinc-500 font-bold tracking-widest">/yr</span></p>
                      
                      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-zinc-800/50">
                         <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase">
                           <BedDouble size={12} /> Bed: {unit.bedrooms || '-'}
                         </div>
                         <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase">
                           <Bath size={12} /> Bath: {unit.bathrooms || '-'}
                         </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Tenants */}
        {tab === 'tenants' && (
          <div className="space-y-6">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Active Tenancies ({tenancies?.length || 0})</p>
            {(!tenancies || tenancies.length === 0) ? (
              <div className="py-24 text-center border border-dashed border-zinc-800 rounded-3xl">
                <Users className="mx-auto text-zinc-800 mb-4" size={48} />
                <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">No active tenants</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {tenancies.map((t: any) => (
                  <div key={t.id} className="p-6 bg-zinc-900/30 border border-zinc-800 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="font-black uppercase tracking-tight text-lg">{t.tenant_name}</p>
                      <p className="text-[10px] text-zinc-500 font-bold">{t.unit_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-mono font-black text-teal-400">₦{safeF(t.rent_amount)}</p>
                      <div className="flex items-center justify-end gap-1.5 mt-1">
                         <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></div>
                         <p className="text-[9px] text-teal-500 font-black uppercase tracking-widest">Active</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Receipts */}
        {tab === 'receipts' && (
          <div className="space-y-6">
             <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Payment History</p>
             {receipts.length === 0 ? (
               <div className="py-24 text-center border border-dashed border-zinc-800 rounded-3xl">
                 <FileText className="mx-auto text-zinc-800 mb-4" size={48} />
                 <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">No transactions logged</p>
               </div>
             ) : (
               <div className="space-y-3">
                 {receipts.map((r: any) => (
                   <div key={r.id} className="p-5 bg-zinc-900/20 border border-zinc-800/50 rounded-2xl flex items-center justify-between">
                     <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-500">
                         <Download size={18} />
                       </div>
                       <div>
                         <p className="font-bold text-sm uppercase">{r.tenant_name || 'System Payment'}</p>
                         <p className="text-[9px] text-zinc-600 font-mono">HASH: {r.ledger_hash?.slice(0,12)}...</p>
                       </div>
                     </div>
                     <p className="font-mono font-black text-white">₦{safeF(r.amount_ngn)}</p>
                   </div>
                 ))}
               </div>
             )}
          </div>
        )}

        {/* Trust Badges Footer */}
        <div className="mt-20 pt-8 border-t border-zinc-900 flex flex-wrap gap-4">
          <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-600">
            <Shield size={10} className="text-teal-500" /> Tri-Layer Verified
          </span>
          <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-600">
            <TrendingUp size={10} className="text-teal-500" /> Yield Engine Active
          </span>
        </div>
      </main>

      {/* 4. MODAL COMPONENT (Integrated Logic) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-zinc-950 border border-zinc-800 p-8 rounded-[40px] w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black uppercase tracking-tighter italic">Register Unit</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-zinc-900 rounded-full transition-colors">
                <X size={20} className="text-zinc-500" />
              </button>
            </div>
            
            <form onSubmit={(e: any) => {
              e.preventDefault();
              handleSaveUnit({
                unitName: e.target.unitName.value,
                category: e.target.category.value,
                rentAmount: e.target.rentAmount.value
              });
            }} className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block ml-1">Unit Name</label>
                <input name="unitName" placeholder="e.g. Apartment A1" required 
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-5 py-4 text-sm focus:border-teal-500 focus:outline-none transition-all font-bold" />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block ml-1">Category</label>
                <select name="category" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-5 py-4 text-sm focus:border-teal-500 focus:outline-none transition-all font-bold appearance-none">
                  <option value="Mini-flat">Mini-flat</option>
                  <option value="1-Bedroom">1-Bedroom</option>
                  <option value="2-Bedroom Flat">2-Bedroom Flat</option>
                  <option value="3-Bedroom Flat">3-Bedroom Flat</option>
                  <option value="Shop/Commercial">Shop/Commercial</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block ml-1">Annual Rent (₦)</label>
                <input name="rentAmount" type="number" placeholder="0.00" required 
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-5 py-4 text-sm focus:border-teal-500 focus:outline-none transition-all font-mono text-teal-400 font-bold" />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} 
                  className="flex-1 px-6 py-4 border border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-900 transition-all">
                  Cancel
                </button>
                <button type="submit" 
                  className="flex-1 px-6 py-4 bg-teal-500 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-teal-500/20">
                  Save Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default function RentalManagementPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={32} /></div>}>
      <RentalManagementContent />
    </Suspense>
  );
}