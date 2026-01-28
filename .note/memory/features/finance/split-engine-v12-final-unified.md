# Memory: features/finance/split-engine-v12-final-unified
Updated: just now

## Motor de Divisão (Split Engine) v3.2 - CORREÇÃO CRÍTICA DE BASE

### MUDANÇA CRÍTICA (2026-01-28)
**O Split Engine agora usa `subtotal_cents` (sem juros) como base para TODOS os cálculos!**

- **ANTES**: Usava `total_cents` (incluindo juros de parcelamento) ❌
- **AGORA**: Usa `subtotal_cents` (valor base do produto) ✓

### Lógica de Cálculo Corrigida
Exemplo: Venda R$ 29,02 parcelada (total cobrado R$ 31,19 com juros):

```
Base = R$ 29,02 (subtotal_cents, SEM juros)
Juros = R$ 2,17 (NINGUÉM recebe comissão sobre isso)

1. Taxa Plataforma = 4,99% de R$ 29,02 + R$ 1,00 = R$ 2,45
2. Base Líquida = R$ 29,02 - R$ 2,45 = R$ 26,57
3. Afiliado (15%) = 15% de R$ 26,57 = R$ 3,99
4. Co-produtor (5%) = 5% de R$ 29,02 = R$ 1,45
5. Fábrica = R$ 7,00 (fixo por unidade)
6. Indústria = R$ 2,00 (fixo por unidade)
7. Tenant = R$ 29,02 - R$ 2,45 - R$ 3,99 - R$ 1,45 - R$ 7,00 - R$ 2,00 = R$ 12,13
```

### Hierarquia de Processamento
1. **Fábrica**: Custos fixos/unitários, prioridade máxima, sem responsabilidade por estorno
2. **Indústria**: Custos fixos/unitários, liberação imediata, sem responsabilidade por estorno
3. **Plataforma**: 4,99% + R$1,00 sobre `baseCents`, sem responsabilidade por estorno
4. **Co-produtor**: % sobre `baseCents` (valor item), responsável por estorno
5. **Afiliado**: % sobre `baseForAffiliateCommission` (base - plataforma), responsável por estorno
6. **Tenant**: Restante após todos os splits, responsável por estorno

### Receita de Juros (NOVA)
- Campo "Receita Juros" adicionado ao Super Admin → Gateway
- Calculado como: `SUM(total_cents - subtotal_cents)` para vendas pagas
- Esta receita vai direto para a plataforma, sem divisão

### Arquivos Modificados
- `supabase/functions/payment-webhook/split-engine.ts`: Usa `baseCents = sale.subtotal_cents`
- `src/components/super-admin/GatewayFinancialDashboard.tsx`: Card "Receita Juros"

### Validação de Próximo Teste
Para validar a correção, fazer uma venda parcelada e verificar:
1. Splits calculados sobre `subtotal_cents` (sem juros)
2. `totalInterestRevenue` aparece no Super Admin
3. Afiliado/Co-produtor/Tenant recebem valores corretos
