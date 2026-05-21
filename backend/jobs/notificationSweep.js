import { query } from '../config/database.js';
import {
  dispatchInvoiceDueReminders,
  dispatchUpcomingClassReminders,
} from '../services/notificationDispatchService.js';

/**
 * Runs notification reminders safely in multi-instance deployments.
 * - ENABLE_NOTIFICATION_SWEEP=true to enable (default: enabled)
 * - Uses Postgres advisory lock so only one instance runs the sweep at a time.
 * - In-process lock prevents overlapping runs when a sweep exceeds the interval.
 */

const parseBool = (v, fallback) => {
  if (v == null || String(v).trim() === '') return fallback;
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return fallback;
};

const ENABLED = parseBool(process.env.ENABLE_NOTIFICATION_SWEEP, true);
/** Default 5 minutes — was 60s and caused excess DB load behind Nginx. */
const INTERVAL_MS = Number(process.env.NOTIFICATION_SWEEP_INTERVAL_MS || 300_000);
const LOCK_KEY = Number(process.env.NOTIFICATION_SWEEP_LOCK_KEY || 81010203);

let sweepInProgress = false;

const tryAcquireLock = async () => {
  const r = await query('SELECT pg_try_advisory_lock($1) AS locked', [LOCK_KEY]);
  return Boolean(r.rows?.[0]?.locked);
};

const releaseLock = async () => {
  await query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
};

export const runNotificationSweepOnce = async () => {
  if (sweepInProgress) {
    return { ran: false, reason: 'sweep_already_in_progress' };
  }

  const gotLock = await tryAcquireLock();
  if (!gotLock) return { ran: false, reason: 'lock_not_acquired' };

  sweepInProgress = true;
  try {
    await dispatchUpcomingClassReminders();
    await dispatchInvoiceDueReminders();
    return { ran: true };
  } finally {
    sweepInProgress = false;
    try {
      await releaseLock();
    } catch {
      // no-op
    }
  }
};

export const startNotificationSweep = async () => {
  if (!ENABLED) {
    console.log('ℹ️ Notification sweep disabled (ENABLE_NOTIFICATION_SWEEP=false)');
    return;
  }

  const intervalMs = Math.max(60_000, INTERVAL_MS);
  console.log(`ℹ️ Notification sweep enabled (every ${Math.round(intervalMs / 1000)}s)`);

  const runSafe = async () => {
    try {
      await runNotificationSweepOnce();
    } catch (error) {
      console.error('Notification sweep failed:', error?.message || error);
    }
  };

  await runSafe();
  setInterval(runSafe, intervalMs);
};
