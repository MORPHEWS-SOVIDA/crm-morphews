# Memory: features/ecommerce/affiliate-link-visibility-v2
Updated: just now

## Visibilidade de Links de Afiliados (Correção 2026-01-29)

### Problema Resolvido
Mesmo após vincular afiliados a checkouts via a aba **Afiliados** no Editor Visual, os links não apareciam no painel do parceiro ("Meus Links").

**Causa raiz**: A tabela `checkout_affiliate_links` possuía RLS apenas para admins da org (FOR ALL). Afiliados não conseguiam ler seus próprios vínculos.

### Correção Aplicada
Nova política adicionada:

```sql
CREATE POLICY "Affiliates can view own checkout links"
  ON public.checkout_affiliate_links
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_affiliates oa
      WHERE oa.id = checkout_affiliate_links.affiliate_id
        AND oa.user_id = auth.uid()
        AND oa.is_active = true
    )
  );
```

### Fluxo Correto Agora

1. **Admin** abre checkout → Aba "Afiliados" → Adiciona parceiro (cria registro em `checkout_affiliate_links`)
2. **Parceiro** acessa `/ecommerce` → "Meus Links"
3. Hook `useAffiliateAvailableOffers`:
   - Busca `organization_affiliates` onde `user_id = auth.uid()` ✅
   - Busca `checkout_affiliate_links` filtrando pelo `affiliate_id` encontrado ✅ (agora RLS permite)
   - Retorna lista de checkouts com link `?ref=AFFCODE`
4. **Painel** exibe os links para copiar

### Tabelas Envolvidas

| Tabela | Permissão Afiliado |
|--------|-------------------|
| `organization_affiliates` | SELECT próprio registro (user_id = auth.uid()) |
| `checkout_affiliate_links` | SELECT próprios vínculos (via affiliate_id → user_id) |
| `standalone_checkouts` | SELECT públicos (is_active = true) |
| `lead_products` | SELECT públicos (ecommerce_enabled = true) |

### Sincronização de user_id
Os triggers existentes (`sync_va_user_to_affiliates`, `sync_profile_to_affiliates_trigger`) garantem que `organization_affiliates.user_id` seja preenchido automaticamente no primeiro login do parceiro, desde que o e-mail confira.
