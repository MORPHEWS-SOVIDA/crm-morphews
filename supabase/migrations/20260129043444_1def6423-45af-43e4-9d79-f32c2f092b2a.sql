-- Add address fields to payment_links table for client-specific links
ALTER TABLE public.payment_links 
ADD COLUMN IF NOT EXISTS customer_cep text,
ADD COLUMN IF NOT EXISTS customer_street text,
ADD COLUMN IF NOT EXISTS customer_street_number text,
ADD COLUMN IF NOT EXISTS customer_neighborhood text,
ADD COLUMN IF NOT EXISTS customer_city text,
ADD COLUMN IF NOT EXISTS customer_state text,
ADD COLUMN IF NOT EXISTS customer_complement text;