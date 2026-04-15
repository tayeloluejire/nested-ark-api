'use client';
import { useState } from 'react';
import { Download, Loader2, ShieldCheck, FileText } from 'lucide-react';

interface CertProps {
  investment: {
    id: string;
    amount: number;
    created_at: string;
    project_title: string;
    project_id: string;
    status: string;
  };
  ledgerHash: string;
  investorName: string;
  roiRate: number;
  projectNumber?: string;
}

// ── Generates and triggers download of a PDF-quality HTML certificate ─────────
// Uses the browser's print-to-PDF via a hidden iframe — no jsPDF dependency needed.
// Works in all modern browsers. For server-side PDF, swap the iframe approach for
// a call to /api/investments/:id/certificate which can use puppeteer or pdfmake.
export default function InvestmentCertificate({ investment, ledgerHash, investorName, roiRate, projectNumber }: CertProps) {
  const [generating, setGenerating] = useState(false);

  const downloadCertificate = () => {
    setGenerating(true);

    const issueDate   = new Date(investment.created_at).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
    const shortHash   = ledgerHash ? ledgerHash.slice(0, 16) + '...' + ledgerHash.slice(-8) : 'PENDING';
    const projectRef  = projectNumber ?? investment.project_id.slice(0, 8).toUpperCase();
    const amountFmt   = `₦${Number(investment.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Nested Ark — Certificate of Interest</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;900&family=Space+Mono:wght@400;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #050505; color: #fff; font-family: 'Space Grotesk', sans-serif; padding: 60px; min-height: 100vh; }
  .cert { max-width: 760px; margin: 0 auto; border: 1px solid #14b8a630; border-radius: 16px; overflow: hidden; }
  .header { background: #0a0a0a; border-bottom: 1px solid #14b8a620; padding: 40px; display: flex; justify-content: space-between; align-items: flex-start; }
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo-icon { width: 20px; height: 20px; background: #14b8a6; transform: rotate(45deg); border-radius: 3px; }
  .logo-text { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; }
  .os-tag { color: #14b8a6; }
  .badge { font-family: 'Space Mono', monospace; font-size: 8px; color: #14b8a6; border: 1px solid #14b8a630; padding: 4px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.2em; }
  .body { padding: 48px; }
  .title-block { margin-bottom: 40px; border-left: 3px solid #14b8a6; padding-left: 20px; }
  .subtitle { font-size: 9px; color: #14b8a6; text-transform: uppercase; letter-spacing: 0.3em; font-weight: 700; margin-bottom: 8px; }
  h1 { font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px; font-style: italic; line-height: 1.1; }
  .certifies { font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: 0.2em; margin: 32px 0 8px; }
  .investor-name { font-size: 22px; font-weight: 900; text-transform: uppercase; color: #fff; border-bottom: 1px solid #27272a; padding-bottom: 12px; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
  .field { background: #0f0f0f; border: 1px solid #1f1f1f; border-radius: 10px; padding: 16px; }
  .field-label { font-size: 8px; color: #71717a; text-transform: uppercase; letter-spacing: 0.2em; font-weight: 700; margin-bottom: 6px; }
  .field-value { font-family: 'Space Mono', monospace; font-size: 14px; font-weight: 700; color: #14b8a6; }
  .field-value.white { color: #fff; }
  .field-value.green { color: #34d399; }
  .hash-block { background: #0a0a0a; border: 1px solid #14b8a620; border-radius: 10px; padding: 20px; margin: 24px 0; }
  .hash-label { font-size: 8px; color: #14b8a6; text-transform: uppercase; letter-spacing: 0.2em; font-weight: 700; margin-bottom: 8px; }
  .hash-value { font-family: 'Space Mono', monospace; font-size: 9px; color: #52525b; word-break: break-all; line-height: 1.6; }
  .disclaimer { font-size: 8px; color: #3f3f46; line-height: 1.6; border-top: 1px solid #1f1f1f; padding-top: 20px; margin-top: 24px; }
  .footer-strip { background: #0a0a0a; border-top: 1px solid #14b8a620; padding: 20px 48px; display: flex; justify-content: space-between; align-items: center; }
  .footer-text { font-size: 8px; color: #52525b; font-family: 'Space Mono', monospace; text-transform: uppercase; letter-spacing: 0.1em; }
  @media print {
    body { background: #050505; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="cert">
  <div class="header">
    <div class="logo">
      <div class="logo-icon"></div>
      <div>
        <div class="logo-text">Nested Ark <span class="os-tag">OS</span></div>
        <div style="font-size:7px;color:#52525b;text-transform:uppercase;letter-spacing:0.2em;margin-top:2px;">Infrastructure Exchange Platform</div>
      </div>
    </div>
    <div class="badge">✓ Cryptographically Verified</div>
  </div>

  <div class="body">
    <div class="title-block">
      <div class="subtitle">Official Document · Investment Certificate</div>
      <h1>Certificate<br>of Interest</h1>
    </div>

    <div class="certifies">This certifies that</div>
    <div class="investor-name">${investorName}</div>

    <p style="font-size:12px;color:#a1a1aa;line-height:1.7;margin-bottom:24px;">
      has committed capital to the following infrastructure project on the Nested Ark OS platform,
      with funds held in Paystack escrow pending tri-layer milestone verification.
    </p>

    <div class="grid">
      <div class="field">
        <div class="field-label">Project</div>
        <div class="field-value white" style="font-size:12px;">${investment.project_title}</div>
      </div>
      <div class="field">
        <div class="field-label">Project ID</div>
        <div class="field-value">${projectRef}</div>
      </div>
      <div class="field">
        <div class="field-label">Amount Committed</div>
        <div class="field-value green" style="font-size:18px;">${amountFmt}</div>
      </div>
      <div class="field">
        <div class="field-label">Annual Yield Target</div>
        <div class="field-value" style="font-size:18px;">${roiRate}% p.a.</div>
      </div>
      <div class="field">
        <div class="field-label">Date of Issue</div>
        <div class="field-value white" style="font-size:11px;">${issueDate}</div>
      </div>
      <div class="field">
        <div class="field-label">Status</div>
        <div class="field-value" style="font-size:11px;">${investment.status}</div>
      </div>
    </div>

    <div class="hash-block">
      <div class="hash-label">🔐 Global Ledger Hash — SHA-256</div>
      <div class="hash-value">${ledgerHash || 'Hash pending — contact support if not resolved within 24 hours'}</div>
      <div style="font-size:8px;color:#3f3f46;margin-top:8px;font-family:'Space Mono',monospace;">
        This hash permanently links this investment to the Nested Ark immutable audit trail.
        Verify at: nested-ark-frontend.vercel.app/ledger
      </div>
    </div>

    <div class="disclaimer">
      <strong style="color:#71717a;">Important Notice:</strong> Nested Ark OS (operated by Impressions &amp; Impacts Ltd) is the escrow
      and transparency platform provider — not the contractor, developer or project owner. Capital is held by Paystack Financial Services Ltd
      and released only upon successful tri-layer verification (AI + Human Auditor + Drone). This certificate is a record of your committed
      interest in the referenced project. It does not constitute financial advice, guarantee returns, or represent ownership of physical assets.
      Actual returns may vary. Past performance is not indicative of future results. For disputes, contact nestedark@gmail.com.
    </div>
  </div>

  <div class="footer-strip">
    <div class="footer-text">Nested Ark OS v4.0 · Impressions &amp; Impacts Ltd</div>
    <div class="footer-text">Lagos · London · Dubai · ${new Date().getFullYear()}</div>
  </div>
</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `NestedArk-Certificate-${projectRef}-${investment.id.slice(0, 8)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setGenerating(false);
  };

  return (
    <button
      onClick={downloadCertificate}
      disabled={generating}
      title="Download Investment Certificate"
      className="flex items-center gap-1.5 px-3 py-2 border border-zinc-700 text-zinc-400 font-bold rounded-lg text-[9px] uppercase tracking-widest hover:text-teal-500 hover:border-teal-500/40 transition-all disabled:opacity-50"
    >
      {generating
        ? <Loader2 className="animate-spin" size={10} />
        : <FileText size={10} />
      }
      Certificate
    </button>
  );
}
