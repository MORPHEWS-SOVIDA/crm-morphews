# Memory: features/ecommerce/progressive-cart-capture-unified-v1
Updated: just now

## Captura Progressiva de Carrinhos (Unificada)

### Problema Resolvido
Anteriormente, o Checkout Avulso (PublicCheckoutPage) não sincronizava dados progressivamente como a Loja e Landing Pages. Isso significava que se um cliente preenchesse nome/email e abandonasse, o carrinho não seria capturado.

### Implementação Atual
Todos os 3 pontos de entrada agora utilizam a Edge Function `cart-sync` para captura progressiva:

| Fluxo | Arquivo | Trigger |
|-------|---------|---------|
| Storefront | `CartContext.tsx` | `debouncedSync` via `updateCustomerData` |
| Landing Page | `LandingCheckoutModal.tsx` | `handleFieldBlur` com timeout 500ms |
| Checkout Avulso | `PublicCheckoutPage.tsx` | `handleFieldBlur` com timeout 500ms |

### Como Funciona
1. Usuário preenche nome ou email
2. Ao sair do campo (blur), sistema aguarda 500ms (debounce)
3. `cart-sync` é chamada com dados atuais
4. Carrinho criado/atualizado no banco com `session_id` único
5. Se já existe `cart_id`, atualiza o registro existente

### Campos Capturados
- **Customer**: name, email, phone, cpf
- **Shipping**: cep, street, number, complement, neighborhood, city, state
- **Attribution**: affiliate_code, UTMs, click_ids (fbclid, gclid, ttclid)

### Relatório de Carrinhos Abandonados
Rota: `/ecommerce/carrinhos`
- Exibe todos os carrinhos não convertidos
- Filtra por período, origem (storefront/landing/checkout)
- Permite envio de automações de recuperação

### Edge Function cart-sync
- Cria ou atualiza `ecommerce_carts`
- Vincula automaticamente `lead_id` baseado em email/telefone
- Preserva dados de atribuição para rastreamento
