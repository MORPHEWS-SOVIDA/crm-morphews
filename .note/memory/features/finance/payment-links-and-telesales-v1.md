# Memory: features/finance/payment-link-and-telesales-v1
Updated: just now

## Sistema de Link de Pagamento e Televendas

### Rota e Menu
- **`/cobrar`**: Página principal (requer autenticação)
- Menu adicionado no Sidebar e MobileNav (grupo Financeiro)
- Controlado por permissões `payment_links_*` e feature `payment_links`

### Tabelas Criadas
- `payment_links`: Links de cobrança com slug único, valor fixo/livre, métodos habilitados
- `payment_link_transactions`: Registro de todas transações com status, taxas, data de liberação
- `payment_link_attempts`: Log de tentativas para auditoria e segurança

### Permissões no `user_permissions`
- `payment_links_create`: Criar links de pagamento
- `payment_links_view_transactions`: Ver transações
- `telesales_charge_card`: Cobrar cartão por telefone
- `bank_account_manage`: Cadastrar conta bancária para saque
- `withdrawal_request`: Solicitar saque

### Feature no Plano
- `payment_links` em `plan_features`

### Taxas Padrão (configurável por tenant)
- **Cartão**: 4,99% | D+15 | Juros parcelamento 2,69%/mês
- **PIX**: 0,99% + R$1,00 | D+1
- **Boleto**: 0,5% + R$4,00 | D+3

### Arquivos Principais
- `/src/pages/Cobrar.tsx`: Página principal com abas Links, Transações, Televendas, Carteira
- `/src/components/payment-links/PaymentLinksTab.tsx`: CRUD de links com QR Code
- `/src/components/payment-links/TransactionsTab.tsx`: Dashboard de transações
- `/src/components/payment-links/TelesalesTab.tsx`: Cobrança digitada de cartão
- `/src/components/payment-links/WalletTab.tsx`: Saldo, conta bancária, saques
- `/src/hooks/usePaymentLinks.ts`: Hooks para links e transações
- `/supabase/functions/process-payment-link/`: Processa pagamentos via Pagar.me V5

### Próximos Passos
1. Criar página pública `/pagar/:slug` para clientes pagarem
2. Configurar Super Admin para negociar taxas por tenant
3. Integrar botões de ação rápida em Add Receptivo e Vendas
