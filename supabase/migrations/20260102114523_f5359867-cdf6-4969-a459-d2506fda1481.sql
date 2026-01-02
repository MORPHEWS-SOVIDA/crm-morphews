-- Create table for dynamic product price kits
CREATE TABLE public.product_price_kits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  
  -- Regular price
  regular_price_cents INTEGER NOT NULL DEFAULT 0,
  regular_use_default_commission BOOLEAN NOT NULL DEFAULT true,
  regular_custom_commission NUMERIC(5,2) NULL,
  
  -- Promotional price
  promotional_price_cents INTEGER NULL,
  promotional_use_default_commission BOOLEAN NOT NULL DEFAULT true,
  promotional_custom_commission NUMERIC(5,2) NULL,
  
  -- Minimum price
  minimum_price_cents INTEGER NULL,
  minimum_use_default_commission BOOLEAN NOT NULL DEFAULT true,
  minimum_custom_commission NUMERIC(5,2) NULL,
  
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique quantity per product
  UNIQUE(product_id, quantity)
);

-- Add indexes
CREATE INDEX idx_product_price_kits_product_id ON public.product_price_kits(product_id);
CREATE INDEX idx_product_price_kits_org_id ON public.product_price_kits(organization_id);

-- Enable RLS
ALTER TABLE public.product_price_kits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view kits of their org"
  ON public.product_price_kits
  FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert kits in their org"
  ON public.product_price_kits
  FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update kits of their org"
  ON public.product_price_kits
  FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete kits of their org"
  ON public.product_price_kits
  FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Add trigger for updated_at
CREATE TRIGGER update_product_price_kits_updated_at
  BEFORE UPDATE ON public.product_price_kits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();