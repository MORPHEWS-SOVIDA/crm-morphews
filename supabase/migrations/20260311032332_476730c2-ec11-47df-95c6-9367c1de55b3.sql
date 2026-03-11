
-- 1. Update storefront: logo, colors, custom_css (dark/gold theme)
UPDATE tenant_storefronts 
SET 
  logo_url = 'https://rriizlxqfpfpdflgxjtj.supabase.co/storage/v1/object/public/storefront-assets/balestrero/logo.png',
  primary_color = '#D4A84B',
  secondary_color = '#1A1A1A',
  custom_css = '.storefront-wrapper { background-color: #0D0D0D !important; color: #E8E8E8 !important; }
.storefront-wrapper .bg-card, .storefront-wrapper [class*="bg-white"], .storefront-wrapper [class*="bg-background"] { background-color: #1A1A1A !important; color: #E8E8E8 !important; }
.storefront-wrapper .text-foreground, .storefront-wrapper .text-gray-900, .storefront-wrapper .text-gray-800, .storefront-wrapper .text-gray-700 { color: #E8E8E8 !important; }
.storefront-wrapper .text-muted-foreground, .storefront-wrapper .text-gray-500, .storefront-wrapper .text-gray-600 { color: #A0A0A0 !important; }
.storefront-wrapper .border, .storefront-wrapper [class*="border-"] { border-color: #2A2A2A !important; }
.storefront-wrapper input, .storefront-wrapper select, .storefront-wrapper textarea { background-color: #1A1A1A !important; color: #E8E8E8 !important; border-color: #333 !important; }
.storefront-wrapper .bg-primary, .storefront-wrapper [class*="btn-primary"], .storefront-wrapper button[class*="bg-primary"] { background-color: #D4A84B !important; color: #0D0D0D !important; }
.storefront-wrapper .text-primary { color: #D4A84B !important; }
.storefront-wrapper .ring-primary { --tw-ring-color: #D4A84B !important; }
.storefront-wrapper .shadow-sm, .storefront-wrapper .shadow-md, .storefront-wrapper .shadow-lg { box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important; }
.storefront-wrapper .rounded-lg, .storefront-wrapper .rounded-xl { border: 1px solid #2A2A2A !important; }
.storefront-wrapper h1, .storefront-wrapper h2, .storefront-wrapper h3 { color: #D4A84B !important; }',
  meta_title = 'Balestrero Nutrition - Suplementos para Lutadores de Jiu-Jitsu',
  meta_description = 'Suplementos premium desenvolvidos exclusivamente para atletas de Jiu-Jitsu. Performance, recuperação e energia para o tatame.'
WHERE slug = 'balestrero';

-- 2. Remove old storefront products
DELETE FROM storefront_products WHERE storefront_id = 'df9a1b37-2bb2-4f4d-b3bb-21993b34bfdc';

-- 3. Add new Balestrero products
INSERT INTO storefront_products (storefront_id, product_id, display_order, is_featured) VALUES
  ('df9a1b37-2bb2-4f4d-b3bb-21993b34bfdc', 'aaa20c1c-b158-4aa4-b9f4-8aa133f89001', 1, true),
  ('df9a1b37-2bb2-4f4d-b3bb-21993b34bfdc', 'aaa20c1c-b158-4aa4-b9f4-8aa133f89002', 2, true),
  ('df9a1b37-2bb2-4f4d-b3bb-21993b34bfdc', 'aaa20c1c-b158-4aa4-b9f4-8aa133f89003', 3, false),
  ('df9a1b37-2bb2-4f4d-b3bb-21993b34bfdc', 'aaa20c1c-b158-4aa4-b9f4-8aa133f89004', 4, false),
  ('df9a1b37-2bb2-4f4d-b3bb-21993b34bfdc', 'aaa20c1c-b158-4aa4-b9f4-8aa133f89005', 5, false),
  ('df9a1b37-2bb2-4f4d-b3bb-21993b34bfdc', 'aaa20c1c-b158-4aa4-b9f4-8aa133f89006', 6, false);

-- 4. Remove old banners
DELETE FROM storefront_banners WHERE storefront_id = 'df9a1b37-2bb2-4f4d-b3bb-21993b34bfdc';

-- 5. Add new jiu-jitsu banners
INSERT INTO storefront_banners (storefront_id, image_url, title, subtitle) VALUES
  ('df9a1b37-2bb2-4f4d-b3bb-21993b34bfdc', 'https://rriizlxqfpfpdflgxjtj.supabase.co/storage/v1/object/public/storefront-assets/balestrero/banners/banner-1.jpg', 'Performance no Tatame', 'Suplementos desenvolvidos para quem vive o Jiu-Jitsu'),
  ('df9a1b37-2bb2-4f4d-b3bb-21993b34bfdc', 'https://rriizlxqfpfpdflgxjtj.supabase.co/storage/v1/object/public/storefront-assets/balestrero/banners/banner-2.jpg', 'Foco. Força. Resistência.', 'Formulado para atletas de combate');

-- 6. Update product images (BURNFAT and BOA NOITE/DEEP SLEEP)
UPDATE lead_products SET image_url = 'https://rriizlxqfpfpdflgxjtj.supabase.co/storage/v1/object/public/storefront-assets/balestrero/products/burnfat.jpg' WHERE id = 'aaa20c1c-b158-4aa4-b9f4-8aa133f89005';
UPDATE lead_products SET image_url = 'https://rriizlxqfpfpdflgxjtj.supabase.co/storage/v1/object/public/storefront-assets/balestrero/products/deepsleep.png' WHERE id = 'aaa20c1c-b158-4aa4-b9f4-8aa133f89003';
