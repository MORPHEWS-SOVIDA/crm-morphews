# Memory: admin/super-admin/gateway-financial-dashboard-v5
Updated: now

## Melhorias no Gateway Financial Dashboard

### Nova Aba "Detalhado"
Adicionada como tab principal com visão completa de custos e lucros por venda.

### Cards de Resumo
1. **Valor Autorizado**: Total processado (soma das vendas pagas)
2. **Processamento Gateway**: Custo estimado do Pagar.me (~0.88% + R$ 0,09 por transação)
3. **Antecipação Est.**: Custo de antecipação para cartão (~1.5%/mês para D+30→D+2)
4. **Ganho Gateway**: Taxa plataforma (4.99% + R$1,00 para cartão)
5. **Lucro Juros**: Receita de parcelamento (integral para plataforma)
6. **Lucro Total**: Ganho Gateway + Juros - Custos

### Cards de Custos de Parceiros
- Custo Afiliados
- Custo Co-produtores
- Custo Indústrias
- Custo Fábricas

### Tabela Detalhada por Venda
Colunas:
- Pedido, Data, Origem, Método, Parcelas
- Valor, Juros
- Gateway (custo processamento)
- Afiliado, Co-prod, Indústria, Fábrica (custos de split)
- Plataforma (taxa nossa)
- Lucro (plataforma + juros)
- Link Pagar.me (clicável, abre no dashboard do gateway)
- Botão Ver (detalhes da venda)

### Exportação CSV
Botão "Exportar CSV" gera arquivo com todos os dados incluindo:
- Todos os valores financeiros
- Link completo do Pagar.me para cada transação
- ID de transação do gateway

### Link Pagar.me
Formato: `https://dash.pagar.me/{merchant_id}/{account_id}/charges/{charge_id}`
- Para transações `ch_*`: /charges/
- Para transações `or_*`: /orders/

### Arquivos
- `src/components/super-admin/GatewayDetailedTable.tsx`: Novo componente
- `src/components/super-admin/GatewayFinancialDashboard.tsx`: Integração da nova tab

### Constantes Configuráveis
```typescript
PAGARME_MERCHANT_ID = 'merch_WrgRKV8tGubALlPe'
PAGARME_ACCOUNT_ID = 'acc_40nvZdeuVSn03aQB'
PLATFORM_FEE_PERCENTAGE = 4.99
PLATFORM_FEE_FIXED_CENTS = 100
ANTICIPATION_RATE_MONTHLY = 1.5
```
