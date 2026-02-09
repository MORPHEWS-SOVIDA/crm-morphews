
-- 1. Fix integration_logs check constraint to accept 'rate_limited', 'rejected', 'skipped' etc.
ALTER TABLE public.integration_logs DROP CONSTRAINT IF EXISTS integration_logs_status_check;
-- No constraint = any status allowed. This prevents cascading errors.

-- 2. Add consecutive_failures and is_paused columns to integrations
ALTER TABLE public.integrations 
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paused_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS pause_reason text;
