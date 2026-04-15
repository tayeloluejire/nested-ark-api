'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { useLiveProjects } from '@/hooks/useLiveSystem';
import {
  Truck, Package, CheckCircle2, Clock, AlertTriangle,
  Loader2, RefreshCw, QrCode, ShieldCheck, Activity,
  Wifi, Zap, BarChart3, Hash
} from 'lucide-react';

const MATERIAL_TYPES = ['Cement (Bags)', 'Steel Rods (Tonnes)', 'Solar Panels (Units)', 'Gravel (m³)', 'Sand (m³)', 'Timber (m³)', 'Glass (Sheets)', 'Pipes (Lengths)', 'Cables (m)'];
const STATUS_COLOR: Record<string, string> = {
  DELIVERED: 'text-teal-500 bg-teal-500/10 border-teal-500/30',
  IN_TRANSIT: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  PENDING: 'text-zinc-500 bg-zinc-800/50 border-zinc-700',
  REJECTED: 'text-red-400 bg-red-500/10 border-red-500/30',
};

// Simulated dispatch log for demo — real data would come from /api/supplier/dispatches
function genHash() { return Array.from({length:12}, () => Math.floor(Math.random()*16).toString(16)).join(''); }
const DEMO_DISPATCHES = [
  { id: genHash(), project: 'Lagos-Ibadan Expressway Upgrade', material: 'Cement (Bags)', qty: 2500, status: 'DELIVERED', hash: genHash(), ts: new Date(Date.now() - 3600000) },
  { id: genHash(), project: 'Port Harcourt Smart Bridge', material: 'Steel Rods (Tonnes)', qty: 45, status: 'IN_TRANSIT', hash: genHash(), ts: new Date(Date.now() - 7200000) },
  { id: genHash(), project: 'Kano Water Treatment Plant', material: 'Pipes (Lengths)', qty: 800, status: 'PENDING', hash: genHash(), ts: new Date(Date.now() - 14400000) },
  { id: genHash(), project: 'Abuja Solar Grid Initiative', material: 'Solar Panels (Units)', qty: 120, status: 'DELIVERED', hash: genHash(), ts: new Date(Date.now() - 86400000) },
];

export default function SupplierCommandCenter() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { projects } = useLiveProjects();
  const [dispatches, setDispatches] = useState(DEMO_DISPATCHES);
  const [showDispatch, setShowDispatch] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [form, setForm] = useState({ project_id: '', material: 'Cement (Bags)', qty: 100, notes: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user && user.role !== 'SUPPLIER' && user.role !== 'ADMIN') router.replace('/dashboard');
  }, [user, authLoading, router]);

  if (authLoading || !user) return <div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={32} /></div>;

  const stats = {
    delivered: dispatches.filter(d => d.status === 'DELIVERED').length,
    in_transit: dispatches.filter(d => d.status === 'IN_TRANSIT').length,
    pending: dispatches.filter(d => d.status === 'PENDING').length,
    total: dispatches.length,
  };

  const handleCreateDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_id) { alert('Select a project'); return; }
    setSubmitting(true);
    const dispatchHash = genHash() + genHash();
    const newDispatch = {
      id: genHash(), project: projects.find((p: any) => p.id === form.project_id)?.title || form.project_id,
      material: form.material, qty: form.qty, status: 'PENDING', hash: dispatchHash, ts: new Date()
    };
    setDispatches(prev => [newDispatch, ...prev]);
    setQrCode(`NARK-DISPATCH-${dispatchHash.toUpperCase()}`);
    setShowDispatch(false);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      {/* System Pulse Bar */}
      <div className="border-b border-zinc-800 bg-black px-6 py-2 flex items-center gap-6 text-[9px] font-mono uppercase tracking-widest overflow-x-auto">
        <div className="flex items-center gap-1.5 text-teal-500 flex-shrink-0"><Wifi size={9} /> API Online</div>
        <div className="flex items-center gap-1.5 text-amber-500 flex-shrink-0"><Truck size={9} /> {stats.in_transit} In Transit</div>
        <div className="flex items-center gap-1.5 text-teal-500 flex-shrink-0"><CheckCircle2 size={9} /> {stats.delivered} Delivered</div>
        <div className="flex items-center gap-1.5 text-zinc-600 flex-shrink-0"><Hash size={9} /> Ledger-Linked Dispatches</div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full">
        <header className="mb-8 border-l-2 border-blue-500 pl-6">
          <p className="text-[9px] text-blue-400 uppercase font-bold tracking-[0.2em] mb-1">Supplier Command Center</p>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic">Material Logistics</h1>
          <p className="text-zinc-500 text-sm mt-1">Tokenized dispatch tracking · On-site QR verification · Escrow-linked payouts</p>
        </header>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Dispatches', value: stats.total, icon: Package, color: 'text-zinc-400' },
            { label: 'Delivered', value: stats.delivered, icon: CheckCircle2, color: 'text-teal-500' },
            { label: 'In Transit', value: stats.in_transit, icon: Truck, color: 'text-amber-400' },
            { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-zinc-500' },
          ].map(c => { const Icon = c.icon; return (
            <div key={c.label} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/30">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{c.label}</p>
                <Icon size={14} className={c.color} />
              </div>
              <p className="text-2xl font-black font-mono">{c.value}</p>
            </div>
          ); })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Material Dispatch Ledger ──────── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Material Ledger</h2>
              <button onClick={() => setShowDispatch(!showDispatch)} className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 font-bold rounded-xl text-[10px] uppercase tracking-widest hover:bg-blue-500/30 transition-all">
                <Truck size={12} /> + New Dispatch
              </button>
            </div>

            {/* New dispatch form */}
            {showDispatch && (
              <form onSubmit={handleCreateDispatch} className="p-5 rounded-2xl border border-blue-500/30 bg-blue-500/5 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-tight text-blue-400">Initialize Dispatch</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">Project *</label>
                    <select value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-blue-500 transition-colors">
                      <option value="">Select project…</option>
                      {projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">Material</label>
                    <select value={form.material} onChange={e => setForm({...form, material: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-blue-500 transition-colors">
                      {MATERIAL_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">Quantity</label>
                    <input type="number" min={1} value={form.qty} onChange={e => setForm({...form, qty: Number(e.target.value)})} className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-blue-500 transition-colors font-mono" />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">Notes</label>
                    <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Driver, vehicle plate…" className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-blue-500 transition-colors" />
                  </div>
                </div>
                <button type="submit" disabled={submitting} className="w-full py-3 bg-blue-500 text-black font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-blue-400 transition-all flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="animate-spin" size={13} /> : <><QrCode size={13} /> Generate Dispatch & QR Code</>}
                </button>
              </form>
            )}

            {/* QR code display */}
            {qrCode && (
              <div className="p-5 rounded-2xl border border-teal-500/30 bg-teal-500/5 text-center space-y-3">
                <QrCode className="text-teal-500 mx-auto" size={32} />
                <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Dispatch Code — Contractor Scans On Delivery</p>
                <p className="font-mono text-teal-400 text-sm bg-black px-4 py-3 rounded-xl border border-zinc-800 break-all">{qrCode}</p>
                <p className="text-[8px] text-zinc-600">Share this code with the driver. Contractor scans it on-site to trigger escrow release.</p>
                <button onClick={() => setQrCode(null)} className="text-zinc-500 text-[9px] hover:text-white transition-colors">Dismiss</button>
              </div>
            )}

            {/* Dispatch table */}
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <div className="grid grid-cols-5 gap-3 p-3 bg-zinc-900 border-b border-zinc-800">
                {['Project', 'Material', 'Qty', 'Status', 'Hash'].map(h => (
                  <span key={h} className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">{h}</span>
                ))}
              </div>
              <div className="divide-y divide-zinc-800/50">
                {dispatches.map(d => (
                  <div key={d.id} className="grid grid-cols-5 gap-3 p-3 hover:bg-zinc-900/30 transition-colors font-mono text-[10px]">
                    <span className="text-zinc-300 truncate">{d.project}</span>
                    <span className="text-zinc-400 truncate">{d.material}</span>
                    <span className="text-white">{d.qty.toLocaleString()}</span>
                    <span className={`px-2 py-0.5 rounded border text-[8px] font-bold uppercase w-fit ${STATUS_COLOR[d.status]}`}>{d.status}</span>
                    <span className="text-zinc-600 truncate" title={d.hash}>{d.hash.slice(0, 8)}…</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Sidebar ───────────────────────── */}
          <div className="space-y-5">
            {/* Escrow Payment Status */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/30 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={14} className="text-teal-500" />
                <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Escrow Payment Status</p>
              </div>
              {[
                { label: 'Locked in Escrow', value: '$890,000', color: 'text-amber-400' },
                { label: 'Pending Release', value: '$240,000', color: 'text-teal-400' },
                { label: 'Released to You', value: '$125,000', color: 'text-emerald-400' },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{item.label}</span>
                  <span className={`font-mono text-sm font-bold ${item.color}`}>{item.value}</span>
                </div>
              ))}
              <div className="pt-3 border-t border-zinc-800">
                <p className="text-[8px] text-zinc-600 leading-relaxed">Escrow releases when Contractor scans your dispatch QR code + Drone confirms delivery on-site.</p>
              </div>
            </div>

            {/* How it works */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Delivery Verification Flow</p>
              {[
                { n: '1', t: 'Create Dispatch', d: 'Register material delivery in the ledger' },
                { n: '2', t: 'Share QR Code', d: 'Driver carries dispatch code to site' },
                { n: '3', t: 'Contractor Scans', d: 'Physical scan confirms delivery receipt' },
                { n: '4', t: 'Drone Confirms', d: 'Aerial footage verifies materials on-site' },
                { n: '5', t: 'Escrow Releases', d: 'Payment auto-released to your account' },
              ].map(s => (
                <div key={s.n} className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[9px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{s.n}</div>
                  <div>
                    <p className="text-[9px] font-bold text-white uppercase tracking-widest">{s.t}</p>
                    <p className="text-[8px] text-zinc-600 mt-0.5">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
