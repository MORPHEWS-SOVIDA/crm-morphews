# Memory: features/logistics/expedition-checkpoint-permissions-v1
Updated: just now

## Permissão de Desmarcar Etapas de Expedição

### Nova Permissão: `sales_uncheck_checkpoint`
- Controla quem pode DESMARCAR etapas de expedição (Impresso, Pedido Separado, Despachado, Entregue)
- Por padrão, apenas owners e admins têm essa permissão
- Configurável em **Equipe > Permissões > Desmarcar Etapas Expedição**

### Regras de Editabilidade de Vendas
Uma venda só pode ser editada (alterar turno, data, produtos, vendedor, etc.) quando:
1. Status é `draft` (rascunho) OU
2. Status é `returned` (voltou) OU
3. Status é `pending_expedition` E `expedition_validated_at` é NULL

### Fluxo de Expedição
- **Marcar**: Requer permissões específicas (sales_mark_printed, sales_validate_expedition, sales_dispatch, sales_mark_delivered)
- **Desmarcar**: Requer a permissão `sales_uncheck_checkpoint`
- Quando desmarcado, a venda volta para status editável e o vendedor pode reagendar

### Componentes Atualizados
- `src/hooks/useUserPermissions.ts`: Interface e labels da nova permissão
- `src/components/sales/SaleCheckpointsCard.tsx`: Verificação de permissão no handleToggle
- `src/components/team/UserPermissionsEditor.tsx`: Checkbox aparece automaticamente no grupo "Vendas"

### Migração Aplicada
```sql
ALTER TABLE public.user_permissions
ADD COLUMN IF NOT EXISTS sales_uncheck_checkpoint boolean NOT NULL DEFAULT false;
```
