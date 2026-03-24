# Memory: features/ecommerce/combo-explosion-v1
Updated: just now

## Explosão de Combos no Checkout

Quando um combo (kit) é vendido via checkout e-commerce, o sistema agora cria:

### Estrutura em sale_items
1. **Item PAI** (combo): `combo_id` preenchido, `combo_item_parent_id = null`, preço total do kit
2. **Itens FILHOS** (componentes): `combo_item_parent_id = pai.id`, `combo_id` preenchido, `unit_price_cents = 0` (preço fica no pai)

### Mesma estrutura em ecommerce_order_items
Replicada para visibilidade no painel de vendas online.

### Colunas Adicionadas (migração)
- `sale_items.combo_id` (uuid → product_combos)
- `sale_items.combo_item_parent_id` (uuid → sale_items, self-ref)
- `ecommerce_order_items.combo_id` (uuid → product_combos)
- `ecommerce_order_items.combo_item_parent_id` (uuid → ecommerce_order_items, self-ref)
- `lead_products.label_links` (text[], URLs do Google Drive para rótulos print-on-demand)

### Frontend
- **SaleDetail**: Filtra `combo_item_parent_id = null` para mostrar apenas pais. Abaixo de cada kit, exibe filhos com `↳` indentado.
- **ExpeditionReport**: `getProductsList()` mostra kit + componentes indentados.
- **EcommerceOrderDetail**: Mesma lógica de pai/filhos.
- **ProductForm**: Campo "Links dos Rótulos" para adicionar URLs de rótulos do Google Drive.

### Comissões
O preço do combo é definido separadamente (não é soma dos individuais). Comissões do co-produtor são calculadas pelo valor configurado no combo `product_combo_prices`, não pela soma dos componentes.
