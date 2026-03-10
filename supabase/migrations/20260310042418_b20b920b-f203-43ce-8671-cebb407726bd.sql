UPDATE tenant_storefronts 
SET logo_url = 'https://rriizlxqfpfpdflgxjtj.supabase.co/storage/v1/object/public/storefront-assets/41f84ec2-87c9-4220-9e35-5089f504c1fe/logos/shapefy-logo-white.png',
    custom_css = 'body .storefront-wrapper { background-color: #000000; color: #ffffff; } .storefront-wrapper .border-b, .storefront-wrapper .border-t { border-color: #222222; } .storefront-wrapper .bg-background\/95, .storefront-wrapper .bg-background { background-color: #000000 !important; } .storefront-wrapper .bg-muted\/30 { background-color: #111111 !important; } .storefront-wrapper .text-muted-foreground { color: #999999 !important; } .storefront-wrapper .text-foreground, .storefront-wrapper h1, .storefront-wrapper h2, .storefront-wrapper h3, .storefront-wrapper h4, .storefront-wrapper p, .storefront-wrapper span, .storefront-wrapper a { color: #ffffff; }',
    secondary_color = '#000000',
    updated_at = now()
WHERE slug = 'shapefy';