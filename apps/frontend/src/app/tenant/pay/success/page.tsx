'use client';
export const dynamic = 'force-dynamic';

/**
 * /tenant/pay/success/page.tsx
 * Paystack redirects here after successful payment.
 * Polls verify-payment endpoint (supports both linked flex vault and standalone vault).
 * Uses proven getToken() + fetch pattern — NOT axios api instance.
 */

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  CheckCircle, Loader2, AlertCircle, ArrowRight,
  TrendingUp, Shield, Download, Copy, CheckCircle2,
} from 'lucide-react';

const API_BASE = '/api';
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}
const safeN = (v: any) => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any) => safeN(v).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n: number) => `₦${safeF(n)}`;

// ── TenantNav ─────────────────────────────────────────────────────────────────
function TenantNav() {
  const pathname = usePathname();
  const links = [
    { href: '/tenant/dashboard',     label: 'My Dashboard' },
    { href: '/tenant/vault',         label: 'My Vault'     },
    { href: '/tenant/pay',           label: 'Pay Rent'     },
    { href: '/tenant/contributions', label: 'History'      },
    { href: '/tenant/banking',       label: 'My Banking'   },
    { href: '/tenant/notices',       label: 'My Notices'   },
    { href: '/marketplace',          label: 'Marketplace'  },
  ];
  return (
    <nav className="border-b border-zinc-800 bg-[#050505]/90 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 flex gap-0.5 overflow-x-auto py-1" style={{ scrollbarWidth: 'none' }}>
        {links.map(l => {
          const active = pathname === l.href || pathname?.startsWith(l.href + '/');
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
type VerifyResult = {
  verified:      boolean;
  amount_ngn:    number;
  reference:     string;
  vault_balance: number;
  target_amount: number;
  funded_pct:    number;
  vault_status:  string;
  vault_type?:   'linked' | 'standalone';
  tenant_name:   string;
  period_label:  string;
  ledger_hash:   string;
  paid_at?:      string;
};

// ── Receipt Download ──────────────────────────────────────────────────────────
function downloadReceiptHTML(result: VerifyResult) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Nested Ark — Payment Receipt</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#050505;color:#fff;font-family:'Helvetica Neue',Arial,sans-serif;padding:40px 20px}
    .card{max-width:540px;margin:0 auto;background:#0d1a1a;border:1px solid rgba(20,184,166,0.25);border-radius:16px;overflow:hidden}
    .header{background:linear-gradient(135deg,#0d2a2a,#091818);padding:28px 32px;border-bottom:1px solid rgba(20,184,166,0.15)}
    .logo{font-size:11px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:#14b8a6;margin-bottom:8px}
    .title{font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px}
    .body{padding:28px 32px}
    .amount-block{text-align:center;padding:24px;margin-bottom:20px;background:rgba(20,184,166,0.06);border:1px solid rgba(20,184,166,0.15);border-radius:12px}
    .amount{font-size:42px;font-weight:900;font-family:monospace;color:#14b8a6}
    .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04)}
    .row:last-child{border-bottom:none}
    .label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;font-weight:700}
    .value{font-size:11px;color:#fff;font-weight:600;text-align:right;max-width:60%;word-break:break-all}
    .hash{margin-top:20px;padding:16px;background:rgba(0,0,0,0.3);border:1px solid rgba(20,184,166,0.1);border-radius:10px}
    .hash-label{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#6b7280;margin-bottom:8px}
    .hash-value{font-size:9px;font-family:monospace;color:#6b7280;word-break:break-all;line-height:1.6}
    .footer-r{margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);text-align:center}
    .footer-r p{font-size:9px;color:#374151;text-transform:uppercase;letter-spacing:1px;margin-top:4px}
    .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;text-transform:uppercase;background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);margin-top:10px}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">Nested Ark OS</div>
      <div class="title">Payment Confirmed</div>
    </div>
    <div class="body">
      <div class="amount-block">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#6b7280;margin-bottom:6px">Amount Paid</div>
        <div class="amount">${fmt(result.amount_ngn)}</div>
        <div class="badge">SUCCESS</div>
      </div>
      <div class="row"><span class="label">Reference</span><span class="value" style="font-family:monospace;font-size:9px">${result.reference}</span></div>
      <div class="row"><span class="label">Tenant</span><span class="value">${result.tenant_name || '—'}</span></div>
      <div class="row"><span class="label">Period</span><span class="value">${result.period_label}</span></div>
      <div class="row"><span class="label">Date</span><span class="value">${result.paid_at ? new Date(result.paid_at).toLocaleString('en-NG',{dateStyle:'long',timeStyle:'medium'}) : new Date().toLocaleString('en-NG')}</span></div>
      <div class="row"><span class="label">Vault Type</span><span class="value">${result.vault_type === 'standalone' ? 'Independent Savings Vault' : 'Flex-Pay Vault'}</span></div>
      <div class="row"><span class="label">Vault Balance</span><span class="value" style="color:#14b8a6;font-family:monospace">${fmt(result.vault_balance)}</span></div>
      <div class="row"><span class="label">Target</span><span class="value" style="font-family:monospace">${fmt(result.target_amount)}</span></div>
      <div class="row"><span class="label">Funded</span><span class="value">${result.funded_pct}%</span></div>
      <div class="hash">
        <div class="hash-label">🔐 SHA-256 Ledger Hash</div>
        <div class="hash-value">${result.ledger_hash || 'N/A'}</div>
      </div>
      <div class="footer-r">
        <p>Nested Ark OS · Impressions &amp; Impacts Ltd</p>
        <p>Lagos · London · Dubai · nestedark@gmail.com</p>
        <p>Court-admissible SHA-256 hashed receipt</p>
        <p>Generated: ${new Date().toLocaleString('en-NG')}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `nested-ark-receipt-${result.reference}-${result.period_label}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── HashDisplay ───────────────────────────────────────────────────────────────
function HashDisplay({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(hash).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/10 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Shield size={10} className="text-teal-500" />
          <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">SHA-256 Ledger Receipt</span>
        </div>
        <button onClick={copy}
          className="flex items-center gap-1 px-2 py-1 rounded border border-zinc-700 text-zinc-500 text-[9px] font-bold hover:border-teal-500/30 hover:text-teal-400 transition-all">
          {copied ? <CheckCircle2 size={9} className="text-teal-400"/> : <Copy size={9}/>}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="font-mono text-[9px] text-zinc-600 break-all leading-relaxed">{hash}</p>
    </div>
  );
}

// ── Success Content ───────────────────────────────────────────────────────────
function SuccessContent() {
  const params    = useSearchParams();
  const reference = params.get('reference') || params.get('trxref') || '';

  const [status,  setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [result,  setResult] = useState<VerifyResult | null>(null);
  const [errMsg,  setErrMsg] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!reference) { setErrMsg('No payment reference found.'); setStatus('error'); return; }

    let attempts  = 0;
    const MAX     = 12;
    const DELAY   = 3000;
    let cancelled = false;

    const verify = async () => {
      if (cancelled) return;
      attempts++;
      setAttempt(attempts);
      try {
        const token = getToken();
        const res   = await fetch(
          `${API_BASE}/tenant/verify-payment?reference=${encodeURIComponent(reference)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const d = await res.json();

        if (d && d.verified && d.amount_ngn > 0) {
          if (!cancelled) { setResult(d); setStatus('success'); }
          return;
        }
        if (attempts < MAX && !cancelled) {
          setTimeout(verify, DELAY);
        } else if (!cancelled) {
          if (d && d.verified) { setResult(d); setStatus('success'); }
          else { setErrMsg('Payment received but vault update is still processing. Please check your vault.'); setStatus('error'); }
        }
      } catch (e: any) {
        if (cancelled) return;
        if (attempts < MAX) { setTimeout(verify, DELAY); }
        else { setErrMsg('Could not verify payment. Please check your vault.'); setStatus('error'); }
      }
    };

    // Wait 3s for webhook to land before first poll
    const initial = setTimeout(verify, 3000);
    return () => { cancelled = true; clearTimeout(initial); };
  }, [reference]);

  const fundedPct = result
    ? Math.min(Math.round((safeN(result.vault_balance) / (safeN(result.target_amount) || 1)) * 100), 100)
    : 0;
  const isStandalone = result?.vault_type === 'standalone';

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <TenantNav />

      <main className="flex-1 max-w-2xl mx-auto px-4 md:px-6 py-10 w-full space-y-6">

        {/* Loading */}
        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="relative">
              <Loader2 className="animate-spin text-teal-500" size={40} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-teal-500/20 animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-zinc-300 font-black text-sm uppercase tracking-widest">Confirming Payment…</p>
              <p className="text-zinc-600 text-[10px] mt-2">Waiting for Paystack webhook · Attempt {attempt}/{12}</p>
              <p className="text-zinc-700 text-[9px] mt-1">This usually takes 3–10 seconds.</p>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="space-y-5">
            <div className="p-5 rounded-2xl border border-red-500/20 bg-red-500/5 flex items-start gap-3">
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-sm text-red-300">Payment Verification Issue</p>
                <p className="text-xs text-red-400/70 mt-1 leading-relaxed">{errMsg}</p>
              </div>
            </div>
            <p className="text-zinc-500 text-sm leading-relaxed">
              If you completed payment, your vault will update shortly. Check your vault balance or contact support with reference:{' '}
              <code className="font-mono text-white text-xs bg-zinc-900 px-2 py-0.5 rounded">{reference}</code>
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/tenant/vault"
                className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800 hover:border-teal-500/30 hover:bg-teal-500/5 transition-all group">
                <span className="text-sm font-bold">Check My Vault</span>
                <ArrowRight size={14} className="text-zinc-600 group-hover:text-teal-400 group-hover:translate-x-1 transition-all"/>
              </Link>
              <Link href="/tenant/dashboard"
                className="text-center text-zinc-600 text-xs hover:text-zinc-400 transition-colors">
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* Success */}
        {status === 'success' && result && (
          <div className="space-y-5">

            {/* Hero */}
            <div className="text-center space-y-3 py-4">
              <div className="w-16 h-16 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mx-auto">
                <CheckCircle className="text-teal-400" size={32} />
              </div>
              <h1 className="text-3xl font-black uppercase tracking-tighter">Payment Confirmed</h1>
              <p className="text-zinc-500 text-sm">
                {isStandalone ? 'Your installment has been credited to your independent savings vault' : 'Your installment has been credited to your Flex-Pay vault'}
              </p>
              {isStandalone && (
                <span className="inline-block text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-teal-500/30 text-teal-400 bg-teal-500/10">
                  Independent Savings Vault
                </span>
              )}
            </div>

            {/* Amount */}
            <div className="p-6 rounded-3xl border border-teal-500/20 bg-teal-500/5 text-center">
              <p className="text-[9px] text-teal-500 uppercase font-black tracking-widest mb-2">Amount Paid</p>
              <p className="text-5xl font-black font-mono text-teal-400">{fmt(result.amount_ngn)}</p>
              <p className="text-[9px] text-zinc-600 font-mono mt-3 break-all">ref: {result.reference}</p>
              {result.tenant_name && (
                <p className="text-[10px] text-zinc-500 mt-1">Tenant: {result.tenant_name}</p>
              )}
            </div>

            {/* Vault gauge */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Updated Vault Balance</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-black font-mono text-white">{fmt(result.vault_balance)}</p>
                  <p className="text-[9px] text-zinc-600 mt-0.5">of {fmt(result.target_amount)} target</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-teal-400">{fundedPct}%</p>
                  <p className="text-[9px] text-zinc-600 uppercase font-bold">funded</p>
                </div>
              </div>
              <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${fundedPct >= 80 ? 'bg-teal-500' : fundedPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${fundedPct}%` }} />
              </div>
              {result.vault_status === 'FUNDED_READY' && (
                <div className="p-4 rounded-xl border border-teal-500/30 bg-teal-500/10 text-center">
                  <p className="text-teal-400 font-black text-xs uppercase tracking-widest">🎉 Vault Fully Funded!</p>
                  <p className="text-zinc-500 text-[10px] mt-1">
                    {isStandalone
                      ? 'Your savings vault is fully funded. The platform will coordinate disbursement to your landlord.'
                      : 'Your landlord has been notified. Disbursement will proceed automatically.'}
                  </p>
                </div>
              )}
            </div>

            {/* Ledger receipt */}
            {result.ledger_hash && <HashDisplay hash={result.ledger_hash} />}
            {result.period_label && (
              <p className="text-[9px] text-zinc-600 text-center">
                Period: <span className="text-zinc-400 font-bold font-mono">{result.period_label}</span>
              </p>
            )}

            {/* Download receipt */}
            <button onClick={() => downloadReceiptHTML(result)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-teal-500/30 bg-teal-500/10 text-teal-400 text-[10px] font-black uppercase tracking-widest hover:bg-teal-500/20 transition-all">
              <Download size={13} /> Download Receipt (HTML)
            </button>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Link href="/tenant/pay"
                className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800 hover:border-teal-500/30 hover:bg-teal-500/5 transition-all group">
                <span className="text-sm font-bold uppercase tracking-tight">Make Another Installment</span>
                <ArrowRight size={14} className="text-zinc-600 group-hover:text-teal-400 group-hover:translate-x-1 transition-all"/>
              </Link>
              <Link href="/tenant/vault"
                className="flex items-center justify-between p-4 rounded-2xl border border-zinc-800 hover:border-zinc-600 transition-all group">
                <span className="text-sm font-bold uppercase tracking-tight text-zinc-400">View My Vault</span>
                <ArrowRight size={14} className="text-zinc-600 group-hover:translate-x-1 transition-all"/>
              </Link>
              <Link href="/tenant/contributions"
                className="flex items-center justify-center gap-2 py-3 border border-zinc-800 rounded-xl text-zinc-600 text-[9px] font-bold uppercase tracking-widest hover:text-teal-400 hover:border-teal-500/30 transition-all">
                <TrendingUp size={10}/> View Contribution History
              </Link>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function TenantPaySuccessPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
