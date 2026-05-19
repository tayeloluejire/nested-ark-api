'use client';
export const dynamic = 'force-dynamic';
/**
 * /tenant/contributions/page.tsx
 * Real API: GET /api/tenant/my-contributions
 * Returns: contributions[] { id, amount, currency, period_label, paid_at,
 *          status, ledger_hash, receipt_id }
 * Receipt download: GET /api/tenant/receipt/:contributionId
 * NOTE: endpoint requires auth — uses api.get with blob responseType, not bare <a href>
 */
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { Receipt, Loader2, AlertCircle, ArrowLeft, Download, ShieldCheck, CheckCircle2, Clock } from 'lucide-react';

const safeN = (v:any) => { const n=Number(v); return(v==null||isNaN(n))?0:n; };
const safeF = (v:any) => safeN(v).toLocaleString();

function ContributionsContent() {
  const [items,       setItems]       = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [downloading, setDownloading] = useState<string|null>(null);

  useEffect(() => {
    api.get('/api/tenant/my-contributions')
      .then(r => setItems(r.data.contributions ?? []))
      .catch(e => setError(e?.response?.data?.error ?? 'Could not load contributions.'))
      .finally(() => setLoading(false));
  }, []);

  // FIX: receipt endpoint requires authentication — cannot use bare <a href>.
  // Use api.get with responseType blob, then trigger client-side download.
  const downloadReceipt = async (receiptId: string, label: string) => {
    setDownloading(receiptId);
    try {
      const res = await api.get(`/api/tenant/receipt/${receiptId}`, { responseType: 'blob' });
      const contentType = res.headers?.['content-type'] ?? 'text/html';
      const ext  = contentType.includes('pdf') ? 'pdf' : 'html';
      const url  = URL.createObjectURL(new Blob([res.data], { type: contentType }));
      const a    = document.createElement('a');
      a.href = url; a.download = `Receipt-${label || receiptId}.${ext}`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch(e:any) {
      alert(e?.response?.data?.error ?? 'Download failed. Please try again.');
    } finally { setDownloading(null); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white"><Navbar />
      <div className="flex items-center justify-center py-40"><Loader2 className="animate-spin text-teal-500" size={28} /></div>
    <Footer /></div>
  );

  const totalPaid = items.filter(c => c.status === 'SUCCESS').reduce((s, c) => s + safeN(c.amount), 0);
  const currency  = items[0]?.currency || 'NGN';

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-6 py-10 space-y-8 w-full">

        <Link href="/tenant/dashboard" className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
          <ArrowLeft size={13} /> Dashboard
        </Link>

        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">My Contributions</h1>
          <p className="text-zinc-500 text-xs mt-1">Complete payment history — SHA-256 hashed &amp; court-admissible</p>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Paid',     value: `${currency} ${safeF(totalPaid)}`,                           color: 'text-teal-400' },
            { label: 'Payments Made',  value: items.filter(c=>c.status==='SUCCESS').length,                 color: 'text-white'    },
            { label: 'Total Records',  value: items.length,                                                  color: 'text-zinc-400' },
          ].map(s => (
            <div key={s.label} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-1.5">
              <p className={`text-xl font-black font-mono ${s.color}`}>{s.value}</p>
              <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>

        {/* List */}
        {items.length === 0 && !error ? (
          <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl space-y-3">
            <Receipt className="text-zinc-700 mx-auto" size={36} />
            <p className="text-zinc-500 font-bold">No contributions yet</p>
            <p className="text-zinc-600 text-sm">Payment history appears here after your first Flex-Pay installment.</p>
            <Link href="/tenant/pay"
              className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all">
              Make First Payment
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(c => (
              <div key={c.id} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex items-center justify-between gap-4 flex-wrap">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.status === 'SUCCESS'
                      ? <CheckCircle2 size={12} className="text-teal-500 flex-shrink-0" />
                      : <Clock size={12} className="text-zinc-600 flex-shrink-0" />
                    }
                    <p className="font-bold text-sm">{c.period_label || 'Flex-Pay contribution'}</p>
                    <span className={`text-[7px] px-1.5 py-0.5 rounded border font-black uppercase ${c.status==='SUCCESS'?'border-teal-500/30 text-teal-400':'border-zinc-700 text-zinc-500'}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[9px] text-zinc-500 flex-wrap">
                    {c.paid_at && <span>{new Date(c.paid_at).toLocaleDateString('en-GB')}</span>}
                    {c.ledger_hash && (
                      <span className="flex items-center gap-1 font-mono text-[8px] text-zinc-700">
                        <ShieldCheck size={8} className="text-teal-500/50" /> {c.ledger_hash.slice(0, 18)}…
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="font-mono font-bold text-lg text-teal-400">{currency} {safeF(c.amount)}</p>
                    <p className="text-[8px] text-zinc-600 uppercase font-bold">contribution</p>
                  </div>
                  {/* FIX: was bare <a href> (unauthenticated — always 401). Now uses api.get blob download. */}
                  {c.receipt_id && (
                    <button
                      onClick={() => downloadReceipt(c.receipt_id, c.period_label || c.id)}
                      disabled={downloading === c.receipt_id}
                      className="flex items-center gap-1.5 px-3 py-2 border border-zinc-700 text-zinc-400 rounded-xl text-[9px] font-bold uppercase hover:text-teal-400 hover:border-teal-500/30 transition-all disabled:opacity-50">
                      {downloading === c.receipt_id
                        ? <Loader2 size={10} className="animate-spin" />
                        : <Download size={10} />} PDF
                    </button>
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

export default function TenantContributionsPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={28} /></div>}>
      <ContributionsContent />
    </Suspense>
  );
}
