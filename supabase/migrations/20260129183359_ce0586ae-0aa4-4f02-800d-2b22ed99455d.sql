-- Add column to store real shipping cost when seller offers free shipping
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS shipping_cost_real_cents integer DEFAULT 0;

-- Add comment explaining the field
COMMENT ON COLUMN public.sales.shipping_cost_real_cents IS 'Real shipping cost in cents when free shipping is offered to client. shipping_cost_cents will be 0 but this stores the actual cost for internal tracking.';