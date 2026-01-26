# Memory: features/finance/split-engine-v8-coproducer
Updated: just now

## Split Engine v3.1 - Suporte a Co-produtores Adicionado

### Participantes do Split (ordem de processamento)

| # | Participante | Fonte de Dados | Responsável por Estorno? | Hold Days |
|---|--------------|----------------|--------------------------|-----------|
| 1 | **Fábrica** | `product_factory_costs` | ❌ Não | Configurável |
| 2 | **Indústria** | `product_industry_costs` | ❌ Não | Imediato (0 dias) |
| 3 | **Plataforma** | `organization_split_rules` | ❌ Não | Configurável |
| 4 | **Co-produtor** | `coproducers` | ✅ Sim | = Afiliado |
| 5 | **Afiliado** | `affiliate_attributions` → `affiliates` | ✅ Sim | Configurável |
| 6 | **Tenant** | Restante após todos os splits | ✅ Sim | Configurável |

### Lógica de Co-produtor
- Baseado no produto vendido (`coproducers.product_id`)
- Percentual configurado em `coproducers.commission_percentage`
- Múltiplos co-produtores permitidos por produto
- Valor calculado sobre o `total_cents` do item, não da venda total
- Split type: `coproducer`

### Arquivos Modificados
- `supabase/functions/payment-webhook/split-engine.ts`
  - Adicionado `coproducer_amount` ao interface `SplitResult`
  - Adicionado STEP C.5 para processar co-produtores
  - Consulta `coproducers` com join em `virtual_accounts`

### Tabela `coproducers` (já existia)
```sql
CREATE TABLE public.coproducers (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES lead_products(id),
  virtual_account_id UUID REFERENCES virtual_accounts(id),
  commission_percentage NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE
);
```

### Exemplo de Cálculo
Venda de R$100.00 com produto que tem 10% de coprodução:
- Fábrica: R$20.00 (custos fixos)
- Indústria: R$15.00 (custos fixos)
- Plataforma: 4.99% + R$1 = R$5.99
- **Co-produtor: 10% de R$100 = R$10.00** ← NOVO
- Afiliado: 20% do restante = R$9.80
- Tenant: Restante = R$39.21

### Validação
Para testar, uma venda no tenant `thiago@sonatura.com.br` que tenha:
1. Produto com `coproducers` cadastrado
2. Indústria vinculada
3. Afiliado atribuído

Deve gerar 6 registros em `sale_splits` após pagamento confirmado.
