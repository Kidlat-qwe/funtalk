-- Appointment slot uniqueness by class type.
-- Goal:
-- 1) one_on_one + vip are exclusive per teacher/date/time
-- 2) group can share the same teacher/date/time
--
-- This replaces the old broad unique constraint that blocks group sharing.

BEGIN;

-- Drop old broad unique constraints/indexes if present.
ALTER TABLE IF EXISTS public.appointmenttbl
  DROP CONSTRAINT IF EXISTS unique_teacher_time_slot;

ALTER TABLE IF EXISTS public.appointmenttbl
  DROP CONSTRAINT IF EXISTS appointmenttbl_teacher_id_appointment_date_appointment_time_key;

DROP INDEX IF EXISTS public.idx_appointmenttbl_teacher_slot_non_group_unique;

-- Enforce exclusivity only for non-group classes that are still active.
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointmenttbl_teacher_slot_non_group_unique
  ON public.appointmenttbl (teacher_id, appointment_date, appointment_time)
  WHERE teacher_id IS NOT NULL
    AND class_type IN ('one_on_one', 'vip')
    AND status NOT IN ('cancelled', 'no_show');

COMMIT;
