-- Add category column to lead_products table
ALTER TABLE public.lead_products 
ADD COLUMN category text NOT NULL DEFAULT 'produto_pronto';

-- Add check constraint for valid categories
ALTER TABLE public.lead_products
ADD CONSTRAINT lead_products_category_check 
CHECK (category IN ('produto_pronto', 'print_on_demand', 'manipulado', 'ebook', 'info_video_aula', 'dropshipping', 'servico', 'outro'));

-- Create index for category filtering
CREATE INDEX idx_lead_products_category ON public.lead_products(organization_id, category) WHERE is_active = true;