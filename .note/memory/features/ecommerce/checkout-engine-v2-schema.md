# Memory: features/ecommerce/checkout-engine-v2-schema
Updated: just now

## Etapa 1 Completa: Schema + Config Super Admin

### Tabelas Criadas
- `platform_gateway_config`: Gateways globais (Pagarme, Appmax, Stripe, Asaas) com credenciais, prioridade e modo sandbox
- `tenant_payment_fees`: Taxas por organização (PIX, Cartão, Boleto) com parcelamento configurável
- `payment_attempts`: Log de tentativas de pagamento para analytics e fallback tracking
- `saved_payment_methods`: Card on File para one-click upsell/cross-sell
- `payment_admin_actions`: Log de ações administrativas (reprocessar, antifraude, estorno)
- `gateway_fallback_config`: Configuração de fallback por método de pagamento

### UI Super Admin
- `/super-admin` → Aba "Gateways": Configuração dos provedores de pagamento da plataforma
- `/super-admin` → Aba "Taxas": Configuração de taxas por tenant (PIX, Cartão, Boleto, parcelamento)

### Próximas Etapas
1. **Etapa 2**: Checkout Engine + Fallback (Edge Function com retry automático)
2. **Etapa 3**: Card on File + One-Click (Salvar cartões para upsell)
3. **Etapa 4**: Televendas Panel (Reprocessar pagamentos, liberar antifraude)
