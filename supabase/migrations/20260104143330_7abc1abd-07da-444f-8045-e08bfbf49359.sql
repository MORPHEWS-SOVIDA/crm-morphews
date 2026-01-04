-- Add restriction flag to products
ALTER TABLE public.lead_products 
ADD COLUMN IF NOT EXISTS restrict_to_users boolean NOT NULL DEFAULT false;

-- Create junction table for product-user visibility
CREATE TABLE public.product_user_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, user_id)
);

-- Enable RLS
ALTER TABLE public.product_user_visibility ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view product visibility for their org"
ON public.product_user_visibility
FOR SELECT
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can manage product visibility"
ON public.product_user_visibility
FOR ALL
USING (public.is_org_admin(auth.uid(), organization_id))
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

-- Index for performance
CREATE INDEX idx_product_user_visibility_product ON public.product_user_visibility(product_id);
CREATE INDEX idx_product_user_visibility_user ON public.product_user_visibility(user_id);
CREATE INDEX idx_product_user_visibility_org ON public.product_user_visibility(organization_id);