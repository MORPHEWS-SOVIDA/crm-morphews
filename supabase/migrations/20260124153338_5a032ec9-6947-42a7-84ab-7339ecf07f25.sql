-- Add missing columns to ecommerce_carts for progressive capture
ALTER TABLE public.ecommerce_carts
ADD COLUMN IF NOT EXISTS items JSONB,
ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES landing_offers(id),
ADD COLUMN IF NOT EXISTS customer_cpf TEXT,
ADD COLUMN IF NOT EXISTS shipping_cep TEXT,
ADD COLUMN IF NOT EXISTS shipping_address TEXT,
ADD COLUMN IF NOT EXISTS shipping_city TEXT,
ADD COLUMN IF NOT EXISTS shipping_state TEXT,
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS utm_term TEXT,
ADD COLUMN IF NOT EXISTS utm_content TEXT,
ADD COLUMN IF NOT EXISTS src TEXT,
ADD COLUMN IF NOT EXISTS fbclid TEXT,
ADD COLUMN IF NOT EXISTS gclid TEXT;

-- Index for abandoned cart recovery queries with customer data
CREATE INDEX IF NOT EXISTS idx_ecommerce_carts_customer_data 
ON public.ecommerce_carts(organization_id, status, customer_email, customer_phone) 
WHERE status = 'active';