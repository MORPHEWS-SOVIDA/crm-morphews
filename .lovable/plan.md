

## Rebranding Morphews → Atomic Sales — CONCLUÍDO ✅

### O que foi feito

**~40 arquivos atualizados** com as seguintes mudanças:

1. **Dashboard**: Sidebar, MobileNav, LayoutMinimal — fallback brand "Atomic Sales"
2. **Auth pages**: Login, ForcePasswordChange, ResetPassword, AuthError, NotFound, WhiteLabelLogin — logo alt text, toasts, copyright
3. **Landing pages**: SalesLanding, Power, Planos, NicheLandingPage, DirectCheckout — textos, footer, WhatsApp links, copyright
4. **Páginas**: Onboarding, SignupSuccess, Legal, Team, PublicHelper — textos de boas-vindas e termos
5. **Domínios**: useCustomDomainDetection (atomic.ia.br adicionado), CustomDomainRedirect (redirect → atomic.ia.br)
6. **Edge Functions**: create-checkout (Stripe), email-hook (emails transacionais), send-welcome-email, implementer-checkout, partner-notification, chargeback-alerts, stripe-webhook, manual-user-provision, melhor-envio-* (User-Agent), split-engine, ecommerce-checkout/pagarme
7. **White Label**: WhiteAdminBranding (URLs), WhiteLabelSalesPage (CTA), PartnerDetailSheet, PendingInvitations
8. **index.html**: Twitter handle, redirect script

### Mantido como "Morphews" (conforme solicitado)
- DonnaHelperPanel — assistente virtual
- morphews-avatar.png — avatar do assistente  
- Sidebar "Fale com Morphews" — seção do helper
- MASTER_ADMIN_EMAIL — email real
- Secretária Morphews — em Power.tsx, Planos.tsx, admin panels
- MORPHEWS_CHECKOUT_TRIGGER — evento interno
- evolution-assistant-webhook — assistente WhatsApp
