# Memory: features/ecommerce/checkout-combo-resolution-v1
Updated: just now

## Resolução de Combos no Checkout

O checkout agora resolve IDs tanto de produtos individuais (`lead_products`) quanto de kits/combos (`product_combos`). Quando um site externo envia um `pid` no carrinho Base64:

1. **Frontend** (`StorefrontCart.tsx`, `StorefrontCheckout.tsx`): A função `resolveProductDetails` primeiro tenta buscar em `storefront_products → lead_products`. Se não encontrar, tenta por `combo_id → product_combos` e busca o preço na tabela `product_combo_prices` usando o `multiplier` correspondente à quantidade.

2. **Backend** (`ecommerce-checkout/index.ts`): O enriquecimento de itens primeiro busca em `lead_products`, depois tenta `product_combos` para IDs não resolvidos. Para combos, o preço é calculado como `regular_price_cents × quantity` a partir da tabela `product_combo_prices`.

### Preços Escalonados (Tiered Pricing)
- Para produtos individuais: `price_1_unit` (q=1), `price_3_units` (q≥3), `price_6_units` (q≥5)
- Para combos: `product_combo_prices.regular_price_cents` filtrado por `multiplier` = quantidade
- Os valores representam o preço **por unidade/mês**, total = preço × quantidade
