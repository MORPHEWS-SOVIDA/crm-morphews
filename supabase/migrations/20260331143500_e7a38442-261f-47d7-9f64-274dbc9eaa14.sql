
-- Add stock_movement_id column to track which stock movement generated the label assignment
ALTER TABLE public.product_serial_labels 
  ADD COLUMN IF NOT EXISTS stock_movement_id UUID REFERENCES public.stock_movements(id);

-- Create index for faster lookups by sale_id and status
CREATE INDEX IF NOT EXISTS idx_serial_labels_sale_status 
  ON public.product_serial_labels(organization_id, sale_id, status);

CREATE INDEX IF NOT EXISTS idx_serial_labels_product_status 
  ON public.product_serial_labels(organization_id, product_id, status);

CREATE INDEX IF NOT EXISTS idx_serial_labels_stock_movement 
  ON public.product_serial_labels(stock_movement_id);
