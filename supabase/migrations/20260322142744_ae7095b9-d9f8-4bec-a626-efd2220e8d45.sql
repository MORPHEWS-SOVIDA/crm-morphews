-- 1. Checkout events log table
CREATE TABLE IF NOT EXISTS public.checkout_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cart_id uuid REFERENCES public.ecommerce_carts(id) ON DELETE SET NULL,
  session_id text,
  event_type text NOT NULL, -- cart_loaded, form_filled, checkout_started, payment_started, payment_success, payment_failed, payment_error, abandoned
  event_data jsonb DEFAULT '{}',
  customer_name text,
  customer_email text,
  customer_phone text,
  source_url text, -- full URL that brought the customer
  source_type text, -- storefront, standalone_checkout, landing_page
  source_id text, -- storefront_id, checkout_id, or landing_page_id
  ip_address text,
  user_agent text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_checkout_events_org_created ON public.checkout_events(organization_id, created_at DESC);
CREATE INDEX idx_checkout_events_cart ON public.checkout_events(cart_id);
CREATE INDEX idx_checkout_events_session ON public.checkout_events(session_id);
CREATE INDEX idx_checkout_events_type ON public.checkout_events(event_type);

-- RLS
ALTER TABLE public.checkout_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view checkout events"
ON public.checkout_events FOR SELECT TO authenticated
USING (organization_id IN (
  SELECT organization_id FROM profiles WHERE user_id = auth.uid()
));

-- Allow anon inserts (from public checkout pages)
CREATE POLICY "Anyone can insert checkout events"
ON public.checkout_events FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- 2. Add source_url and extra tracking to ecommerce_carts
ALTER TABLE public.ecommerce_carts
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS device_info jsonb,
  ADD COLUMN IF NOT EXISTS checkout_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS events_count integer DEFAULT 0;

-- Enable realtime for checkout_events for live monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.checkout_events;