ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS is_ecommerce_origin boolean DEFAULT false;

-- Mark existing ecommerce sales
UPDATE public.sales s
SET is_ecommerce_origin = true
WHERE EXISTS (
  SELECT 1 FROM ecommerce_orders eo WHERE eo.sale_id = s.id
);

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_sales_ecommerce_origin ON public.sales (is_ecommerce_origin) WHERE is_ecommerce_origin = true;