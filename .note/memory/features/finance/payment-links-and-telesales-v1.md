# Memory: features/finance/payment-link-and-telesales-v1
Updated: just now

## Sistema de Link de Pagamento e Televendas - COMPLETO

### Rotas
- **`/cobrar`**: Página principal (menu Financeiro)
- **`/pagar/:slug`**: Checkout público para clientes pagarem

### Componentes Criados
- `src/pages/PaymentLinkCheckout.tsx`: Checkout público com PIX, Boleto e Cartão
- `src/components/payment-links/QuickPaymentLinkButton.tsx`: Botão de ação rápida (gerar link)
- `src/components/payment-links/InlineTelesalesForm.tsx`: Dialog de venda digitada (cartão ao vivo)
- `src/components/payment-links/PaymentActionsBar.tsx`: Barra unificada com link + televendas

### Integrações
- Botão "Cobrar via Link" + "Cobrar Cartão" adicionados em:
  - `src/pages/AddReceptivo.tsx` (seção de pagamento - com valor total automático)
  - `src/pages/Sales.tsx` (cabeçalho)
  - `src/components/leads/LeadSalesSection.tsx` (detalhes do lead)

### Super Admin (já existentes)
- **Taxas Tenants** (`tenant-fees`): TenantPaymentFeesTab.tsx
- **Receitas Gateway** (`gateway-financial`): GatewayFinancialDashboard.tsx
- **Editor de Planos**: Feature `payment_links` já configurada

### Permissões
- `payment_gateways_manage`: Criar links de pagamento
- `telesales_manage`: Venda digitada de cartão
- `virtual_wallet_view`: Ver transações e carteira

### Taxas Padrão
- **Cartão**: 4,99% | D+15 | Juros 2,69%/mês
- **PIX**: 0,99% + R$1,00 | D+1
- **Boleto**: 0,5% + R$4,00 | D+3

### Fluxo Add Receptivo
1. Vendedor monta a venda normalmente
2. Na etapa "Pagamento", aparece barra com:
   - **Gerar Link**: Cria link com valor total preenchido
   - **Cobrar Cartão**: Abre formulário para digitar dados do cartão ao vivo
3. Ao aprovar pagamento, status muda automaticamente para "Já pagou"
