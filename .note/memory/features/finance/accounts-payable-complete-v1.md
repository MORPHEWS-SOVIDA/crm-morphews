# Memory: features/finance/accounts-payable-complete-v1
Updated: just now

## Módulo Financeiro Completo (Padrão ERP)

### Tabelas Criadas
- `suppliers`: Cadastro de fornecedores com dados bancários e PIX
- `bank_accounts`: Contas bancárias da organização com saldo
- `financial_categories`: Plano de contas (receitas/despesas)
- `accounts_payable`: Contas a pagar com vencimentos, parcelas, aprovação
- `financial_approval_rules`: Regras de alçada por valor
- `bank_transactions`: Transações para conciliação OFX
- `ofx_imports`: Histórico de importações OFX

### Funcionalidades
1. **Contas a Pagar**: CRUD completo com filtros por status, fornecedor, período
2. **Extração de Duplicatas**: Parser XML extrai `<dup>` tags automaticamente
3. **Aprovação por Valor**: Trigger verifica `financial_approval_min_cents` na org
4. **Conciliação OFX**: Parser client-side para arquivos bancários
5. **Saldo Automático**: Trigger atualiza `current_balance_cents` ao conciliar

### Hooks Criados
- `useAccountsPayable.ts`: CRUD, confirmação, aprovação
- `useSuppliers.ts`: CRUD fornecedores
- `useBankAccounts.ts`: Contas, transações, import OFX
- `useFinancialCategories.ts`: Plano de contas
- `usePurchaseInvoices.ts`: Adicionado `useGeneratePayablesFromInvoice`

### Componentes
- `PayablesTab.tsx`: Listagem e gestão de contas a pagar
- `PayableFormDialog.tsx`: Formulário nova/editar conta
- `PayableDetailDialog.tsx`: Detalhes e ações
- `ConfirmPayableDialog.tsx`: Confirmação com desconto/juros
- `SuppliersManager.tsx`: CRUD fornecedores
- `BankAccountsManager.tsx`: Contas + import OFX

### Página Atualizada
`/financeiro` agora tem 8 abas:
1. A Receber
2. A Pagar (NOVO)
3. Fluxo de Caixa
4. Conciliação
5. Contas Bancárias (NOVO)
6. Fornecedores (NOVO)
7. Centros de Custo
8. Relatórios

### Fluxo NF-e → Contas a Pagar
1. Importar XML via `/produtos/notas-entrada`
2. Parser extrai duplicatas (`installments`)
3. `useGeneratePayablesFromInvoice` cria contas a pagar
4. Contas aparecem na aba "A Pagar" do Financeiro
