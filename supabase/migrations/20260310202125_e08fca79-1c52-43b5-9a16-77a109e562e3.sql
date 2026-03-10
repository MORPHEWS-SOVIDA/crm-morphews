-- Fix old converted carts with no sale reference - they're abandoned
UPDATE ecommerce_carts
SET status = 'abandoned', abandoned_at = updated_at
WHERE status = 'converted' AND converted_sale_id IS NULL;