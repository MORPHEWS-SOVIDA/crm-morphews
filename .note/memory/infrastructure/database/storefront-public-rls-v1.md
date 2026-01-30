# Memory: infrastructure/database/storefront-public-rls-v1
Updated: just now

## Políticas RLS para Acesso Público ao Storefront

### Tabela `lead_products`
Duas políticas permitem visualização pública dos produtos de e-commerce:

1. **"Public can view ecommerce-enabled products"** (anon):
   - `is_active = true`
   - `ecommerce_enabled = true`
   - `COALESCE(restrict_to_users, false) = false`

2. **"Users can view lead products"** (authenticated):
   - Produtos da própria organização (`organization_id = get_user_organization_id()`)
   - OU produtos públicos de e-commerce (mesmas condições do anon)

### Outras tabelas públicas do storefront
Todas possuem políticas para `anon` e `authenticated`:
- `tenant_storefronts`: `is_active = true`
- `storefront_products`: `is_visible = true` + storefront ativo
- `storefront_banners`: `is_active = true` + datas válidas
- `storefront_pages`: `is_active = true`
- `storefront_categories`: `is_active = true`
- `storefront_testimonials`: `is_active = true`
- `storefront_templates`: todos podem ver
- `product_price_kits`: produtos vinculados a storefronts ativos

### Trigger de Ativação Automática
A trigger `auto_enable_ecommerce_on_storefront` ativa `ecommerce_enabled = true` em `lead_products` quando um produto é associado a um storefront.
