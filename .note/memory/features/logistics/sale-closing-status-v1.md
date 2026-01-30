# Memory: features/logistics/sale-closing-status-v1
Updated: just now

## Novos Status de Venda: Baixado e Finalizado

### Status da Venda (Ordem)
1. `draft` - Rascunho
2. `pending_expedition` - Aguardando Expedição
3. `dispatched` - Despachado
4. `delivered` - Entregue
5. `payment_pending` - Aguardando Pagamento
6. `payment_confirmed` - Pagamento Confirmado
7. **`closed`** - Baixado (NOVO)
8. **`finalized`** - Finalizado (NOVO)
9. `cancelled` - Cancelado
10. `returned` - Voltou / Reagendar

### Fluxo de Confirmação nos Fechamentos
Os fechamentos (Balcão, Motoboy, Transportadora) têm 2 etapas:

1. **Confirmar (Financeiro)** - Primeiro botão
   - Quem pode: Qualquer usuário com permissão `reports_view` (Financeiro)
   - Ação: Atualiza vendas do fechamento para status `closed`
   - Grava: `closed_at` e `closed_by` na tabela `sales`

2. **Confirmar Final** - Segundo botão
   - Quem pode: Apenas `thiago@sonatura.com.br`
   - Ação: Atualiza vendas do fechamento para status `finalized`
   - Grava: `finalized_at` e `finalized_by` na tabela `sales`

### Novas Colunas na Tabela `sales`
```sql
closed_at TIMESTAMP WITH TIME ZONE
closed_by UUID REFERENCES auth.users(id)
finalized_at TIMESTAMP WITH TIME ZONE
finalized_by UUID REFERENCES auth.users(id)
```

### Componente SaleClosingInfoCard
- Localização: `src/components/sales/SaleClosingInfoCard.tsx`
- Exibido na página de detalhes da venda (`/vendas/{id}`)
- Mostra: número do fechamento, tipo (Balcão/Motoboy/Transportadora), status, quem confirmou

### Relatório de Vendas (/relatorios/vendas)
Colunas de auditoria atualizadas:
- **Baixado?** - Se a venda está em algum fechamento
- **Financeiro?** - Se foi confirmado por usuário Financeiro (antes era "Auxiliar?")
- **Thiago?** - Se foi confirmado por Thiago

### Arquivos Modificados
- `src/hooks/useSales.ts` - Adicionados tipos `closed` e `finalized`
- `src/hooks/useSaleClosingStatus.ts` - Atualizado para usar `confirmedByFinanceiro`
- `src/hooks/usePickupClosings.ts` - Lógica de atualização de status das vendas
- `src/hooks/useDeliveryClosings.ts` - Lógica de atualização de status das vendas
- `src/pages/PickupClosing.tsx` - Verificação de permissão `reports_view`
- `src/pages/DeliveryClosing.tsx` - Verificação de permissão `reports_view`
- `src/pages/SaleDetail.tsx` - Adicionado SaleClosingInfoCard
- `src/components/reports/SalesDetailedReport.tsx` - Atualizado labels
