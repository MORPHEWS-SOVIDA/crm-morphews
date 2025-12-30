
-- Add cost and stock fields to lead_products
ALTER TABLE public.lead_products
ADD COLUMN IF NOT EXISTS cost_cents integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock_quantity integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS minimum_stock integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS track_stock boolean DEFAULT false;

-- Create stock movements table for history
CREATE TABLE public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('entry', 'exit', 'adjustment', 'sale', 'return')),
  quantity integer NOT NULL,
  previous_quantity integer NOT NULL,
  new_quantity integer NOT NULL,
  reference_id uuid NULL, -- Can reference sale_id or other entities
  reference_type text NULL, -- 'sale', 'manual', etc.
  notes text NULL,
  created_by uuid NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX idx_stock_movements_org ON public.stock_movements(organization_id);
CREATE INDEX idx_stock_movements_created ON public.stock_movements(created_at DESC);

-- Enable RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS policies for stock_movements
CREATE POLICY "Users can view stock movements of their org"
ON public.stock_movements FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert stock movements in their org"
ON public.stock_movements FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

-- Comments for documentation
COMMENT ON COLUMN public.lead_products.cost_cents IS 'Product cost in cents for profit margin calculation';
COMMENT ON COLUMN public.lead_products.stock_quantity IS 'Current stock quantity';
COMMENT ON COLUMN public.lead_products.minimum_stock IS 'Minimum stock level for alerts';
COMMENT ON COLUMN public.lead_products.track_stock IS 'Whether to track stock for this product';
COMMENT ON TABLE public.stock_movements IS 'History of all stock movements for auditing';
