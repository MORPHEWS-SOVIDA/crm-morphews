# Memory: features/ecommerce/affiliate-system-v3-logic-and-rls
Updated: just now

## Arquitetura de Afiliados (Dual-Table System)

### Tabelas de Afiliados
- **`organization_affiliates`** (ATUAL): Códigos `AFF...` - usada pela UI do checkout
- **`partner_associations`** (LEGADO): Códigos `P...` - fallback no Split Engine
- **`checkout_affiliate_links`**: Vincula afiliados a checkouts específicos

### Fluxo de Atribuição
1. Cliente acessa checkout com `?ref=AFF8AE0DF`
2. `ecommerce-checkout` grava em `affiliate_attributions` com `attribution_type: 'link'`
3. Webhook de pagamento processa splits via Split Engine
4. Split Engine busca afiliado em `organization_affiliates` pelo `affiliate_code`

### Cálculo de Comissão (CORRIGIDO)
- Base = Total - Taxa Plataforma (4.99%)
- Comissão = Base × % afiliado (ex: 15%)
- Exemplo: R$29,02 venda → Base R$27,57 → Comissão R$4,13

### Correções Aplicadas (2026-01-28)
1. **attribution_type**: Mudado de `'ref'` para `'link'` (valores válidos: link, coupon, manual, utm)
2. **Standalone affiliates**: Split Engine agora processa afiliados que NÃO pertencem a redes

### Visibilidade RLS
- Afiliados veem apenas vendas/pedidos/carrinhos vinculados ao seu código via `?ref=`
- Checkout público exibe código do afiliado: "Essa compra está associada a: [CODIGO]"
