import { getClient, query } from '../config/database.js';
import { createNotification, ensureNotificationSchema } from './notificationService.js';

const PATTY_BILLING_TYPE = 'patty';

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseIsoDateAsLocalNoon = (value) => {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0);
  }
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]) - 1;
      const day = Number(m[3]);
      return new Date(year, month, day, 12, 0, 0, 0);
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return parsed;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0, 0);
};

const toIsoDate = (value) => {
  const d = parseIsoDateAsLocalNoon(value);
  if (Number.isNaN(d.getTime())) {
    return formatLocalDate(new Date());
  }
  return formatLocalDate(d);
};

const addMonthsKeepDay = (isoDate, months) => {
  const source = parseIsoDateAsLocalNoon(isoDate);
  const target = new Date(source);
  target.setMonth(target.getMonth() + months);
  if (target.getDate() !== source.getDate()) {
    target.setDate(0);
  }
  return toIsoDate(target);
};

const computeCycleEnd = (cycleStart) => {
  const nextStart = addMonthsKeepDay(cycleStart, 1);
  const end = parseIsoDateAsLocalNoon(nextStart);
  end.setDate(end.getDate() - 1);
  return toIsoDate(end);
};

/**
 * Patty installment: payment is due on `paymentDueDay` (1–28) in the calendar month
 * **immediately after** the month of `cycleStart`.
 * Example: start 2026-03-23, due day 5 → 2026-04-05.
 */
const computeDueDate = (cycleStart, paymentDueDay) => {
  const day = Math.max(1, Math.min(28, Number(paymentDueDay) || 1));
  const anchor = parseIsoDateAsLocalNoon(cycleStart);
  if (Number.isNaN(anchor.getTime())) {
    const fallback = new Date();
    const due = new Date(fallback.getFullYear(), fallback.getMonth() + 1, day);
    return toIsoDate(due);
  }
  const due = new Date(anchor.getFullYear(), anchor.getMonth() + 1, day);
  return toIsoDate(due);
};

export const ensureSubscriptionSchema = async () => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL search_path TO public, pg_catalog');

    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptionplantbl (
        plan_id SERIAL PRIMARY KEY,
        plan_name VARCHAR(255) NOT NULL,
        billing_type VARCHAR(50) NOT NULL DEFAULT 'patty',
        cycle_interval VARCHAR(20) NOT NULL DEFAULT 'monthly',
        credits_per_cycle INTEGER NOT NULL CHECK (credits_per_cycle > 0),
        credit_rate NUMERIC(10,2) NOT NULL CHECK (credit_rate >= 0),
        base_amount NUMERIC(10,2) NOT NULL CHECK (base_amount >= 0),
        rollover_enabled BOOLEAN NOT NULL DEFAULT true,
        max_rollover_credits INTEGER NOT NULL DEFAULT 0 CHECK (max_rollover_credits >= 0),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptionscheduletbl (
        subscription_id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES userstbl(user_id) ON DELETE CASCADE,
        plan_id INTEGER REFERENCES subscriptionplantbl(plan_id) ON DELETE SET NULL,
        billing_type VARCHAR(50) NOT NULL DEFAULT 'patty',
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        start_date DATE NOT NULL,
        current_cycle_start DATE NOT NULL,
        current_cycle_end DATE NOT NULL,
        next_due_date DATE NOT NULL,
        payment_due_day INTEGER NOT NULL DEFAULT 1 CHECK (payment_due_day BETWEEN 1 AND 28),
        grace_days INTEGER NOT NULL DEFAULT 0 CHECK (grace_days >= 0),
        auto_renew BOOLEAN NOT NULL DEFAULT true,
        rollover_enabled BOOLEAN NOT NULL DEFAULT true,
        max_rollover_credits INTEGER NOT NULL DEFAULT 0 CHECK (max_rollover_credits >= 0),
        last_cycle_processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      ALTER TABLE invoicetbl
      ADD COLUMN IF NOT EXISTS subscription_id INTEGER REFERENCES subscriptionscheduletbl(subscription_id) ON DELETE SET NULL
    `);
    await client.query(`ALTER TABLE invoicetbl ADD COLUMN IF NOT EXISTS cycle_start DATE`);
    await client.query(`ALTER TABLE invoicetbl ADD COLUMN IF NOT EXISTS cycle_end DATE`);
    await client.query(`ALTER TABLE invoicetbl ADD COLUMN IF NOT EXISTS overdue_since DATE`);
    await client.query(`ALTER TABLE invoicetbl ADD COLUMN IF NOT EXISTS receipt_url TEXT`);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_invoicetbl_subscription_cycle
      ON invoicetbl (subscription_id, cycle_start)
      WHERE subscription_id IS NOT NULL AND cycle_start IS NOT NULL
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_credittx_subscription_cycle
      ON credittransactionstbl (user_id, transaction_type, description)
      WHERE transaction_type = 'purchase'
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const getOrCreatePlan = async (client, {
  planName,
  creditsPerCycle,
  creditRate,
  rolloverEnabled,
  maxRolloverCredits,
}) => {
  const amount = Number((Number(creditsPerCycle) * Number(creditRate)).toFixed(2));
  const found = await client.query(
    `SELECT plan_id FROM subscriptionplantbl
     WHERE plan_name = $1
       AND credits_per_cycle = $2
       AND credit_rate = $3
       AND rollover_enabled = $4
       AND max_rollover_credits = $5
     LIMIT 1`,
    [planName, creditsPerCycle, creditRate, rolloverEnabled, maxRolloverCredits]
  );
  if (found.rows.length > 0) return found.rows[0].plan_id;

  const created = await client.query(
    `INSERT INTO subscriptionplantbl (
      plan_name, billing_type, cycle_interval, credits_per_cycle, credit_rate, base_amount,
      rollover_enabled, max_rollover_credits, is_active
    ) VALUES ($1, $2, 'monthly', $3, $4, $5, $6, $7, true)
    RETURNING plan_id`,
    [planName, PATTY_BILLING_TYPE, creditsPerCycle, creditRate, amount, rolloverEnabled, maxRolloverCredits]
  );
  return created.rows[0].plan_id;
};

export const upsertPattySubscription = async ({
  userId,
  planName,
  creditsPerCycle,
  creditRate,
  paymentDueDay,
  graceDays,
  rolloverEnabled = true,
  maxRolloverCredits = 0,
  autoRenew = true,
  startDate,
}) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const effectiveStart = startDate || toIsoDate(new Date());
    const cycleStart = effectiveStart;
    const cycleEnd = computeCycleEnd(cycleStart);
    const dueDate = computeDueDate(cycleStart, paymentDueDay);
    const finalPlanName = planName || `Patty Plan User ${userId}`;

    const planId = await getOrCreatePlan(client, {
      planName: finalPlanName,
      creditsPerCycle,
      creditRate,
      rolloverEnabled,
      maxRolloverCredits,
    });

    const existing = await client.query(
      'SELECT subscription_id FROM subscriptionscheduletbl WHERE user_id = $1',
      [userId]
    );

    let subscriptionId;
    if (existing.rows.length > 0) {
      const updated = await client.query(
        `UPDATE subscriptionscheduletbl
         SET plan_id = $1,
             billing_type = $2,
             status = 'active',
             payment_due_day = $3,
             grace_days = $4,
             rollover_enabled = $5,
             max_rollover_credits = $6,
             auto_renew = $7,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $8
         RETURNING subscription_id`,
        [planId, PATTY_BILLING_TYPE, paymentDueDay, graceDays, rolloverEnabled, maxRolloverCredits, autoRenew, userId]
      );
      subscriptionId = updated.rows[0].subscription_id;
    } else {
      const inserted = await client.query(
        `INSERT INTO subscriptionscheduletbl (
          user_id, plan_id, billing_type, status, start_date,
          current_cycle_start, current_cycle_end, next_due_date,
          payment_due_day, grace_days, auto_renew, rollover_enabled, max_rollover_credits
        ) VALUES ($1,$2,$3,'active',$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING subscription_id`,
        [
          userId,
          planId,
          PATTY_BILLING_TYPE,
          effectiveStart,
          cycleStart,
          cycleEnd,
          dueDate,
          paymentDueDay,
          graceDays,
          autoRenew,
          rolloverEnabled,
          maxRolloverCredits,
        ]
      );
      subscriptionId = inserted.rows[0].subscription_id;
    }

    await client.query('COMMIT');
    return { subscriptionId, planId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const applyCreditTransaction = async ({
  client,
  userId,
  amount,
  transactionType,
  description,
  createdBy,
}) => {
  const creditRow = await client.query(
    'SELECT current_balance FROM creditstbl WHERE user_id = $1 FOR UPDATE',
    [userId]
  );
  if (creditRow.rows.length === 0) {
    await client.query(
      'INSERT INTO creditstbl (user_id, current_balance) VALUES ($1, 0)',
      [userId]
    );
  }

  const currentResult = await client.query(
    'SELECT current_balance FROM creditstbl WHERE user_id = $1 FOR UPDATE',
    [userId]
  );
  const before = Number(currentResult.rows[0]?.current_balance || 0);
  const after = before + Number(amount);

  await client.query(
    'UPDATE creditstbl SET current_balance = $1, last_updated = CURRENT_TIMESTAMP WHERE user_id = $2',
    [after, userId]
  );

  const tx = await client.query(
    `INSERT INTO credittransactionstbl (
      user_id, transaction_type, amount, balance_before, balance_after, description, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING transaction_id`,
    [userId, transactionType, Math.abs(Number(amount)), before, after, description || null, createdBy || null]
  );
  return { transactionId: tx.rows[0].transaction_id, before, after };
};

export const runCycleForSubscription = async (subscriptionId, actorUserId = null, opts = {}) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const subResult = await client.query(
      `SELECT s.*, p.credits_per_cycle, p.credit_rate, p.base_amount
       FROM subscriptionscheduletbl s
       LEFT JOIN subscriptionplantbl p ON p.plan_id = s.plan_id
       WHERE s.subscription_id = $1
       FOR UPDATE OF s`,
      [subscriptionId]
    );
    if (subResult.rows.length === 0) {
      throw new Error('Subscription not found');
    }
    const sub = subResult.rows[0];
    if (sub.status !== 'active') {
      await client.query('COMMIT');
      return { skipped: true, reason: 'inactive_subscription' };
    }

    let cycleStart = sub.current_cycle_start;
    let cycleEnd = sub.current_cycle_end;

    // If the current cycle already has an invoice (common after signup), allow manual "Generate"
    // to advance to the next cycle and generate that invoice immediately.
    const invoiceCheck = await client.query(
      'SELECT invoice_id FROM invoicetbl WHERE subscription_id = $1 AND cycle_start = $2',
      [subscriptionId, cycleStart]
    );
    if (invoiceCheck.rows.length > 0) {
      if (opts?.advanceToNextCycleIfAlreadyInvoiced) {
        // Keep advancing until we find a cycle_start without an invoice, then generate for that cycle.
        // This prevents manual Generate from being blocked by existing invoices (e.g., signup invoice).
        const maxAdvance = 24;
        let found = false;
        let candidateStart = cycleStart;
        for (let i = 0; i < maxAdvance; i++) {
          candidateStart = addMonthsKeepDay(candidateStart, 1);
          const exists = await client.query(
            'SELECT invoice_id FROM invoicetbl WHERE subscription_id = $1 AND cycle_start = $2 LIMIT 1',
            [subscriptionId, candidateStart]
          );
          if (exists.rows.length === 0) {
            const candidateEnd = computeCycleEnd(candidateStart);
            const candidateDue = computeDueDate(candidateStart, sub.payment_due_day);
            await client.query(
              `UPDATE subscriptionscheduletbl
               SET current_cycle_start = $1,
                   current_cycle_end = $2,
                   next_due_date = $3,
                   updated_at = CURRENT_TIMESTAMP
               WHERE subscription_id = $4`,
              [candidateStart, candidateEnd, candidateDue, subscriptionId]
            );
            cycleStart = candidateStart;
            cycleEnd = candidateEnd;
            found = true;
            break;
          }
        }
        if (!found) {
          await client.query('COMMIT');
          return { skipped: true, reason: 'already_processed' };
        }
      } else {
        /** Auto runner behavior: only advance after period end. */
        const todayStr = toIsoDate(new Date());
        if (cycleEnd && String(cycleEnd) < todayStr) {
          const nextCycleStart = addMonthsKeepDay(cycleStart, 1);
          const nextCycleEnd = computeCycleEnd(nextCycleStart);
          const nextDueDate = computeDueDate(nextCycleStart, sub.payment_due_day);
          await client.query(
            `UPDATE subscriptionscheduletbl
             SET current_cycle_start = $1,
                 current_cycle_end = $2,
                 next_due_date = $3,
                 last_cycle_processed_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE subscription_id = $4`,
            [nextCycleStart, nextCycleEnd, nextDueDate, subscriptionId]
          );
          await client.query('COMMIT');
          return {
            skipped: true,
            reason: 'advanced_after_existing_invoice',
            subscriptionId,
            nextCycleStart,
          };
        }
        await client.query('COMMIT');
        return { skipped: true, reason: 'already_processed' };
      }
    }

    const creditInfo = await client.query(
      'SELECT current_balance FROM creditstbl WHERE user_id = $1 FOR UPDATE',
      [sub.user_id]
    );
    const existingBalance = Number(creditInfo.rows[0]?.current_balance || 0);
    const carryIn = sub.rollover_enabled
      ? Math.min(existingBalance, Number(sub.max_rollover_credits || 0))
      : 0;
    const allocation = Number(sub.credits_per_cycle || 0);
    const newBalance = carryIn + allocation;

    // Use computed due date for the chosen cycle (avoid stale next_due_date after manual advancement)
    const dueDate = computeDueDate(cycleStart, sub.payment_due_day);
    const baseAmount = Number(sub.base_amount || 0);
    const billingRow = await client.query(
      `INSERT INTO billingtbl (user_id, package_id, billing_type, amount, status)
       VALUES ($1, NULL, $2, $3, 'pending')
       RETURNING billing_id`,
      [sub.user_id, PATTY_BILLING_TYPE, baseAmount]
    );
    const billingId = billingRow.rows[0].billing_id;
    const invoiceInsert = await client.query(
      `INSERT INTO invoicetbl (
        billing_id, user_id, invoice_number, description, due_date, amount, status,
        subscription_id, cycle_start, cycle_end
      ) VALUES (
        $1, $2, NULL, $3, $4, $5, 'pending', $6, $7, $8
      ) RETURNING invoice_id`,
      [
        billingId,
        sub.user_id,
        `Patty monthly billing for cycle ${cycleStart} to ${cycleEnd}`,
        dueDate,
        baseAmount,
        subscriptionId,
        cycleStart,
        cycleEnd,
      ]
    );
    const invoiceId = invoiceInsert.rows[0].invoice_id;
    await client.query(
      'UPDATE invoicetbl SET invoice_number = $1 WHERE invoice_id = $2',
      [`INV-${invoiceId}`, invoiceId]
    );

    // Notifications (minimal): inform superadmins + the school when an invoice is generated.
    // Keep it simple and link to the relevant page.
    try {
      await ensureNotificationSchema();
      const invNumber = `INV-${invoiceId}`;
      await createNotification({
        targetRole: 'superadmin',
        title: 'Invoice generated',
        message: `${invNumber} generated for school user_id=${sub.user_id} (due ${dueDate}).`,
        href: '/superadmin/invoices',
        severity: 'info',
        entityType: 'invoice',
        entityId: invoiceId,
      });
      await createNotification({
        userId: sub.user_id,
        title: 'New invoice generated',
        message: `${invNumber} has been generated. Due ${dueDate}.`,
        href: '/school/credits',
        severity: 'info',
        entityType: 'invoice',
        entityId: invoiceId,
      });
    } catch (e) {
      // Do not block invoice generation if notifications fail.
      console.error('Notification create failed:', e);
    }

    if (creditInfo.rows.length === 0) {
      await client.query(
        'INSERT INTO creditstbl (user_id, current_balance, last_updated) VALUES ($1, $2, CURRENT_TIMESTAMP)',
        [sub.user_id, newBalance]
      );
    } else {
      await client.query(
        'UPDATE creditstbl SET current_balance = $1, last_updated = CURRENT_TIMESTAMP WHERE user_id = $2',
        [newBalance, sub.user_id]
      );
    }

    await client.query(
      `INSERT INTO credittransactionstbl (
        user_id, transaction_type, amount, balance_before, balance_after, description, created_by
      ) VALUES ($1, 'purchase', $2, $3, $4, $5, $6)`,
      [
        sub.user_id,
        allocation,
        existingBalance,
        newBalance,
        `monthly_allocation cycle=${cycleStart} carry_in=${carryIn}`,
        actorUserId,
      ]
    );

    const nextCycleStart = addMonthsKeepDay(cycleStart, 1);
    const nextCycleEnd = computeCycleEnd(nextCycleStart);
    const nextDueDate = computeDueDate(nextCycleStart, sub.payment_due_day);
    await client.query(
      `UPDATE subscriptionscheduletbl
       SET current_cycle_start = $1,
           current_cycle_end = $2,
           next_due_date = $3,
           last_cycle_processed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE subscription_id = $4`,
      [nextCycleStart, nextCycleEnd, nextDueDate, subscriptionId]
    );

    await client.query('COMMIT');
    return { skipped: false, subscriptionId, cycleStart, allocation, carryIn, newBalance };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const runDueCycles = async (actorUserId = null) => {
  const dueSubs = await query(
    `SELECT subscription_id
     FROM subscriptionscheduletbl
     WHERE status = 'active'
       AND current_cycle_end < CURRENT_DATE`
  );
  const results = [];
  for (const row of dueSubs.rows) {
    try {
      const res = await runCycleForSubscription(row.subscription_id, actorUserId);
      results.push(res);
    } catch (error) {
      results.push({ subscriptionId: row.subscription_id, error: error.message });
    }
  }
  return results;
};

export const listSubscriptionsWithStatus = async () => {
  const result = await query(
    `SELECT
      s.subscription_id,
      s.user_id,
      u.name AS user_name,
      u.email,
      u.billing_type,
      s.status,
      s.current_cycle_start,
      s.current_cycle_end,
      s.next_due_date,
      s.grace_days,
      s.payment_due_day,
      s.rollover_enabled,
      s.max_rollover_credits,
      p.plan_name,
      p.credits_per_cycle,
      p.credit_rate,
      p.base_amount,
      c.current_balance,
      CASE
        WHEN s.next_due_date < CURRENT_DATE THEN true
        ELSE false
      END AS is_overdue,
      GREATEST((CURRENT_DATE - s.next_due_date), 0) AS days_overdue
    FROM subscriptionscheduletbl s
    INNER JOIN userstbl u ON u.user_id = s.user_id
    LEFT JOIN subscriptionplantbl p ON p.plan_id = s.plan_id
    LEFT JOIN creditstbl c ON c.user_id = s.user_id
    ORDER BY s.next_due_date ASC`
  );
  return result.rows;
};

export const getSubscriptionStatusByUserId = async (userId) => {
  const result = await query(
    `SELECT
      s.subscription_id,
      s.user_id,
      s.status,
      s.current_cycle_start,
      s.current_cycle_end,
      s.next_due_date,
      s.grace_days,
      s.payment_due_day,
      p.plan_name,
      p.credits_per_cycle,
      p.credit_rate,
      p.base_amount,
      c.current_balance,
      CASE WHEN s.next_due_date < CURRENT_DATE THEN true ELSE false END AS is_overdue,
      GREATEST((CURRENT_DATE - s.next_due_date), 0) AS days_overdue
    FROM subscriptionscheduletbl s
    LEFT JOIN subscriptionplantbl p ON p.plan_id = s.plan_id
    LEFT JOIN creditstbl c ON c.user_id = s.user_id
    WHERE s.user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
};

/**
 * Patty = recurring monthly installments (not one upfront “full” payment).
 * Summarizes subscription-linked invoices: paid vs pending counts and amounts.
 */
export const getPattyInstallmentSummary = async (userId, subscriptionRow = null) => {
  const inv = await query(
    `SELECT
      COUNT(*)::int AS total_count,
      COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(status, ''))) = 'paid')::int AS paid_count,
      COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(status, ''))) = 'pending')::int AS pending_count,
      COUNT(*) FILTER (
        WHERE LOWER(TRIM(COALESCE(status, ''))) NOT IN ('paid', 'pending')
      )::int AS other_status_count,
      COALESCE(SUM(amount) FILTER (WHERE LOWER(TRIM(COALESCE(status, ''))) = 'paid'), 0)::numeric AS amount_paid,
      COALESCE(SUM(amount) FILTER (WHERE LOWER(TRIM(COALESCE(status, ''))) = 'pending'), 0)::numeric AS amount_pending
    FROM invoicetbl i
    LEFT JOIN billingtbl b ON b.billing_id = i.billing_id
    WHERE i.user_id = $1
      AND (
        i.subscription_id IS NOT NULL
        OR LOWER(TRIM(COALESCE(b.billing_type, ''))) = 'patty'
      )`,
    [userId]
  );
  const row = inv.rows[0] || {};
  const paid = Number(row.paid_count || 0);
  const pending = Number(row.pending_count || 0);
  const other = Number(row.other_status_count || 0);
  const recorded = paid + pending + other;
  const denom = paid + pending;
  const paymentProgressPercent =
    denom > 0 ? Math.round((100 * paid) / denom) : recorded === 0 ? null : paid > 0 ? 100 : 0;

  const monthlyAmount = subscriptionRow != null ? Number(subscriptionRow.base_amount ?? 0) : null;
  const creditsPer = subscriptionRow?.credits_per_cycle;
  const rate = subscriptionRow?.credit_rate;

  return {
    is_patty: true,
    is_installment_billing: true,
    billing_model_note:
      'Patty is billed in monthly installments. Each invoice is one period’s payment—not the full contract upfront.',
    monthly_payment_amount: monthlyAmount,
    monthly_payment_label:
      creditsPer != null && rate != null
        ? `${creditsPer} credits × ${Number(rate).toFixed(2)} per credit = ${monthlyAmount != null ? Number(monthlyAmount).toFixed(2) : '—'} per month`
        : null,
    installments_recorded: recorded,
    installments_paid: paid,
    installments_pending: pending,
    installments_other_status: other,
    amount_paid_to_date: Number(row.amount_paid || 0),
    amount_pending_total: Number(row.amount_pending || 0),
    payment_progress_percent: paymentProgressPercent,
  };
};

/**
 * All school accounts with patty billing (installment / monthly), with optional subscription & credits.
 * Includes schools that have patty on userstbl but no subscriptionschedule row yet.
 */
export const listPattySchoolUsersForInstallmentView = async () => {
  const result = await query(
    `SELECT
      u.user_id,
      u.name AS user_name,
      u.email,
      u.billing_type,
      u.status AS user_status,
      s.subscription_id,
      s.status AS subscription_status,
      s.start_date,
      s.current_cycle_start,
      s.current_cycle_end,
      s.next_due_date,
      s.grace_days,
      s.payment_due_day,
      s.auto_renew,
      p.plan_name,
      p.credits_per_cycle,
      p.credit_rate,
      p.base_amount,
      c.current_balance,
      last_inv.invoice_id AS last_invoice_id,
      CONCAT('INV-', last_inv.invoice_id::text) AS last_invoice_number,
      last_inv.status AS last_invoice_status,
      last_inv.amount AS last_invoice_amount,
      last_inv.due_date AS last_invoice_due_date,
      CASE
        WHEN s.subscription_id IS NOT NULL
          AND s.next_due_date IS NOT NULL
          AND s.next_due_date < CURRENT_DATE
        THEN true
        ELSE false
      END AS is_overdue,
      CASE
        WHEN s.next_due_date IS NULL THEN 0
        ELSE GREATEST((CURRENT_DATE - s.next_due_date), 0)
      END AS days_overdue
      ,
      /* Installment invoice counts (generated vs paid/pending) */
      patty_inv.patty_inv_total,
      patty_inv.patty_inv_paid,
      patty_inv.patty_inv_pending,
      patty_inv.patty_amount_paid,
      patty_inv.patty_amount_pending,
      patty_inv.patty_payment_progress_pct
    FROM userstbl u
    LEFT JOIN subscriptionscheduletbl s ON s.user_id = u.user_id
    LEFT JOIN subscriptionplantbl p ON p.plan_id = s.plan_id
    LEFT JOIN creditstbl c ON c.user_id = u.user_id
    LEFT JOIN LATERAL (
      SELECT i.invoice_id, i.invoice_number, i.status, i.amount, i.due_date
      FROM invoicetbl i
      WHERE i.user_id = u.user_id
      ORDER BY i.due_date DESC NULLS LAST, i.invoice_id DESC
      LIMIT 1
    ) last_inv ON true
    LEFT JOIN LATERAL (
      SELECT
        COUNT(DISTINCT i.invoice_id)::int AS patty_inv_total,
        COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(i.status, ''))) = 'paid')::int AS patty_inv_paid,
        COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(i.status, ''))) = 'pending')::int AS patty_inv_pending,
        COALESCE(SUM(i.amount) FILTER (WHERE LOWER(TRIM(COALESCE(i.status, ''))) = 'paid'), 0)::numeric AS patty_amount_paid,
        COALESCE(SUM(i.amount) FILTER (WHERE LOWER(TRIM(COALESCE(i.status, ''))) = 'pending'), 0)::numeric AS patty_amount_pending,
        CASE
          WHEN (
            COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(i.status, ''))) = 'paid')
            + COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(i.status, ''))) = 'pending')
          ) > 0 THEN ROUND(
            100.0 * COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(i.status, ''))) = 'paid')
            / NULLIF(
              COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(i.status, ''))) IN ('paid', 'pending')),
              0
            )
          )::int
          ELSE NULL
        END AS patty_payment_progress_pct
      FROM invoicetbl i
      WHERE i.user_id = u.user_id
        /* Installment view is already scoped to patty schools; count all invoices as generated installments. */
    ) patty_inv ON true
    WHERE u.user_type = 'school'
      AND LOWER(COALESCE(u.billing_type, '')) = $1
    ORDER BY u.name ASC NULLS LAST, u.email ASC`,
    [PATTY_BILLING_TYPE]
  );
  return result.rows;
};

export const backfillPattySubscriptions = async () => {
  const users = await query(
    `SELECT user_id, name
     FROM userstbl
     WHERE user_type = 'school' AND LOWER(COALESCE(billing_type, '')) = 'patty'`
  );
  const created = [];
  for (const u of users.rows) {
    const existing = await query(
      'SELECT subscription_id FROM subscriptionscheduletbl WHERE user_id = $1',
      [u.user_id]
    );
    if (existing.rows.length > 0) continue;
    const res = await upsertPattySubscription({
      userId: u.user_id,
      planName: `${u.name || 'School'} Patty Plan`,
      creditsPerCycle: 20,
      creditRate: 5,
      paymentDueDay: 1,
      graceDays: 7,
      rolloverEnabled: true,
      maxRolloverCredits: 100,
      autoRenew: true,
      startDate: toIsoDate(new Date()),
    });
    created.push(res.subscriptionId);
  }
  return { createdCount: created.length, subscriptionIds: created };
};

export const defaults = {
  PATTY_BILLING_TYPE,
};
