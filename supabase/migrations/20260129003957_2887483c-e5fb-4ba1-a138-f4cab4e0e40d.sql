-- Create table for pending implementer checkouts (PIX/Boleto waiting for payment confirmation)
CREATE TABLE IF NOT EXISTS public.implementer_pending_checkouts (
  id TEXT PRIMARY KEY, -- Pagar.me order_id
  checkout_link_id UUID NOT NULL REFERENCES implementer_checkout_links(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_whatsapp TEXT,
  customer_document TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'boleto')),
  total_amount_cents BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.implementer_pending_checkouts ENABLE ROW LEVEL SECURITY;

-- Service role can access (for webhook processing)
CREATE POLICY "Service role can manage pending checkouts"
ON public.implementer_pending_checkouts
FOR ALL
USING (true)
WITH CHECK (true);

-- Index for quick lookups
CREATE INDEX idx_implementer_pending_checkouts_status 
ON public.implementer_pending_checkouts(status) 
WHERE status = 'pending';