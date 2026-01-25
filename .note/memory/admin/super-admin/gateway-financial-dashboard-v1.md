# Memory: admin/super-admin/gateway-financial-dashboard-v1
Updated: just now

## Gateway Financial Dashboard no Super Admin

### Funcionalidade
- Nova aba "Receitas Gateway" no Super Admin → E-commerce
- Mostra visão completa de custos e lucros do processamento de pagamentos

### KPIs Exibidos
1. **GMV (30 dias)**: Volume total processado
2. **Receita Plataforma**: Soma dos splits tipo `platform_fee`
3. **Custo Gateway**: Taxas pagas ao Pagar.me (campo `gateway_fee_cents` em sales)
4. **Lucro Líquido**: Receita - Custos = Margem real

### Previsão de Recebimentos
- **PIX/Boleto**: D+1 (liquidação em 1 dia útil)
- **Cartão de Crédito**: D+30 (liquidação em 30 dias)
- Mostra valores pendentes por tipo de pagamento

### Detalhamento
- Tabela com breakdown por método de pagamento
- Lista das últimas vendas com custo de gateway e data de liquidação prevista

### Arquivos
- `src/components/super-admin/GatewayFinancialDashboard.tsx`: Componente principal
- `src/components/super-admin/SuperAdminNavigation.tsx`: Adicionado item de menu
- `src/pages/SuperAdmin.tsx`: Renderiza a aba

### Dados Utilizados
- `sales.gateway_fee_cents`: Custo cobrado pelo gateway
- `sale_splits` where `split_type = 'platform_fee'`: Receita da plataforma
- Cálculos baseados em `payment_confirmed_at` + dias de liquidação
