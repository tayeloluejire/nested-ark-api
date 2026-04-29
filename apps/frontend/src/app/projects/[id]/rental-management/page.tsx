'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  Building2, Users, Gavel, FileText, MessageCircle,
  Copy, CheckCircle2, Loader2, AlertCircle, ArrowRight,
  Phone, Mail, Calendar, ChevronRight, Bell, X,
  Receipt, Home, Shield, Clock, TrendingUp,
  Download, RefreshCw, Edit3, Save, Plus, Trash2,
  Camera, Bath, BedDouble, Maximize2, Car, Star,
  ChevronDown, ChevronUp, Wifi, Wind, Zap, Droplet
} from 'lucide-react';

// ── Defensive numeric helpers ──────────────────────────────────────────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string  => safeN(v).toLocaleString();

function RentalManagementContent() {
  const { id: projectId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get('tab') || 'units';

  // ── 1. STATE MANAGEMENT (Consolidated & Top-Level) ───────────────────────
  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<any[]>([]);
  const [tenancies, setTenancies] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [litigation, setLitigation] = useState<any[]>([]);
  const [summary, setSummary] = useState({ units: 0, expected: 0 });
  
  // Modals & UI States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── 2. DATA LOADING ──────────────────────────────────────────────────────
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
      setUnits(unitRes.data || []);
      setTenancies(tenRes.data || []);
      setReceipts(recRes.data || []);
    } catch (err) {
      console.error("Critical Load Error:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // ── 3. ACTIONS: UNITS ────────────────────────────────────────────────────
  const handleSaveUnit = async (formData: any) => {
    try {
      setIsSaving(true);
      const response = await api.post('/api/rental/units', {
        project_id: projectId,
        unit_name: formData.unitName,
        category: formData.category,
        current_rent: formData.rentAmount
      });
      if (response.data) {
        setIsAddModalOpen(false);
        load();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || "Registration Failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (unit: any) => {
    setEditingId(unit.id);
    setEditForm({ ...unit });
  };

  const updateUnit = async () => {
    if (!editingId) return;
    try {
      setIsSaving(true);
      await api.put(`/api/rental/units/${editingId}`, editForm);
      setEditingId(null);
      load();
    } catch (err) {
      alert("Update failed. Ensure backend supports PUT /api/rental/units/:id");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-teal-500" size={40} />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Syncing Infrastructure...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-teal-500/30 font-sans">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-6 py-16">
        {/* HEADER BLOCK */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Link href={`/projects/${projectId}`} className="p-2 bg-zinc-900 rounded-xl text-zinc-500 hover:text-white transition-all hover:scale-110">
                <Building2 size={18} />
              </Link>
              <ChevronRight size={14} className="text-zinc-800" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-500 px-3 py-1 bg-teal-500/5 border border-teal-500/20 rounded-full">Rental Node 0.3a</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none italic">
              Rental Command<br/><span className="text-teal-500">Centre</span>
            </h1>
          </div>

          <div className="flex gap-4">
            <div className="bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-md p-6 rounded-[2rem] min-w-[160px]">
              <p className="text-[9px] text-zinc-500 uppercase font-black mb-2 tracking-widest">Global Inventory</p>
              <p className="text-3xl font-black font-mono">{summary.units} <span className="text-sm text-zinc-700">UNITS</span></p>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-md p-6 rounded-[2rem] min-w-[160px]">
              <p className="text-[9px] text-zinc-500 uppercase font-black mb-2 tracking-widest">Projected Revenue</p>
              <p className="text-3xl font-black font-mono text-teal-400">₦{safeF(summary.expected)}</p>
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex gap-2 bg-zinc-900/20 p-2 rounded-3xl border border-zinc-800/50 mb-12 overflow-x-auto no-scrollbar">
          {[
            { id: 'units', label: 'Inventory', icon: Building2 },
            { id: 'tenants', label: 'Ledger', icon: Users },
            { id: 'litigation', label: 'Litigation', icon: Gavel },
            { id: 'receipts', label: 'Receipts', icon: Receipt },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                tab === t.id ? 'bg-teal-500 text-black shadow-2xl shadow-teal-500/20 scale-105' : 'text-zinc-500 hover:bg-zinc-900 hover:text-white'
              }`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {/* CONTENT AREA */}
        <div className="min-h-[400px]">
          {/* TAB: UNITS */}
          {tab === 'units' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-600">Property Nodes</h2>
                <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-500 transition-all active:scale-95">
                  <Plus size={14} /> Register New Unit
                </button>
              </div>

              {units.length === 0 ? (
                <div className="py-32 text-center border border-dashed border-zinc-800 rounded-[3rem] bg-zinc-900/5">
                  <Building2 className="mx-auto text-zinc-900 mb-6" size={64} />
                  <p className="text-zinc-600 font-black uppercase text-xs tracking-widest italic">Infrastructure Empty</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {units.map((unit) => (
                    <div key={unit.id} className="group relative bg-zinc-900/30 border border-zinc-800/50 rounded-[2.5rem] overflow-hidden hover:border-teal-500/40 transition-all flex flex-col h-full">
                      {/* Unit Header Image/Status */}
                      <div className="h-48 bg-zinc-950 relative overflow-hidden">
                        {unit.photo_urls?.[0] ? (
                          <Image src={unit.photo_urls[0]} alt={unit.unit_name} fill className="object-cover opacity-60 group-hover:scale-110 transition-transform duration-1000" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center opacity-10"><Building2 size={80} /></div>
                        )}
                        <div className="absolute top-6 left-6 px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[9px] font-black uppercase tracking-widest">
                          {unit.status || 'VACANT'}
                        </div>
                        <button onClick={() => startEdit(unit)} className="absolute top-6 right-6 p-2 bg-white/10 backdrop-blur-md rounded-xl hover:bg-white hover:text-black transition-all">
                          <Edit3 size={14} />
                        </button>
                      </div>

                      <div className="p-8 flex flex-col flex-grow">
                        <p className="text-[10px] font-black text-teal-500 uppercase tracking-widest mb-2">{unit.category}</p>
                        <h3 className="text-3xl font-black uppercase tracking-tighter mb-4 italic leading-none">{unit.unit_name}</h3>
                        
                        <div className="space-y-4 mb-8">
                          <p className="text-3xl font-mono font-black">₦{safeF(unit.current_rent)}<span className="text-[10px] text-zinc-600 font-bold tracking-widest ml-1">/ANNUAL</span></p>
                          <div className="flex gap-4">
                            <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase"><BedDouble size={14}/> {unit.bedrooms || 0}</div>
                            <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase"><Bath size={14}/> {unit.bathrooms || 0}</div>
                            <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase"><Maximize2 size={14}/> {unit.floor_area_sqm || 0}m²</div>
                          </div>
                        </div>

                        <div className="mt-auto flex gap-3">
                          <button className="flex-1 px-4 py-3 bg-zinc-800 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all">View Analytics</button>
                          <button className="px-4 py-3 border border-zinc-800 rounded-xl text-zinc-500 hover:text-teal-500 transition-all"><Star size={14} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: TENANTS (RESTORED) */}
          {tab === 'tenants' && (
            <div className="space-y-6">
              <p className="text-[11px] text-zinc-600 uppercase font-black tracking-[0.3em] mb-8">Active Tenancies ({tenancies?.length || 0})</p>
              {tenancies.length === 0 ? (
                 <div className="py-24 text-center border border-dashed border-zinc-800 rounded-3xl opacity-50"><Users className="mx-auto mb-4" /> <p className="text-[10px] font-black uppercase tracking-widest">No active ledger</p></div>
              ) : (
                <div className="grid gap-6">
                  {tenancies.map((t: any) => (
                    <div key={t.id} className="p-8 bg-zinc-900/40 border border-zinc-800/50 rounded-[2rem] flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:border-teal-500/30 transition-all">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:bg-teal-500 group-hover:text-black transition-all">
                          <Users size={24} />
                        </div>
                        <div>
                          <p className="text-2xl font-black uppercase italic tracking-tighter">{t.tenant_name}</p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Bound to {t.unit_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8 text-right">
                        <div>
                          <p className="text-2xl font-mono font-black text-teal-400">₦{safeF(t.rent_amount)}</p>
                          <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">Current Obligation</p>
                        </div>
                        <Link href={`/projects/${projectId}/rental-management/tenant/${t.id}`} className="p-4 bg-zinc-800 rounded-2xl hover:bg-white hover:text-black transition-all">
                          <ChevronRight size={20} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: LITIGATION (RESTORED) */}
          {tab === 'litigation' && (
            <div className="py-24 text-center bg-zinc-900/20 border border-zinc-800 rounded-[3rem]">
              <Gavel size={48} className="mx-auto text-zinc-800 mb-6" />
              <p className="text-zinc-500 font-black uppercase text-[10px] tracking-[0.4em]">Zero Active Disputes</p>
            </div>
          )}

          {/* TAB: RECEIPTS (RESTORED) */}
          {tab === 'receipts' && (
            <div className="space-y-4">
              {receipts.length === 0 ? (
                <div className="py-24 text-center opacity-30"><Receipt size={40} className="mx-auto mb-4" /><p className="text-[10px] font-black tracking-widest uppercase">No Transaction Data</p></div>
              ) : (
                receipts.map((r: any) => (
                  <div key={r.id} className="p-6 bg-zinc-900/20 border border-zinc-800/40 rounded-3xl flex items-center justify-between group hover:border-white/10 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center text-teal-500"><Download size={20}/></div>
                      <div>
                        <p className="text-xs font-black uppercase">{r.tenant_name || 'System Transaction'}</p>
                        <p className="text-[10px] text-zinc-600 font-mono">ID: {r.id.slice(0,8)}</p>
                      </div>
                    </div>
                    <p className="text-xl font-mono font-black">₦{safeF(r.amount_ngn)}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* TRUST SIGNATURE */}
        <div className="mt-24 pt-12 border-t border-zinc-900 flex flex-wrap gap-8 justify-center">
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-700">
            <Shield size={14} className="text-teal-500" /> Tri-Layer Secure Engine
          </div>
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-700">
            <TrendingUp size={14} className="text-teal-500" /> Real-Time Yield Oracle
          </div>
        </div>
      </main>

      {/* ── 4. MODALS (RESTORED FULL DETAIL EDITING) ───────────────────────── */}
      
      {/* REGISTER UNIT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="bg-zinc-950 border border-zinc-800 p-10 rounded-[3rem] w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-2xl font-black uppercase tracking-tighter italic">Register <span className="text-teal-500">Unit</span></h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-3 hover:bg-zinc-900 rounded-full transition-colors"><X size={20} className="text-zinc-600" /></button>
            </div>
            
            <form onSubmit={(e: any) => {
              e.preventDefault();
              handleSaveUnit({
                unitName: e.target.unitName.value,
                category: e.target.category.value,
                rentAmount: e.target.rentAmount.value
              });
            }} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Label / Identifier</label>
                <input name="unitName" placeholder="e.g. FLAT 101A" required className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-6 py-4 text-sm font-bold focus:border-teal-500 focus:outline-none transition-all uppercase placeholder:text-zinc-800" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Architecture Type</label>
                <select name="category" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-6 py-4 text-sm font-bold focus:border-teal-500 focus:outline-none appearance-none transition-all">
                  <option value="Mini-flat">Mini-flat</option>
                  <option value="1-Bedroom">1-Bedroom</option>
                  <option value="2-Bedroom Flat">2-Bedroom Flat</option>
                  <option value="3-Bedroom Flat">3-Bedroom Flat</option>
                  <option value="Shop/Commercial">Shop/Commercial</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Annual Reserve (₦)</label>
                <input name="rentAmount" type="number" placeholder="0.00" required className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-6 py-4 text-sm font-mono text-teal-400 font-bold focus:border-teal-500 focus:outline-none transition-all placeholder:text-zinc-800" />
              </div>
              <button type="submit" disabled={isSaving} className="w-full py-5 bg-teal-500 text-black rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-teal-500/20 active:scale-95 transition-all">
                {isSaving ? <Loader2 className="animate-spin mx-auto" /> : "Deploy to Ledger"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FULL EDIT DETAIL MODAL (RESTORED FROM OLD) */}
      {editingId && editForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/98 backdrop-blur-2xl animate-in zoom-in-95 duration-300">
           <div className="bg-zinc-950 border border-zinc-800 p-10 rounded-[3rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto no-scrollbar relative shadow-3xl">
              <div className="sticky top-0 bg-zinc-950/80 backdrop-blur-md z-10 flex justify-between items-center pb-8 border-b border-zinc-900 mb-8">
                <h2 className="text-3xl font-black uppercase tracking-tighter italic">Refine <span className="text-teal-500">Infrastructure Detail</span></h2>
                <button onClick={() => setEditingId(null)} className="p-3 bg-zinc-900 hover:bg-white hover:text-black rounded-full transition-all"><X size={20} /></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
                   <section className="space-y-4">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Base Identity</p>
                      <div className="grid grid-cols-1 gap-4">
                        <input value={editForm.unit_name} onChange={e => setEditForm({...editForm, unit_name: e.target.value})} placeholder="Unit Name" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 font-bold text-sm" />
                        <select value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 font-bold text-sm">
                           <option>Mini-flat</option><option>1-Bedroom</option><option>2-Bedroom Flat</option>
                        </select>
                      </div>
                   </section>

                   <section className="space-y-4">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Specifications</p>
                      <div className="grid grid-cols-3 gap-3">
                         <div className="space-y-2">
                           <label className="text-[8px] font-black text-zinc-700 uppercase ml-1">Beds</label>
                           <input type="number" value={editForm.bedrooms || 0} onChange={e => setEditForm({...editForm, bedrooms: parseInt(e.target.value)})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center" />
                         </div>
                         <div className="space-y-2">
                           <label className="text-[8px] font-black text-zinc-700 uppercase ml-1">Baths</label>
                           <input type="number" value={editForm.bathrooms || 0} onChange={e => setEditForm({...editForm, bathrooms: parseInt(e.target.value)})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center" />
                         </div>
                         <div className="space-y-2">
                           <label className="text-[8px] font-black text-zinc-700 uppercase ml-1">SQM</label>
                           <input type="number" value={editForm.floor_area_sqm || 0} onChange={e => setEditForm({...editForm, floor_area_sqm: parseInt(e.target.value)})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center" />
                         </div>
                      </div>
                   </section>

                   <section className="space-y-4">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Financials (₦)</p>
                      <input type="number" value={editForm.current_rent} onChange={e => setEditForm({...editForm, current_rent: parseFloat(e.target.value)})} className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 font-mono text-teal-400 text-xl font-black" />
                   </section>
                </div>

                <div className="space-y-8">
                   <section className="space-y-4">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Amenity Suite</p>
                      <div className="grid grid-cols-2 gap-2">
                         {['WiFi', 'Parking', 'Generator', 'Security', 'AC', 'Elevator'].map(amen => (
                           <button key={amen} onClick={() => {
                             const list = editForm.amenities || [];
                             const next = list.includes(amen) ? list.filter((a:any) => a !== amen) : [...list, amen];
                             setEditForm({...editForm, amenities: next});
                           }} className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                             (editForm.amenities || []).includes(amen) ? 'bg-teal-500 text-black' : 'bg-zinc-900 text-zinc-600 border border-zinc-800 hover:border-zinc-700'
                           }`}>{amen}</button>
                         ))}
                      </div>
                   </section>

                   <section className="space-y-4">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Photo Assets (URLs)</p>
                      <textarea rows={3} value={(editForm.photo_urls || []).join('\n')} onChange={e => setEditForm({...editForm, photo_urls: e.target.value.split('\n')})} placeholder="Enter image URLs (one per line)" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-xs text-zinc-500 font-mono focus:border-teal-500 outline-none" />
                   </section>

                   <div className="flex gap-4 pt-4">
                      <button onClick={updateUnit} disabled={isSaving} className="flex-1 py-5 bg-white text-black rounded-[2rem] text-[11px] font-black uppercase tracking-widest hover:bg-teal-500 transition-all flex items-center justify-center gap-2 shadow-2xl">
                        {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Save Infrastructure
                      </button>
                   </div>
                </div>
              </div>
           </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default function RentalManagementPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" /></div>}>
      <RentalManagementContent />
    </Suspense>
  );
}