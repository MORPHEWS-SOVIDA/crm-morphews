# Memory: features/finance/payment-links-and-telesales-v1
Updated: just now

## Sistema de Link de Pagamento e Televendas

### Tabelas Criadas
- `payment_links`: Links de cobrança com slug único, valor fixo/livre, métodos habilitados
- `payment_link_transactions`: Registro de todas transações com status, taxas, data de liberação
- `payment_link_attempts`: Log de tentativas para auditoria e segurança

### Novas Colunas em Tabelas Existentes
- `user_permissions`: `payment_links_create`, `payment_links_view_transactions`, `telesales_charge_card`, `bank_account_manage`, `withdrawal_request`
- `tenant_payment_fees`: `payment_link_enabled`, `telesales_enabled`, `daily_transaction_limit_cents`, `max_transaction_cents`
- `plan_features`: Nova feature key `payment_links`

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

### Rota
- `/cobrar`: Página principal (requer autenticação)
- `/pagar/:slug`: Checkout público do link (a implementar)

### Permissões
- `payment_gateways_manage`: Criar/editar links
- `virtual_wallet_view`: Ver transações e carteira
- `telesales_manage`: Realizar cobranças televendas

### Próximos Passos
1. Criar página pública `/pagar/:slug` para clientes pagarem
2. Adicionar item no menu lateral principal
3. Configurar Super Admin para negociar taxas por tenant
4. Integrar botões de ação rápida em Add Receptivo e Vendas
