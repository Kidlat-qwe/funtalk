-- Database Enhancement Migration Script
-- This script adds essential tables and constraints for the booking appointment system
-- Generated for Funtalk Platform
-- Date: 2024

BEGIN;

-- ============================================================================
-- 1. TEACHER AVAILABILITY TABLE
-- Stores teacher's recurring weekly schedule (e.g., Monday 9 AM - 12 PM)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.teacheravailabilitytbl
(
    availability_id serial NOT NULL,
    teacher_id integer NOT NULL,
    day_of_week integer NOT NULL, -- 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT teacheravailabilitytbl_pkey PRIMARY KEY (availability_id),
    CONSTRAINT teacheravailabilitytbl_day_check CHECK (day_of_week >= 0 AND day_of_week <= 6),
    CONSTRAINT teacheravailabilitytbl_time_check CHECK (end_time > start_time)
);

-- Foreign Key: Teacher Availability -> Teacher
ALTER TABLE IF EXISTS public.teacheravailabilitytbl
    ADD CONSTRAINT teacheravailabilitytbl_teacher_id_fkey FOREIGN KEY (teacher_id)
    REFERENCES public.teachertbl (teacher_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_teacheravailabilitytbl_teacher_id 
    ON public.teacheravailabilitytbl(teacher_id);

CREATE INDEX IF NOT EXISTS idx_teacheravailabilitytbl_day_active 
    ON public.teacheravailabilitytbl(day_of_week, is_active);


-- ============================================================================
-- 2. TEACHER AVAILABILITY EXCEPTIONS TABLE
-- Stores blocked dates/holidays when teacher is unavailable
-- (e.g., specific dates blocked for holidays)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.teacheravailabilityexceptionstbl
(
    exception_id serial NOT NULL,
    teacher_id integer NOT NULL,
    exception_date date NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    reason text COLLATE pg_catalog."default",
    is_blocked boolean DEFAULT true, -- true = blocked, false = available (override)
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT teacheravailabilityexceptionstbl_pkey PRIMARY KEY (exception_id)
);

-- Foreign Key: Availability Exceptions -> Teacher
ALTER TABLE IF EXISTS public.teacheravailabilityexceptionstbl
    ADD CONSTRAINT teacheravailabilityexceptionstbl_teacher_id_fkey FOREIGN KEY (teacher_id)
    REFERENCES public.teachertbl (teacher_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_teacheravailabilityexceptionstbl_teacher_date 
    ON public.teacheravailabilityexceptionstbl(teacher_id, exception_date);


-- ============================================================================
-- 3. CREDIT TRANSACTION LOG TABLE
-- Tracks all credit transactions (additions, deductions, adjustments)
-- Provides audit trail for credit balance changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.credittransactionstbl
(
    transaction_id serial NOT NULL,
    user_id integer NOT NULL, -- School user_id
    appointment_id integer, -- NULL if not related to appointment (e.g., purchase, refund)
    transaction_type character varying(50) COLLATE pg_catalog."default" NOT NULL, -- 'purchase', 'deduction', 'refund', 'adjustment', 'expired'
    amount integer NOT NULL, -- positive for credit, negative for debit
    balance_before integer NOT NULL,
    balance_after integer NOT NULL,
    description text COLLATE pg_catalog."default",
    created_by integer, -- Admin/Superadmin who made the transaction (if manual)
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT credittransactionstbl_pkey PRIMARY KEY (transaction_id)
);

-- Foreign Key: Credit Transactions -> User (School)
ALTER TABLE IF EXISTS public.credittransactionstbl
    ADD CONSTRAINT credittransactionstbl_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.userstbl (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

-- Foreign Key: Credit Transactions -> Appointment (optional)
ALTER TABLE IF EXISTS public.credittransactionstbl
    ADD CONSTRAINT credittransactionstbl_appointment_id_fkey FOREIGN KEY (appointment_id)
    REFERENCES public.appointmenttbl (appointment_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL; -- Keep transaction history even if appointment is deleted

-- Foreign Key: Credit Transactions -> Created By (Admin/Superadmin)
ALTER TABLE IF EXISTS public.credittransactionstbl
    ADD CONSTRAINT credittransactionstbl_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.userstbl (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_credittransactionstbl_user_id 
    ON public.credittransactionstbl(user_id);

CREATE INDEX IF NOT EXISTS idx_credittransactionstbl_appointment_id 
    ON public.credittransactionstbl(appointment_id);

CREATE INDEX IF NOT EXISTS idx_credittransactionstbl_created_at 
    ON public.credittransactionstbl(created_at);


-- ============================================================================
-- 4. STUDENT PROFILES TABLE (OPTIONAL)
-- Stores student roster managed by schools
-- Allows schools to reuse student information across multiple bookings
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.studentprofilestbl
(
    student_id serial NOT NULL,
    school_id integer NOT NULL, -- user_id of the school
    student_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    student_age integer,
    student_level character varying(50) COLLATE pg_catalog."default",
    student_email character varying(255) COLLATE pg_catalog."default",
    student_phone character varying(50) COLLATE pg_catalog."default",
    parent_name character varying(255) COLLATE pg_catalog."default",
    parent_contact character varying(255) COLLATE pg_catalog."default",
    notes text COLLATE pg_catalog."default",
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT studentprofilestbl_pkey PRIMARY KEY (student_id)
);

-- Foreign Key: Student Profiles -> School (User)
ALTER TABLE IF EXISTS public.studentprofilestbl
    ADD CONSTRAINT studentprofilestbl_school_id_fkey FOREIGN KEY (school_id)
    REFERENCES public.userstbl (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE; -- Delete students if school is deleted

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_studentprofilestbl_school_id 
    ON public.studentprofilestbl(school_id);

CREATE INDEX IF NOT EXISTS idx_studentprofilestbl_school_active 
    ON public.studentprofilestbl(school_id, is_active);


-- ============================================================================
-- 5. UNIQUE CONSTRAINT ON APPOINTMENTS
-- Prevents double-booking: Same teacher cannot be booked at same date/time
-- ============================================================================
-- Add unique constraint to prevent double-booking
ALTER TABLE IF EXISTS public.appointmenttbl
    ADD CONSTRAINT unique_teacher_time_slot 
    UNIQUE (teacher_id, appointment_date, appointment_time)
    DEFERRABLE INITIALLY DEFERRED; -- Allows checking at end of transaction


-- ============================================================================
-- 6. ADDITIONAL INDEXES FOR PERFORMANCE
-- ============================================================================
-- Index for appointment queries by teacher and date
CREATE INDEX IF NOT EXISTS idx_appointmenttbl_teacher_date 
    ON public.appointmenttbl(teacher_id, appointment_date);

-- Index for appointment queries by school and status
CREATE INDEX IF NOT EXISTS idx_appointmenttbl_user_status 
    ON public.appointmenttbl(user_id, status);

-- Index for appointment queries by date range
CREATE INDEX IF NOT EXISTS idx_appointmenttbl_date_status 
    ON public.appointmenttbl(appointment_date, status);


-- ============================================================================
-- 7. ADD FEEDBACK COLUMN TO APPOINTMENT HISTORY (Optional Enhancement)
-- Stores teacher feedback after class completion
-- ============================================================================
-- Check if column exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'appointmenthistorytbl' 
        AND column_name = 'teacher_feedback'
    ) THEN
        ALTER TABLE public.appointmenthistorytbl
        ADD COLUMN teacher_feedback text COLLATE pg_catalog."default";
    END IF;
END $$;


-- ============================================================================
-- 8. ADD STUDENT_ID TO APPOINTMENT TABLE (Optional - if using student profiles)
-- Links appointment to student profile if student roster is used
-- ============================================================================
-- Check if column exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'appointmenttbl' 
        AND column_name = 'student_id'
    ) THEN
        ALTER TABLE public.appointmenttbl
        ADD COLUMN student_id integer;
        
        -- Foreign Key: Appointment -> Student Profile (optional)
        ALTER TABLE public.appointmenttbl
        ADD CONSTRAINT appointmenttbl_student_id_fkey FOREIGN KEY (student_id)
        REFERENCES public.studentprofilestbl (student_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL; -- Keep appointment even if student profile is deleted
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- SUMMARY OF CHANGES:
-- ============================================================================
-- 1. teacheravailabilitytbl - Teacher recurring weekly schedule
-- 2. teacheravailabilityexceptionstbl - Teacher blocked dates/holidays
-- 3. credittransactionstbl - Complete audit trail for credit transactions
-- 4. studentprofilestbl - Student roster management (optional)
-- 5. Unique constraint on appointmenttbl - Prevents double-booking
-- 6. Performance indexes - Faster queries
-- 7. teacher_feedback column - Stores post-class feedback
-- 8. student_id column - Links appointments to student profiles (optional)
-- ============================================================================

