# Pricing and Categories Overhaul v106

## Resumo
Reestruturação completa do cadastro de produtos para corrigir a lógica de precificação.

## Mudanças Principais

### 1. Preço de 1 Unidade Fixo no Cadastro
Novos campos na tabela `lead_products`:
- `base_price_cents` - Preço fixo de 1 unidade
- `base_commission_percentage` - Comissão personalizada (se não usar padrão)
- `base_use_default_commission` - Flag para usar comissão padrão
- `base_points` - Pontos de campanha por 1 unidade vendida
- `base_usage_period_days` - Período de uso/tratamento em dias
- `base_sales_hack` - Dicas de venda para 1 unidade

### 2. Categorias com Comportamentos Distintos
- **Com Kits (múltiplos 2+)**: `produto_pronto`, `print_on_demand`, `dropshipping`, `outro`
- **Preço Único (sem kits)**: `ebook`, `info_video_aula`, `servico`
- **Sem Preço no Cadastro**: `manipulado` (preço definido na hora da venda)

### 3. Sistema de Combos (Vendas Casadas)
Novas tabelas:
- `product_combos` - Combos principais
- `product_combo_items` - Produtos que compõem cada combo
- `product_combo_prices` - Preços por multiplicador (Combo ×1, ×2, ×3...)

Funcionalidades:
- Menu separado: Produtos → Combos
- Preço base calculado automaticamente (soma dos `base_price_cents` dos produtos)
- Suporte a múltiplos preços: Normal, Promocional, Promocional 2, Mínimo
- Campos extras: Pontos, Hack de Venda
- No cadastro do produto, aba read-only mostra combos que ele faz parte

### 4. Criar Marca Inline
Botão + ao lado do select de marca no ProductForm abre popup para criar nova marca sem sair da tela.

### 5. CSV Export/Import Atualizado
Novos campos incluídos:
- `base_price_cents`
- `base_commission_percentage`
- `base_use_default_commission`
- `base_points`
- `base_usage_period_days`

## Arquivos Criados/Modificados
- `src/hooks/useProductCombos.ts` - Hook completo para CRUD de combos
- `src/components/products/BaseUnitPricing.tsx` - Card de preço de 1 UN
- `src/components/products/CreateBrandDialog.tsx` - Popup inline para nova marca
- `src/components/products/ProductCombosReadOnly.tsx` - Exibe combos do produto
- `src/pages/ProductCombos.tsx` - Lista de combos
- `src/pages/ComboForm.tsx` - Criar/editar combo
- `src/components/products/ProductForm.tsx` - Atualizado com novos campos
- `src/components/products/ProductCsvManager.tsx` - CSV com novos campos

## Rotas
- `/produtos/combos` - Lista de combos
- `/produtos/combos/novo` - Criar novo combo
- `/produtos/combos/:id` - Editar combo existente
