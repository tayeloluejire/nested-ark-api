'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  Download, Copy, CheckCircle2, Shield, RefreshCw,
  DollarSign, TrendingUp, AlertCircle, ChevronRight,
} from 'lucide-react';

const API_BASE = '/api';
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}
const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(n);

// ── TenantNav ─────────────────────────────────────────────────────────────────
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
interface Contribution {
  id: string; amount: number; currency: string; period_label: string;
  paid_at: string | null; status: string; ledger_hash: string | null;
  receipt_id: string; source?: string;
}
interface Summary { total_paid: number; count: number; source: 'linked' | 'standalone' | 'none'; }
type FilterType = 'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED';

const STATUS_STYLE: Record<string, string> = {
  SUCCESS: 'border-teal-500/30 text-teal-400 bg-teal-500/10',
  PENDING: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  FAILED:  'border-red-500/30 text-red-400 bg-red-500/10',
};

// ── Hash Badge ────────────────────────────────────────────────────────────────
function HashBadge({ hash }: { hash: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!hash) return <span className="text-zinc-700 text-[10px] font-mono">—</span>;
  const copy = () => {
    navigator.clipboard.writeText(hash).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} title={hash}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-teal-500/20 bg-teal-500/5 hover:bg-teal-500/10 transition-colors group">
      <span className="font-mono text-[9px] text-teal-400 group-hover:text-teal-300">
        {copied ? 'Copied!' : hash.slice(0, 10) + '…'}
      </span>
      {copied ? <CheckCircle2 size={9} className="text-teal-400"/> : <Copy size={9} className="text-teal-500/60"/>}
    </button>
  );
}

// ── Receipt Generator ─────────────────────────────────────────────────────────
function generateReceiptHTML(c: Contribution): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Nested Ark — Payment Receipt</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#050505;color:#fff;font-family:'Helvetica Neue',Arial,sans-serif;padding:40px 20px;}
    .card{max-width:560px;margin:0 auto;background:#0d1a1a;border:1px solid rgba(20,184,166,0.25);border-radius:16px;overflow:hidden;}
    .header{background:linear-gradient(135deg,#0d2a2a,#091818);padding:28px 32px;border-bottom:1px solid rgba(20,184,166,0.15);}
    .logo{font-size:11px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:#14b8a6;margin-bottom:8px;}
    .title{font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;}
    .subtitle{font-size:11px;color:#6b7280;margin-top:4px;}
    .body{padding:28px 32px;}
    .amount-block{text-align:center;padding:24px;margin-bottom:24px;background:rgba(20,184,166,0.06);border:1px solid rgba(20,184,166,0.15);border-radius:12px;}
    .amount-label{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#6b7280;margin-bottom:6px;}
    .amount{font-size:42px;font-weight:900;font-family:monospace;color:#14b8a6;}
    .row{display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);}
    .row:last-child{border-bottom:none;}
    .row-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;font-weight:700;}
    .row-value{font-size:11px;color:#fff;font-weight:600;text-align:right;max-width:60%;word-break:break-all;}
    .hash-block{margin-top:24px;padding:16px;background:rgba(0,0,0,0.3);border:1px solid rgba(20,184,166,0.1);border-radius:10px;}
    .hash-label{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#6b7280;margin-bottom:8px;display:flex;align-items:center;gap:6px;}
    .hash-value{font-size:9px;font-family:monospace;color:#6b7280;word-break:break-all;line-height:1.6;}
    .footer-receipt{margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;}
    .footer-receipt p{font-size:9px;color:#374151;text-transform:uppercase;letter-spacing:1px;}
    .status-badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;text-transform:uppercase;background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">Nested Ark OS</div>
      <div class="title">Payment Receipt</div>
      <div class="subtitle">Bulletproof Hash Chain · SHA-256 Ledger</div>
    </div>
    <div class="body">
      <div class="amount-block">
        <div class="amount-label">Amount Paid</div>
        <div class="amount">${fmt(c.amount)}</div>
        <div style="margin-top:10px"><span class="status-badge">${c.status}</span></div>
      </div>
      <div class="row"><span class="row-label">Receipt ID</span><span class="row-value" style="font-family:monospace;font-size:10px">${c.receipt_id}</span></div>
      <div class="row"><span class="row-label">Date & Time</span><span class="row-value">${c.paid_at ? new Date(c.paid_at).toLocaleString('en-NG', { dateStyle: 'long', timeStyle: 'medium' }) : '—'}</span></div>
      <div class="row"><span class="row-label">Period</span><span class="row-value">${c.period_label || '—'}</span></div>
      <div class="row"><span class="row-label">Currency</span><span class="row-value">${c.currency || 'NGN'}</span></div>
      <div class="row"><span class="row-label">Vault Type</span><span class="row-value">${c.source === 'STANDALONE' ? 'Independent Savings Vault' : 'Flex-Pay Vault'}</span></div>
      <div class="hash-block">
        <div class="hash-label">🔐 SHA-256 Ledger Hash</div>
        <div class="hash-value">${c.ledger_hash || 'N/A — hash not yet generated'}</div>
      </div>
      <div class="footer-receipt">
        <p>Nested Ark OS · Impressions &amp; Impacts Ltd</p>
        <p style="margin-top:4px">Lagos · London · Dubai · nestedark@gmail.com</p>
        <p style="margin-top:4px">This is a court-admissible SHA-256 hashed receipt.</p>
        <p style="margin-top:4px">Generated: ${new Date().toLocaleString('en-NG')}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function downloadReceipt(c: Contribution) {
  const html  = generateReceiptHTML(c);
  const blob  = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href      = url;
  a.download  = `nested-ark-receipt-${c.receipt_id.slice(0, 8)}-${(c.period_label || 'payment').replace(/[^a-z0-9]/gi, '-')}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Expanded Row ──────────────────────────────────────────────────────────────
function ContributionRow({ c, isLast }: { c: Contribution; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const statusStyle = STATUS_STYLE[c.status] || 'border-zinc-700 text-zinc-500 bg-zinc-900/20';

  return (
    <div className={`transition-colors ${isLast ? '' : 'border-b border-zinc-800/60'}`}>
      {/* Main row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full grid items-center px-5 py-4 hover:bg-teal-500/[0.03] transition-colors text-left"
        style={{ gridTemplateColumns: '1fr 110px 80px 110px 110px 36px' }}>
        {/* Date */}
        <div>
          <p className="text-white text-sm font-semibold">
            {c.paid_at ? new Date(c.paid_at).toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
          </p>
          <p className="text-zinc-600 text-[10px] font-mono mt-0.5">
            {c.paid_at ? new Date(c.paid_at).toLocaleTimeString('en-NG', { hour:'2-digit', minute:'2-digit' }) : ''}
          </p>
        </div>
        {/* Amount */}
        <div className="font-black font-mono text-sm text-white">{fmt(c.amount)}</div>
        {/* Status */}
        <div>
          <span className={`text-[9px] font-bold px-2 py-1 rounded-lg border ${statusStyle}`}>{c.status}</span>
        </div>
        {/* Period */}
        <div className="text-zinc-500 text-[10px] font-mono">{c.period_label || '—'}</div>
        {/* Hash */}
        <div onClick={e => e.stopPropagation()}>
          <HashBadge hash={c.ledger_hash} />
        </div>
        {/* Expand chevron */}
        <div className={`text-zinc-600 transition-transform ${expanded ? 'rotate-90' : ''}`}>
          <ChevronRight size={14} />
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 pt-1 bg-zinc-900/30 border-t border-zinc-800/40 space-y-4">
          {/* Full hash */}
          {c.ledger_hash && (
            <div className="p-4 rounded-xl border border-teal-500/15 bg-teal-500/5">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={11} className="text-teal-500" />
                <span className="text-[9px] text-teal-500 font-bold uppercase tracking-widest">SHA-256 Ledger Hash</span>
              </div>
              <p className="font-mono text-[9px] text-zinc-400 break-all leading-relaxed">{c.ledger_hash}</p>
            </div>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Receipt ID',  value: c.receipt_id },
              { label: 'Currency',    value: c.currency || 'NGN' },
              { label: 'Vault Type',  value: c.source === 'STANDALONE' ? 'Independent' : 'Flex-Pay' },
              { label: 'Period',      value: c.period_label || '—' },
              { label: 'Status',      value: c.status },
              { label: 'Amount',      value: fmt(c.amount) },
            ].map(d => (
              <div key={d.label} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest mb-0.5">{d.label}</p>
                <p className="text-[10px] font-mono text-zinc-300 break-all">{d.value}</p>
              </div>
            ))}
          </div>

          {/* Download receipt */}
          {c.status === 'SUCCESS' && (
            <button onClick={() => downloadReceipt(c)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-teal-500/30 bg-teal-500/10 text-teal-400 text-[10px] font-black uppercase tracking-widest hover:bg-teal-500/20 transition-all w-fit">
              <Download size={12} /> Download Receipt (HTML)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TenantContributionsPage() {
  const router = useRouter();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [summary,       setSummary]       = useState<Summary>({ total_paid: 0, count: 0, source: 'none' });
  const [loading,       setLoading]       = useState(true);
  const [filter,        setFilter]        = useState<FilterType>('ALL');
  const [downloading,   setDownloading]   = useState(false);

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) { router.push('/login'); return; }
      try {
        const res  = await fetch(`${API_BASE}/tenant/my-contributions`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        const list: Contribution[] = (data.contributions || []).map((c: any) => ({
          id:           c.id,
          amount:       parseFloat(c.amount) || 0,
          currency:     c.currency || 'NGN',
          period_label: c.period_label || '—',
          paid_at:      c.paid_at || null,
          status:       c.status || 'UNKNOWN',
          ledger_hash:  c.ledger_hash || null,
          receipt_id:   c.receipt_id || c.id,
          source:       c.source || 'linked',
        }));
        setContributions(list);
        const successOnly = list.filter(c => c.status === 'SUCCESS');
        setSummary({
          total_paid: successOnly.reduce((s, c) => s + c.amount, 0),
          count:      successOnly.length,
          source:     data.source || (list.length > 0 ? 'linked' : 'none'),
        });
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const visible = filter === 'ALL' ? contributions : contributions.filter(c => c.status === filter);

  // ── Bulk download all SUCCESS receipts ───────────────────────────────────
  const downloadAll = async () => {
    setDownloading(true);
    const success = contributions.filter(c => c.status === 'SUCCESS');
    for (let i = 0; i < success.length; i++) {
      await new Promise(res => setTimeout(res, 200));
      downloadReceipt(success[i]);
    }
    setDownloading(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <TenantNav />

      <main className="flex-1 max-w-4xl mx-auto px-4 md:px-6 py-8 w-full">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div className="border-l-2 border-teal-500 pl-4">
            <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Tenant Portal</p>
            <h1 className="text-2xl font-black uppercase tracking-tighter">My Contributions</h1>
            <p className="text-zinc-500 text-xs mt-1">
              {summary.source === 'standalone' ? 'Independent savings vault' : 'Flex-Pay vault history'} · SHA-256 ledger
            </p>
          </div>
          {!loading && contributions.filter(c => c.status === 'SUCCESS').length > 0 && (
            <button onClick={downloadAll} disabled={downloading}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-teal-500/30 text-teal-400 text-[10px] font-black uppercase tracking-widest transition-all flex-shrink-0 ${downloading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-teal-500/10'}`}>
              {downloading ? <RefreshCw size={12} className="animate-spin"/> : <Download size={12}/>}
              Download All Receipts
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="animate-spin text-teal-500 mr-3" size={20} />
            <span className="text-zinc-500 font-mono text-sm">Loading contributions…</span>
          </div>
        )}

        {!loading && (
          <>
            {/* Summary KPIs */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                {
                  label: 'Total Saved',
                  value: fmt(summary.total_paid),
                  sub: `${summary.count} successful payment${summary.count !== 1 ? 's' : ''}`,
                  icon: TrendingUp, iconColor: 'text-teal-400',
                },
                {
                  label: 'Vault Type',
                  value: summary.source === 'standalone' ? 'Independent' : summary.source === 'linked' ? 'Linked' : '—',
                  sub: summary.source === 'standalone' ? 'Self-initiated vault' : summary.source === 'linked' ? 'Landlord-linked vault' : 'No vault yet',
                  icon: DollarSign, iconColor: 'text-amber-400',
                },
                {
                  label: 'Ledger',
                  value: 'SHA-256',
                  sub: 'Bulletproof hash chain · Court-admissible',
                  icon: Shield, iconColor: 'text-teal-500',
                },
              ].map(({ label, value, sub, icon: Icon, iconColor }) => (
                <div key={label} className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-2">
                  <Icon size={16} className={iconColor} />
                  <p className="font-black font-mono text-base text-white">{value}</p>
                  <div>
                    <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{label}</p>
                    <p className="text-[9px] text-zinc-700 mt-0.5">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 mb-5 flex-wrap">
              {(['ALL', 'SUCCESS', 'PENDING', 'FAILED'] as FilterType[]).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                    filter === f
                      ? 'border-teal-500 bg-teal-500/15 text-teal-400'
                      : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                  }`}>
                  {f === 'ALL' ? `All (${contributions.length})` : `${f} (${contributions.filter(c => c.status === f).length})`}
                </button>
              ))}
            </div>

            {/* Empty state */}
            {visible.length === 0 && (
              <div className="p-12 rounded-2xl border border-zinc-800 bg-zinc-900/20 text-center space-y-4">
                {contributions.length === 0 ? (
                  <>
                    <div className="text-4xl">💳</div>
                    <p className="font-black text-sm uppercase tracking-tight">No contributions yet</p>
                    <p className="text-zinc-500 text-xs">Make your first installment to start building your rent history.</p>
                    <button onClick={() => router.push('/tenant/pay')}
                      className="px-6 py-2.5 bg-teal-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all">
                      Make First Contribution
                    </button>
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-zinc-500">
                    <AlertCircle size={14} />
                    <p className="text-sm">No {filter} contributions found.</p>
                  </div>
                )}
              </div>
            )}

            {/* Table */}
            {visible.length > 0 && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 overflow-hidden">
                {/* Table header */}
                <div className="grid px-5 py-3 border-b border-zinc-800 bg-zinc-900/40"
                  style={{ gridTemplateColumns: '1fr 110px 80px 110px 110px 36px' }}>
                  {['Date', 'Amount', 'Status', 'Period', 'Ledger Hash', ''].map(h => (
                    <div key={h} className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">{h}</div>
                  ))}
                </div>
                {/* Rows */}
                {visible.map((c, i) => (
                  <ContributionRow key={c.id} c={c} isLast={i === visible.length - 1} />
                ))}
              </div>
            )}

            {/* Footer nav */}
            <div className="flex items-center justify-center gap-6 mt-6">
              <Link href="/tenant/vault" className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
                ← My Vault
              </Link>
              <Link href="/tenant/pay" className="text-[11px] text-teal-500 font-bold hover:underline flex items-center gap-1">
                Pay Installment <ChevronRight size={11}/>
              </Link>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
