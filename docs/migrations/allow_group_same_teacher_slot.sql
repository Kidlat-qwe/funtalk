-- Allow multiple group appointments to share the same teacher/time slot.
-- The API now enforces business rules:
-- - group at same time must reuse the same teacher
-- - one_on_one / vip remain exclusive per teacher/time
--
-- If your DB still has a unique constraint on (teacher_id, appointment_date, appointment_time),
-- this migration removes it so group sharing can work.

BEGIN;

ALTER TABLE IF EXISTS public.appointmenttbl
  DROP CONSTRAINT IF EXISTS unique_teacher_time_slot;

ALTER TABLE IF EXISTS public.appointmenttbl
  DROP CONSTRAINT IF EXISTS appointmenttbl_teacher_id_appointment_date_appointment_time_key;

COMMIT;
