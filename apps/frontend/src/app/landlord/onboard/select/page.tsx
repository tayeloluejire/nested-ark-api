'use client';
export const dynamic = 'force-dynamic';
/**
 * /landlord/onboard/select/page.tsx
 * When landlord has multiple vacant units, they pick one here
 * before being sent to /landlord/onboard/[unitId].
 * ONLY reachable by LANDLORD/DEVELOPER — middleware enforces this.
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { Building2, Loader2, AlertCircle, ArrowRight, Home } from 'lucide-react';

const safeF = (v:any) => Number(v||0).toLocaleString();

export default function SelectUnitPage() {
  const router = useRouter();
  const [units,   setUnits]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(()=>{
    api.get('/api/rental/landlord/vacant-units')
      .then(r => setUnits(r.data.units??[]))
      .catch(e => setError(e?.response?.data?.error??'Could not load units.'))
      .finally(()=>setLoading(false));
  },[]);

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar/>
      <div className="flex items-center justify-center py-40">
        <Loader2 className="animate-spin text-teal-500" size={28}/>
      </div>
      <Footer/>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar/>
      <main className="flex-1 max-w-2xl mx-auto px-6 py-16 space-y-8 w-full">
        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Landlord · Onboarding</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Select a Unit</h1>
          <p className="text-zinc-500 text-xs mt-1">Choose which vacant unit to onboard a tenant into</p>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14}/> {error}
          </div>
        )}

        {units.length===0 && !error ? (
          <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
            <Home className="text-zinc-700 mx-auto" size={36}/>
            <p className="text-zinc-400 font-bold">No vacant units found</p>
            <p className="text-zinc-600 text-sm">All units are occupied or you need to add units to a project first.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {units.map((u:any)=>(
              <button key={u.id} onClick={()=>router.push(`/landlord/onboard/${u.id}`)}
                className="w-full p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-teal-500/40 hover:bg-teal-500/5 transition-all text-left flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-base">{u.unit_name}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{u.project_title} · {u.unit_type} · {u.currency||'NGN'} {safeF(u.rent_amount)}/mo</p>
                </div>
                <ArrowRight size={16} className="text-teal-500 flex-shrink-0"/>
              </button>
            ))}
          </div>
        )}
      </main>
      <Footer/>
    </div>
  );
}
