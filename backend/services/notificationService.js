import { query } from '../config/database.js';

export const ensureNotificationSchema = async () => {
  await query(
    `CREATE TABLE IF NOT EXISTS notificationtbl (
      notification_id SERIAL PRIMARY KEY,
      user_id INT NULL REFERENCES userstbl(user_id) ON DELETE CASCADE,
      target_role VARCHAR(32) NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      href TEXT NOT NULL,
      severity VARCHAR(16) NOT NULL DEFAULT 'info',
      entity_type VARCHAR(64) NULL,
      entity_id INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at TIMESTAMP NULL
    )`
  );

  await query(`CREATE INDEX IF NOT EXISTS idx_notification_user_id ON notificationtbl(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notification_target_role ON notificationtbl(target_role)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notification_read_at ON notificationtbl(read_at)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notification_created_at ON notificationtbl(created_at DESC)`);
};

export const createNotification = async ({
  userId = null,
  targetRole = null,
  title,
  message,
  href,
  severity = 'info',
  entityType = null,
  entityId = null,
}) => {
  const res = await query(
    `INSERT INTO notificationtbl (
      user_id, target_role, title, message, href, severity, entity_type, entity_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING notification_id, user_id, target_role, title, message, href, severity, entity_type, entity_id, created_at, read_at`,
    [userId, targetRole, title, message, href, severity, entityType, entityId]
  );
  return res.rows[0];
};

export const listNotificationsForUser = async ({ userId, userType, limit = 20, unreadOnly = false }) => {
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const params = [Number(userId), String(userType || ''), lim];
  let idx = 4;
  let where = `
    (n.user_id = $1 OR (n.user_id IS NULL AND n.target_role = $2))
  `;
  if (unreadOnly) {
    where += ` AND n.read_at IS NULL`;
  }

  const res = await query(
    `SELECT
      n.notification_id,
      n.user_id,
      n.target_role,
      n.title,
      n.message,
      n.href,
      n.severity,
      n.entity_type,
      n.entity_id,
      n.created_at,
      n.read_at
     FROM notificationtbl n
     WHERE ${where}
     ORDER BY n.created_at DESC, n.notification_id DESC
     LIMIT $3`,
    params.slice(0, idx - 1)
  );

  return res.rows;
};

export const getUnreadCountForUser = async ({ userId, userType }) => {
  const res = await query(
    `SELECT COUNT(*)::int AS c
     FROM notificationtbl n
     WHERE (n.user_id = $1 OR (n.user_id IS NULL AND n.target_role = $2))
       AND n.read_at IS NULL`,
    [Number(userId), String(userType || '')]
  );
  return Number(res.rows[0]?.c || 0);
};

export const markNotificationRead = async ({ notificationId, userId, userType }) => {
  const res = await query(
    `UPDATE notificationtbl
     SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
     WHERE notification_id = $1
       AND (user_id = $2 OR (user_id IS NULL AND target_role = $3))
     RETURNING notification_id, read_at`,
    [Number(notificationId), Number(userId), String(userType || '')]
  );
  return res.rows[0] || null;
};

export const markAllNotificationsRead = async ({ userId, userType }) => {
  const res = await query(
    `UPDATE notificationtbl
     SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
     WHERE (user_id = $1 OR (user_id IS NULL AND target_role = $2))
       AND read_at IS NULL`,
    [Number(userId), String(userType || '')]
  );
  return { updated: res.rowCount || 0 };
};

