# Memory: features/ecommerce/ecommerce-pending-status-v1
Updated: just now

## Separação Ecommerce vs ERP

### Novo Status: `ecommerce_pending`
Vendas criadas via checkout e-commerce usam status `ecommerce_pending` ao invés de `payment_pending`.

### Comportamento
1. **Checkout cria venda com status `ecommerce_pending`**
   - NÃO aparece em `/vendas` (ERP)
   - Aparece apenas em `/ecommerce/vendas`

2. **Quando pagamento é confirmado (webhook)**
   - Status muda para `payment_confirmed`
   - Passa a aparecer no ERP

3. **Cancelamento automático após 1 hora**
   - Edge function `cancel-expired-orders` roda a cada 10min via cron
   - Cancela pedidos `awaiting_payment` > 1 hora
   - Também cancela as vendas `ecommerce_pending` associadas

### Arquivos Modificados
- `src/hooks/useSales.ts` - Novo status + filtro `.neq('status', 'ecommerce_pending')`
- `supabase/functions/ecommerce-checkout/index.ts` - Usa `ecommerce_pending`
- `supabase/functions/cancel-expired-orders/index.ts` - Nova função cron

### Cron Job
```sql
cron.schedule('cancel-expired-ecommerce-orders', '*/10 * * * *', ...)
```
