/**
 * cron_scheduler.ts — Nested Ark Infrastructure OS
 * Daily automated rent reminders, overdue escalation, and vault drawdown.
 * Runs at 08:00 WAT (07:00 UTC) every day via node-cron.
 *
 * Called once from startServer() in index.ts:
 *   startReminderCron(pool, getMailer)
 */

import cron from 'node-cron';
import { Pool } from 'pg';
import crypto from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────────
type MailerFactory = () => import('nodemailer').Transporter;

// ── Helpers ───────────────────────────────────────────────────────────────────
function arkEmail(
  subject: string,
  bodyHtml: string,
  actionBtn?: { label: string; url: string }
): string {
  const btn = actionBtn
    ? `<div style="text-align:center;margin:24px 0;">
         <a href="${actionBtn.url}" style="background:#14b8a6;color:#000;font-weight:900;font-size:13px;text-decoration:none;padding:12px 28px;border-radius:8px;display:inline-block;letter-spacing:.5px;">
           ${actionBtn.label}
         </a>
       </div>`
    : '';
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
    <body style="background:#09090b;margin:0;padding:0;font-family:'Segoe UI',sans-serif;">
      <div style="max-width:520px;margin:32px auto;background:#18181b;border:1px solid #27272a;border-radius:12px;overflow:hidden;">
        <div style="background:#000;padding:18px 24px;border-bottom:1px solid #27272a;">
          <span style="color:#14b8a6;font-weight:900;font-size:16px;letter-spacing:1px;">NESTED ARK</span>
          <span style="color:#52525b;font-size:11px;margin-left:12px;">Infrastructure OS</span>
        </div>
        <div style="padding:24px;">
          <h2 style="color:#fff;font-size:16px;font-weight:800;margin:0 0 16px;">${subject}</h2>
          ${bodyHtml}
          ${btn}
        </div>
        <div style="padding:14px 24px;border-top:1px solid #27272a;text-align:center;">
          <p style="color:#52525b;font-size:9px;text-transform:uppercase;letter-spacing:2px;margin:0;">
            Secured by Nested Ark Infrastructure OS · Do not reply to this email
          </p>
        </div>
      </div>
    </body>
    </html>`;
}

// ── Main cron function ────────────────────────────────────────────────────────
export function startReminderCron(pool: Pool, getMailer: MailerFactory): void {
  // Run at 07:00 UTC = 08:00 WAT every day
  const schedule = process.env.CRON_SCHEDULE || '0 7 * * *';

  const isValidCron = cron.validate(schedule);
  if (!isValidCron) {
    console.error(`[CRON] Invalid cron schedule "${schedule}" — using default 0 7 * * *`);
  }

  cron.schedule(isValidCron ? schedule : '0 7 * * *', async () => {
    const runId = crypto.randomUUID().slice(0, 8);
    console.log(`[CRON:${runId}] Daily rent cycle starting — ${new Date().toISOString()}`);

    const client = await pool.connect();
    try {
      // ── 1. Send reminders for vaults due today or tomorrow ──────────────────
      const dueVaults = await client.query(`
        SELECT
          fpv.id            AS vault_id,
          fpv.tenancy_id,
          fpv.next_due_date,
          fpv.installment_amount,
          fpv.currency,
          fpv.frequency,
          t.tenant_name,
          t.tenant_email,
          t.tenant_phone,
          t.unit_id,
          t.project_id,
          ru.unit_name,
          p.title          AS project_title,
          p.project_number
        FROM flex_pay_vaults fpv
        JOIN tenancies    t  ON t.id  = fpv.tenancy_id
        JOIN rental_units ru ON ru.id = fpv.unit_id
        JOIN projects     p  ON p.id  = fpv.project_id
        WHERE fpv.status IN ('ACTIVE', 'FUNDED_READY')
          AND fpv.next_due_date <= (CURRENT_DATE + INTERVAL '1 day')
          AND fpv.next_due_date >= CURRENT_DATE
          AND t.status = 'ACTIVE'
      `);

      const mailer = getMailer();
      const frontendUrl = process.env.FRONTEND_URL || 'https://nested-ark-frontend.vercel.app';

      for (const v of dueVaults.rows) {
        try {
          const html = arkEmail(
            'Rent Payment Due',
            `<p style="color:#a1a1aa;font-size:13px;line-height:1.7;">
              Dear <strong style="color:white">${v.tenant_name}</strong>,<br><br>
              Your ${v.frequency.toLowerCase()} installment of
              <strong style="color:#14b8a6">${v.currency} ${Number(v.installment_amount).toLocaleString()}</strong>
              for <strong style="color:white">${v.unit_name}</strong> at
              <strong style="color:white">${v.project_title}</strong> (${v.project_number})
              is due today.<br><br>
              <strong style="color:#f97316;">48-Hour Rule:</strong> If payment is not received within 48 hours,
              a formal Notice to Pay will be automatically issued.
            </p>`,
            { label: 'Pay Now — Ark Portal', url: `${frontendUrl}/tenant/pay?tenancy_id=${v.tenancy_id}` }
          );

          await mailer.sendMail({
            from: `"Nested Ark OS" <${process.env.EMAIL_USER}>`,
            to: v.tenant_email,
            subject: `[ACTION REQUIRED] Rent Due Today — ${v.unit_name} · ${v.project_number}`,
            html,
          });

          await client.query(
            `INSERT INTO rent_reminders
               (tenancy_id, unit_id, project_id, reminder_type, sent_via, recipient_email, was_delivered)
             VALUES ($1,$2,$3,'DUE_TODAY','EMAIL',$4,true)`,
            [v.tenancy_id, v.unit_id, v.project_id, v.tenant_email]
          );

          console.log(`[CRON:${runId}] DUE reminder sent → ${v.tenant_email} (${v.unit_name})`);
        } catch (mailErr: any) {
          console.warn(`[CRON:${runId}] DUE reminder FAILED → ${v.tenant_email}: ${mailErr.message}`);
          await client.query(
            `INSERT INTO rent_reminders
               (tenancy_id, unit_id, project_id, reminder_type, sent_via, recipient_email, was_delivered, error_msg)
             VALUES ($1,$2,$3,'DUE_TODAY','EMAIL',$4,false,$5)`,
            [v.tenancy_id, v.unit_id, v.project_id, v.tenant_email, mailErr.message]
          );
        }
      }

      // ── 2. Escalate vaults 48+ hours overdue → auto-issue Notice to Pay ────
      const overdueVaults = await client.query(`
        SELECT
          fpv.id            AS vault_id,
          fpv.tenancy_id,
          fpv.next_due_date,
          fpv.installment_amount,
          fpv.currency,
          fpv.vault_balance,
          fpv.target_amount,
          t.tenant_name,
          t.tenant_email,
          t.tenant_phone,
          t.unit_id,
          t.project_id,
          t.tenant_score,
          ru.unit_name,
          p.title          AS project_title,
          p.project_number,
          -- Check if a notice already exists for this overdue cycle
          (
            SELECT COUNT(*) FROM legal_notices ln
            WHERE ln.tenancy_id = fpv.tenancy_id
              AND ln.status IN ('ISSUED','SERVED')
              AND ln.issued_at > (fpv.next_due_date - INTERVAL '1 day')
          ) AS active_notice_count
        FROM flex_pay_vaults fpv
        JOIN tenancies    t  ON t.id  = fpv.tenancy_id
        JOIN rental_units ru ON ru.id = fpv.unit_id
        JOIN projects     p  ON p.id  = fpv.project_id
        WHERE fpv.status IN ('ACTIVE')
          AND fpv.next_due_date < (CURRENT_DATE - INTERVAL '1 day')
          AND fpv.vault_balance < fpv.installment_amount
          AND t.status = 'ACTIVE'
      `);

      for (const v of overdueVaults.rows) {
        if (parseInt(v.active_notice_count) > 0) {
          console.log(`[CRON:${runId}] Skipping ${v.unit_name} — active notice already issued`);
          continue;
        }

        const daysOverdue = Math.floor(
          (Date.now() - new Date(v.next_due_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        const amountOverdue = parseFloat(v.installment_amount) - parseFloat(v.vault_balance || 0);

        try {
          // Determine notice type based on days overdue
          const noticeType = daysOverdue >= 7 ? 'NOTICE_TO_QUIT' : 'PAY_OR_QUIT';
          const deadlineDays = noticeType === 'NOTICE_TO_QUIT' ? 14 : 7;
          const deadline = new Date();
          deadline.setDate(deadline.getDate() + deadlineDays);
          const deadlineStr = deadline.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

          // Generate notice number
          let noticeSeq = 1;
          try {
            const seqRes = await client.query(`SELECT nextval('notice_number_seq') AS n`);
            noticeSeq = seqRes.rows[0].n;
          } catch {
            // Sequence may not exist yet — use timestamp fallback
            noticeSeq = Date.now() % 100000;
          }
          const noticeNumber = `ARK-${noticeType.slice(0, 3)}-${new Date().getFullYear()}-${String(noticeSeq).padStart(5, '0')}`;

          const h = crypto
            .createHash('sha256')
            .update(`auto-notice-${noticeNumber}-${v.tenancy_id}-${amountOverdue}-${Date.now()}`)
            .digest('hex');

          // Insert notice
          await client.query(
            `INSERT INTO legal_notices
               (tenancy_id, unit_id, project_id, notice_type, notice_number,
                amount_overdue, days_overdue, response_deadline, ledger_hash, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ISSUED')`,
            [
              v.tenancy_id, v.unit_id, v.project_id, noticeType, noticeNumber,
              amountOverdue, daysOverdue, deadline.toISOString().split('T')[0], h,
            ]
          );

          // Deduct tenant score (10 pts per overdue event, minimum 0)
          await client.query(
            `UPDATE tenancies
             SET tenant_score = GREATEST(0, COALESCE(tenant_score, 100) - 10)
             WHERE id = $1`,
            [v.tenancy_id]
          );

          // Ledger entry
          await client.query(
            `INSERT INTO system_ledger (transaction_type, payload, immutable_hash)
             VALUES ($1,$2,$3)`,
            [
              'AUTO_NOTICE_ISSUED',
              JSON.stringify({
                notice_number: noticeNumber, notice_type: noticeType,
                tenancy_id: v.tenancy_id, unit_id: v.unit_id,
                amount_overdue: amountOverdue, days_overdue: daysOverdue,
              }),
              h,
            ]
          );

          // Send overdue email
          const html = arkEmail(
            `${noticeNumber} — Formal Notice`,
            `<p style="color:#a1a1aa;font-size:13px;line-height:1.7;">
              Dear <strong style="color:white">${v.tenant_name}</strong>,<br><br>
              Your vault for <strong style="color:#14b8a6">${v.unit_name}</strong> at
              <strong style="color:white">${v.project_title}</strong> (${v.project_number})
              is <strong style="color:#ef4444">${daysOverdue} days overdue</strong>.<br><br>
              <strong style="color:#ef4444">Arrears: ${v.currency} ${amountOverdue.toLocaleString()}</strong><br>
              <strong style="color:#f97316">Respond by: ${deadlineStr}</strong><br><br>
              Failure to act will result in escalation to eviction proceedings.
            </p>`,
            { label: 'Resolve Now — Pay Immediately', url: `${process.env.FRONTEND_URL}/tenant/pay?tenancy_id=${v.tenancy_id}` }
          );

          await mailer.sendMail({
            from: `"Nested Ark OS — Legal" <${process.env.EMAIL_USER}>`,
            to: v.tenant_email,
            subject: `FORMAL NOTICE: ${noticeNumber} — Rental Arrears · ${v.project_number}`,
            html,
          });

          await client.query(
            `UPDATE legal_notices SET served_at = NOW(), status = 'SERVED'
             WHERE notice_number = $1`,
            [noticeNumber]
          );

          console.log(`[CRON:${runId}] AUTO-NOTICE issued → ${v.tenant_email} | ${noticeNumber} | ${daysOverdue}d overdue`);
        } catch (err: any) {
          console.error(`[CRON:${runId}] AUTO-NOTICE FAILED for tenancy ${v.tenancy_id}: ${err.message}`);
        }
      }

      // ── 3. Update next_due_date for fully funded vaults ────────────────────
      const fundedVaults = await client.query(`
        SELECT id, frequency, next_due_date
        FROM flex_pay_vaults
        WHERE vault_balance >= installment_amount
          AND status = 'ACTIVE'
          AND next_due_date < CURRENT_DATE
      `);

      for (const v of fundedVaults.rows) {
        const next = new Date(v.next_due_date);
        const freq: Record<string, number> = { WEEKLY: 7, MONTHLY: 30, QUARTERLY: 90 };
        const addDays = freq[v.frequency] || 30;
        next.setDate(next.getDate() + addDays);

        await client.query(
          `UPDATE flex_pay_vaults
           SET next_due_date = $1,
               vault_balance  = 0,
               status         = 'ACTIVE'
           WHERE id = $2`,
          [next.toISOString().split('T')[0], v.id]
        );
      }

      // ── 4. Auto-payout: for each rolled vault, trigger Paystack transfer ────
      let payoutsTriggered = 0;
      const PAYSTACK_SK = process.env.PAYSTACK_SECRET_KEY || '';
      if (PAYSTACK_SK) {
        for (const v of fundedVaults.rows) {
          try {
            // Get landlord bank account for this vault's project
            const projRes = await client.query(
              `SELECT p.sponsor_id, t.rent_amount, ru.currency
               FROM flex_pay_vaults fpv
               JOIN tenancies t ON fpv.tenancy_id = t.id
               JOIN rental_units ru ON fpv.unit_id = ru.id
               JOIN projects p ON ru.project_id = p.id
               WHERE fpv.id = $1`,
              [v.id]
            );
            if (!projRes.rows.length) continue;
            const { sponsor_id, rent_amount, currency } = projRes.rows[0];

            const bankRes = await client.query(
              `SELECT * FROM landlord_bank_accounts
               WHERE user_id=$1 AND is_default=true
                 AND paystack_recipient_code IS NOT NULL LIMIT 1`,
              [sponsor_id]
            );
            if (!bankRes.rows.length) continue;
            const acct = bankRes.rows[0];

            const platformFee = Math.round(parseFloat(rent_amount) * 0.02 * 100) / 100;
            const netKobo     = Math.round((parseFloat(rent_amount) - platformFee) * 100);
            const payRef      = `CRON-PAYOUT-${crypto.randomUUID().split('-')[0].toUpperCase()}-${Date.now()}`;

            const tRes = await fetch('https://api.paystack.co/transfer', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${PAYSTACK_SK}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                source:    'balance',
                amount:    netKobo,
                recipient: acct.paystack_recipient_code,
                reason:    `Nested Ark monthly rent payout`,
                reference: payRef,
                currency:  currency || 'NGN',
              }),
            });
            const tData = await (tRes as any).json() as any;

            const ph = crypto.createHash('sha256')
              .update(`cron-payout-${payRef}-${sponsor_id}-${netKobo}-${Date.now()}`)
              .digest('hex');

            await client.query(
              `INSERT INTO system_ledger (transaction_type, payload, immutable_hash)
               VALUES ('LANDLORD_PAYOUT', $1, $2)`,
              [JSON.stringify({
                reference: payRef, amount_ngn: netKobo / 100,
                platform_fee: platformFee, user_id: sponsor_id,
                bank_account_id: acct.id,
                transfer_code: tData.data?.transfer_code,
                transfer_status: tData.status ? 'INITIATED' : 'FAILED',
                vault_id: v.id,
              }), ph]
            );

            payoutsTriggered++;
            console.log(`[CRON:${runId}] AUTO-PAYOUT → ${acct.account_name} | ${acct.bank_name} | ₦${netKobo/100} | ref=${payRef} | status=${tData.data?.status || 'pending'}`);
          } catch (payErr: any) {
            console.warn(`[CRON:${runId}] PAYOUT FAILED vault=${v.id}: ${payErr.message}`);
          }
        }
      }

      console.log(`[CRON:${runId}] Cycle complete — due:${dueVaults.rows.length} overdue:${overdueVaults.rows.length} rolled:${fundedVaults.rows.length} payouts:${payoutsTriggered}`);
    } catch (err: any) {
      console.error(`[CRON:${runId}] Fatal cycle error: ${err.message}`);
    } finally {
      client.release();
    }
  });

  console.log(`[CRON] Rent reminder scheduler active — ${schedule} (UTC)`);
}
