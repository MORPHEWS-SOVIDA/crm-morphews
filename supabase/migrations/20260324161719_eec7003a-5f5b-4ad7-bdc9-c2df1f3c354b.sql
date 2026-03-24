-- Add combo tracking to sale_items
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS combo_id uuid REFERENCES public.product_combos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS combo_item_parent_id uuid REFERENCES public.sale_items(id) ON DELETE CASCADE;

-- Add combo tracking to ecommerce_order_items
ALTER TABLE public.ecommerce_order_items
  ADD COLUMN IF NOT EXISTS combo_id uuid REFERENCES public.product_combos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS combo_item_parent_id uuid REFERENCES public.ecommerce_order_items(id) ON DELETE CASCADE;

-- Add label links to lead_products (array of Google Drive URLs for print on demand)
ALTER TABLE public.lead_products
  ADD COLUMN IF NOT EXISTS label_links text[] DEFAULT '{}';

-- Index for fast combo lookups
CREATE INDEX IF NOT EXISTS idx_sale_items_combo_id ON public.sale_items(combo_id) WHERE combo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sale_items_combo_parent ON public.sale_items(combo_item_parent_id) WHERE combo_item_parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ecommerce_order_items_combo_id ON public.ecommerce_order_items(combo_id) WHERE combo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ecommerce_order_items_combo_parent ON public.ecommerce_order_items(combo_item_parent_id) WHERE combo_item_parent_id IS NOT NULL;