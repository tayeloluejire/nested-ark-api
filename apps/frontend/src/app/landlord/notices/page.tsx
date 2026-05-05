'use client';
export const dynamic = 'force-dynamic';
/**
 * /landlord/notices/page.tsx
 * DEVELOPER + accountType=LANDLORD only (middleware enforces).
 *
 * Lists all legal notices across all landlord properties.
 * Issue new notice: POST /api/notices/generate
 *   Body: { tenancy_id, notice_type, amount_overdue, days_overdue, notes }
 *   Returns: PDF download stream OR JSON with notice_id, notice_number, ledger_hash
 *
 * List notices: GET /api/notices/:projectId
 *   Returns: { notices: [{id, notice_number, notice_type, tenant_name, unit_name,
 *              amount_overdue, days_overdue, issued_at, served_at,
 *              response_deadline, status, ledger_hash}] }
 *
 * Download: GET /api/notices/download/:noticeId
 *   Returns: PDF or HTML
 *
 * Landlord tenancies: GET /api/rental/landlord/tenants
 *   Returns tenancy list with tenancy_id, days_overdue, etc.
 */
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  Gavel, Loader2, AlertCircle, RefreshCw, Download,
  CheckCircle2, Clock, X, ShieldCheck, Bell, FileText,
  ArrowLeft, Users,
} from 'lucide-react';

const safeN = (v:any) => { const n=Number(v); return(v==null||isNaN(n))?0:n; };
const safeF = (v:any) => safeN(v).toLocaleString();
const fmtDate = (s:any) => s ? new Date(s).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';

const NOTICE_TYPES = [
  { key:'NOTICE_TO_PAY',    label:'Notice to Pay',    days:7,  color:'border-amber-500/40 bg-amber-500/5',   badge:'bg-amber-500/10 text-amber-400 border-amber-500/20',  icon:Bell  },
  { key:'NOTICE_TO_QUIT',   label:'Notice to Quit',   days:30, color:'border-red-500/40 bg-red-500/5',       badge:'bg-red-500/10 text-red-400 border-red-500/20',         icon:Clock },
  { key:'FINAL_WARNING',    label:'Final Warning',    days:2,  color:'border-orange-500/40 bg-orange-500/5', badge:'bg-orange-500/10 text-orange-400 border-orange-500/20', icon:AlertCircle },
  { key:'EVICTION_WARNING', label:'Eviction Warning', days:30, color:'border-rose-600/40 bg-rose-600/5',     badge:'bg-rose-600/10 text-rose-400 border-rose-600/20',       icon:Gavel },
] as const;

const STATUS_STYLE: Record<string,string> = {
  SERVED:  'border-red-500/30 text-red-400 bg-red-500/10',
  PENDING: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  RESOLVED:'border-teal-500/30 text-teal-400 bg-teal-500/10',
};

// ── Issue Notice Modal ────────────────────────────────────────────────────────
function IssueNoticeModal({
  tenancies, onClose, onIssued,
}: { tenancies:any[]; onClose:()=>void; onIssued:()=>void }) {
  const [tenancyId,  setTenancyId]  = useState(tenancies[0]?.id ?? '');
  const [noticeType, setNoticeType] = useState('NOTICE_TO_PAY');
  const [notes,      setNotes]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [result,     setResult]     = useState('');
  const [isError,    setIsError]    = useState(false);

  const selectedTenancy = tenancies.find(t => t.id === tenancyId);
  const selectedNotice  = NOTICE_TYPES.find(n => n.key === noticeType)!;

  const issue = async () => {
    if (!tenancyId) { setResult('Select a tenant first.'); setIsError(true); return; }
    setSending(true); setResult(''); setIsError(false);
    try {
      await api.post('/api/notices/generate', {
        tenancy_id:    tenancyId,
        notice_type:   noticeType,
        amount_overdue:selectedTenancy?.rent_amount ?? 0,
        days_overdue:  selectedTenancy?.days_overdue ?? 0,
        notes:         notes || undefined,
      });
      setResult(`✓ ${selectedNotice.label} issued. PDF emailed to ${selectedTenancy?.tenant_email}.`);
      setTimeout(() => { onIssued(); onClose(); }, 2200);
    } catch(e:any) {
      setResult(e?.response?.data?.error ?? 'Failed to issue notice.');
      setIsError(true);
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-900">
          <div>
            <p className="text-[8px] text-red-400 uppercase font-black tracking-[0.25em]">Litigation Command</p>
            <p className="text-sm font-black uppercase tracking-tight text-white mt-0.5">Issue Legal Notice</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-zinc-600 hover:text-white hover:bg-zinc-800 transition-all">
            <X size={16}/>
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* Tenant picker */}
          <div className="space-y-2">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Select Tenant *</label>
            {tenancies.length === 0 ? (
              <p className="text-zinc-500 text-sm">No active tenancies found. Onboard a tenant first.</p>
            ) : (
              tenancies.map(t => (
                <button key={t.id} onClick={() => setTenancyId(t.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${tenancyId===t.id?'border-teal-500/40 bg-teal-500/5':'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'}`}>
                  <div>
                    <p className="text-xs font-bold text-white">{t.tenant_name ?? t.full_name}</p>
                    <p className="text-[9px] text-zinc-500">{t.unit_name} · ₦{safeF(t.rent_amount)}/mo</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    {(t.days_overdue ?? 0) > 0
                      ? <span className="text-[8px] text-red-400 font-bold">{t.days_overdue}d overdue</span>
                      : <span className="text-[8px] text-teal-400 font-bold">Current</span>
                    }
                    {tenancyId===t.id && <CheckCircle2 size={12} className="text-teal-400 mt-1 ml-auto"/>}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Notice type */}
          <div className="space-y-2">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Notice Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {NOTICE_TYPES.map(n => {
                const Icon = n.icon;
                return (
                  <button key={n.key} onClick={() => setNoticeType(n.key)}
                    className={`p-3 rounded-xl border text-left transition-all ${noticeType===n.key?n.color:'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={12} className={noticeType===n.key?'':'text-zinc-500'}/>
                      <p className="text-[10px] font-black uppercase tracking-tight">{n.label}</p>
                    </div>
                    <p className="text-[8px] text-zinc-500">{n.days}-day deadline</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legal badge */}
          <div className={`px-3 py-2 rounded-xl border text-[9px] font-bold ${selectedNotice.badge}`}>
            ⚖️ SHA-256 hashed · emailed as signed PDF · immutably ledgered
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest block">Additional Notes (optional)</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
              placeholder="e.g. Rent overdue since 1 March — formal notice as per tenancy agreement…"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-xs text-white placeholder:text-zinc-700 focus:border-teal-500 outline-none resize-none"/>
          </div>

          {result && (
            <div className={`p-3 rounded-xl text-xs font-bold border ${isError?'bg-red-500/10 border-red-500/30 text-red-400':'bg-teal-500/10 border-teal-500/30 text-teal-400'}`}>
              {result}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-zinc-900 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-zinc-800 text-zinc-500 font-bold text-[10px] uppercase tracking-widest hover:text-zinc-300 hover:border-zinc-600 transition-all">
            Cancel
          </button>
          <button onClick={issue} disabled={sending||!tenancyId}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-black text-[10px] uppercase tracking-widest hover:bg-red-400 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {sending?<Loader2 size={13} className="animate-spin"/>:<Gavel size={13}/>}
            {sending?'Issuing…':'Issue Notice'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function LandlordNoticesContent() {
  const [tenancies,    setTenancies]    = useState<any[]>([]);
  const [allNotices,   setAllNotices]   = useState<any[]>([]);
  const [projects,     setProjects]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [showModal,    setShowModal]    = useState(false);
  const [downloading,  setDownloading]  = useState<string|null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [tRes, pRes] = await Promise.allSettled([
        api.get('/api/rental/landlord/tenants'),
        api.get('/api/projects/my'),
      ]);
      let tenancyList: any[] = [];
      let projectList: any[] = [];
      if (tRes.status==='fulfilled') tenancyList = tRes.value.data.tenants ?? [];
      if (pRes.status==='fulfilled') projectList = pRes.value.data.projects ?? [];
      setTenancies(tenancyList);
      setProjects(projectList);

      // Fetch notices for each project
      const noticeResults = await Promise.allSettled(
        projectList.map((p:any) => api.get(`/api/notices/${p.id}`))
      );
      const combined: any[] = [];
      noticeResults.forEach(r => {
        if (r.status==='fulfilled') combined.push(...(r.value.data.notices ?? []));
      });
      combined.sort((a,b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime());
      setAllNotices(combined);
    } catch(e:any) {
      setError(e?.response?.data?.error ?? 'Could not load notices.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const downloadNotice = async (noticeId: string, noticeNumber: string) => {
    setDownloading(noticeId);
    try {
      const res = await api.get(`/api/notices/download/${noticeId}`, { responseType:'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `${noticeNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch(e:any) {
      alert(e?.response?.data?.error ?? 'Download failed.');
    } finally { setDownloading(null); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white"><Navbar/>
      <div className="flex items-center justify-center py-40"><Loader2 className="animate-spin text-teal-500" size={28}/></div>
    <Footer/></div>
  );

  const overdueCount = tenancies.filter(t=>(t.days_overdue??0)>0).length;
  const servedCount  = allNotices.filter(n=>n.status==='SERVED').length;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar/>

      {showModal && (
        <IssueNoticeModal
          tenancies={tenancies}
          onClose={() => setShowModal(false)}
          onIssued={load}
        />
      )}

      {/* Status bar */}
      <div className="border-b border-zinc-800 bg-black px-6 py-2 flex items-center gap-5 text-[9px] font-mono uppercase tracking-widest overflow-x-auto">
        <span className="text-teal-500 flex-shrink-0">Landlord · Legal</span>
        <span className="text-zinc-500 flex-shrink-0">{allNotices.length} notices</span>
        {overdueCount>0 && <span className="text-red-400 font-black flex-shrink-0">{overdueCount} tenants overdue</span>}
      </div>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-10 space-y-8 w-full">

        <Link href="/landlord/tenants" className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
          <ArrowLeft size={13}/> Tenants
        </Link>

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="border-l-2 border-red-500 pl-5">
            <p className="text-[9px] text-red-400 font-mono font-black tracking-widest uppercase mb-1">Litigation Command</p>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Legal Notices</h1>
            <p className="text-zinc-500 text-xs mt-1">Issue, track and download formal notices — SHA-256 ledgered</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-400 transition-all">
            <Gavel size={12}/> Issue Notice
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14}/> {error}
            <button onClick={load} className="ml-auto text-teal-500 text-xs font-black hover:text-white">Retry →</button>
          </div>
        )}

        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {label:'Total Notices',    value:allNotices.length,     color:'text-white'},
            {label:'Served',           value:servedCount,           color:'text-red-400'},
            {label:'Overdue Tenants',  value:overdueCount,          color:overdueCount>0?'text-red-400':'text-teal-400'},
            {label:'Properties',       value:projects.length,       color:'text-zinc-400'},
          ].map(s=>(
            <div key={s.label} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-1.5">
              <p className={`text-2xl font-black font-mono ${s.color}`}>{s.value}</p>
              <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Overdue tenants needing action */}
        {overdueCount > 0 && (
          <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/5 space-y-3">
            <p className="text-[9px] text-red-400 uppercase font-black tracking-widest flex items-center gap-1.5">
              <AlertCircle size={11}/> Tenants Requiring Immediate Action
            </p>
            {tenancies.filter(t=>(t.days_overdue??0)>0).map(t=>(
              <div key={t.id} className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="font-bold text-sm">{t.tenant_name ?? t.full_name}</p>
                  <p className="text-[9px] text-zinc-500">{t.unit_name} · {t.days_overdue} days overdue · ₦{safeF(t.rent_amount)}</p>
                </div>
                <button onClick={() => setShowModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase hover:bg-red-400 transition-all flex-shrink-0">
                  <Gavel size={10}/> Issue Notice
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Notice type quick-issue grid */}
        <div>
          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-3">Quick Issue</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {NOTICE_TYPES.map(n => {
              const Icon = n.icon;
              return (
                <button key={n.key} onClick={() => setShowModal(true)}
                  className={`p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5 ${n.color}`}>
                  <Icon size={14} className="mb-1.5"/>
                  <p className="text-[10px] font-black uppercase tracking-tight">{n.label}</p>
                  <p className="text-[8px] text-zinc-500 mt-0.5">{n.days}-day deadline</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notice history */}
        <div className="space-y-4">
          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
            Notice History ({allNotices.length})
          </p>

          {allNotices.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl space-y-3">
              <Gavel className="text-zinc-700 mx-auto" size={36}/>
              <p className="text-zinc-400 font-bold">No notices issued yet</p>
              <p className="text-zinc-600 text-sm">Notices appear here once issued. Each is SHA-256 hashed and court-admissible.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allNotices.map(n => (
                <div key={n.id} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 transition-all">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[8px] font-mono text-teal-500 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded">
                          {n.notice_number}
                        </span>
                        <span className={`text-[7px] px-2 py-0.5 rounded border font-black uppercase ${STATUS_STYLE[n.status]??'border-zinc-700 text-zinc-500'}`}>
                          {n.status}
                        </span>
                        <span className="text-[7px] text-zinc-600 border border-zinc-800 px-2 py-0.5 rounded font-mono">
                          {n.notice_type?.replace(/_/g,' ')}
                        </span>
                      </div>
                      <p className="font-bold text-sm">{n.tenant_name}</p>
                      <div className="flex items-center gap-3 text-[9px] text-zinc-500 flex-wrap">
                        <span>{n.unit_name}</span>
                        <span>Issued: {fmtDate(n.issued_at)}</span>
                        {n.response_deadline && <span>Deadline: {fmtDate(n.response_deadline)}</span>}
                        {n.amount_overdue && <span className="text-red-400 font-bold">₦{safeF(n.amount_overdue)} overdue</span>}
                      </div>
                      {n.ledger_hash && (
                        <p className="text-[8px] text-zinc-700 font-mono flex items-center gap-1 mt-0.5">
                          <ShieldCheck size={8} className="text-teal-500/40"/> {n.ledger_hash.slice(0,24)}…
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => downloadNotice(n.id, n.notice_number)}
                      disabled={downloading===n.id}
                      className="flex items-center gap-1.5 px-3 py-2 border border-zinc-700 text-zinc-400 rounded-xl text-[9px] font-bold uppercase hover:text-teal-400 hover:border-teal-500/30 transition-all flex-shrink-0 disabled:opacity-50">
                      {downloading===n.id?<Loader2 size={10} className="animate-spin"/>:<Download size={10}/>} PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trust */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-zinc-900">
          {[
            <><ShieldCheck size={9}/> SHA-256 Hashed</>,
            <><FileText size={9}/> Court-Admissible PDF</>,
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

export default function LandlordNoticesPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={28}/></div>}>
      <LandlordNoticesContent/>
    </Suspense>
  );
}
