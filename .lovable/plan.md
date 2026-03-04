

## Rebranding: Substituir logo Morphews pelo logo Atomic Sales

### O que será feito

1. **Copiar os 2 logos enviados** para `src/assets/`:
   - `atomic-sales-2.png` → `src/assets/logo-atomic-dark.png` (logo claro, para tema escuro)
   - `Design_sem_nome_26-2.png` → `src/assets/logo-atomic-light.png` (logo escuro, para tema claro)

2. **Substituir imports em ~10 arquivos** que hoje importam `logo-morphews.png`:
   - `Login.tsx`, `ResetPassword.tsx`, `AuthError.tsx`, `NotFound.tsx`, `ForcePasswordChange.tsx`, `WhiteLabelLogin.tsx` — trocar import para `logo-atomic-light.png`
   - `Sidebar.tsx`, `MobileNav.tsx`, `LayoutMinimal.tsx`, `CustomDomainRedirect.tsx` — trocar import para `logo-atomic-light.png` (com suporte a tema escuro via `logo-atomic-dark.png`)

3. **Adicionar suporte a tema** nos componentes que têm acesso ao `resolvedTheme`:
   - `Sidebar.tsx`, `MobileNav.tsx`, `LayoutMinimal.tsx` já têm lógica de tema — adicionar fallback com `logo-atomic-dark.png` quando `isDark`
   - `Login.tsx` e outras páginas auth — importar ambos logos e selecionar por tema

4. **Atualizar `useDomainBranding.ts`** — adicionar `atomic.ia.br` ao `MAIN_DOMAINS`

5. **Textos remanescentes com "Morphews"** (exceto assistente):
   - `WhiteAdminSettings.tsx`: `noreply@morphews.com` → `noreply@updates.atomic.ia.br`
   - `RomaneioBatchPrint.tsx`: URLs QR code `sales.morphews.com` → `atomic.ia.br`
   - `LandingPageEditor.tsx`: preview URL `sales.morphews.com`
   - Edge functions com fallbacks `morphews.com`
   - `WhiteLabelSalesPage.tsx`: seção "MORPHEWS" e feature anchors — renomear para referência ao assistente ou Atomic Sales
   - `zapi-assistant-webhook`: mensagens de erro "Morphews" → "Atomic Sales"
   - `create-org-user`: mensagem de erro "CRM da Morphews" → "Atomic Sales"
   - `stripe-webhook`: fallback email `tenant@morphews.com`
   - `ecommerce-checkout/stripe.ts`: fallback URL

6. **Não alterar**:
   - `DonnaHelperPanel.tsx` — assistente continua "Morphews"
   - `morphews-avatar.png` — mantém
   - `MASTER_ADMIN_EMAIL` — email real
   - `AdminWhatsAppInstanceTab.tsx` — referências à "Secretária Morphews" (é o assistente)

### Escopo: ~15 arquivos frontend + ~6 edge functions

