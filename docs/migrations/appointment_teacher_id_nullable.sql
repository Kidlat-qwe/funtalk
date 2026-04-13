-- Allow school-created bookings without a teacher until superadmin assigns one.
-- Safe to run once; idempotent intent (will error if already nullable — ignore or use DO block).

ALTER TABLE appointmenttbl
  ALTER COLUMN teacher_id DROP NOT NULL;
