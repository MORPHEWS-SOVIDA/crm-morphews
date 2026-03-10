-- Fix carts that were marked as 'converted' but sale was never paid
-- These should be 'payment_initiated' (checkout was submitted but payment not confirmed)
UPDATE ecommerce_carts c
SET status = 'payment_initiated'
WHERE c.status = 'converted'
AND c.converted_sale_id IS NOT NULL
AND EXISTS (
  SELECT 1 FROM sales s 
  WHERE s.id = c.converted_sale_id 
  AND s.payment_status IN ('pending', 'failed', 'processing')
);

-- Fix carts where the sale was cancelled - set them as abandoned
UPDATE ecommerce_carts c
SET status = 'abandoned',
    abandoned_at = c.updated_at
WHERE c.status = 'converted'
AND c.converted_sale_id IS NOT NULL
AND EXISTS (
  SELECT 1 FROM sales s 
  WHERE s.id = c.converted_sale_id 
  AND s.payment_status = 'cancelled'
);