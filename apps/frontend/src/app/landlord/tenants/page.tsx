'use client';
export const dynamic = 'force-dynamic';
/**
 * /landlord/tenants/page.tsx
 * Landlord-only view of all tenants across their properties.
 * Middleware guarantees only LANDLORD/DEVELOPER roles reach here.
 * "Onboard Tenant" routes to /landlord/onboard/[unitId] — never /onboard.
 */
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  Users, Plus, Loader2, AlertCircle, Building2, Mail,
  Phone, Calendar, Gavel, RefreshCw, ShieldCheck, ArrowRight,
} from 'lucide-react';

const safeN = (v:any) => { const n=Number(v); return(v==null||isNaN(n))?0:n; };
const safeF = (v:any) => safeN(v).toLocaleString();

interface Tenant {
  id:string; full_name:string; email:string; phone?:string;
  unit_name:string; unit_id:string; project_id:string; project_title:string;
  rent_amount:number; currency:string;
  status:'ACTIVE'|'OVERDUE'|'NOTICE_ISSUED'|'TERMINATED';
  lease_start:string; vault_funded_pct:number; days_overdue?:number;
  kyc_verified:boolean;
}

const S:Record<string,string>={
  ACTIVE:        'border-teal-500/30 text-teal-400 bg-teal-500/10',
  OVERDUE:       'border-red-500/30 text-red-400 bg-red-500/10',
  NOTICE_ISSUED: 'border-orange-500/30 text-orange-400 bg-orange-500/10',
  TERMINATED:    'border-zinc-700 text-zinc-500 bg-zinc-800/20',
};

function Content() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units,   setUnits]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [tR, uR] = await Promise.allSettled([
        api.get('/api/rental/landlord/tenants'),
        api.get('/api/rental/landlord/vacant-units'),
      ]);
      if (tR.status==='fulfilled') setTenants(tR.value.data.tenants??[]);
      if (uR.status==='fulfilled') setUnits(uR.value.data.units??[]);
    } catch(e:any) { setError(e?.response?.data?.error??'Could not load tenants.'); }
    finally { setLoading(false); }
  };

  useEffect(()=>{ load(); },[]);

  const overdue = tenants.filter(t=>t.status==='OVERDUE');

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="flex items-center justify-center py-40">
        <Loader2 className="animate-spin text-teal-500" size={28}/>
      </div>
      <Footer />
    </div>
  );

  // Choose onboard destination based on how many vacant units exist
  const onboardHref = units.length===1
    ? `/landlord/onboard/${units[0].id}`
    : units.length>1 ? '/landlord/onboard/select' : '/projects/my';

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <div className="border-b border-zinc-800 bg-black px-6 py-2 flex items-center gap-5 text-[9px] font-mono uppercase tracking-widest">
        <span className="text-teal-500">Landlord Portal</span>
        <span className="text-zinc-500">{tenants.length} tenants</span>
        {overdue.length>0 && <span className="text-red-400 font-black">{overdue.length} overdue</span>}
      </div>

      <main className="flex-1 max-w-6xl mx-auto px-6 py-10 space-y-8 w-full">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="border-l-2 border-teal-500 pl-5">
            <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Landlord Portal</p>
            <h1 className="text-3xl font-black uppercase tracking-tighter">My Tenants</h1>
            <p className="text-zinc-500 text-xs mt-1">Manage tenancies across all your properties</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/landlord/notices"
              className="flex items-center gap-1.5 px-4 py-2.5 border border-red-500/30 text-red-400 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-red-500/10 transition-all">
              <Gavel size={11}/> Notices</Link>
            <button onClick={load} className="flex items-center gap-1.5 px-4 py-2.5 border border-zinc-800 text-zinc-500 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:text-white transition-all">
              <RefreshCw size={11}/> Refresh
            </button>
            <Link href={onboardHref}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-teal-500 text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white transition-all">
              <Plus size={12}/> {units.length===0 ? 'View My Properties' : 'Onboard Tenant'}
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14}/> {error}
            <button onClick={load} className="ml-auto text-teal-500 text-xs uppercase font-black hover:text-white">Retry →</button>
          </div>
        )}

        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {label:'Total',     value:tenants.length,        color:'text-white'},
            {label:'Active',    value:tenants.filter(t=>t.status==='ACTIVE').length, color:'text-teal-400'},
            {label:'Overdue',   value:overdue.length,        color:overdue.length>0?'text-red-400':'text-teal-400'},
            {label:'Vacant',    value:units.length,          color:'text-amber-400'},
          ].map(s=>(
            <div key={s.label} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-1.5">
              <p className={`text-2xl font-black font-mono ${s.color}`}>{s.value}</p>
              <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>

        {overdue.length>0 && (
          <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle size={16} className="text-red-400"/>
              <div>
                <p className="text-sm font-black text-red-300">{overdue.length} tenant{overdue.length>1?'s':''} overdue</p>
                <p className="text-[10px] text-zinc-500">{overdue.map(t=>t.full_name).join(', ')}</p>
              </div>
            </div>
            <Link href={`/projects/${overdue[0]?.project_id}/rental-management?tab=litigation`}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase hover:bg-red-400 transition-all">
              <Gavel size={12}/> Issue Notice
            </Link>
          </div>
        )}

        {tenants.length===0 ? (
          <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
            <Users className="text-zinc-700 mx-auto" size={40}/>
            <p className="text-zinc-400 font-bold">No tenants yet</p>
            <p className="text-zinc-600 text-sm">Add units to your properties, then use Onboard Tenant above.</p>
            <Link href="/projects/my"
              className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all">
              View My Properties <ArrowRight size={11}/>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {tenants.map(t=>(
              <div key={t.id} className={`p-5 rounded-2xl border transition-all hover:border-zinc-700 ${t.status==='OVERDUE'?'border-red-500/20 bg-red-500/5':'border-zinc-800 bg-zinc-900/20'}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-black text-base">{t.full_name}</p>
                      <span className={`text-[7px] px-2 py-0.5 rounded-full font-black uppercase border ${S[t.status]}`}>{t.status.replace('_',' ')}</span>
                      {t.kyc_verified && <span className="flex items-center gap-0.5 text-[7px] text-teal-500 border border-teal-500/20 px-1.5 py-0.5 rounded font-bold"><ShieldCheck size={7}/> KYC</span>}
                      {(t.days_overdue??0)>0 && <span className="text-[8px] text-red-400 font-bold">{t.days_overdue}d overdue</span>}
                    </div>
                    <p className="text-[10px] text-zinc-500">{t.unit_name} · {t.project_title}</p>
                    <div className="flex items-center gap-3 flex-wrap mt-1">
                      <span className="flex items-center gap-1 text-[9px] text-zinc-600"><Mail size={8}/>{t.email}</span>
                      {t.phone && <span className="flex items-center gap-1 text-[9px] text-zinc-600"><Phone size={8}/>{t.phone}</span>}
                      <span className="flex items-center gap-1 text-[9px] text-zinc-600"><Calendar size={8}/>From {t.lease_start}</span>
                    </div>
                  </div>
                  <div className="text-right space-y-1 flex-shrink-0">
                    <p className="font-mono font-bold text-xl text-teal-400">{t.currency} {safeF(t.rent_amount)}</p>
                    <p className="text-[8px] text-zinc-600 uppercase">/month</p>
                    <p className="text-[9px] text-zinc-500">Vault: {t.vault_funded_pct}% funded</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${t.vault_funded_pct>=80?'bg-teal-500':t.vault_funded_pct>=50?'bg-amber-500':'bg-red-500'}`} style={{width:`${t.vault_funded_pct}%`}}/>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-zinc-800/60 flex-wrap">
                  <Link href={`/projects/${t.project_id}/rental-management?tab=tenants`}
                    className="flex items-center gap-1.5 px-3 py-2 border border-zinc-700 text-zinc-400 rounded-xl text-[9px] font-bold uppercase hover:text-teal-400 hover:border-teal-500/30 transition-all">
                    <Building2 size={10}/> Manage Property
                  </Link>
                  {t.status==='OVERDUE' && (
                    <Link href={`/projects/${t.project_id}/rental-management?tab=litigation`}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-[9px] font-bold uppercase hover:bg-red-500/20 transition-all">
                      <Gavel size={10}/> Issue Notice
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

export default function LandlordTenantsPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={28}/></div>}>
      <Content />
    </Suspense>
  );
}
