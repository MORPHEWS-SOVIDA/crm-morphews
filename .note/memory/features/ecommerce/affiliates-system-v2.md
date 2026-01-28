# Memory: features/ecommerce/affiliates-system-v2
Updated: just now

## Sistema de Afiliados V2 - Estrutura Limpa

### Problema Anterior
O sistema antigo usava `partner_associations` com `virtual_accounts`, que tinha problemas de:
- Lógica complexa de deduplicação
- Registros duplicados por checkout
- Dificuldade em carregar afiliados no modal "Adicionar"
- Múltiplas tabelas interdependentes (partner_invitations, partner_applications, etc.)

### Nova Estrutura

**Tabela `organization_affiliates`**
- Registro canônico de cada afiliado por organização
- Campos: id, organization_id, email (único por org), name, phone, affiliate_code (auto-gerado), default_commission_type, default_commission_value, is_active, user_id (opcional)
- Trigger auto-gera código `AFF + 6 chars MD5`

**Tabela `checkout_affiliate_links`**
- Vínculo direto afiliado ↔ checkout
- Campos: id, checkout_id, affiliate_id, organization_id, commission_type, commission_value
- Constraint UNIQUE(checkout_id, affiliate_id)

### Hooks (useOrganizationAffiliatesV2.ts)
- `useOrganizationAffiliatesV2()` - Lista todos afiliados ativos da org
- `useCheckoutAffiliatesV2(checkoutId)` - Lista afiliados vinculados a um checkout
- `useCreateAffiliate()` - Cria novo afiliado
- `useLinkAffiliateToCheckoutV2()` - Vincula afiliado existente ao checkout
- `useUnlinkAffiliateFromCheckoutV2()` - Remove vínculo
- `useFindAffiliateByEmail()` - Busca afiliado por email

### UI (CheckoutAffiliatesTab.tsx)
Modal com 3 abas:
1. **Selecionar** - Dropdown com afiliados existentes não vinculados
2. **Buscar por E-mail** - Input para buscar afiliado já cadastrado
3. **Novo Afiliado** - Form para cadastrar e vincular em um passo

### Migração
As tabelas antigas (`partner_associations`, `affiliates`, `virtual_accounts` para afiliados) continuam existindo mas não são mais usadas para a funcionalidade de checkout. Os novos cadastros usam exclusivamente as tabelas V2.
