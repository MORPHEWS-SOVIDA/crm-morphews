# Memory: features/ecommerce/checkout-engine-v2-schema
Updated: just now

## Arquitetura de Pagamentos Centralizada (Modelo Kiwify)

### Modelo de Negócio
- **Gateways são 100% Super Admin**: Apenas a plataforma configura os gateways (Pagarme, Appmax, Stripe, Asaas)
- A plataforma recebe TODOS os pagamentos e faz split automático para tenants/afiliados/indústrias

### Taxa da Plataforma
- **Padrão**: 4.99% + R$1.00 por venda
- Configurável por tenant em `tenant_payment_fees`

### Taxas por Modalidade de Pagamento
- **Cartão**: 3.99% + R$1.00 | D+3 dias
- **PIX**: 1.99% + R$0.00 | D+1 dia
- **Boleto**: 1.99% + R$4.00 | D+1 dia

### Reserva de Segurança
- 10% por 15 dias (configurável em `platform_settings.withdrawal_rules`)

### Sistema de Indústrias (NOVO)
- Fornecedores/fábricas que recebem valor FIXO por unidade vendida
- Tabelas: `industries`, `product_industry_costs`
- Custos por produto: `unit_cost_cents`, `shipping_cost_cents`, `additional_cost_cents`

### Ordem de Split (pagamento confirmado)
1. **Plataforma**: 4.99% + R$1.00
2. **Indústria**: Valor fixo × quantidade vendida
3. **Afiliado**: % sobre venda bruta
4. **Tenant**: Resto vai para saldo do lojista

### Exemplo de Cálculo
Venda de R$100.00:
- Plataforma: 4.99% + R$1 = R$5.99
- Indústria: R$30 (produto) + R$15 (frete) + R$10 (adicional) = R$55.00
- Afiliado: 20% de R$100 = R$20.00
- Tenant: R$100 - R$5.99 - R$55 - R$20 = R$19.01

### UI Implementada
- `/super-admin` → Aba "Gateways": Configuração dos provedores de pagamento
- `/super-admin` → Aba "Taxas": Taxas por tenant (PIX, Cartão, Boleto, parcelamento)
- `/ecommerce` → Aba "Indústrias": CRUD de fornecedores + custos por produto
- `/ecommerce` → Removida aba "Gateways" (agora só no Super Admin)

### Tabelas Principais
- `platform_gateway_config`: Gateways globais com credenciais
- `tenant_payment_fees`: Taxas customizadas por organização
- `industries`: Cadastro de indústrias/fornecedores
- `product_industry_costs`: Custo por produto × indústria
- `payment_attempts`: Log de tentativas de pagamento
- `saved_payment_methods`: Card on File para one-click
- `gateway_fallback_config`: Fallback por método de pagamento
