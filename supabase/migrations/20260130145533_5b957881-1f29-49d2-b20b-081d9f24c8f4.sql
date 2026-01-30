-- Add review_count field to products
ALTER TABLE public.lead_products 
ADD COLUMN IF NOT EXISTS review_count integer DEFAULT floor(random() * 151 + 50)::integer;

-- Add constraint to keep value between 0 and 200
ALTER TABLE public.lead_products 
ADD CONSTRAINT lead_products_review_count_range 
CHECK (review_count >= 0 AND review_count <= 200);

-- Update existing products with random values (50-200) if they have NULL
UPDATE public.lead_products 
SET review_count = floor(random() * 151 + 50)::integer 
WHERE review_count IS NULL;