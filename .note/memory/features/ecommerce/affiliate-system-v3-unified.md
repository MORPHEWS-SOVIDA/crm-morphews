# Memory: features/ecommerce/affiliate-system-v3-unified
Updated: just now

## Sistema de Afiliados - Arquitetura Completa (2026-01-29)

### Duas Tabelas de Afiliados

| Tabela | Prefixo Código | Uso | Onde é criado |
|--------|----------------|-----|---------------|
| `organization_affiliates` | `AFF...` | V2 (atual) - Usado pelo Editor Visual de Checkout | Aba Afiliados no checkout |
| `partner_associations` | `P...` | V1 (legado) - Sistema de convites | Aceite de convite ou criação manual |

### Fluxo de Visibilidade dos Links (CORRIGIDO)

```
1. Admin abre checkout → Aba "Afiliados"
2. Adiciona parceiro por email/seleção
   └── Cria registro em `checkout_affiliate_links`
        (FK → organization_affiliates.id)

3. Parceiro acessa /ecommerce → "Meus Links"
4. Hook useAffiliateAvailableOffers():
   ├── Busca organization_affiliates.user_id = auth.uid()
   ├── Busca checkout_affiliate_links.affiliate_id = oa.id
   │     └── RLS: "Affiliates can view own checkout links" ✅
   └── Retorna lista com links ?ref=AFFCODE

5. Hook useMyAffiliateCode():
   ├── Prioriza código V2 (AFF...) de organization_affiliates
   └── Fallback para V1 (P...) de partner_associations
```

### Políticas RLS da Tabela checkout_affiliate_links

| Política | Operação | Quem pode |
|----------|----------|-----------|
| `Org admins can manage checkout affiliates` | ALL | owner/admin da org |
| `Affiliates can view own checkout links` | SELECT | afiliado via user_id |

### Sincronização Automática de user_id

Triggers garantem que `organization_affiliates.user_id` seja preenchido:

1. **sync_va_user_to_affiliates** - Quando virtual_accounts.user_id é setado
2. **sync_profile_to_affiliates_trigger** - No primeiro login (INSERT em profiles)

Match por email: Se o email do profiles.email = organization_affiliates.email, o user_id é sincronizado.

### Cálculo de Comissão (Split Engine)

```
Base = Subtotal - Taxa Plataforma (4.99%)
Comissão = Base × % afiliado
```

Exemplo: R$29,02 → Base R$27,57 → 15% = R$4,13

### Diagnóstico Comum

**"Afiliado adicionado ao checkout mas não vê links":**
1. Verificar se `organization_affiliates.user_id` está preenchido
2. Se não estiver, rodar:
   ```sql
   UPDATE organization_affiliates 
   SET user_id = (SELECT user_id FROM profiles WHERE email = organization_affiliates.email LIMIT 1)
   WHERE user_id IS NULL AND email IN (SELECT email FROM profiles);
   ```

**Código exibido é P... ao invés de AFF...:**
- Usuário tem registro no sistema legado
- Hook `useMyAffiliateCode` agora prioriza V2
