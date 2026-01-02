-- Create table for discount authorization logs
CREATE TABLE public.discount_authorizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  sale_item_id UUID REFERENCES public.sale_items(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  seller_user_id UUID NOT NULL,
  authorizer_user_id UUID NOT NULL,
  minimum_price_cents INTEGER NOT NULL,
  authorized_price_cents INTEGER NOT NULL,
  discount_amount_cents INTEGER NOT NULL,
  authorization_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.discount_authorizations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view authorizations from their organization"
ON public.discount_authorizations
FOR SELECT
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can insert authorizations for their organization"
ON public.discount_authorizations
FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

-- Index for faster queries
CREATE INDEX idx_discount_authorizations_org_id ON public.discount_authorizations(organization_id);
CREATE INDEX idx_discount_authorizations_sale_id ON public.discount_authorizations(sale_id);
CREATE INDEX idx_discount_authorizations_authorizer ON public.discount_authorizations(authorizer_user_id);