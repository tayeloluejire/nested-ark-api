// ════════════════════════════════════════════════════════════════════════════
// EmailService — the ONLY place in this codebase allowed to call
// nodemailer.createTransport(). Every route sends mail through
// `EmailService.send(...)`. Nothing else touches SMTP directly.
//
// Lifecycle:
//   1. `initEmailService()` is called ONCE from startServer(), before the
//      HTTP listener opens. It creates the pooled transporter and (best
//      effort) verifies the SMTP connection so boot logs tell you
//      immediately if mail is misconfigured — it does NOT crash boot if
//      verification fails, since a temporarily-down mail server should never
//      take down the whole API.
//   2. `EmailService.send(...)` reuses that one transporter for every email,
//      for the lifetime of the process.
//   3. `setDbLogger(...)` lets index.ts wire up persistence (email_logs
//      table) without this module needing to know about `pg.Pool` directly.
// ════════════════════════════════════════════════════════════════════════════

import nodemailer, { Transporter } from 'nodemailer';

// ── Config ────────────────────────────────────────────────────────────────
// NOTE: reads SMTP_* first (what's actually set on Render), falls back to
// EMAIL_* for local/dev convenience. Previously this only checked EMAIL_*,
// which doesn't exist on Render — every value silently fell back to its
// hardcoded default (smtp.gmail.com with no credentials), which is why boot
// logged "Connection timeout": it was trying to reach Gmail, not Brevo.
const EMAIL_HOST    = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
const EMAIL_PORT    = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587', 10);
const EMAIL_SECURE  = (process.env.SMTP_SECURE || process.env.EMAIL_SECURE || 'false').toLowerCase() === 'true';
const EMAIL_USER    = process.env.SMTP_USER || process.env.EMAIL_USER || '';   // SMTP login (e.g. a7af0c001@smtp-brevo.com) — used for auth only
const EMAIL_PASS    = process.env.SMTP_PASS || process.env.EMAIL_PASS || '';
// FROM_ADDRESS is the visible "From" address shown to recipients. Brevo's
// SMTP login is not a real mailbox — the domain-authenticated address
// (SPF/DKIM/DMARC verified on nestedark.com) belongs in EMAIL_FROM.
const FROM_ADDRESS   = process.env.EMAIL_FROM || EMAIL_USER;
const FROM_NAME      = process.env.EMAIL_FROM_NAME || 'Nested Ark OS';
const SUPPORT_EMAIL  = process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM || 'nestedark@gmail.com';
const FRONTEND_URL   = process.env.FRONTEND_URL || 'https://nestedark.com';
const MAX_RETRIES    = 2;
const RETRY_DELAY_MS = 1500;

// ════════════════════════════════════════════════════════════════════════════
// SINGLETON TRANSPORTER
// ════════════════════════════════════════════════════════════════════════════
let _transporter: Transporter | null = null;
let _initialized = false;

function buildTransporter(): Transporter {
  return nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_SECURE,
    auth: EMAIL_USER ? { user: EMAIL_USER, pass: EMAIL_PASS } : undefined,
    pool: true,             // reuse SMTP connections (Phase 4: connection pooling)
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
}

/**
 * Call ONCE at server startup, before app.listen(). Creates the singleton
 * transporter and verifies connectivity (logs only — never throws, since a
 * flaky mail server must never block the API from booting).
 */
export async function initEmailService(): Promise<void> {
  if (_initialized) {
    console.warn('[EmailService] initEmailService() called more than once — ignoring, singleton already exists.');
    return;
  }
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error('[EmailService] SMTP_USER / SMTP_PASS (or EMAIL_USER / EMAIL_PASS) not set — email sending will be disabled until configured.');
  }
  _transporter = buildTransporter();
  _initialized = true;

  try {
    await _transporter.verify();
    console.log(`[EmailService] Ready — SMTP connection verified (${EMAIL_HOST}:${EMAIL_PORT}, pooled).`);
  } catch (err: any) {
    console.warn(`[EmailService] SMTP verify failed at boot (non-fatal, will retry on send): ${err?.message || err}`);
  }
}

/**
 * Returns the singleton transporter, creating it defensively if
 * initEmailService() was never called (e.g. in a test harness). Also used by
 * cron_scheduler.ts via the getMailer() compatibility shim in index.ts, so
 * scheduled jobs share the exact same pooled connection as HTTP routes.
 */
export function getTransporter(): Transporter {
  if (!_transporter) {
    console.warn('[EmailService] getTransporter() called before initEmailService() — creating transporter lazily.');
    _transporter = buildTransporter();
  }
  return _transporter;
}

// ════════════════════════════════════════════════════════════════════════════
// STRUCTURED EMAIL EVENT LOGGING
// Every send — success or failure — is logged with recipient, template,
// status, provider response, and timestamp. Console logging always happens;
// DB persistence is optional and wired up by index.ts via setDbLogger().
// ════════════════════════════════════════════════════════════════════════════
export interface EmailLogEntry {
  recipient: string;
  template: string;
  status: 'SENT' | 'FAILED';
  providerResponse?: string;
  errorMessage?: string;
}

type DbLogger = (entry: EmailLogEntry) => Promise<void>;
let _dbLogger: DbLogger | null = null;

/** Wire up persistence for email events (e.g. an INSERT into `email_logs`). Optional. */
export function setDbLogger(fn: DbLogger): void {
  _dbLogger = fn;
}

function logEmailEvent(entry: EmailLogEntry) {
  const timestamp = new Date().toISOString();
  const line = {
    event: 'email',
    timestamp,
    recipient: entry.recipient,
    template: entry.template,
    status: entry.status,
    providerResponse: entry.providerResponse || null,
    errorMessage: entry.errorMessage || null,
  };
  if (entry.status === 'SENT') {
    console.log(`[EmailService] ${JSON.stringify(line)}`);
  } else {
    console.error(`[EmailService] ${JSON.stringify(line)}`);
  }
  if (_dbLogger) {
    _dbLogger(entry).catch((e: any) => {
      console.warn('[EmailService] DB log persistence failed (non-fatal):', e?.message || e);
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SEND
// ════════════════════════════════════════════════════════════════════════════
export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: any[];
  /** Name of the template used — required for event logging (Phase 8). */
  template?: string;
  /** Override the "From" display name (default: EMAIL_FROM_NAME / "Nested Ark OS"). */
  fromName?: string;
  /** If true, awaits the send and returns the result. Default: fire-and-forget. */
  await?: boolean;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWithRetry(opts: SendEmailOptions): Promise<SendEmailResult> {
  const templateName = opts.template || 'generic';
  const mailOptions = {
    from: `"${opts.fromName || FROM_NAME}" <${FROM_ADDRESS}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments,
  };

  let lastError: any = null;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const info = await getTransporter().sendMail(mailOptions);
      logEmailEvent({
        recipient: opts.to,
        template: templateName,
        status: 'SENT',
        providerResponse: info?.response || info?.messageId || 'ok',
      });
      return { success: true };
    } catch (err: any) {
      lastError = err;
      const isTransient =
        err?.code === 'ETIMEDOUT' || err?.code === 'ECONNECTION' || err?.code === 'ESOCKET' ||
        /timeout|timed out|econnreset|econnrefused/i.test(err?.message || '');
      if (!isTransient || attempt > MAX_RETRIES) break;
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  // Never throw — a failed email must never interrupt the business
  // transaction that triggered it (Phase 7).
  logEmailEvent({
    recipient: opts.to,
    template: templateName,
    status: 'FAILED',
    errorMessage: lastError?.message || 'Unknown email error',
  });
  return { success: false, error: lastError?.message || 'Unknown email error' };
}

export const EmailService = {
  /**
   * Always returns Promise<SendEmailResult>. Fire-and-forget callers can
   * simply not `await` it — the send still happens in the background and
   * errors are already caught/logged inside sendWithRetry either way.
   * (Previously this had a conditional `Promise<SendEmailResult> | void`
   * return type keyed off `opts.await`, which TypeScript can't narrow at
   * the call site — every awaited call was typed as `void | SendEmailResult`
   * and `.success`/`.error` access failed to compile. Same runtime
   * behavior, just a real, single return type now.)
   */
  send(opts: SendEmailOptions): Promise<SendEmailResult> {
    if (!EMAIL_USER || !EMAIL_PASS) {
      logEmailEvent({ recipient: opts.to, template: opts.template || 'generic', status: 'FAILED', errorMessage: 'SMTP_USER/SMTP_PASS not configured' });
      return Promise.resolve({ success: false, error: 'Email not configured' });
    }
    return sendWithRetry(opts); // caller decides whether to await; errors are already caught/logged inside
  },
};

// ════════════════════════════════════════════════════════════════════════════
// REUSABLE HTML TEMPLATE COMPONENTS (Phase 3/4 of the audit)
// Header · Footer · CTA Button · Security Notice — every template composes
// these four building blocks so branding changes happen in exactly one place.
// ════════════════════════════════════════════════════════════════════════════

export function renderHeader(eyebrow: string = 'Nested Ark OS'): string {
  return `
    <tr>
      <td style="background:#0a0a0a;border-bottom:1px solid #14b8a633;padding:24px 32px;text-align:center;">
        <p style="color:#14b8a6;font-size:10px;font-weight:900;letter-spacing:4px;text-transform:uppercase;margin:0;">${eyebrow}</p>
      </td>
    </tr>`;
}

export function renderCTAButton(cta?: { label: string; url: string }): string {
  if (!cta) return '';
  return `
    <div style="text-align:center;margin:32px 0;">
      <a href="${cta.url}" style="background:#14b8a6;color:#000;padding:14px 34px;text-decoration:none;font-weight:900;border-radius:8px;text-transform:uppercase;font-size:11px;letter-spacing:2px;display:inline-block;">${cta.label}</a>
    </div>`;
}

export function renderSecurityNotice(text?: string): string {
  const message = text || "Nested Ark will never ask for your password by email. If you didn't expect this message, you can safely ignore it.";
  return `<p style="color:#52525b;font-size:10px;line-height:1.6;text-align:center;margin:0 0 6px;">${message}</p>`;
}

export function renderFooter(securityNotice?: string): string {
  const year = new Date().getFullYear();
  return `
    <tr>
      <td style="padding:20px 32px 28px;border-top:1px solid #1f2937;">
        ${renderSecurityNotice(securityNotice)}
        <p style="color:#3f3f46;font-size:9px;text-transform:uppercase;letter-spacing:1.5px;text-align:center;margin:14px 0 4px;">
          Support: <a href="mailto:${SUPPORT_EMAIL}" style="color:#14b8a6;text-decoration:none;">${SUPPORT_EMAIL}</a>
        </p>
        <p style="color:#3f3f46;font-size:9px;text-transform:uppercase;letter-spacing:1px;text-align:center;margin:0 0 10px;">
          <a href="https://twitter.com/nestedark" style="color:#52525b;text-decoration:none;margin:0 6px;">Twitter</a>·
          <a href="https://instagram.com/nestedark" style="color:#52525b;text-decoration:none;margin:0 6px;">Instagram</a>·
          <a href="https://linkedin.com/company/nestedark" style="color:#52525b;text-decoration:none;margin:0 6px;">LinkedIn</a>
        </p>
        <p style="color:#3f3f46;font-size:9px;text-transform:uppercase;letter-spacing:1px;text-align:center;margin:0;">
          © ${year} Impressions &amp; Impacts Ltd · Nested Ark OS
        </p>
      </td>
    </tr>`;
}

/** The shell every email is built on: Header → body → CTA → Footer (with Security Notice). */
export function renderEmail(opts: {
  eyebrow?: string;
  title: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  securityNotice?: string;
}): string {
  const { eyebrow = 'Nested Ark OS', title, bodyHtml, cta, securityNotice } = opts;
  return `
  <div style="background:#09090b;padding:24px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;background:#050505;border:1px solid #1f2937;border-radius:16px;overflow:hidden;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
      ${renderHeader(eyebrow)}
      <tr>
        <td style="padding:36px 32px 8px;">
          <h1 style="color:#ffffff;font-size:21px;font-weight:900;letter-spacing:-0.5px;text-transform:uppercase;margin:0 0 20px;text-align:center;">${title}</h1>
          <div style="color:#a1a1aa;font-size:13px;line-height:1.7;">${bodyHtml}</div>
          ${renderCTAButton(cta)}
        </td>
      </tr>
      ${renderFooter(securityNotice)}
    </table>
  </div>`;
}

/**
 * Drop-in replacement for the old `arkEmail(subject, bodyHtml, actionBtn)`
 * helper — same signature, so every ad-hoc/operational email (reminders,
 * legal notices, dual-channel messages, disbursement alerts) migrates with a
 * one-line rename instead of a rewrite, while still composing the same
 * Header/Footer/CTA/SecurityNotice components under the hood.
 */
export function genericTemplate(subject: string, bodyHtml: string, actionBtn?: { label: string; url: string }): string {
  return renderEmail({ title: subject, bodyHtml, cta: actionBtn });
}

// ════════════════════════════════════════════════════════════════════════════
// STANDARDIZED TRANSACTIONAL TEMPLATES (Phase 3)
// ════════════════════════════════════════════════════════════════════════════

const bulletRow = (icon: string, text: string) =>
  `<tr><td style="padding:5px 0;font-size:13px;color:#a1a1aa;"><span style="color:#14b8a6;margin-right:10px;">${icon}</span>${text}</td></tr>`;

// ── 1. Welcome (tenant) ───────────────────────────────────────────────────────
export function welcomeTenantTemplate(firstName: string) {
  const body = `
    <p>Hello <strong style="color:#fff;">${firstName}</strong>,</p>
    <p>Welcome to Nested Ark. We're excited to have you join a growing community of people taking control of their rent journey.</p>
    <p style="font-weight:700;color:#fff;">With Nested Ark, you can:</p>
    <table style="border-collapse:collapse;width:100%;margin:4px 0 20px;">
      ${bulletRow('•', 'Create a Rent Vault for your next rent payment')}
      ${bulletRow('•', 'Contribute gradually instead of scrambling at renewal')}
      ${bulletRow('•', 'Track every contribution transparently')}
      ${bulletRow('•', 'Receive reminders and progress updates')}
    </table>
    <p style="background:#0d1f1f;border:1px solid #134e4a;border-radius:8px;padding:16px;font-size:12px;color:#5eead4;font-style:italic;text-align:center;">
      Small consistent contributions today can eliminate rent pressure tomorrow.
    </p>`;
  return {
    subject: 'Welcome to Nested Ark — Your Rent Journey Starts Here',
    html: renderEmail({ title: 'Welcome to Nested Ark', bodyHtml: body, cta: { label: 'Create My Rent Vault', url: `${FRONTEND_URL}/tenant/vault` } }),
  };
}

// ── 2. Welcome (landlord) ─────────────────────────────────────────────────────
export function welcomeLandlordTemplate(firstName: string) {
  const body = `
    <p>Hello <strong style="color:#fff;">${firstName}</strong>,</p>
    <p>Welcome to Nested Ark. Thank you for joining our growing network of landlords embracing smarter rent management.</p>
    <p style="font-weight:700;color:#fff;">With Nested Ark, you can:</p>
    <table style="border-collapse:collapse;width:100%;margin:4px 0 20px;">
      ${bulletRow('•', 'List and manage rental units')}
      ${bulletRow('•', 'Track tenant activity in real time')}
      ${bulletRow('•', 'Receive secure, automated rent payments')}
      ${bulletRow('•', 'Benefit from automated payout workflows')}
    </table>`;
  return {
    subject: 'Welcome to Nested Ark Landlord Network',
    html: renderEmail({ title: 'Welcome to Nested Ark', bodyHtml: body, cta: { label: 'Go to My Properties', url: `${FRONTEND_URL}/projects/my` } }),
  };
}

// ── 3. Verify Email ───────────────────────────────────────────────────────────
export function verifyEmailTemplate(verifyUrl: string) {
  return {
    subject: 'Verify your email address — Nested Ark OS',
    html: renderEmail({
      title: 'Verify Your Account',
      bodyHtml: `<p>Your account has been created. Click the button below to verify your email and activate your access. This link expires in <strong style="color:#fff;">24 hours</strong>.</p>`,
      cta: { label: 'Verify My Account', url: verifyUrl },
    }),
  };
}

// ── 4. Password Reset ─────────────────────────────────────────────────────────
export function forgotPasswordTemplate(fullName: string, resetLink: string) {
  return {
    subject: 'Reset your password — Nested Ark OS',
    html: renderEmail({
      title: 'Password Reset Requested',
      bodyHtml: `<p>Hello ${fullName || 'there'},</p><p>A password reset was requested for this account. Click below to choose a new password. This link expires in <strong style="color:#fff;">15 minutes</strong>.</p>`,
      cta: { label: 'Reset My Password', url: resetLink },
      securityNotice: 'If you did not request this, ignore this message — your password remains unchanged.',
    }),
  };
}

// ── 5. Password Changed ──────────────────────────────────────────────────────
export function passwordChangedTemplate(fullName: string) {
  return {
    subject: 'Your password was changed — Nested Ark OS',
    html: renderEmail({
      title: 'Password Changed',
      bodyHtml: `<p>Hello ${fullName || 'there'},</p><p>This confirms your Nested Ark account password was successfully changed.</p>`,
      securityNotice: 'If you did not make this change, contact support immediately — your account may be at risk.',
    }),
  };
}

// ── 6. Payment Receipt ────────────────────────────────────────────────────────
export function rentVaultReceiptTemplate(opts: { fullName: string; amount: string; vaultName: string; reference: string; date: string }) {
  const body = `
    <p>Hello ${opts.fullName || 'there'},</p>
    <p>We've received your contribution. Here's your receipt:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:12px;">
      <tr><td style="padding:6px 0;color:#71717a;">Amount</td><td style="padding:6px 0;color:#fff;text-align:right;">${opts.amount}</td></tr>
      <tr><td style="padding:6px 0;color:#71717a;">Vault</td><td style="padding:6px 0;color:#fff;text-align:right;">${opts.vaultName}</td></tr>
      <tr><td style="padding:6px 0;color:#71717a;">Reference</td><td style="padding:6px 0;color:#fff;text-align:right;">${opts.reference}</td></tr>
      <tr><td style="padding:6px 0;color:#71717a;">Date</td><td style="padding:6px 0;color:#fff;text-align:right;">${opts.date}</td></tr>
    </table>`;
  return { subject: `Payment Receipt — ${opts.vaultName}`, html: renderEmail({ title: 'Rent Vault Payment Receipt', bodyHtml: body }) };
}

// ── 7. Vault Fully Funded ─────────────────────────────────────────────────────
export function vaultFullyFundedTemplate(opts: { fullName: string; vaultName: string; targetAmount: string }) {
  const body = `<p>Hello ${opts.fullName || 'there'},</p><p>Great news — your Rent Vault <strong style="color:#fff;">${opts.vaultName}</strong> is now fully funded at <strong style="color:#fff;">${opts.targetAmount}</strong>. We're processing your disbursement.</p>`;
  return { subject: `Your Rent Vault is fully funded 🎉`, html: renderEmail({ title: 'Vault Fully Funded', bodyHtml: body }) };
}

/** Progress milestones (25/50/75/100%) for both Rent Vault and Savings Vault flows — replaces two near-duplicate inline blocks that used to live directly in the webhook handlers. */
export function vaultMilestoneTemplate(opts: {
  firstName: string; vaultLabel: string; hitMilestone: number; fundedPct: number;
  currentAmount: string; targetAmount: string; ctaUrl: string;
}) {
  const emoji = opts.hitMilestone === 100 ? '✅' : opts.hitMilestone === 75 ? '🔥' : opts.hitMilestone === 50 ? '🚀' : '🎉';
  const message = opts.hitMilestone === 100
    ? `Your ${opts.vaultLabel.toLowerCase()} is fully funded! Disbursement will proceed automatically.`
    : `You're ${opts.hitMilestone}% of the way to your goal. Keep going!`;
  const body = `
    <p>Hello <strong style="color:#fff;">${opts.firstName}</strong>,</p>
    <p>${message}</p>
    <div style="background:#0d1f1f;border:1px solid #134e4a;border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
      <p style="color:#52525b;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px;">${opts.vaultLabel} Progress</p>
      <p style="color:#14b8a6;font-size:36px;font-weight:900;margin:0;font-family:monospace;">${opts.fundedPct}%</p>
      <p style="color:#3f3f46;font-size:11px;margin:6px 0 0;font-family:monospace;">${opts.currentAmount} of ${opts.targetAmount}</p>
    </div>`;
  return {
    subject: `${emoji} Your ${opts.vaultLabel} is ${opts.hitMilestone}% Funded — Nested Ark OS`,
    html: renderEmail({ eyebrow: 'Nested Ark OS · Vault Update', title: `${opts.hitMilestone}% Funded`, bodyHtml: body, cta: { label: `View My ${opts.vaultLabel}`, url: opts.ctaUrl } }),
  };
}

// ── 8. Landlord Disbursement ─────────────────────────────────────────────────
export function landlordDisbursementTemplate(opts: { landlordName: string; amount: string; unitName: string; bankAccount: string }) {
  const body = `
    <p>Hello ${opts.landlordName || 'there'},</p>
    <p>A rent disbursement has been initiated for <strong style="color:#fff;">${opts.unitName}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:12px;">
      <tr><td style="padding:6px 0;color:#71717a;">Amount</td><td style="padding:6px 0;color:#fff;text-align:right;">${opts.amount}</td></tr>
      <tr><td style="padding:6px 0;color:#71717a;">Destination</td><td style="padding:6px 0;color:#fff;text-align:right;">${opts.bankAccount}</td></tr>
    </table>`;
  return { subject: `Rent Disbursement Initiated — ${opts.unitName}`, html: renderEmail({ title: 'Landlord Disbursement', bodyHtml: body }) };
}

// ── 9. Admin Notification ────────────────────────────────────────────────────
export function adminNotificationTemplate(opts: { heading: string; message: string }) {
  return {
    subject: `[Admin] ${opts.heading}`,
    html: renderEmail({ eyebrow: 'Nested Ark OS · Admin', title: opts.heading, bodyHtml: `<p>${opts.message}</p>` }),
  };
}
