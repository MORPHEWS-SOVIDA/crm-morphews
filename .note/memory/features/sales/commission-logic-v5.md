# Memory: features/sales/commission-logic-v5
Updated: just now

## Lógica de Comissões e Elegibilidade

### Nova Regra (v5)
A comissão só é considerada **"A Pagar"** quando a venda atinge o status **`finalized`** (Finalizado).

### Fluxo de Status para Comissão
1. `draft` → `pending_expedition` → `dispatched` → `delivered` → `closed` → **`finalized`**
2. Apenas vendas com `status === 'finalized'` contam para comissões pagas
3. Todos os outros status são considerados "Pendente"

### Arquivos Atualizados
- `src/components/dashboard/SellerSalesList.tsx` - SalesSummary usa `isFinalized`
- `src/hooks/useSellerDashboard.ts` - Query busca `status = 'finalized'` e `finalized_at`
- `src/hooks/useTeamDashboard.ts` - Mesma lógica para dashboard de equipe
- `src/components/reports/CommissionReport.tsx` - Separação paidCommission vs pendingCommission

### Base de Cálculo
O sistema continua garantindo que o frete seja excluído da base de cálculo de comissões. A hierarquia de cálculo permanece:
1. Regra do Kit de Produto (commission_percentage_override)
2. Percentual padrão do vendedor
