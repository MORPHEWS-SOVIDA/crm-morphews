# Memory: features/ecommerce/checkout-shipping-modes-v1
Updated: just now

## Configuração de Frete nos Checkouts Avulsos

### Campo `shipping_mode` na tabela `standalone_checkouts`
- **`none`**: Sem frete (produto digital ou retirada)
- **`free`**: Frete grátis (vendedor assume custo)
- **`calculated`**: Calcula via Correios (PAC/SEDEX) + R$ 7,00 picking + 2 dias

### Regra de Comissão Crítica
**Parceiros NÃO ganham comissão sobre o valor do frete:**
- Indústria
- Fábrica
- Co-produtor
- Afiliado

O frete é cobrado separadamente e não entra na base de cálculo de comissões.

### Fluxo do Checkout
1. Usuário preenche CEP
2. Se `shipping_mode === 'calculated'`, sistema busca cotação via `correios-simple-quote`
3. Opções PAC e SEDEX exibidas com preço e prazo
4. Frete selecionado adicionado ao total
5. Dados de frete enviados ao `ecommerce-checkout`:
   - `shipping_cost_cents`
   - `shipping_service_code`
   - `shipping_service_name`
   - `shipping_delivery_days`
   - `shipping_mode`

### Componentes Atualizados
- `CheckoutFormDialog.tsx`: Configuração com RadioGroup (none/free/calculated)
- `PublicCheckoutPage.tsx`: Seletor de frete + resumo com custo
- `useStandaloneCheckouts.ts`: Interface com `shipping_mode`
