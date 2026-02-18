
-- Add timestamps to track when the seller started and finished the receptive attendance
ALTER TABLE public.receptive_attendances
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Comment for clarity
COMMENT ON COLUMN public.receptive_attendances.started_at IS 'When the seller searched the phone number (start of attendance)';
COMMENT ON COLUMN public.receptive_attendances.completed_at IS 'When the seller finished the attendance (sale, no-purchase, followup, etc)';
