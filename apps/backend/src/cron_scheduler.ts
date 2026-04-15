// ============================================================================
// NESTED ARK — AUTOMATED REMINDER & NOTICE CRON SCHEDULER
// File: backend/cron.scheduler.ts
//
// HOW TO USE:
// 1. npm install node-cron
// 2. In index.ts, add at the bottom (after all routes, before startServer()):
//
//    import { startReminderCron } from './cron.scheduler';
//    // OR if using require:
//    // const { startReminderCron } = require('./cron.scheduler');
//
//    startReminderCron(pool, getMailer);
//    // where getMailer is the helper function defined in powerhouse.routes.ts
//    // OR just inline the transporter creation here
//
// The cron runs daily at 08:00 WAT and:
//   - Sends 30/15/7 day pre-due reminders
//   - Sends overdue reminders at 2, 7, 14 days past due
//   - Auto-generates Notice to Pay at 48h overdue (if landlord has automation enabled)
//   - Processes flex-pay vault drawdown disbursements
// ============================================================================

import { Pool } from 'pg';
import crypto from 'crypto';

// ── Type declarations ─────────────────────────────────────────────────────────
interface Tenancy {
  id: string;
  tenant_name: string;
  tenant_email: string;
  tenant_phone: string;
  unit_name: string;
  unit_id: string;
  project_id: string;
  project_title: string;
  project_number: string;
  rent_amount: string;
  payment_day: number;
  days_until_due: number;
  days_overdue: number;
  auto_notices_enabled: boolean;
}

// ── HTML email helper (duplicated here for cron context) ──────────────────────
function arkEmailCron(subject: string, body: string, actionUrl?: string, actionLabel?: string) {
  const btn = actionUrl
    ? `<div style="text-align:center;margin:28px 0;"><a href="${actionUrl}" style="background:#14b8a6;color:#000;padding:13px 30px;text-decoration:none;font-weight:900;border-radius:8px;text-transform:uppercase;font-size:11px;letter-spacing:2px;display:inline-block;">${actionLabel || 'Take Action'}</a></div>`
    : '';
  return `<div style="background:#050505;color:#f4f4f5;padding:40px 32px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #1f2937;border-radius:12px;">
    <p style="color:#14b8a6;font-size:9px;font-weight:900;letter-spacing:4px;text-transform:uppercase;margin:0 0 6px;">Nested Ark OS</p>
    <h1 style="color:#fff;font-size:20px;font-weight:900;letter-spacing:-0.5px;text-transform:uppercase;margin:0 0 24px;">${subject}</h1>
    ${body}${btn}
    <div style="border-top:1px solid #1f2937;padding-top:18px;margin-top:28px;"><p style="color:#3f3f46;font-size:9px;text-transform:uppercase;letter-spacing:1.5px;text-align:center;margin:0;">Impressions &amp; Impacts Ltd · Nested Ark OS</p></div>
  </div>`;
}

// ── Notice HTML builder (minimal version for cron auto-notices) ───────────────
function buildAutoNotice(t: Tenancy, noticeNumber: string, hash: string): string {
  const deadline = new Date(); deadline.setDate(deadline.getDate() + 7);
  const deadlineStr = deadline.toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
  const issuedAt = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:'Times New Roman',serif;background:#fff;color:#111;margin:0;padding:0}
    .page{max-width:720px;margin:0 auto;padding:48px 56px}
    .hdr{border-bottom:3px solid #14b8a6;padding-bottom:20px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:flex-end}
    h1{font-size:17px;font-weight:900;text-transform:uppercase;letter-spacing:1px;text-align:center;margin:0 0 28px;padding:14px;background:#f9fafb;border:2px solid #14b8a6;border-radius:4px}
    .amount-box{background:#fef2f2;border:2px solid #dc2626;border-radius:6px;padding:16px 20px;margin:24px 0;text-align:center}
    .ledger{margin-top:36px;padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;font-family:'Courier New',monospace;font-size:9px;color:#166534;word-break:break-all}
  </style></head><body><div class="page">
  <div class="hdr"><div><div style="color:#14b8a6;font-size:11px;font-weight:900;letter-spacing:3px;text-transform:uppercase">⬡ Nested Ark OS</div><div style="font-size:10px;color:#555;margin-top:3px">Impressions &amp; Impacts Ltd</div></div>
  <div style="font-size:10px;color:#555;font-family:'Courier New',monospace"><div>${noticeNumber}</div><div style="margin-top:3px">Issued: ${issuedAt}</div></div></div>
  <h1>NOTICE TO PAY — RENTAL ARREARS</h1>
  <div class="amount-box"><div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#dc2626;margin-bottom:6px">Total Amount in Arrears</div>
  <div style="font-size:26px;font-weight:900;color:#dc2626;font-family:'Courier New',monospace">₦${Number(t.rent_amount).toLocaleString()}</div></div>
  <p style="font-size:13px;line-height:1.8">TAKE NOTICE that <strong>${t.tenant_name}</strong> is in arrears of rent for <strong>${t.unit_name}</strong>, ${t.project_title} (${t.project_number}), currently <strong>${t.days_overdue} days overdue</strong>. You are required to pay ₦${Number(t.rent_amount).toLocaleString()} on or before <strong>${deadlineStr}</strong>.</p>
  <div class="ledger">SHA-256: ${hash}<br>Auto-generated by Nested Ark OS · nestedark.io/ledger</div>
  </div></body></html>`;
}

export function startReminderCron(pool: Pool, getMailerFn: () => any) {
  let nodeCron: any;
  try { nodeCron = require('node-cron'); } catch {
    console.warn('[CRON] node-cron not installed. Run: npm install node-cron');
    console.warn('[CRON] Automated reminders disabled. Install node-cron to enable.');
    return;
  }

  // Daily at 08:00 WAT (UTC+1 = 07:00 UTC)
  nodeCron.schedule('0 7 * * *', async () => {
    console.log('[CRON] Running daily rent reminder scheduler…');
    try {
      await runDailyReminders(pool, getMailerFn);
    } catch (err: any) {
      console.error('[CRON] Reminder run failed:', err.message);
    }
  });

  // Drawdown disbursements at 09:00 UTC daily
  nodeCron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Running flex-pay drawdown disbursements…');
    try {
      await runDrawdownDisbursements(pool);
    } catch (err: any) {
      console.error('[CRON] Drawdown run failed:', err.message);
    }
  });

  console.log('[CRON] Reminder scheduler started — daily 08:00 WAT');
}

async function runDailyReminders(pool: Pool, getMailerFn: () => any) {
  // Fetch all active tenancies with their rent due status
  const tenancies = await pool.query(`
    SELECT
      t.id, t.tenant_name, t.tenant_email, t.tenant_phone,
      t.payment_day, t.rent_amount, t.project_id,
      ru.unit_name, ru.unit_id, ru.id AS unit_id,
      p.title AS project_title, p.project_number,
      COALESCE(p.auto_reminders_enabled, true) AS auto_notices_enabled,
      -- Days until next due date this month
      (DATE_TRUNC('month', NOW()) + ((t.payment_day - 1) || ' days')::interval)::date - NOW()::date AS days_until_due,
      -- Days since last successful payment
      EXTRACT(DAY FROM NOW() - COALESCE(
        (SELECT MAX(rp.paid_at) FROM rent_payments rp WHERE rp.unit_id = t.unit_id AND rp.status='SUCCESS'),
        t.lease_start::timestamp
      )) AS days_since_payment
    FROM tenancies t
    JOIN rental_units ru ON ru.id = t.unit_id
    JOIN projects p      ON p.id  = t.project_id
    WHERE t.status = 'ACTIVE'
  `);

  const mailer = getMailerFn();
  const frontendUrl = process.env.FRONTEND_URL || 'https://nested-ark-frontend.vercel.app';

  for (const t of tenancies.rows) {
    const daysUntil = parseInt(t.days_until_due) || 0;
    const daysSince = parseInt(t.days_since_payment) || 0;

    // ── Pre-due reminders ─────────────────────────────────────────────────
    let reminderType: string | null = null;
    if      (daysUntil === 30) reminderType = 'PRE_DUE_30';
    else if (daysUntil === 15) reminderType = 'PRE_DUE_15';
    else if (daysUntil === 7)  reminderType = 'PRE_DUE_7';
    else if (daysUntil === 0)  reminderType = 'DUE_TODAY';

    if (reminderType) {
      const alreadySent = await pool.query(
        `SELECT 1 FROM rent_reminders WHERE tenancy_id=$1 AND reminder_type=$2 AND sent_at > NOW() - INTERVAL '1 day'`,
        [t.id, reminderType]
      );
      if (!alreadySent.rows.length) {
        const dayLabel = daysUntil === 0 ? 'TODAY' : `in ${daysUntil} days`;
        try {
          await mailer.sendMail({
            from: `"Nested Ark OS" <${process.env.EMAIL_USER}>`,
            to:   t.tenant_email,
            subject: `Rent due ${dayLabel} — ${t.unit_name} · ${t.project_number}`,
            html: arkEmailCron(
              `Rent Due ${dayLabel.toUpperCase()}`,
              `<p style="color:#a1a1aa;font-size:13px;line-height:1.7;">Dear <strong style="color:white">${t.tenant_name}</strong>,<br><br>Your rent of <strong style="color:#14b8a6">₦${Number(t.rent_amount).toLocaleString()}</strong> for <strong style="color:white">${t.unit_name}</strong> (${t.project_title}) is due <strong style="color:#f97316">${dayLabel}</strong>.</p>`,
              `${frontendUrl}/tenant/pay/${t.id}`, 'Pay Rent Now'
            ),
          });
          await pool.query(
            `INSERT INTO rent_reminders (tenancy_id, unit_id, project_id, reminder_type, sent_via, recipient_email, was_delivered) VALUES ($1,$2,$3,$4,'EMAIL',$5,true)`,
            [t.id, t.unit_id, t.project_id, reminderType, t.tenant_email]
          );
          console.log(`[CRON][REMINDER] ${reminderType} → ${t.tenant_email}`);
        } catch (err: any) {
          await pool.query(
            `INSERT INTO rent_reminders (tenancy_id, unit_id, project_id, reminder_type, sent_via, recipient_email, was_delivered, error_msg) VALUES ($1,$2,$3,$4,'EMAIL',$5,false,$6)`,
            [t.id, t.unit_id, t.project_id, reminderType, t.tenant_email, err.message]
          );
        }
      }
    }

    // ── Overdue reminders ─────────────────────────────────────────────────
    let overdueType: string | null = null;
    if      (daysSince >= 14 && daysSince < 21) overdueType = 'OVERDUE_14D';
    else if (daysSince >= 7  && daysSince < 14) overdueType = 'OVERDUE_7D';
    else if (daysSince >= 2  && daysSince < 7)  overdueType = 'OVERDUE_2D';

    if (overdueType) {
      const alreadySent = await pool.query(
        `SELECT 1 FROM rent_reminders WHERE tenancy_id=$1 AND reminder_type=$2 AND sent_at > NOW() - INTERVAL '3 days'`,
        [t.id, overdueType]
      );
      if (!alreadySent.rows.length) {
        const daysLabel = Math.round(daysSince);
        try {
          await mailer.sendMail({
            from:    `"Nested Ark OS — Arrears" <${process.env.EMAIL_USER}>`,
            to:      t.tenant_email,
            subject: `OVERDUE ${daysLabel} DAYS — ${t.unit_name} · ${t.project_number}`,
            html: arkEmailCron(
              `Rent ${daysLabel} Days Overdue`,
              `<p style="color:#a1a1aa;font-size:13px;line-height:1.7;">Dear <strong style="color:white">${t.tenant_name}</strong>,<br><br>Your rent of <strong style="color:#ef4444">₦${Number(t.rent_amount).toLocaleString()}</strong> for <strong style="color:white">${t.unit_name}</strong> is now <strong style="color:#ef4444">${daysLabel} days overdue</strong>.<br><br>Please pay immediately to avoid a formal legal notice being issued.</p>`,
              `${frontendUrl}/tenant/pay/${t.id}`, 'Pay Immediately'
            ),
          });
          await pool.query(
            `INSERT INTO rent_reminders (tenancy_id, unit_id, project_id, reminder_type, sent_via, recipient_email, was_delivered) VALUES ($1,$2,$3,$4,'EMAIL',$5,true)`,
            [t.id, t.unit_id, t.project_id, overdueType, t.tenant_email]
          );
          console.log(`[CRON][OVERDUE] ${overdueType} → ${t.tenant_email}`);
        } catch (err: any) {
          console.error(`[CRON] Overdue email failed for ${t.tenant_email}:`, err.message);
        }

        // ── Auto-generate Notice to Pay at 48h+ overdue ───────────────────
        if (daysSince >= 2 && t.auto_notices_enabled) {
          const noticeExists = await pool.query(
            `SELECT 1 FROM legal_notices WHERE tenancy_id=$1 AND notice_type='NOTICE_TO_PAY' AND issued_at > NOW() - INTERVAL '30 days'`,
            [t.id]
          );
          if (!noticeExists.rows.length) {
            try {
              const seqRes = await pool.query(`SELECT nextval('notice_number_seq') AS n`);
              const noticeNumber = `ARK-NTP-${new Date().getFullYear()}-${String(seqRes.rows[0].n).padStart(5,'0')}`;
              const deadline = new Date(); deadline.setDate(deadline.getDate() + 7);
              const h = crypto.createHash('sha256')
                .update(`auto-notice-${t.id}-${Date.now()}`).digest('hex');

              await pool.query(
                `INSERT INTO legal_notices (tenancy_id, unit_id, project_id, notice_type, notice_number, amount_overdue, days_overdue, response_deadline, ledger_hash, notes)
                 VALUES ($1,$2,$3,'NOTICE_TO_PAY',$4,$5,$6,$7,$8,'Auto-generated by Nested Ark cron')`,
                [t.id, t.unit_id, t.project_id, noticeNumber, t.rent_amount, Math.round(daysSince), deadline.toISOString().split('T')[0], h]
              );

              const noticeHtml = buildAutoNotice(
                { ...t, days_overdue: Math.round(daysSince), auto_notices_enabled: true },
                noticeNumber, h
              );

              await mailer.sendMail({
                from:    `"Nested Ark OS — Legal" <${process.env.EMAIL_USER}>`,
                to:      t.tenant_email,
                subject: `FORMAL NOTICE: ${noticeNumber} — Rental Arrears`,
                html: arkEmailCron(
                  'Formal Notice to Pay',
                  `<p style="color:#a1a1aa;font-size:13px;line-height:1.7;">Dear <strong style="color:white">${t.tenant_name}</strong>, please see the attached formal notice regarding rental arrears of <strong style="color:#ef4444">₦${Number(t.rent_amount).toLocaleString()}</strong> for ${t.unit_name}.</p>`,
                ),
                attachments: [{ filename: `${noticeNumber}.html`, content: Buffer.from(noticeHtml), contentType: 'text/html' }],
              });

              await pool.query(
                `UPDATE legal_notices SET served_at=NOW(), status='SERVED' WHERE notice_number=$1`, [noticeNumber]
              );
              await pool.query(
                `INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1,$2,$3)`,
                ['AUTO_NOTICE_ISSUED', JSON.stringify({ notice_number: noticeNumber, tenancy_id: t.id, days_overdue: Math.round(daysSince) }), h]
              );
              console.log(`[CRON][NOTICE] Auto-issued ${noticeNumber} → ${t.tenant_email}`);
            } catch (noticeErr: any) {
              console.error('[CRON] Auto-notice failed:', noticeErr.message);
            }
          }
        }
      }
    }
  }

  console.log(`[CRON] Reminder run complete — ${tenancies.rows.length} tenancies processed`);
}

async function runDrawdownDisbursements(pool: Pool) {
  const today = new Date().getDate();

  // Find DRAWDOWN mode vaults where today is the drawdown day and vault has balance
  const vaults = await pool.query(
    `SELECT fpv.*, t.tenant_name, p.sponsor_id
     FROM flex_pay_vaults fpv
     JOIN tenancies t ON t.id = fpv.tenancy_id
     JOIN projects p  ON p.id = fpv.project_id
     WHERE fpv.cashout_mode = 'DRAWDOWN'
       AND fpv.drawdown_day = $1
       AND fpv.vault_balance >= fpv.installment_amount
       AND fpv.status = 'ACTIVE'`,
    [today]
  );

  for (const v of vaults.rows) {
    try {
      const monthlyDisbursement = parseFloat(v.vault_balance) / 12;
      const platformFee = monthlyDisbursement * 0.02;
      const netDisbursement = monthlyDisbursement - platformFee;

      await pool.query(
        `UPDATE flex_pay_vaults SET vault_balance = vault_balance - $1, updated_at=NOW() WHERE id=$2`,
        [monthlyDisbursement, v.id]
      );

      const h = crypto.createHash('sha256')
        .update(`drawdown-${v.id}-${netDisbursement}-${Date.now()}`).digest('hex');

      await pool.query(
        `INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1,$2,$3)`,
        ['DRAWDOWN_DISBURSEMENT', JSON.stringify({
          vault_id: v.id, project_id: v.project_id, gross: monthlyDisbursement,
          platform_fee: platformFee, net: netDisbursement,
        }), h]
      );

      console.log(`[CRON][DRAWDOWN] ₦${netDisbursement.toLocaleString()} → project ${v.project_id}`);
    } catch (err: any) {
      console.error(`[CRON][DRAWDOWN] Failed for vault ${v.id}:`, err.message);
    }
  }

  console.log(`[CRON] Drawdown run complete — ${vaults.rows.length} vaults processed`);
}
