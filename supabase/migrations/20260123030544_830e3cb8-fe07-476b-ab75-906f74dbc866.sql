-- Add recovery_sent_at column to ecommerce_carts if not exists
ALTER TABLE public.ecommerce_carts 
ADD COLUMN IF NOT EXISTS recovery_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Add index for abandoned cart queries
CREATE INDEX IF NOT EXISTS idx_ecommerce_carts_abandoned 
ON public.ecommerce_carts(status, updated_at) 
WHERE status = 'active' AND recovery_sent_at IS NULL;