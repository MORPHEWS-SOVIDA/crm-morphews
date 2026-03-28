# Memory: features/finance/split-engine-v4-cost-centers
Updated: 2026-03-28

## Split Engine v4.1 - Modelo de Centros de Custo + Gerente de Afiliados

### Nova Arquitetura (substitui v3.x)
O co-produtor agora recebe **percentual do lucro líquido**, não valor fixo.
O gerente de afiliados recebe **percentual sobre remaining** antes do coprodutor.

### Contas de Custo (virtual_accounts type='cost_center')
| Conta | Email | ID | Função |
|-------|-------|----|--------|
| Pagarme | pagarme@sonatura.com.br | a0000001-...-000000000001 | Juros de parcelamento |
| Correios | correio@sonatura.com.br | a0000001-...-000000000002 | Frete real + R$7 picking |
| Farmácia | farmacia@sonatura.com.br | a0000001-...-000000000003 | cost_cents dos produtos |
| Imposto | imposto@sonatura.com.br | a0000001-...-000000000004 | 12% sobre subtotal |

### Ordem de Processamento (Split Engine v4.1)
1. **Juros** → pagarme (total - subtotal, NÃO entra no remaining)
2. **Plataforma** → Morphews (4.99% + R$1 sobre subtotal)
3. **Imposto** → imposto (12% do subtotal)
4. **Frete + Picking** → correio (shipping_cost_real_cents + R$700)
5. **Custo Produção** → farmacia (cost_cents × qty por item)
6. **Afiliado** → % sobre remaining
7. **Gerente de Afiliados** → % sobre remaining (configurado por loja em tenant_storefronts)
8. **Co-produtor** → 50% do lucro líquido (remaining após tudo acima)
9. **Tenant** → restante

### Fórmula
```
Lucro Líquido = Subtotal - Plataforma - Imposto(12%) - Frete+Picking - Custo Produto - Afiliado - Gerente Afiliados
Co-produtor = 50% × Lucro Líquido
Tenant = 50% × Lucro Líquido
```

### Split Types Disponíveis
`tenant`, `platform_fee`, `affiliate`, `industry`, `factory`, `gateway_fee`, `coproducer`, `interest`, `tax`, `shipping`, `product_cost`, `affiliate_manager`

### Gerentes de Afiliados (por loja)
Configurados em `tenant_storefronts.affiliate_manager_account_id` + `affiliate_manager_percent`
- camila@vvero.store → 5% (loja Vvero)
- Se não tem gerente configurado, step é ignorado (0%)

### Todos os Co-produtores
- Todos configurados com `commission_type = 'percentage'`, `commission_percentage = 50`
- juliana@rytmovida.com.br (RytmoVida)
- luciana@nutricell.com.br (Nutricell)
- tiago@balestrero.com.br (Balestrero)
- eduardo@shapefy.shop (Shapefy)
- matoso@vvero.store (Vvero)
