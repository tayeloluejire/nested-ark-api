'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Lock, ShieldCheck, DollarSign, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';

const API_BASE = '/api';
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}
const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(n);

// ── TenantNav (shared across all tenant pages) ────────────────────────────────
function TenantNav() {
  const pathname = usePathname();
  const links = [
    { href: '/tenant/dashboard',     label: 'My Dashboard' },
    { href: '/tenant/vault',         label: 'My Vault'     },
    { href: '/tenant/pay',           label: 'Pay Rent'     },
    { href: '/tenant/contributions', label: 'History'      },
    { href: '/tenant/notices',       label: 'My Notices'   },
    { href: '/marketplace',          label: 'Marketplace'  },
  ];
  return (
    <nav className="border-b border-zinc-800 bg-[#050505]/90 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 flex gap-0.5 overflow-x-auto py-1" style={{ scrollbarWidth: 'none' }}>
        {links.map(l => {
          const active = pathname === l.href;
          return (
            <Link key={l.href} href={l.href}
              className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap rounded-lg transition-all flex-shrink-0 ${
                active ? 'text-teal-400 bg-teal-500/10 border border-teal-500/20'
                       : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60'}`}>
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface StandaloneVault {
  id: string; vault_balance: number; target_amount: number; installment_amount: number;
  funded_pct: number; frequency: string; status: string; currency: string;
  funded_periods: number; total_contributed: number; contribution_count: number;
  landlord_name: string|null; landlord_email: string|null; landlord_bank_name: string|null;
  landlord_account_name: string|null; linked_tenancy_id: string|null; created_at: string;
}
interface LinkedVault {
  id: string; vault_balance: number; target_amount: number; installment_amount: number;
  funded_pct: number; frequency: string; status: string; total_contributed: number; currency?: string;
}
interface VaultApiResponse {
  success: boolean; hasActiveTenancy: boolean;
  vault: LinkedVault|null; standalone_vault: StandaloneVault|null;
  profile?: { email: string; full_name: string };
}
interface InitForm {
  target_amount: string; installment_amount: string; frequency: string;
  landlord_name: string; landlord_email: string; landlord_bank_name: string;
  landlord_account_number: string; landlord_account_name: string;
}

// ── ProgressRing ──────────────────────────────────────────────────────────────
function ProgressRing({ pct }: { pct: number }) {
  const r = 54, circ = 2 * Math.PI * r, dash = (pct / 100) * circ;
  const col = pct >= 100 ? '#10b981' : pct >= 80 ? '#14b8a6' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="130" height="130" viewBox="0 0 130 130">
      <circle cx="65" cy="65" r={r} fill="none" stroke="#18181b" strokeWidth="10"/>
      <circle cx="65" cy="65" r={r} fill="none" stroke={col} strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ/4}
        strokeLinecap="round" style={{transition:'stroke-dasharray 0.8s ease'}}/>
      <text x="65" y="60" textAnchor="middle" fill="white" fontSize="22" fontWeight="700" fontFamily="monospace">{pct}%</text>
      <text x="65" y="78" textAnchor="middle" fill={col} fontSize="9" fontFamily="monospace" letterSpacing="2">FUNDED</text>
    </svg>
  );
}

// ── EscrowSeal ────────────────────────────────────────────────────────────────
function EscrowSeal({ status }: { status: string }) {
  const ready = status === 'FUNDED_READY';
  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl border ${ready?'border-teal-500/30 bg-teal-500/5':'border-zinc-800 bg-zinc-900/20'}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${ready?'bg-teal-500/20':'bg-zinc-800'}`}>
        <Lock size={14} className={ready?'text-teal-400':'text-zinc-500'}/>
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-300">
          {ready?'🔓 Escrow Release Pending':'🔒 Vault Escrow Active'}
        </p>
        <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
          {ready?'Vault fully funded. Funds will be disbursed to your landlord within 24 hours.'
                :'Funds held in Paystack escrow. Auto-disbursed when vault reaches 100%.'}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <ShieldCheck size={9} className="text-teal-500"/>
          <span className="text-[8px] text-teal-500 font-bold uppercase tracking-widest">Paystack-secured · SHA-256 · Court-admissible</span>
        </div>
      </div>
    </div>
  );
}

// ── VaultStats Grid ───────────────────────────────────────────────────────────
function VaultStats({ items }: { items: {label:string;value:string;color?:string}[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {items.map(s => (
        <div key={s.label} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
          <p className="text-zinc-600 uppercase font-bold text-[8px] mb-0.5">{s.label}</p>
          <p className={`font-black font-mono text-[11px] ${s.color||'text-white'}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Init Vault Form ───────────────────────────────────────────────────────────
function InitVaultForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState<InitForm>({
    target_amount:'',installment_amount:'',frequency:'MONTHLY',
    landlord_name:'',landlord_email:'',landlord_bank_name:'',
    landlord_account_number:'',landlord_account_name:'',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [showLL,  setShowLL]  = useState(false);

  const set = (k: keyof InitForm) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setForm(f => ({...f,[k]:e.target.value}));

  const handleSubmit = async () => {
    setError('');
    if (!form.target_amount||Number(form.target_amount)<100) return setError('Target amount must be at least ₦100');
    if (!form.installment_amount||Number(form.installment_amount)<50) return setError('Installment must be at least ₦50');
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/tenant/standalone-vault/init`,{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({
          target_amount:Number(form.target_amount),installment_amount:Number(form.installment_amount),
          frequency:form.frequency,
          landlord_name:form.landlord_name||undefined,landlord_email:form.landlord_email||undefined,
          landlord_bank_name:form.landlord_bank_name||undefined,
          landlord_account_number:form.landlord_account_number||undefined,
          landlord_account_name:form.landlord_account_name||undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok||!data.success) throw new Error(data.error||'Failed to initialize vault');
      onSuccess();
    } catch(e:any){setError(e.message);}
    finally{setLoading(false);}
  };

  const inp = "w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-teal-500 outline-none transition-colors";
  const lbl = "block text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-1.5";

  return (
    <div className="p-6 rounded-2xl border border-teal-500/20 bg-zinc-900/20 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center text-xl flex-shrink-0">🔒</div>
        <div>
          <h2 className="font-black text-sm uppercase tracking-tight">Initialize Your Savings Vault</h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">Start saving toward rent — no landlord required to begin</p>
        </div>
      </div>
      <div className="p-3 rounded-xl border border-teal-500/15 bg-teal-500/5 text-[10px] text-teal-400 leading-relaxed">
        💡 Savings held in Paystack escrow. When your landlord onboards, funds auto-release. Add their bank details now to pre-configure payout.
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={lbl}>Target Amount (₦) *</label><input className={inp} type="number" placeholder="e.g. 150000" value={form.target_amount} onChange={set('target_amount')}/></div>
        <div><label className={lbl}>Installment Amount (₦) *</label><input className={inp} type="number" placeholder="e.g. 25000" value={form.installment_amount} onChange={set('installment_amount')}/></div>
      </div>
      <div>
        <label className={lbl}>Payment Frequency</label>
        <select className={inp+" cursor-pointer"} value={form.frequency} onChange={set('frequency')}>
          {['DAILY','WEEKLY','BIWEEKLY','MONTHLY','QUARTERLY'].map(f=><option key={f} value={f}>{f.charAt(0)+f.slice(1).toLowerCase()}</option>)}
        </select>
      </div>
      <button onClick={()=>setShowLL(!showLL)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-500 text-[10px] hover:border-teal-500/30 hover:text-teal-400 transition-all">
        <span>🏠 Add Landlord Payout Details <span className="text-zinc-700">(optional — pre-configures auto-release)</span></span>
        <span className="text-xs">{showLL?'▲':'▼'}</span>
      </button>
      {showLL&&(
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Landlord Name</label><input className={inp} placeholder="Full name" value={form.landlord_name} onChange={set('landlord_name')}/></div>
            <div><label className={lbl}>Landlord Email</label><input className={inp} type="email" placeholder="landlord@email.com" value={form.landlord_email} onChange={set('landlord_email')}/></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className={lbl}>Bank Name</label><input className={inp} placeholder="GTBank" value={form.landlord_bank_name} onChange={set('landlord_bank_name')}/></div>
            <div><label className={lbl}>Account Number</label><input className={inp} placeholder="0123456789" value={form.landlord_account_number} onChange={set('landlord_account_number')}/></div>
            <div><label className={lbl}>Account Name</label><input className={inp} placeholder="As on bank" value={form.landlord_account_name} onChange={set('landlord_account_name')}/></div>
          </div>
        </div>
      )}
      {error&&<div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-[11px]">{error}</div>}
      <button onClick={handleSubmit} disabled={loading}
        className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${loading?'bg-zinc-800 text-zinc-600 cursor-not-allowed':'bg-teal-500 text-black hover:bg-teal-400 cursor-pointer'}`}>
        {loading?'⏳ Initializing...':'🚀 Initialize My Savings Vault'}
      </button>
    </div>
  );
}

// ── Standalone Vault Display ──────────────────────────────────────────────────
function StandaloneVaultDisplay({vault,onPay}:{vault:StandaloneVault;onPay:()=>void}) {
  const col = vault.status==='FUNDED_READY'?'#10b981':'#14b8a6';
  return (
    <div className="space-y-4">
      {vault.status==='FUNDED_READY'&&(
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-teal-500/30 bg-teal-500/5">
          <span className="text-xl">🎯</span>
          <div>
            <p className="text-teal-400 font-black text-sm">Vault Fully Funded!</p>
            <p className="text-zinc-500 text-[10px] mt-0.5">Awaiting landlord onboarding for escrow release. Share vault ID <code className="bg-zinc-900 px-1 py-0.5 rounded text-zinc-400 text-[9px]">{vault.id.slice(0,8)}…</code></p>
          </div>
        </div>
      )}
      <div className="p-6 rounded-2xl border bg-zinc-900/20" style={{borderColor:`${col}30`}}>
        <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-5">Independent Flex-Pay Vault</p>
        <div className="flex flex-col md:flex-row items-center gap-8 mb-6">
          <ProgressRing pct={vault.funded_pct}/>
          <div className="flex-1 w-full space-y-3">
            <div>
              <p className="font-black font-mono text-2xl text-white">{fmt(vault.vault_balance)}</p>
              <p className="text-zinc-500 text-xs mt-0.5">of {fmt(vault.target_amount)} target · {vault.frequency.toLowerCase()}</p>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{width:`${vault.funded_pct}%`,background:col}}/>
            </div>
          </div>
        </div>
        <VaultStats items={[
          {label:'Total Saved',value:fmt(vault.total_contributed),color:'text-teal-400'},
          {label:'Installment',value:fmt(vault.installment_amount),color:'text-white'},
          {label:'Payments',value:String(vault.contribution_count),color:'text-zinc-300'},
          {label:'Funded Periods',value:String(vault.funded_periods),color:'text-zinc-300'},
          {label:'Status',value:vault.status.replace('_',' '),color:vault.status==='FUNDED_READY'?'text-teal-400':'text-zinc-300'},
          {label:'Currency',value:vault.currency},
        ]}/>
        {(vault.landlord_name||vault.landlord_email)?(
          <div className="mt-4 p-4 rounded-xl border border-teal-500/15 bg-teal-500/5">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-2">Landlord Payout Destination</p>
            <div className="flex gap-4 flex-wrap text-xs">
              {vault.landlord_name&&<span className="text-white">👤 {vault.landlord_name}</span>}
              {vault.landlord_email&&<span className="text-teal-400">✉️ {vault.landlord_email}</span>}
              {vault.landlord_bank_name&&<span className="text-zinc-400">🏦 {vault.landlord_bank_name}</span>}
              {vault.landlord_account_name&&<span className="text-zinc-400">{vault.landlord_account_name}</span>}
            </div>
            <p className="text-[9px] text-zinc-600 mt-2">✅ Auto-release configured — funds disburse when vault is claimed by landlord</p>
          </div>
        ):(
          <div className="mt-4 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-[10px] text-amber-400">
            ⚠️ No landlord payout details. Add them to pre-configure escrow release, or share vault ID <code className="bg-zinc-900 px-1 py-0.5 rounded text-zinc-400">{vault.id.slice(0,8)}…</code> with your landlord.
          </div>
        )}
        <p className="text-[8px] text-zinc-700 font-mono mt-4">VAULT · {vault.id} · {new Date(vault.created_at).toLocaleDateString('en-NG')}</p>
      </div>
      <EscrowSeal status={vault.status}/>
      {vault.status!=='FUNDED_READY'&&(
        <button onClick={onPay} className="w-full py-4 bg-teal-500 text-black font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all flex items-center justify-center gap-2">
          <DollarSign size={14}/> Pay {fmt(vault.installment_amount)} Installment
        </button>
      )}
      <div className="flex items-center justify-center gap-6 pt-2">
        <Link href="/tenant/contributions" className="text-[11px] text-teal-500 font-bold hover:underline flex items-center gap-1">View All Contributions<ChevronRight size={11}/></Link>
        <Link href="/tenant/pay" className="text-[11px] text-zinc-500 hover:text-zinc-300 font-bold flex items-center gap-1">Pay Installment<ChevronRight size={11}/></Link>
      </div>
    </div>
  );
}

// ── Linked Vault Display ──────────────────────────────────────────────────────
function LinkedVaultDisplay({vault,onPay}:{vault:LinkedVault;onPay:()=>void}) {
  return (
    <div className="space-y-4">
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20">
        <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-5">Flex-Pay Vault</p>
        <div className="flex flex-col md:flex-row items-center gap-8 mb-6">
          <ProgressRing pct={vault.funded_pct}/>
          <div className="flex-1 w-full space-y-3">
            <div>
              <p className="font-black font-mono text-2xl text-white">{fmt(vault.vault_balance)}</p>
              <p className="text-zinc-500 text-xs mt-0.5">of {fmt(vault.target_amount)} target</p>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{width:`${vault.funded_pct}%`,background:vault.funded_pct>=80?'#14b8a6':vault.funded_pct>=50?'#f59e0b':'#ef4444'}}/>
            </div>
          </div>
        </div>
        <VaultStats items={[
          {label:'Vault Balance',value:fmt(vault.vault_balance),color:'text-teal-400'},
          {label:'Annual Target',value:fmt(vault.target_amount),color:'text-white'},
          {label:'Remaining',value:fmt(Math.max(0,vault.target_amount-vault.vault_balance)),color:'text-zinc-300'},
          {label:'Contributed',value:fmt(vault.total_contributed),color:'text-zinc-300'},
          {label:'Installment',value:fmt(vault.installment_amount),color:'text-amber-400'},
          {label:'Status',value:vault.status,color:vault.status==='FUNDED_READY'?'text-teal-400':vault.status==='OVERDUE'?'text-red-400':'text-zinc-300'},
        ]}/>
        <button onClick={onPay} className="w-full mt-5 py-3.5 bg-teal-500 text-black font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all flex items-center justify-center gap-2">
          <DollarSign size={13}/> Pay {fmt(vault.installment_amount)} Installment
        </button>
      </div>
      <EscrowSeal status={vault.status}/>
      <div className="flex items-center justify-center pt-1">
        <Link href="/tenant/contributions" className="text-[11px] text-teal-500 font-bold hover:underline flex items-center gap-1">View All Contributions<ChevronRight size={11}/></Link>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TenantVaultPage() {
  const router = useRouter();
  const [loading,setLoading]=useState(true);
  const [data,setData]=useState<VaultApiResponse|null>(null);
  const [error,setError]=useState('');

  const fetchVault=async()=>{
    setLoading(true);
    try{
      const token=getToken();
      if(!token){router.push('/login');return;}
      const res=await fetch(`${API_BASE}/tenant/my-vault`,{headers:{Authorization:`Bearer ${token}`}});
      setData(await res.json());
    }catch(e:any){setError(e.message);}
    finally{setLoading(false);}
  };
  useEffect(()=>{fetchVault();},[]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar/>
      <TenantNav/>
      <main className="flex-1 max-w-3xl mx-auto px-4 md:px-6 py-8 w-full">
        <div className="border-l-2 border-teal-500 pl-4 mb-8">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-2xl font-black uppercase tracking-tighter">My Flex-Pay Vault</h1>
          <p className="text-zinc-500 text-xs mt-1">Your micro-contribution rent engine</p>
        </div>
        {loading&&<div className="flex items-center justify-center py-20"><RefreshCw className="animate-spin text-teal-500 mr-3" size={20}/><span className="text-zinc-500 font-mono text-sm">Loading vault…</span></div>}
        {!loading&&error&&<div className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400"><AlertCircle size={16}/><span className="text-sm">{error}</span></div>}
        {!loading&&!error&&data?.hasActiveTenancy&&data.vault&&<LinkedVaultDisplay vault={data.vault} onPay={()=>router.push('/tenant/pay')}/>}
        {!loading&&!error&&data?.hasActiveTenancy&&!data.vault&&(
          <div className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900/20 text-center">
            <div className="text-4xl mb-4">🔄</div>
            <p className="font-black text-sm uppercase tracking-tight mb-2">Property Linked — Vault Pending</p>
            <p className="text-zinc-500 text-xs">Your landlord is setting up your Flex-Pay vault. You'll be notified when it activates.</p>
          </div>
        )}
        {!loading&&!error&&!data?.hasActiveTenancy&&data?.standalone_vault&&<StandaloneVaultDisplay vault={data.standalone_vault} onPay={()=>router.push('/tenant/pay')}/>}
        {!loading&&!error&&!data?.hasActiveTenancy&&!data?.standalone_vault&&(
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[['🔒','Escrow-held'],['📅','Your rhythm'],['⚡','Auto-disburse'],['🧾','SHA-256 receipts']].map(([icon,label])=>(
                <div key={label} className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/30 text-center">
                  <div className="text-xl mb-1">{icon}</div>
                  <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">{label}</p>
                </div>
              ))}
            </div>
            <InitVaultForm onSuccess={fetchVault}/>
          </>
        )}
      </main>
      <Footer/>
    </div>
  );
}
