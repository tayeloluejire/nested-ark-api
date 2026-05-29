'use client';
export const dynamic = 'force-dynamic';
/**
 * /tenant/contributions/page.tsx
 * Real API: GET /api/tenant/my-contributions
 * Receipt download: GET /api/tenant/receipt/:contributionId (blob)
 */
import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  ArrowLeft, Download, Loader2, ShieldCheck,
  CheckCircle2, Clock, AlertCircle, Receipt, FileText,
} from 'lucide-react';

const API_BASE = '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', minimumFractionDigits: 2,
  }).format(Number(n || 0));

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-NG', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return '—'; }
};

const fmtTime = (d: string | null) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

interface Contribution {
  id:           string;
  amount:       number;
  currency:     string;
  period_label: string;
  paid_at:      string | null;
  status:       string;
  ledger_hash:  string | null;
  receipt_id:   string;
  source?:      string;
}

interface Summary {
  total_paid: number;
  count:      number;
  source:     'linked' | 'standalone' | 'none';
}

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: '#10b981',
  PENDING: '#f59e0b',
  FAILED:  '#ef4444',
};

// ── Hash badge — click to copy ────────────────────────────────────────────────
function HashBadge({ hash }: { hash: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!hash) return <span className="text-zinc-700 text-[10px] font-mono">—</span>;
  const short = hash.slice(0, 14) + '…';
  const copy = () => {
    navigator.clipboard.writeText(hash).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      title={hash}
      className="flex items-center gap-1 group"
    >
      <ShieldCheck size={9} className="text-teal-500/60 shrink-0" />
      <span className={`font-mono text-[10px] transition-colors ${
        copied ? 'text-teal-400' : 'text-teal-600 group-hover:text-teal-400'
      }`}>
        {copied ? 'Copied!' : short}
      </span>
    </button>
  );
}

// ── Receipt download button ───────────────────────────────────────────────────
function ReceiptButton({ contributionId, label }: { contributionId: string; label: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  const download = async () => {
    setState('loading');
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/tenant/receipt/${contributionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const contentType = res.headers.get('content-type') ?? 'text/html';
      const ext  = contentType.includes('pdf') ? 'pdf' : 'html';
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `Receipt-${label}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState('idle');
    } catch (e: any) {
      console.error('Receipt download failed:', e);
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  if (state === 'error') return (
    <span className="text-[9px] text-red-400 font-bold">Failed — retry</span>
  );

  return (
    <button
      onClick={download}
      disabled={state === 'loading'}
      title="Download SHA-256 receipt"
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[9px] font-bold uppercase tracking-widest transition-all ${
        state === 'loading'
          ? 'border-zinc-700 text-zinc-600 cursor-wait'
          : 'border-zinc-700 text-zinc-400 hover:border-teal-500/40 hover:text-teal-400 active:scale-95'
      }`}
    >
      {state === 'loading'
        ? <Loader2 size={10} className="animate-spin" />
        : <Download size={10} />}
      {state === 'loading' ? '…' : 'PDF'}
    </button>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────
function ContributionsContent() {
  const router = useRouter();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_paid: 0, count: 0, source: 'none' });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [filter,  setFilter]  = useState<'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED'>('ALL');

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) { router.push('/login'); return; }
      try {
        const res  = await fetch(`${API_BASE}/tenant/my-contributions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) { router.push('/login'); return; }
        const data = await res.json();
        const list: Contribution[] = (data.contributions || []).map((c: any) => ({
          id:           c.id,
          amount:       parseFloat(c.amount) || 0,
          currency:     c.currency || 'NGN',
          period_label: c.period_label || '—',
          paid_at:      c.paid_at || null,
          status:       c.status  || 'UNKNOWN',
          ledger_hash:  c.ledger_hash || null,
          receipt_id:   c.receipt_id  || c.id,
          source:       c.source || 'linked',
        }));
        setContributions(list);
        const ok = list.filter(c => c.status === 'SUCCESS');
        setSummary({
          total_paid: ok.reduce((s, c) => s + c.amount, 0),
          count:      ok.length,
          source:     data.source || (list.length > 0 ? 'linked' : 'none'),
        });
      } catch (e: any) {
        setError(e.message || 'Failed to load contributions.');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const visible = filter === 'ALL'
    ? contributions
    : contributions.filter(c => c.status === filter);

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
      <Footer />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-10 w-full space-y-8">

        {/* Back nav */}
        <Link href="/tenant/dashboard"
          className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors w-fit">
          <ArrowLeft size={13} /> Dashboard
        </Link>

        {/* Header */}
        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">My Contributions</h1>
          <p className="text-zinc-500 text-xs mt-1">
            {summary.source === 'standalone'
              ? 'Independent savings vault · SHA-256 ledger'
              : 'Flex-Pay vault history · SHA-256 ledger'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: 'Total Saved',
              value: fmt(summary.total_paid),
              sub:   `${summary.count} successful payment${summary.count !== 1 ? 's' : ''}`,
              color: 'text-teal-400',
            },
            {
              label: 'Vault Type',
              value: summary.source === 'standalone' ? 'Independent' : summary.source === 'linked' ? 'Linked' : '—',
              sub:   summary.source === 'standalone' ? 'Self-initiated vault' : summary.source === 'linked' ? 'Landlord-linked vault' : 'No vault yet',
              color: 'text-white',
            },
            {
              label: 'Ledger',
              value: 'SHA-256',
              sub:   'Bulletproof hash chain',
              color: 'text-teal-400',
            },
          ].map(s => (
            <div key={s.label} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-1">
              <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s.label}</p>
              <p className={`text-base font-black font-mono ${s.color}`}>{s.value}</p>
              <p className="text-[9px] text-zinc-600">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex gap-2 flex-wrap">
          {(['ALL', 'SUCCESS', 'PENDING', 'FAILED'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                filter === f
                  ? 'bg-teal-500/15 border-teal-500/50 text-teal-400'
                  : 'bg-zinc-900/20 border-zinc-800 text-zinc-500 hover:border-zinc-700'
              }`}>
              {f === 'ALL' ? `All (${contributions.length})` : `${f} (${contributions.filter(c => c.status === f).length})`}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {visible.length === 0 && (
          <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl space-y-4">
            {contributions.length === 0 ? (
              <>
                <Receipt className="text-zinc-700 mx-auto" size={40} />
                <p className="text-zinc-400 font-bold">No contributions yet</p>
                <p className="text-zinc-600 text-sm">Make your first installment to start building your rent history.</p>
                <Link href="/tenant/pay"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-black text-xs uppercase rounded-xl hover:bg-teal-400 transition-all tracking-widest">
                  Make First Contribution
                </Link>
              </>
            ) : (
              <p className="text-zinc-600 text-sm">No {filter} contributions found.</p>
            )}
          </div>
        )}

        {/* Contributions list */}
        {visible.length > 0 && (
          <div className="rounded-2xl border border-zinc-800 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_130px_90px_120px_130px_90px] gap-0 px-5 py-3 bg-zinc-900/40 border-b border-zinc-800">
              {['Date', 'Amount', 'Status', 'Period', 'Ledger Hash', 'Receipt'].map(h => (
                <p key={h} className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{h}</p>
              ))}
            </div>

            {/* Rows */}
            {visible.map((c, i) => {
              const statusColor = STATUS_COLOR[c.status] || '#6b7280';
              return (
                <div key={c.id}
                  className={`grid grid-cols-[1fr_130px_90px_120px_130px_90px] gap-0 px-5 py-4 items-center transition-colors hover:bg-zinc-900/30 ${
                    i < visible.length - 1 ? 'border-b border-zinc-800/60' : ''
                  }`}>
                  {/* Date */}
                  <div>
                    <p className="text-white text-xs font-medium">{fmtDate(c.paid_at)}</p>
                    <p className="text-zinc-600 text-[9px] font-mono mt-0.5">{fmtTime(c.paid_at)}</p>
                  </div>

                  {/* Amount */}
                  <p className="font-mono font-bold text-white text-sm">{fmt(c.amount)}</p>

                  {/* Status */}
                  <div>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                      background: `${statusColor}18`, color: statusColor,
                      border: `1px solid ${statusColor}40`,
                      textTransform: 'uppercase', letterSpacing: 0.5,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      {c.status === 'SUCCESS'
                        ? <CheckCircle2 size={8} />
                        : c.status === 'PENDING'
                          ? <Clock size={8} />
                          : <AlertCircle size={8} />}
                      {c.status}
                    </span>
                  </div>

                  {/* Period */}
                  <p className="text-zinc-400 text-[10px] font-mono">{c.period_label}</p>

                  {/* Ledger hash */}
                  <HashBadge hash={c.ledger_hash} />

                  {/* Receipt download */}
                  {c.status === 'SUCCESS'
                    ? <ReceiptButton
                        contributionId={c.receipt_id || c.id}
                        label={c.period_label || c.id.slice(0, 8)}
                      />
                    : <span className="text-zinc-700 text-[9px]">—</span>
                  }
                </div>
              );
            })}
          </div>
        )}

        {/* Trust badges */}
        {contributions.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-2 border-t border-zinc-900">
            {[
              { icon: ShieldCheck, label: 'SHA-256 Hashed' },
              { icon: FileText,    label: 'Court-Admissible' },
              { icon: CheckCircle2,label: 'Immutable Ledger' },
            ].map(({ icon: Icon, label }) => (
              <span key={label}
                className="flex items-center gap-1.5 text-[8px] text-teal-500 border border-teal-500/20 bg-teal-500/5 px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest">
                <Icon size={9} /> {label}
              </span>
            ))}
          </div>
        )}

        {/* Footer nav */}
        <div className="flex gap-6 justify-center flex-wrap pt-2">
          <Link href="/tenant/vault" className="text-teal-500 text-xs font-bold hover:underline">← My Vault</Link>
          <Link href="/tenant/pay"   className="text-teal-500 text-xs font-bold hover:underline">Pay Installment →</Link>
        </div>

      </main>
      <Footer />
    </div>
  );
}

export default function TenantContributionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
    }>
      <ContributionsContent />
    </Suspense>
  );
}
