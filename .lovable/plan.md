

## Rebranding Morphews → Atomic Sales

Sim, tenho o conhecimento da marca **Atomic Sales** com domínio `atomic.ia.br` e remetente `noreply@updates.atomic.ia.br`. Porém, o logo atual em `src/assets/` ainda é `logo-morphews.png` — **não existe um asset `logo-atomic.png`** no projeto.

### Situação atual
- **53 arquivos** com referências a "morphews"
- **17 arquivos** com "Morphews CRM" hardcoded
- Assets: `logo-morphews.png`, `morphews-avatar.png` (assistente — mantém)
- `index.html` já está como "Atomic Sales" ✓
- `favicon.jpg` já atualizado ✓

### Precisamos resolver primeiro

**Não há logo da Atomic Sales nos assets do projeto.** O `logo-morphews.png` é usado como fallback em ~10 componentes. Preciso que você:
1. **Faça upload do logo da Atomic Sales** (versão clara e, se tiver, versão escura)
2. Ou me diga se o logo já está hospedado em alguma URL

### Plano de execução (após logo)

**1. Assets** — Substituir `logo-morphews.png` por logo Atomic Sales (ou renomear/adicionar novo arquivo)

**2. Componentes do Dashboard (~8 arquivos)**
- `Sidebar.tsx`: fallback → "Atomic Sales"
- `MobileNav.tsx`: import e fallback
- `Login.tsx`: logo, alt text, toast "Bem-vindo ao Atomic Sales"
- `ForcePasswordChange.tsx`: logo e brand name
- `CustomDomainRedirect.tsx`: redirects, fallback title
- `TrialExpiredBlocker.tsx`: texto
- `PublicHelper.tsx`: subtítulo
- `AuthError.tsx`: logo, textos, copyright

**3. Páginas (~5 arquivos)**
- `Onboarding.tsx`, `SignupSuccess.tsx`: textos de boas-vindas
- `Legal.tsx`: termos de uso (Morphews CRM → Atomic Sales)
- `Team.tsx`: fallback plan name
- `SalesLanding.tsx`: textos, URLs, footer

**4. URLs e domínios (~3 arquivos)**
- `useCustomDomainDetection.ts`: lista de domínios conhecidos → adicionar `atomic.ia.br`
- `CustomDomainRedirect.tsx`: redirect `sales.morphews.com`
- `StepPageConfig.tsx`: prefixo URL de landing pages

**5. Edge Functions** — Produto Stripe, emails de boas-vindas, origin fallbacks

**6. Manter como "Morphews"**
- `DonnaHelperPanel.tsx` — assistente continua "Morphews" ✓
- `morphews-avatar.png` — mantém ✓
- `MASTER_ADMIN_EMAIL` — email real ✓

### Escopo total: ~20 arquivos + edge functions

