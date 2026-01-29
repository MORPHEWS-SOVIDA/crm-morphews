# Memory: features/finance/payment-link-and-telesales-v1
Updated: just now

## Sistema de Link de Pagamento e Televendas - COMPLETO

### Rotas
- **`/cobrar`**: Página principal (menu Financeiro)
- **`/pagar/:slug`**: Checkout público para clientes pagarem

### Componentes Criados
- `src/pages/PaymentLinkCheckout.tsx`: Checkout público com PIX, Boleto e Cartão
- `src/components/payment-links/QuickPaymentLinkButton.tsx`: Botão de ação rápida

### Integrações
- Botão "Cobrar via Link" adicionado em:
  - `src/pages/Sales.tsx` (cabeçalho)
  - `src/components/leads/LeadSalesSection.tsx` (detalhes do lead)

### Super Admin (já existentes)
- **Taxas Tenants** (`tenant-fees`): TenantPaymentFeesTab.tsx
- **Receitas Gateway** (`gateway-financial`): GatewayFinancialDashboard.tsx
- **Editor de Planos**: Feature `payment_links` já configurada

### Permissões
- `payment_links_create`, `payment_links_view_transactions`
- `telesales_charge_card`, `bank_account_manage`, `withdrawal_request`

### Taxas Padrão
- **Cartão**: 4,99% | D+15 | Juros 2,69%/mês
- **PIX**: 0,99% + R$1,00 | D+1
- **Boleto**: 0,5% + R$4,00 | D+3
