-- =============================================================================
-- FASE 5A: E-commerce Multi-Tenant - Evolução do Schema
-- =============================================================================

-- 1. CAMPOS DE E-COMMERCE EM PRODUTOS
-- Adicionando campos para exibição no e-commerce
ALTER TABLE lead_products 
ADD COLUMN IF NOT EXISTS ecommerce_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ecommerce_title TEXT,
ADD COLUMN IF NOT EXISTS ecommerce_description TEXT,
ADD COLUMN IF NOT EXISTS ecommerce_short_description TEXT,
ADD COLUMN IF NOT EXISTS ecommerce_images JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ecommerce_video_url TEXT,
ADD COLUMN IF NOT EXISTS ecommerce_benefits JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ecommerce_specifications JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS seo_title TEXT,
ADD COLUMN IF NOT EXISTS seo_description TEXT,
ADD COLUMN IF NOT EXISTS seo_keywords TEXT[];

-- 2. CAMPOS ADICIONAIS EM STOREFRONT_PRODUCTS
-- Para configurar exibição específica por loja
ALTER TABLE storefront_products
ADD COLUMN IF NOT EXISTS show_crosssell BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_kit_upsell BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS category_label TEXT,
ADD COLUMN IF NOT EXISTS highlight_badge TEXT,
ADD COLUMN IF NOT EXISTS custom_images JSONB;

-- 3. TABELA DE PÁGINAS INSTITUCIONAIS
CREATE TABLE IF NOT EXISTS storefront_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID REFERENCES tenant_storefronts(id) ON DELETE CASCADE NOT NULL,
  page_type TEXT NOT NULL, -- 'about', 'privacy', 'terms', 'returns', 'contact', 'faq', 'custom'
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT, -- HTML content
  meta_title TEXT,
  meta_description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(storefront_id, slug)
);

-- 4. TABELA DE BANNERS
CREATE TABLE IF NOT EXISTS storefront_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID REFERENCES tenant_storefronts(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  image_mobile_url TEXT,
  link_url TEXT,
  link_target TEXT DEFAULT '_self', -- '_self', '_blank'
  button_text TEXT,
  button_style TEXT DEFAULT 'primary', -- 'primary', 'secondary', 'outline'
  overlay_color TEXT, -- Para texto sobre imagem
  text_color TEXT DEFAULT '#ffffff',
  position TEXT DEFAULT 'center', -- 'left', 'center', 'right'
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. TABELA DE CATEGORIAS DA LOJA
CREATE TABLE IF NOT EXISTS storefront_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID REFERENCES tenant_storefronts(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  parent_id UUID REFERENCES storefront_categories(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(storefront_id, slug)
);

-- 6. RELAÇÃO PRODUTO-CATEGORIA
CREATE TABLE IF NOT EXISTS storefront_product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_product_id UUID REFERENCES storefront_products(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES storefront_categories(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(storefront_product_id, category_id)
);

-- 7. CONFIGURAÇÕES AVANÇADAS DA STOREFRONT
ALTER TABLE tenant_storefronts
ADD COLUMN IF NOT EXISTS header_config JSONB DEFAULT '{
  "showSearch": true,
  "showCart": true,
  "showCategories": true,
  "menuStyle": "horizontal",
  "stickyHeader": true
}'::jsonb,
ADD COLUMN IF NOT EXISTS footer_config JSONB DEFAULT '{
  "showNewsletter": true,
  "showSocial": true,
  "showPaymentMethods": true,
  "columns": []
}'::jsonb,
ADD COLUMN IF NOT EXISTS checkout_config JSONB DEFAULT '{
  "style": "page",
  "showOrderBump": true,
  "showKitUpsell": true,
  "requirePhone": true,
  "requireCpf": true
}'::jsonb,
ADD COLUMN IF NOT EXISTS cart_config JSONB DEFAULT '{
  "showCrosssell": true,
  "minOrderValue": 0,
  "freeShippingThreshold": 0
}'::jsonb,
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS payment_methods_display TEXT[] DEFAULT ARRAY['pix', 'credit_card', 'boleto'];

-- 8. ATUALIZAR LANDING_PAGES COM CHECKOUT CONFIG
ALTER TABLE landing_pages
ADD COLUMN IF NOT EXISTS checkout_config JSONB DEFAULT '{
  "style": "modal",
  "showOrderBump": true,
  "orderBumpProductId": null,
  "orderBumpDiscount": 0
}'::jsonb,
ADD COLUMN IF NOT EXISTS order_bump_product_id UUID REFERENCES lead_products(id) ON DELETE SET NULL;

-- 9. POPULAR TEMPLATES COM BASE NOS SITES DE REFERÊNCIA
INSERT INTO storefront_templates (name, slug, description, template_type, preview_image_url, config, is_active)
VALUES 
  (
    'Minimal Clean',
    'minimal-clean',
    'Design minimalista e elegante inspirado em Stanley''s Hair Care. Foco no produto com navegação limpa.',
    'store',
    null,
    '{
      "inspiration": "Stanley''s Hair Care",
      "features": ["clean_navigation", "product_focus", "minimal_distractions"],
      "layout": {
        "headerStyle": "minimal",
        "heroStyle": "single_image",
        "productGrid": "3_columns",
        "footerStyle": "compact"
      },
      "colors": {
        "primary": "#1a1a1a",
        "secondary": "#666666",
        "accent": "#c5a572",
        "background": "#ffffff"
      },
      "typography": {
        "headingFont": "Playfair Display",
        "bodyFont": "Inter"
      }
    }'::jsonb,
    true
  ),
  (
    'Vitrine Moderna',
    'vitrine-moderna',
    'Layout de vitrine vibrante inspirado em Gummy Hair. Grid de produtos com categorias destacadas.',
    'store',
    null,
    '{
      "inspiration": "Gummy Hair",
      "features": ["category_navigation", "product_grid", "vibrant_colors", "promotional_banners"],
      "layout": {
        "headerStyle": "full",
        "heroStyle": "carousel",
        "productGrid": "4_columns",
        "footerStyle": "full"
      },
      "colors": {
        "primary": "#e91e63",
        "secondary": "#9c27b0",
        "accent": "#ffeb3b",
        "background": "#fafafa"
      },
      "typography": {
        "headingFont": "Poppins",
        "bodyFont": "Open Sans"
      }
    }'::jsonb,
    true
  ),
  (
    'Premium Saúde',
    'premium-saude',
    'Design premium inspirado em Essential Nutrition. Transmite confiança e qualidade científica.',
    'store',
    null,
    '{
      "inspiration": "Essential Nutrition",
      "features": ["scientific_approach", "trust_badges", "detailed_descriptions", "ingredient_highlights"],
      "layout": {
        "headerStyle": "professional",
        "heroStyle": "split",
        "productGrid": "3_columns_detailed",
        "footerStyle": "comprehensive"
      },
      "colors": {
        "primary": "#2d5a27",
        "secondary": "#1a3a15",
        "accent": "#8bc34a",
        "background": "#ffffff"
      },
      "typography": {
        "headingFont": "Montserrat",
        "bodyFont": "Source Sans Pro"
      }
    }'::jsonb,
    true
  ),
  (
    'VSL Conversão',
    'vsl-conversao',
    'Template de landing page VSL inspirado em Lipofree/Cellulit Free. Focado em conversão com ofertas em kits.',
    'landing_page',
    null,
    '{
      "inspiration": "Lipofree/Cellulit Free",
      "features": ["vsl_video", "benefit_list", "testimonials", "urgency", "kit_offers", "guarantee"],
      "layout": {
        "sections": ["hero_vsl", "benefits", "how_it_works", "testimonials", "offers", "faq", "guarantee"],
        "ctaStyle": "floating",
        "offerLayout": "horizontal_cards"
      },
      "colors": {
        "primary": "#ff6b35",
        "secondary": "#1a1a2e",
        "accent": "#16c79a",
        "background": "#f8f9fa"
      },
      "typography": {
        "headingFont": "Roboto Slab",
        "bodyFont": "Roboto"
      }
    }'::jsonb,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  config = EXCLUDED.config,
  is_active = EXCLUDED.is_active;

-- 10. RLS POLICIES
-- Páginas institucionais
ALTER TABLE storefront_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active pages" ON storefront_pages
  FOR SELECT USING (is_active = true);

CREATE POLICY "Org members can manage pages" ON storefront_pages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_storefronts ts
      JOIN organization_members om ON ts.organization_id = om.organization_id
      WHERE ts.id = storefront_pages.storefront_id
      AND om.user_id = auth.uid()
    )
  );

-- Banners
ALTER TABLE storefront_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active banners" ON storefront_banners
  FOR SELECT USING (
    is_active = true 
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );

CREATE POLICY "Org members can manage banners" ON storefront_banners
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_storefronts ts
      JOIN organization_members om ON ts.organization_id = om.organization_id
      WHERE ts.id = storefront_banners.storefront_id
      AND om.user_id = auth.uid()
    )
  );

-- Categorias
ALTER TABLE storefront_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active categories" ON storefront_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Org members can manage categories" ON storefront_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_storefronts ts
      JOIN organization_members om ON ts.organization_id = om.organization_id
      WHERE ts.id = storefront_categories.storefront_id
      AND om.user_id = auth.uid()
    )
  );

-- Relação produto-categoria
ALTER TABLE storefront_product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view product categories" ON storefront_product_categories
  FOR SELECT USING (true);

CREATE POLICY "Org members can manage product categories" ON storefront_product_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM storefront_products sp
      JOIN tenant_storefronts ts ON sp.storefront_id = ts.id
      JOIN organization_members om ON ts.organization_id = om.organization_id
      WHERE sp.id = storefront_product_categories.storefront_product_id
      AND om.user_id = auth.uid()
    )
  );

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_storefront_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_storefront_pages_updated_at ON storefront_pages;
CREATE TRIGGER update_storefront_pages_updated_at
  BEFORE UPDATE ON storefront_pages
  FOR EACH ROW EXECUTE FUNCTION update_storefront_tables_updated_at();

DROP TRIGGER IF EXISTS update_storefront_banners_updated_at ON storefront_banners;
CREATE TRIGGER update_storefront_banners_updated_at
  BEFORE UPDATE ON storefront_banners
  FOR EACH ROW EXECUTE FUNCTION update_storefront_tables_updated_at();

DROP TRIGGER IF EXISTS update_storefront_categories_updated_at ON storefront_categories;
CREATE TRIGGER update_storefront_categories_updated_at
  BEFORE UPDATE ON storefront_categories
  FOR EACH ROW EXECUTE FUNCTION update_storefront_tables_updated_at();