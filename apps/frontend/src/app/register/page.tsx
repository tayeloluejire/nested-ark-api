'use client';
export const dynamic = 'force-dynamic';
/**
 * /register/page.tsx
 * Self-registration. Captures both DB role (sent to backend)
 * and accountType (stored in localStorage — not sent to backend).
 *
 * Role→accountType mapping:
 *   DEVELOPER + "I own rental properties" → accountType=LANDLORD → /landlord/tenants
 *   DEVELOPER + "I build infrastructure"  → accountType=INFRASTRUCTURE → /projects/my
 *   DEVELOPER + "I invest from diaspora"  → accountType=DIASPORA → /projects/my
 *   INVESTOR                              → accountType=INVESTOR → /portfolio
 *   CONTRACTOR                            → accountType=CONTRACTOR → /dashboard
 *   SUPPLIER                              → accountType=SUPPLIER → /dashboard
 *   BANK                                  → accountType=BANK → /dashboard
 *
 * NOT self-registerable: TENANT (landlord onboards), GOVERNMENT, ADMIN, VERIFIER.
 */
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import type { DbRole, AccountType } from '@/lib/AuthContext';
import { Loader2, AlertCircle, Eye, EyeOff, User, Mail, Phone, Lock, ChevronRight } from 'lucide-react';

interface RoleOption {
  dbRole:      DbRole;
  accountType: AccountType;
  label:       string;
  sublabel:    string;
  desc:        string;
  emoji:       string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    dbRole:'DEVELOPER', accountType:'LANDLORD',
    label:'Property Landlord', sublabel:'Rental Management',
    desc:'Own residential or commercial rental units. Onboard tenants, manage Flex-Pay vaults, issue legal notices.',
    emoji:'🏠',
  },
  {
    dbRole:'DEVELOPER', accountType:'INFRASTRUCTURE',
    label:'Infrastructure Developer', sublabel:'Project Submission',
    desc:'Submit roads, bridges, energy, housing projects. Manage milestones, contractors, and investor bids.',
    emoji:'🏗️',
  },
  {
    dbRole:'DEVELOPER', accountType:'DIASPORA',
    label:'Diaspora Developer', sublabel:'Remote Investment',
    desc:'Invest in and build infrastructure from abroad. Same powers as infrastructure developer — diaspora-flagged.',
    emoji:'🌍',
  },
  {
    dbRole:'INVESTOR', accountType:'INVESTOR',
    label:'Investor', sublabel:'Portfolio & ROI',
    desc:'Browse vetted projects, commit capital, track returns, and receive rental income distributions.',
    emoji:'📈',
  },
  {
    dbRole:'CONTRACTOR', accountType:'CONTRACTOR',
    label:'Contractor', sublabel:'Milestone Delivery',
    desc:'Bid on project milestones. Receive escrow-backed payments on verified completion.',
    emoji:'🔧',
  },
  {
    dbRole:'SUPPLIER', accountType:'SUPPLIER',
    label:'Supply Partner', sublabel:'Materials & Logistics',
    desc:'Supply materials and services to infrastructure projects listed on the platform.',
    emoji:'📦',
  },
  {
    dbRole:'BANK', accountType:'BANK',
    label:'Bank / Financier', sublabel:'Project Finance',
    desc:'Co-fund large infrastructure projects. Access verified project documentation and financial models.',
    emoji:'🏦',
  },
];

function RegisterContent() {
  const { register } = useAuth();
  const [selected, setSelected] = useState<RoleOption>(ROLE_OPTIONS[0]);
  const [form, setForm] = useState({ full_name:'', email:'', phone:'', password:'' });
  const [showPw,  setShowPw]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const set = (k:string, v:string) => setForm(f=>({...f,[k]:v}));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name||!form.email||!form.password){setError('Name, email and password are required.');return;}
    if (form.password.length<8){setError('Password must be at least 8 characters.');return;}
    setLoading(true);setError('');
    try {
      await register({
        ...form,
        role:        selected.dbRole,
        accountType: selected.accountType,
      });
    } catch(ex:any){
      setError(ex?.response?.data?.error??'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg space-y-8">

        <div className="text-center space-y-2">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-[0.3em] uppercase">Nested Ark</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Create Account</h1>
          <p className="text-zinc-500 text-sm">
            Tenant?{' '}
            <span className="text-zinc-400 font-bold">Your landlord will send you an invite link.</span>
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={13}/> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Role + accountType picker */}
          <div className="space-y-2">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">I am a…</label>
            <div className="space-y-2">
              {ROLE_OPTIONS.map(r => (
                <button key={`${r.dbRole}-${r.accountType}`} type="button"
                  onClick={() => setSelected(r)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${selected.accountType===r.accountType&&selected.dbRole===r.dbRole?'border-teal-500/40 bg-teal-500/10':'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700'}`}>
                  <span className="text-xl flex-shrink-0 mt-0.5">{r.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs font-black uppercase tracking-tight ${selected.accountType===r.accountType&&selected.dbRole===r.dbRole?'text-teal-400':'text-zinc-300'}`}>
                        {r.label}
                      </p>
                      <span className="text-[7px] text-zinc-600 border border-zinc-800 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                        {r.sublabel}
                      </span>
                    </div>
                    <p className="text-[9px] text-zinc-500 mt-0.5 leading-relaxed">{r.desc}</p>
                  </div>
                  {selected.accountType===r.accountType&&selected.dbRole===r.dbRole && (
                    <div className="w-3 h-3 rounded-full bg-teal-500 flex-shrink-0 mt-1"/>
                  )}
                </button>
              ))}
            </div>
            {/* Show what will be stored */}
            <p className="text-[8px] text-zinc-700 font-mono px-1">
              DB role: <span className="text-zinc-500">{selected.dbRole}</span>
              {' '}· Account type: <span className="text-zinc-500">{selected.accountType}</span>
            </p>
          </div>

          {/* Fields */}
          {[
            {k:'full_name', label:'Full Name *',    type:'text',  Icon:User,  placeholder:'Your full name',         required:true},
            {k:'email',     label:'Email *',         type:'email', Icon:Mail,  placeholder:'you@email.com',          required:true},
            {k:'phone',     label:'Phone',           type:'tel',   Icon:Phone, placeholder:'+234 800 000 0000',      required:false},
          ].map(f=>(
            <div key={f.k} className="space-y-1.5">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">{f.label}</label>
              <div className="relative">
                <f.Icon size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"/>
                <input type={f.type} value={(form as any)[f.k]} onChange={e=>set(f.k,e.target.value)}
                  placeholder={f.placeholder} required={f.required}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none"/>
              </div>
            </div>
          ))}

          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Password *</label>
            <div className="relative">
              <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"/>
              <input type={showPw?'text':'password'} autoComplete="new-password" value={form.password} onChange={e=>set('password',e.target.value)} required
                placeholder="Minimum 8 characters"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-12 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none"/>
              <button type="button" onClick={()=>setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white">
                {showPw?<EyeOff size={14}/>:<Eye size={14}/>}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-4 bg-teal-500 text-black rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-teal-400 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {loading?<Loader2 size={16} className="animate-spin"/>:<ChevronRight size={16}/>}
            {loading?'Creating account…':'Create Account'}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-600">
          Already have an account?{' '}
          <Link href="/login" className="text-teal-500 hover:text-white font-bold transition-colors">Sign In</Link>
        </p>
        <p className="text-center text-[9px] text-zinc-700">
          Government · Admin · Verifier accounts are assigned by system admin.{' '}
          Contact <span className="text-zinc-500">nestedark@gmail.com</span>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage(){
  return(
    <Suspense fallback={<div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={28}/></div>}>
      <RegisterContent/>
    </Suspense>
  );
}
