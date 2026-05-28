'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MobileBottomNav from '@/components/navigation/MobileBottomNav';
import { Loader2, Download, Copy, Check, ReceiptText } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('ark_token') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('ark_token') ||
    sessionStorage.getItem('token')
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(n);

const fmtDate = (dString: string | null | undefined): string => {
  if (!dString) return '—';
  try {
    return new Date(dString).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

const fmtTime = (dString: string | null | undefined): string => {
  if (!dString) return '';
  try {
    return new Date(dString).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

interface Contribution {
  id: string;
  amount: number;
  currency: string;
  period_label: string;
  paid_at: string | null;
  status: string;
  ledger_hash: string | null;
  receipt_id: string;
  source?: string;
}

interface Summary {
  total_paid: number;
  count: number;
  source: 'linked' | 'standalone' | 'none';
}

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: '#10b981',
  PENDING: '#f59e0b',
  FAILED:  '#ef4444',
};

function HashBadge({ hash }: { hash: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!hash) return <span className="text-zinc-700 text-xs">—</span>;
  const short = hash.slice(0, 12) + '…';
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(hash).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <span
      onClick={copy}
      title={hash}
      className={`font-mono text-xs cursor-pointer px-2 py-0.5 rounded transition-colors select-all ${
        copied ? 'text-emerald-400 bg-emerald-500/10' : 'text-teal-400 bg-teal-500/5 hover:bg-teal-500/10'
      }`}
    >
      {copied ? 'Copied!' : short}
    </span>
  );
}

export default function TenantContributionsPage() {
  const router = useRouter();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_paid: 0, count: 0, source: 'none' });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED'>('ALL');
  const [activeReceipt, setActiveReceipt] = useState<Contribution | null>(null);

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) { router.push('/login'); return; }
      try {
        const res = await fetch(`${API_BASE}/tenant/my-contributions`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
          cache: 'no-store'
        });
        
        if (res.status === 401) {
          router.push('/login');
          return;
        }

        const data = await res.json();
        const list: Contribution[] = (data.contributions || []).map((c: any) => ({
          id:          c.id,
          amount:      parseFloat(c.amount) || 0,
          currency:    c.currency || 'NGN',
          period_label: c.period_label || '—',
          paid_at:     c.paid_at || null,
          status:      c.status || 'UNKNOWN',
          ledger_hash: c.ledger_hash || null,
          receipt_id:  c.receipt_id || c.id,
          source:      c.source || 'linked',
        }));
        setContributions(list);
        const successOnly = list.filter(c => c.status === 'SUCCESS');
        setSummary({
          total_paid: successOnly.reduce((s, c) => s + c.amount, 0),
          count:      successOnly.length,
          source:     data.source || (list.length > 0 ? 'linked' : 'none'),
        });
      } catch (e) {
        console.error("Failed to load contributions:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const downloadReceiptMetadata = (c: Contribution) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      title: "NESTED ARK OS - LEDGER TRANSACTION RECEIPT",
      receipt_id: c.receipt_id,
      payment_id: c.id,
      amount: fmt(c.amount),
      currency: c.currency,
      status: c.status,
      allocated_period: c.period_label,
      timestamp: c.paid_at ? new Date(c.paid_at).toISOString() : '—',
      immutable_ledger_hash: c.ledger_hash || 'PENDING_BLOCKCHAIN_COMMIT',
      verification_protocol: "SHA-256 Hash Chain - Tri-Layer Verified System"
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `receipt-${c.receipt_id.slice(0,8)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const visible = filter === 'ALL' ? contributions : contributions.filter(c => c.status === filter);

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="animate-spin text-teal-500" size={32} />
        <span className="text-zinc-500 font-mono text-sm tracking-wider">Loading immutable ledger...</span>
      </div>
      <Footer />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      <main className="flex-grow max-w-5xl w-full mx-auto px-4 md:px-6 py-12 pb-24 md:pb-16">
        
        {/* Header Block */}
        <div className="mb-10">
          <div className="text-teal-500 text-[10px] font-bold tracking-[0.2em] uppercase mb-2">
            Infrastructure Exchange Vault Portal
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-2 uppercase">
            My Contributions
          </h1>
          <p className="text-zinc-500 text-sm max-w-2xl">
            {summary.source === 'standalone'
              ? 'Independent savings vault secure historical record. Cryptographically tied via SHA-256 ledger.'
              : 'Flex-Pay vault tracking history. Real-time matching matrix mapped into asset escrow vaults.'}
          </p>
        </div>

        {/* Dashboard Financial KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Saved Ledger', value: fmt(summary.total_paid), sub: `${summary.count} successful block allocations` },
            { label: 'Vault Infrastructure', value: summary.source === 'standalone' ? 'Independent' : summary.source === 'linked' ? 'Linked' : '—', sub: summary.source === 'standalone' ? 'Self-directed savings vault' : summary.source === 'linked' ? 'Landlord rental pipeline' : 'No operational vault' },
            { label: 'Ledger Audit Seal', value: 'SHA-256 CHAIN', sub: 'Bulletproof hash record' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-gradient-to-br from-zinc-950 to-black border border-zinc-800/80 p-5 rounded-xl flex flex-col justify-between shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl group-hover:bg-teal-500/10 transition-colors duration-500" />
              <div>
                <div className="text-zinc-500 text-[9px] font-bold tracking-widest uppercase mb-3">{label}</div>
                <div className="text-xl font-black text-white font-mono tracking-tight">{value}</div>
              </div>
              {sub && <div className="text-zinc-600 text-[10px] uppercase font-bold tracking-wide mt-4">{sub}</div>}
            </div>
          ))}
        </div>

        {/* Filter Control Ribbon */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
          {(['ALL', 'SUCCESS', 'PENDING', 'FAILED'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide uppercase transition-all duration-200 border whitespace-nowrap ${
                filter === f
                  ? 'bg-teal-500/10 border-teal-500/50 text-teal-400 font-extrabold shadow-lg shadow-teal-500/5'
                  : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
              }`}
            >
              {f === 'ALL' ? `All Records (${contributions.length})` : `${f} (${contributions.filter(c => c.status === f).length})`}
            </button>
          ))}
        </div>

        {/* Dynamic List Execution Area */}
        {visible.length === 0 ? (
          <div className="border border-zinc-900 bg-zinc-950/20 rounded-xl p-12 text-center max-w-xl mx-auto flex flex-col items-center justify-center">
            {contributions.length === 0 ? (
              <>
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-500 text-xl mb-4">💳</div>
                <h3 className="text-white font-bold text-base uppercase tracking-tight mb-2">No Verified Payments Found</h3>
                <p className="text-zinc-500 text-xs leading-relaxed max-w-sm mb-6">
                  Initiate your starting contract allocation parameters to record metrics onto the secure infrastructure stream.
                </p>
                <button
                  onClick={() => router.push('/tenant/pay')}
                  className="px-5 py-2.5 rounded-lg bg-teal-500 text-black font-black text-xs uppercase tracking-wider hover:bg-teal-400 transition-colors duration-200 shadow-lg shadow-teal-500/10"
                >
                  Make First Contribution
                </button>
              </>
            ) : (
              <div className="text-zinc-500 font-mono text-xs uppercase tracking-widest py-6">
                No ledger rows matches filter filter criteria [{filter}]
              </div>
            )}
          </div>
        ) : (
          <div className="border border-zinc-900 bg-black/40 rounded-xl overflow-hidden shadow-2xl">
            
            {/* Desktop Table Layout Header */}
            <div className="hidden md:grid grid-cols-6 gap-4 px-6 py-4 bg-zinc-950/80 border-b border-zinc-900 text-[10px] font-bold tracking-widest uppercase text-zinc-500">
              <div>Transaction Date</div>
              <div>Period Index</div>
              <div>Escrow Amount</div>
              <div>State Verification</div>
              <div>Cryptographic Hash</div>
              <div className="text-right">Receipt Action</div>
            </div>

            {/* List Array Map Block */}
            <div className="divide-y divide-zinc-900/50">
              {visible.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setActiveReceipt(c)}
                  className="grid grid-cols-1 md:grid-cols-6 gap-3 md:gap-4 px-6 py-4 items-center hover:bg-zinc-950/40 transition-colors duration-150 cursor-pointer group"
                >
                  {/* Date Column */}
                  <div>
                    <span className="md:hidden text-[9px] font-bold tracking-widest text-zinc-600 block uppercase mb-1">Date</span>
                    <div className="text-white font-medium text-xs md:text-sm">{fmtDate(c.paid_at)}</div>
                    <div className="text-zinc-600 text-[11px] font-mono mt-0.5">{fmtTime(c.paid_at)}</div>
                  </div>

                  {/* Period Block */}
                  <div>
                    <span className="md:hidden text-[9px] font-bold tracking-widest text-zinc-600 block uppercase mb-1">Period</span>
                    <span className="text-zinc-400 font-mono text-xs md:text-sm">{c.period_label}</span>
                  </div>

                  {/* Amount Block */}
                  <div>
                    <span className="md:hidden text-[9px] font-bold tracking-widest text-zinc-600 block uppercase mb-1">Amount</span>
                    <div className="text-teal-400 font-black font-mono text-xs md:text-sm">{fmt(c.amount)}</div>
                  </div>

                  {/* Status Block */}
                  <div>
                    <span className="md:hidden text-[9px] font-bold tracking-widest text-zinc-600 block uppercase mb-1">Status</span>
                    <span
                      className="inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border tracking-wide uppercase"
                      style={{
                        backgroundColor: `${STATUS_COLOR[c.status] || '#6b7280'}10`,
                        color: STATUS_COLOR[c.status] || '#6b7280',
                        borderColor: `${STATUS_COLOR[c.status] || '#6b7280'}30`,
                      }}
                    >
                      {c.status}
                    </span>
                  </div>

                  {/* Cryptographic Ledger Column */}
                  <div>
                    <span className="md:hidden text-[9px] font-bold tracking-widest text-zinc-600 block uppercase mb-1">Ledger Hash</span>
                    <HashBadge hash={c.ledger_hash} />
                  </div>

                  {/* Interactive Trigger Row Action */}
                  <div className="text-left md:text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setActiveReceipt(c)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-teal-500 bg-teal-500/5 hover:bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 rounded-lg uppercase transition-all"
                    >
                      <ReceiptText size={12} />
                      Receipt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Navigation Backlink Node */}
        <div className="mt-10 flex gap-6 justify-center items-center text-xs font-bold tracking-wider uppercase border-t border-zinc-900 pt-6">
          <a href="/tenant/vault" className="text-zinc-500 hover:text-teal-400 transition-colors duration-150">← Return to Vault</a>
          <span className="text-zinc-800">|</span>
          <a href="/tenant/pay" className="text-teal-500 hover:text-teal-400 transition-colors duration-150">Authorize Allocation →</a>
        </div>
      </main>

      {/* Dynamic Absolute Modal Overlay Context - Interactive Secure Receipt Viewer */}
      {activeReceipt && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-300 animate-fadeIn"
          onClick={() => setActiveReceipt(null)}
        >
          <div 
            className="w-full max-w-md bg-gradient-to-b from-zinc-950 to-black border border-zinc-800 p-6 rounded-2xl relative shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-500" />
            
            {/* Modal Brand Heading */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <ReceiptText className="text-teal-500" size={18} />
                <span className="text-zinc-400 font-black text-xs uppercase tracking-[0.2em]">Nested Ark OS Receipt</span>
              </div>
              <button 
                onClick={() => setActiveReceipt(null)} 
                className="text-zinc-500 hover:text-white font-mono text-sm uppercase border border-zinc-900 hover:border-zinc-800 px-2 py-0.5 rounded-md"
              >
                ESC
              </button>
            </div>

            {/* Core Receipt Parameters Container */}
            <div className="space-y-4 border-t border-b border-zinc-900 py-5 my-4">
              <div className="flex justify-between items-baseline">
                <span className="text-zinc-500 text-xs uppercase tracking-wide">Allocation Sum</span>
                <span className="text-xl font-black text-white font-mono">{fmt(activeReceipt.amount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 text-xs uppercase tracking-wide">Ledger Status</span>
                <span 
                  className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase"
                  style={{
                    backgroundColor: `${STATUS_COLOR[activeReceipt.status] || '#6b7280'}10`,
                    color: STATUS_COLOR[activeReceipt.status] || '#6b7280',
                    borderColor: `${STATUS_COLOR[activeReceipt.status] || '#6b7280'}30`,
                  }}
                >
                  {activeReceipt.status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 text-xs uppercase tracking-wide">Target Period</span>
                <span className="text-zinc-300 font-mono text-sm">{activeReceipt.period_label}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 text-xs uppercase tracking-wide">Settlement Time</span>
                <span className="text-zinc-300 font-medium text-xs">{fmtDate(activeReceipt.paid_at)} &middot; {fmtTime(activeReceipt.paid_at)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 text-xs uppercase tracking-wide">Receipt Reference</span>
                <span className="text-zinc-400 font-mono text-xs">{activeReceipt.receipt_id.slice(0, 16)}</span>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-zinc-900/40">
                <span className="text-zinc-500 text-xs uppercase tracking-wide block">Ledger Verification Hash Seal</span>
                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-900 break-all font-mono text-[10px] text-teal-400 select-all leading-normal">
                  {activeReceipt.ledger_hash || 'PENDING_INFRASTRUCTURE_LEDGER_BLOCK_COMMIT'}
                </div>
              </div>
            </div>

            {/* Action Trigger Row */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeReceipt.ledger_hash || '').catch(() => {});
                }}
                disabled={!activeReceipt.ledger_hash}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40"
              >
                <Copy size={13} />
                Copy Hash
              </button>
              <button
                onClick={() => downloadReceiptMetadata(activeReceipt)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-500 text-black font-black text-xs uppercase tracking-wider hover:bg-teal-400 transition-all shadow-lg shadow-teal-500/10"
              >
                <Download size={13} />
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
      <MobileBottomNav />
    </div>
  );
}