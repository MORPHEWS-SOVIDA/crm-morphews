-- Rename products
UPDATE lead_products SET name = 'Power Woman', ecommerce_title = 'Power Woman' WHERE id = 'aaa20c1c-b158-4aa4-b9f4-8aa133f89006';
UPDATE lead_products SET name = 'Deep Sleep', ecommerce_title = 'Deep Sleep' WHERE id = 'aaa20c1c-b158-4aa4-b9f4-8aa133f89003';
UPDATE lead_products SET name = 'Combat Creatina', ecommerce_title = 'Combat Creatina' WHERE id = 'aaa20c1c-b158-4aa4-b9f4-8aa133f89002';

-- Update images for all products
UPDATE lead_products SET image_url = 'https://rriizlxqfpfpdflgxjtj.supabase.co/storage/v1/object/public/storefront-assets/balestrero/products/powerwoman.png' WHERE id = 'aaa20c1c-b158-4aa4-b9f4-8aa133f89006';
UPDATE lead_products SET image_url = 'https://rriizlxqfpfpdflgxjtj.supabase.co/storage/v1/object/public/storefront-assets/balestrero/products/healthman.png' WHERE id = 'aaa20c1c-b158-4aa4-b9f4-8aa133f89004';
UPDATE lead_products SET image_url = 'https://rriizlxqfpfpdflgxjtj.supabase.co/storage/v1/object/public/storefront-assets/balestrero/products/creatina.png' WHERE id = 'aaa20c1c-b158-4aa4-b9f4-8aa133f89002';
UPDATE lead_products SET image_url = 'https://rriizlxqfpfpdflgxjtj.supabase.co/storage/v1/object/public/storefront-assets/balestrero/products/power.png' WHERE id = 'aaa20c1c-b158-4aa4-b9f4-8aa133f89001';