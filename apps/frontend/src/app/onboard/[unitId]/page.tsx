'use client';
export const dynamic = 'force-dynamic';
/**
 * /onboard/[unitId]/page.tsx
 * Token-gated — tenant CLAIMS a pre-created account (landlord created the tenancy).
 * Tenant CANNOT create their own tenancy here. They only set a password.
 */
import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { CheckCircle2, Loader2, AlertCircle, Lock, Eye, EyeOff, Home } from 'lucide-react';

function ClaimContent() {
  const { unitId }   = useParams<{unitId:string}>();
  const searchParams = useSearchParams();
  const { login }    = useAuth();
  const token = searchParams.get('token') ?? '';

  const [unit,     setUnit]    = useState<any>(null);
  const [loading,  setLoading] = useState(true);
  const [saving,   setSaving]  = useState(false);
  const [success,  setSuccess] = useState(false);
  const [error,    setError]   = useState('');
  const [showPw,   setShowPw]  = useState(false);
  const [password, setPw]      = useState('');
  const [confirm,  setConfirm] = useState('');

  useEffect(()=>{
    if (!unitId) return;
    api.get(`/api/rental/invite/${unitId}?token=${token}`)
      .then(r=>setUnit(r.data.unit??r.data))
      .catch(e=>setError(e?.response?.data?.error??'Invalid or expired invite link.'))
      .finally(()=>setLoading(false));
  },[unitId,token]);

  const handleClaim = async () => {
    if (password.length<8){setError('Password must be at least 8 characters.');return;}
    if (password!==confirm){setError('Passwords do not match.');return;}
    setSaving(true);setError('');
    try {
      const res = await api.post(`/api/rental/invite/${unitId}/claim`,{token,password});
      setSuccess(true);
      await login(res.data.email, password);
    } catch(e:any){
      setError(e?.response?.data?.error??'Failed to activate. Link may have expired.');
      setSaving(false);
    }
  };

  if (loading) return <div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={28}/></div>;

  if (success) return (
    <div className="h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-center space-y-4">
        <CheckCircle2 className="text-teal-500 mx-auto" size={48}/>
        <p className="text-xl font-black uppercase text-white">Account Activated!</p>
        <p className="text-zinc-500 text-sm">Redirecting to your tenant dashboard…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <Home className="text-teal-500 mx-auto" size={40}/>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Activate Your Account</h1>
          {unit && <p className="text-zinc-500 text-sm">Set a password for <span className="text-teal-400 font-bold">{unit.unit_name}</span></p>}
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold text-center">
            <AlertCircle size={16} className="mx-auto mb-2"/>{error}
          </div>
        )}

        {unit && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl border border-teal-500/20 bg-teal-500/5">
              <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest mb-1">Your Unit</p>
              <p className="font-bold text-sm">{unit.unit_name}</p>
              <p className="text-[10px] text-zinc-400">{unit.project_title} · {unit.currency||'NGN'} {Number(unit.rent_amount||0).toLocaleString()}/month</p>
            </div>
            <div className="relative">
              <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"/>
              <input type={showPw?'text':'password'} value={password} onChange={e=>setPw(e.target.value)}
                placeholder="Set password (min 8 chars)"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-12 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none"/>
              <button onClick={()=>setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white">
                {showPw?<EyeOff size={14}/>:<Eye size={14}/>}
              </button>
            </div>
            <div className="relative">
              <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"/>
              <input type={showPw?'text':'password'} value={confirm} onChange={e=>setConfirm(e.target.value)}
                placeholder="Confirm password"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-teal-500 outline-none"/>
            </div>
            <button onClick={handleClaim} disabled={saving}
              className="w-full py-4 bg-teal-500 text-black rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-teal-400 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {saving?<Loader2 size={16} className="animate-spin"/>:<CheckCircle2 size={16}/>}
              {saving?'Activating…':'Activate & Sign In'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnboardUnitPage(){
  return(
    <Suspense fallback={<div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={28}/></div>}>
      <ClaimContent/>
    </Suspense>
  );
}
