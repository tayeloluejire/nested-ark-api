'use client';
export const dynamic = 'force-dynamic';
/**
 * /tenant/notices/page.tsx
 * TENANT-ONLY — read-only view of all notices issued to this tenant.
 * Real API: GET /api/tenant/my-notices
 * Returns: { notices: [{id, notice_number, notice_type, amount_overdue,
 *             days_overdue, issued_at, served_at, response_deadline, status}] }
 *
 * Download individual notice: GET /api/notices/download/:noticeId (streams PDF binary)
 * Tenant can download their own PDF copy.
 *
 * Tenant CANNOT issue notices — only landlord can via POST /api/notices/generate.
 * If tenant has active notice, banner links to /tenant/pay immediately.
 *
 * STATUS VALUES from backend: 'ISSUED' (default), 'SERVED' (email delivered), 'RESOLVED'
 * NOTE: 'PENDING' is NOT a backend status — was a bug in the original file.
 */
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  Gavel, Loader2, AlertCircle, Download, ArrowLeft,
  CheckCircle2, Clock, ShieldCheck, FileText, Bell, DollarSign,
} from 'lucide-react';

const safeN = (v:any) => { const n=Number(v); return(v==null||isNaN(n))?0:n; };
const safeF = (v:any) => safeN(v).toLocaleString();
const fmtDate = (s:any) => s ? new Date(s).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';

const NOTICE_LABELS: Record<string,{label:string; color:string; icon:any}> = {
  NOTICE_TO_PAY:    { label:'Notice to Pay',    color:'border-amber-500/30 bg-amber-500/5 text-amber-300',     icon:Bell       },
  NOTICE_TO_QUIT:   { label:'Notice to Quit',   color:'border-red-500/30 bg-red-500/5 text-red-300',           icon:Gavel      },
  FINAL_WARNING:    { label:'Final Warning',     color:'border-orange-500/30 bg-orange-500/5 text-orange-300',  icon:AlertCircle },
  EVICTION_WARNING: { label:'Eviction Warning',  color:'border-rose-600/30 bg-rose-600/5 text-rose-300',        icon:Gavel      },
};

// FIX: Added 'ISSUED' badge (was missing — only SERVED/PENDING/RESOLVED existed, PENDING never occurs).
const STATUS_BADGE: Record<string,string> = {
  ISSUED:   'border-amber-500/30 text-amber-400 bg-amber-500/10',
  SERVED:   'border-red-500/30 text-red-400 bg-red-500/10',
  RESOLVED: 'border-teal-500/30 text-teal-400 bg-teal-500/10',
};

function TenantNoticesContent() {
  const [notices,     setNotices]     = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [downloading, setDownloading] = useState<string|null>(null);

  useEffect(() => {
    api.get('/api/tenant/my-notices')
      .then(r => setNotices(r.data.notices ?? []))
      .catch(e => setError(e?.response?.data?.error ?? 'Could not load notices.'))
      .finally(() => setLoading(false));
  }, []);

  const downloadNotice = async (noticeId: string, noticeNumber: string) => {
    setDownloading(noticeId);
    try {
      const res = await api.get(`/api/notices/download/${noticeId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a   = document.createElement('a');
      a.href = url; a.download = `${noticeNumber}.pdf`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch(e:any) {
      alert(e?.response?.data?.error ?? 'Download failed. Try again.');
    } finally { setDownloading(null); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white"><Navbar/>
      <div className="flex items-center justify-center py-40"><Loader2 className="animate-spin text-teal-500" size={28}/></div>
    <Footer/></div>
  );

  // FIX: 'PENDING' is not a real backend status. Active notices are 'ISSUED' or 'SERVED'.
  const activeNotices = notices.filter(n => n.status === 'ISSUED' || n.status === 'SERVED');
  const resolvedCount = notices.filter(n => n.status === 'RESOLVED').length;
  const totalOverdue  = notices.reduce((s, n) => s + safeN(n.amount_overdue), 0);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar/>

      {/* Active notice top banner */}
      {activeNotices.length > 0 && (
        <div className="bg-red-500 px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-white flex-shrink-0"/>
            <p className="text-white text-xs font-black uppercase tracking-wide">
              You have {activeNotices.length} active legal notice{activeNotices.length>1?'s':''}. 
              Respond before the deadline to avoid further action.
            </p>
          </div>
          <Link href="/tenant/pay"
            className="px-4 py-1.5 bg-white text-red-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-100 transition-all flex-shrink-0">
            Pay Now
          </Link>
        </div>
      )}

      <main className="flex-1 max-w-4xl mx-auto px-6 py-10 space-y-8 w-full">

        <Link href="/tenant/dashboard" className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
          <ArrowLeft size={13}/> Dashboard
        </Link>

        <div className="border-l-2 border-red-500 pl-5">
          <p className="text-[9px] text-red-400 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">My Legal Notices</h1>
          <p className="text-zinc-500 text-xs mt-1">Formal notices from your landlord — each is SHA-256 hashed and court-admissible</p>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14}/> {error}
          </div>
        )}

        {/* KPI */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label:'Total Notices', value:notices.length,       color:'text-white' },
            { label:'Active',        value:activeNotices.length, color:activeNotices.length>0?'text-red-400':'text-teal-400' },
            { label:'Resolved',      value:resolvedCount,        color:'text-teal-400' },
          ].map(s=>(
            <div key={s.label} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-1.5">
              <p className={`text-2xl font-black font-mono ${s.color}`}>{s.value}</p>
              <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Active notice urgent card */}
        {activeNotices.length > 0 && (
          <div className="p-5 rounded-2xl border border-red-500/30 bg-red-500/5 space-y-4">
            <p className="text-[9px] text-red-400 uppercase font-black tracking-widest flex items-center gap-1.5">
              <AlertCircle size={11}/> Action Required
            </p>
            <p className="text-sm text-zinc-300 leading-relaxed">
              You have <span className="text-red-300 font-bold">{activeNotices.length} active notice{activeNotices.length>1?'s':''}</span> from your landlord.
              {totalOverdue > 0 && <> Total amount outstanding: <span className="text-red-300 font-bold">₦{safeF(totalOverdue)}</span>.</>}
              {' '}Make a payment immediately to prevent further legal action.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link href="/tenant/pay"
                className="flex items-center gap-2 px-5 py-3 bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-400 transition-all">
                <DollarSign size={13}/> Pay Installment Now
              </Link>
              <Link href="/tenant/vault"
                className="flex items-center gap-2 px-5 py-3 border border-zinc-700 text-zinc-400 rounded-xl text-xs font-bold uppercase tracking-widest hover:text-white transition-all">
                View Vault
              </Link>
            </div>
          </div>
        )}

        {/* All clear state */}
        {notices.length === 0 && !error && (
          <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
            <CheckCircle2 className="text-teal-500 mx-auto" size={40}/>
            <p className="text-teal-400 font-black text-sm uppercase tracking-wide">All Clear</p>
            <p className="text-zinc-600 text-sm">No legal notices on file. Keep your vault funded to maintain this status.</p>
            <Link href="/tenant/pay"
              className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all">
              <DollarSign size={11}/> Make a Contribution
            </Link>
          </div>
        )}

        {/* Notice list */}
        {notices.length > 0 && (
          <div className="space-y-3">
            {notices.map(n => {
              const cfg  = NOTICE_LABELS[n.notice_type] ?? { label:n.notice_type, color:'border-zinc-700 bg-zinc-900/20 text-zinc-400', icon:FileText };
              const Icon = cfg.icon;
              return (
                <div key={n.id} className={`p-5 rounded-2xl border ${cfg.color} space-y-3`}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Icon size={12}/>
                        <span className="text-[8px] font-mono bg-black/30 px-2 py-0.5 rounded border border-white/10">
                          {n.notice_number}
                        </span>
                        {/* FIX: STATUS_BADGE now includes ISSUED key (was missing, showed no badge for new notices) */}
                        <span className={`text-[7px] px-2 py-0.5 rounded border font-black uppercase ${STATUS_BADGE[n.status]??'border-zinc-700 text-zinc-500'}`}>
                          {n.status}
                        </span>
                      </div>
                      <p className="font-black text-base">{cfg.label}</p>
                      <div className="flex items-center gap-3 text-[9px] flex-wrap opacity-80">
                        <span>Issued: {fmtDate(n.issued_at)}</span>
                        {n.served_at && <span>Served: {fmtDate(n.served_at)}</span>}
                        {n.response_deadline && (
                          <span className="font-bold text-red-300">
                            Deadline: {fmtDate(n.response_deadline)}
                          </span>
                        )}
                      </div>
                      {n.amount_overdue && safeN(n.amount_overdue) > 0 && (
                        <p className="text-sm font-black">
                          Amount Outstanding: ₦{safeF(n.amount_overdue)}
                        </p>
                      )}
                      {n.days_overdue && (
                        <p className="text-[9px] opacity-70">{n.days_overdue} days overdue</p>
                      )}
                    </div>
                    <button
                      onClick={() => downloadNotice(n.id, n.notice_number)}
                      disabled={downloading===n.id}
                      className="flex items-center gap-1.5 px-3 py-2 border border-white/20 rounded-xl text-[9px] font-bold uppercase hover:bg-white/10 transition-all flex-shrink-0 disabled:opacity-50">
                      {downloading===n.id?<Loader2 size={10} className="animate-spin"/>:<Download size={10}/>} PDF
                    </button>
                  </div>

                  {/* What to do guidance — FIX: was checking 'PENDING' (never occurs), now checks 'ISSUED' */}
                  {(n.status==='ISSUED' || n.status==='SERVED') && (
                    <div className="pt-3 border-t border-white/10">
                      <p className="text-[9px] opacity-70 leading-relaxed">
                        To resolve this notice, make a payment before the deadline above. 
                        Once your vault is fully funded and rent is disbursed, this notice will be marked resolved.
                      </p>
                      <Link href="/tenant/pay"
                        className="inline-flex items-center gap-1.5 mt-2 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-[9px] font-black uppercase hover:bg-white/20 transition-all">
                        <DollarSign size={10}/> Pay Now to Resolve
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Trust footer */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-zinc-900">
          {[
            <><ShieldCheck size={9}/> SHA-256 Hashed</>,
            <><FileText size={9}/> Court-Admissible</>,
            <><CheckCircle2 size={9}/> Immutable Ledger</>,
          ].map((b,i)=>(
            <span key={i} className="flex items-center gap-1 text-[8px] text-teal-500 border border-teal-500/20 bg-teal-500/5 px-3 py-1.5 rounded-lg font-bold uppercase">{b}</span>
          ))}
        </div>

      </main>
      <Footer/>
    </div>
  );
}

export default function TenantNoticesPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={28}/></div>}>
      <TenantNoticesContent/>
    </Suspense>
  );
}
