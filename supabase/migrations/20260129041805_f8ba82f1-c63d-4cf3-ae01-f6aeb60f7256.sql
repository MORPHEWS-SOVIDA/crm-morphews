-- Add base_amount_cents and interest_amount_cents columns to payment_link_transactions
-- These track the original amount vs interest amount for proper split calculation

ALTER TABLE public.payment_link_transactions 
  ADD COLUMN IF NOT EXISTS base_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS interest_amount_cents INTEGER DEFAULT 0;

-- Update existing rows to set base_amount_cents = amount_cents (no interest) and interest = 0
UPDATE public.payment_link_transactions 
SET base_amount_cents = amount_cents,
    interest_amount_cents = 0
WHERE base_amount_cents IS NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN public.payment_link_transactions.base_amount_cents IS 'Original amount before interest (for commission calculation)';
COMMENT ON COLUMN public.payment_link_transactions.interest_amount_cents IS 'Interest charged on installments (platform revenue)';