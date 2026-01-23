# Memory: features/ecommerce/phase-5a-storefront-admin-v1
Updated: just now

## Schema Implementado (Fase 5A)
Campos adicionados em `lead_products`: `ecommerce_enabled`, `ecommerce_title`, `ecommerce_description`, `ecommerce_short_description`, `ecommerce_images`, `ecommerce_video_url`, `ecommerce_benefits`, `ecommerce_specifications`, `seo_title`, `seo_description`, `seo_keywords`.

Campos em `storefront_products`: `show_crosssell`, `show_kit_upsell`, `category_label`, `highlight_badge`, `custom_images`.

Configurações em `tenant_storefronts`: `header_config`, `footer_config`, `checkout_config`, `cart_config`, `social_links`, `payment_methods_display`.

Novas tabelas: `storefront_pages` (institucionais), `storefront_banners` (hero carousel), `storefront_categories` (navegação), `storefront_product_categories` (relação N:N).

## Templates Disponíveis
1. **Minimal Clean** (Stanley's) - Design minimalista, foco no produto
2. **Vitrine Moderna** (Gummy) - Grid vibrante, categorias destacadas
3. **Premium Saúde** (Essential) - Científico, trust badges
4. **VSL Conversão** (Lipofree) - Landing page com ofertas em kits

## Componentes de Admin
- `StorefrontDetailManager`: Gestor completo com 5 abas
- Tabs: Banners, Páginas, Categorias, Produtos, Configurações
- Dialogs: Banner, Page, Category form dialogs
- Settings: Header, Cart (cross-sell, frete grátis), Checkout (modal/page, order bump, upsell kits)

## Hooks Criados
- `useStorefrontBanners`, `useStorefrontPages`, `useStorefrontCategories`
- CRUD completo com invalidação de cache e toasts

## Próximos Passos (Fase 5B)
1. Frontend público: Layout base, header/footer dinâmicos
2. Página de produto com cross-sell e kit upsell
3. Carrinho acumulativo com sugestões
4. Checkout com Order Bump
