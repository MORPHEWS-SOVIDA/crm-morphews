# Memory: features/ecommerce/affiliate-link-visibility-v1
Updated: just now

## Visibilidade de Links de Afiliados

### Modelo de Acesso (Corrigido 2026-01-28)

Afiliados só veem links para checkouts/landings **explicitamente vinculados** a eles:

1. **Via Redes de Afiliados** (`affiliate_networks`)
   - Admin cria rede, vincula checkouts, afiliados entram na rede
   - Afiliados veem todos os checkouts da rede

2. **Via Vínculo Individual** (`checkout_affiliate_links`)
   - Afiliado entra por convite direto (sem rede)
   - Começa com **0 links disponíveis**
   - Admin vai no checkout → Afiliados → Adiciona o afiliado
   - Só então o link aparece no painel do parceiro

### Fluxo de Dados

```
useAffiliateAvailableOffers()
  ├── 1. Verifica affiliate_network_members (redes)
  │     └── Se tem → busca checkouts via affiliate_network_checkouts
  │
  ├── 2. Verifica organization_affiliates.user_id
  │     └── Se tem → busca vínculos via checkout_affiliate_links
  │
  └── 3. Fallback: partner_associations (legado)
        └── Só mostra checkouts com linked_checkout_id específico
```

### Sincronização Automática de user_id

Triggers criados para garantir que `organization_affiliates.user_id` seja preenchido automaticamente:

1. **`sync_va_user_to_affiliates`** - Quando `virtual_accounts.user_id` é atualizado
2. **`sync_profile_to_affiliates_trigger`** - Quando usuário faz primeiro login (INSERT em profiles)

### Tabelas Envolvidas

| Tabela | Função |
|--------|--------|
| `organization_affiliates` | Registro canônico do afiliado (email, código AFF..., user_id) |
| `checkout_affiliate_links` | Vínculo afiliado ↔ checkout específico |
| `affiliate_network_members` | Vínculo afiliado ↔ rede |
| `affiliate_network_checkouts` | Vínculo rede ↔ checkout |
| `partner_associations` | Sistema legado (códigos P...) |
