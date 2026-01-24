-- Add reconciliation columns to sales table for gateway data
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS gateway_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS gateway_fee_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS gateway_net_cents INTEGER;

-- Add gateway split type to sale_splits
ALTER TABLE public.sale_splits 
DROP CONSTRAINT IF EXISTS sale_splits_split_type_check;

ALTER TABLE public.sale_splits 
ADD CONSTRAINT sale_splits_split_type_check 
CHECK (split_type IN ('tenant', 'affiliate', 'platform', 'gateway', 'coproducer', 'industry'));

-- Create index for reconciliation queries
CREATE INDEX IF NOT EXISTS idx_sales_gateway_transaction_id ON public.sales(gateway_transaction_id) WHERE gateway_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_attempts_gateway_transaction_id ON public.payment_attempts(gateway_transaction_id) WHERE gateway_transaction_id IS NOT NULL;

COMMENT ON COLUMN public.sales.gateway_transaction_id IS 'Transaction ID from payment gateway (Stripe payment_intent, Pagar.me transaction)';
COMMENT ON COLUMN public.sales.gateway_fee_cents IS 'Fee charged by payment gateway in cents';
COMMENT ON COLUMN public.sales.gateway_net_cents IS 'Net amount after gateway fees in cents';