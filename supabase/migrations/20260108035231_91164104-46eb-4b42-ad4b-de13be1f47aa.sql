-- Create brands table
CREATE TABLE public.product_brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_brands ENABLE ROW LEVEL SECURITY;

-- Create unique constraint for name per organization
CREATE UNIQUE INDEX idx_product_brands_name_org ON public.product_brands(organization_id, LOWER(name)) WHERE is_active = true;

-- RLS Policies
CREATE POLICY "Users can view brands from their organization"
ON public.product_brands
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage brands"
ON public.product_brands
FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- Add new columns to lead_products
ALTER TABLE public.lead_products
ADD COLUMN brand_id UUID REFERENCES public.product_brands(id) ON DELETE SET NULL,
ADD COLUMN hot_site_url TEXT,
ADD COLUMN youtube_video_url TEXT,
ADD COLUMN sku TEXT,
ADD COLUMN unit TEXT,
ADD COLUMN net_weight_grams INTEGER,
ADD COLUMN gross_weight_grams INTEGER,
ADD COLUMN width_cm NUMERIC(10,2),
ADD COLUMN height_cm NUMERIC(10,2),
ADD COLUMN depth_cm NUMERIC(10,2),
ADD COLUMN barcode_ean TEXT,
ADD COLUMN gtin_tax TEXT;

-- Create index for brand lookup
CREATE INDEX idx_lead_products_brand_id ON public.lead_products(brand_id);

-- Trigger for updated_at on brands
CREATE TRIGGER update_product_brands_updated_at
BEFORE UPDATE ON public.product_brands
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();