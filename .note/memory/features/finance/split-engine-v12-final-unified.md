# Memory: features/finance/split-engine-v12-final-unified
Updated: just now

## Motor de Divisão (Split Engine) v3.3 - CORREÇÕES CRÍTICAS

### MUDANÇAS CRÍTICAS (2026-01-28)
1. **Base de Cálculo**: `subtotal_cents` (sem juros) é usado como base para TODOS os cálculos
2. **Factory ID**: Adicionada coluna `factory_id` na tabela `sale_splits`
3. **Coproducer**: Adicionado tipo `coproducer` na constraint `split_type_check`

### Lógica de Cálculo (Exemplo: Venda R$ 17,00 parcelada)
```
Total Cobrado = R$ 17,59 (com juros de R$ 0,59)
Base = R$ 17,00 (subtotal_cents, SEM juros)
Juros = R$ 0,59 (NINGUÉM recebe comissão sobre isso)

1. Fábrica = R$ 7,00 (fixo por unidade)
2. Indústria = R$ 2,00 (fixo por unidade)
3. Taxa Plataforma = 4,99% de R$ 17,00 + R$ 1,00 = R$ 1,85
4. Co-produtor (5%) = 5% de R$ 17,00 = R$ 0,85
5. Afiliado (15%) = 15% de (R$ 17,00 - R$ 1,85) = R$ 2,27
6. Tenant = R$ 17,00 - R$ 7,00 - R$ 2,00 - R$ 1,85 - R$ 0,85 - R$ 2,27 = R$ 3,03
```

### Hierarquia de Processamento
1. **Fábrica**: Custos fixos/unitários, prioridade máxima (priority=1), sem responsabilidade por estorno
2. **Indústria**: Custos fixos/unitários, liberação imediata, sem responsabilidade por estorno
3. **Plataforma**: 4,99% + R$1,00 sobre `baseCents`, sem responsabilidade por estorno
4. **Co-produtor**: % sobre `baseCents` (valor item), responsável por estorno
5. **Afiliado**: % sobre `baseForAffiliateCommission` (base - plataforma), responsável por estorno
6. **Tenant**: Restante após todos os splits, responsável por estorno

### Receita de Juros
- Campo "Receita Juros" adicionado ao Super Admin → Gateway
- Calculado como: `SUM(total_cents - subtotal_cents)` para vendas pagas
- Esta receita vai direto para a plataforma, sem divisão

### Bugs Corrigidos (2026-01-28)
- `factory_id` não existia em `sale_splits` → INSERT falhava silenciosamente
- `coproducer` não estava na constraint `split_type_check` → INSERT falhava
- Fallback para `ecommerce_order_items` quando `sale_items` está vazio

### Arquivos Modificados
- `supabase/functions/payment-webhook/split-engine.ts`: Usa `baseCents = sale.subtotal_cents`
- `src/components/ecommerce/OrderFinancialBreakdown.tsx`: Mostra juros separadamente
- `src/components/super-admin/GatewayFinancialDashboard.tsx`: Card "Receita Juros"
