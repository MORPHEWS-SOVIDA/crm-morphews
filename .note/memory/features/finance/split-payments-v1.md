# Memory: features/finance/split-payments-v1
Updated: just now

## Pagamento Dividido (Split Payment)

### Tabela: `sale_payments`
Armazena múltiplas formas de pagamento por venda. Campos: `payment_method_id`, `payment_method_name`, `amount_cents`, `notes`, dados de conciliação (transaction_date, card_brand, transaction_type, nsu_cv, acquirer_id, installments), `created_by`, `updated_by`. FK para `sales(id)` com CASCADE e `payment_methods(id)`.

### Componentes
- **`SplitPaymentEditor`** (`src/components/sales/SplitPaymentEditor.tsx`): Editor reutilizável de linhas de pagamento com botão "+Adicionar forma de pagamento", validação de balanço (total informado vs total da venda), e opção de editar o total (para baixas com desconto/acréscimo).
- **`PaymentConfirmationDialog`** (`src/components/sales/PaymentConfirmationDialog.tsx`): Refatorado para usar `SplitPaymentEditor` em vez de seleção única. Suporta `allowTotalEdit` para telas de baixa. Retorna `payment_lines[]` e `adjusted_total_cents`.

### Hooks
- **`useSalePayments(saleId)`**: Query para ler linhas de pagamento de uma venda.
- **`useSaveSalePayments()`**: Mutation que deleta linhas existentes e insere novas (replace all strategy).

### Integração
- **Add Receptivo**: Toggle "Dividir pagamento" alterna entre seleção única e `SplitPaymentEditor`. Linhas salvas em `sale_payments` após criação da venda. O `payment_method_id` principal da venda é definido pela linha de maior valor.
- **SaleDetail**: Exibe linhas de pagamento dividido no card de informações. Dialog de confirmação de pagamento usa `SplitPaymentEditor` com `allowTotalEdit=true`.
- **Baixas (PickupClosing/DeliveryClosing)**: Herdam o dialog atualizado via SaleDetail workflow.

### Financeiro
Os relatórios podem consultar `sale_payments` para quebra exata por método. A coluna `payment_method` na tabela `sales` mantém o método principal para retrocompatibilidade.
