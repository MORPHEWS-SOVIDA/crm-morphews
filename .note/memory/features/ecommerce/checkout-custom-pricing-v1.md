# Memory: features/ecommerce/checkout-custom-pricing-v1
Updated: just now

## Preço Customizado por Checkout

### Problema Resolvido
Anteriormente, o preço do checkout era sempre vinculado ao preço do produto no banco de dados. Isso impedia criar múltiplos checkouts para o mesmo produto com preços diferentes (promoções, lançamentos, black friday, etc.).

### Solução Implementada
Adicionados 3 novos campos à tabela `standalone_checkouts`:
- `custom_price_cents`: Preço customizado em centavos (nullable - se NULL, usa preço do produto)
- `quantity`: Quantidade do produto vendido neste checkout (default: 1)
- `custom_product_name`: Nome customizado para exibir no checkout (ex: "Kit 3 Potes")

### Lógica de Prioridade de Preço
```
preço_final = custom_price_cents ?? product.price_1_unit ?? product.base_price_cents
```

### Arquivos Modificados
- `src/hooks/ecommerce/useStandaloneCheckouts.ts` - Interfaces atualizadas
- `src/components/ecommerce/checkout/CheckoutFormDialog.tsx` - Form com campos de preço
- `src/components/ecommerce/checkout/CheckoutsManager.tsx` - Exibe preço customizado
- `src/pages/ecommerce/PublicCheckoutPage.tsx` - Checkout público usa preço customizado

### Uso
Na aba "Básico" do editor de checkout:
1. Selecione o produto base
2. Preencha "Preço (R$)" para sobrescrever o valor
3. Opcionalmente ajuste "Quantidade" e "Nome no Checkout"

Exemplos de uso:
- Checkout "Black Friday" com 50% off → custom_price_cents = 9900 (R$ 99,00)
- Checkout "Kit 3 Potes" → quantity = 3, custom_product_name = "Kit 3 Potes"
