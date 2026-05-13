ALTER TABLE public.product_combos
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.product_brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_combos_brand ON public.product_combos(brand_id);