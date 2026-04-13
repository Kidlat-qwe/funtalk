-- Add billing_type column to userstbl
-- This allows users to have a default billing type when created

ALTER TABLE IF EXISTS public.userstbl
ADD COLUMN IF NOT EXISTS billing_type character varying(50) COLLATE pg_catalog."default";

-- Add comment to explain the column
COMMENT ON COLUMN public.userstbl.billing_type IS 'Default billing type for the user (e.g., monthly, yearly, one-time, etc.)';

-- Update existing users to have a default billing type if needed (optional)
-- UPDATE public.userstbl SET billing_type = 'monthly' WHERE billing_type IS NULL;

