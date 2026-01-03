-- Add field to track sales with missing payment proof (non-conforming)
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS missing_payment_proof boolean DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN public.sales.missing_payment_proof IS 'True when sale was delivered but required payment proof was not provided';