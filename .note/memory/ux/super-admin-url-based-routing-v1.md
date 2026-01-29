# Memory: ux/super-admin-url-based-routing-v1
Updated: now

Estrutura de Rotas do Super Admin: O painel (/super-admin) foi refatorado para usar URLs individuais em vez de tabs baseadas em state. Cada seção tem sua própria rota:

**Clientes:**
- /super-admin/organizacoes (Organizações)
- /super-admin/usuarios (Usuários)
- /super-admin/quiz (Quiz/Leads)

**Billing:**
- /super-admin/billing/inadimplencia
- /super-admin/billing/cupons
- /super-admin/billing/planos
- /super-admin/billing/implementadores

**E-commerce:**
- /super-admin/ecommerce/receitas-gateway
- /super-admin/ecommerce/gateways
- /super-admin/ecommerce/taxas-tenants
- /super-admin/ecommerce/templates-lp

**WhatsApp:**
- /super-admin/whatsapp/creditos
- /super-admin/whatsapp/provedores
- /super-admin/whatsapp/admin-instance

**IA:**
- /super-admin/ia/energia-ia
- /super-admin/ia/custos-modelos
- /super-admin/ia/secretaria
- /super-admin/ia/donna

**Sistema:**
- /super-admin/sistema/comunicacoes
- /super-admin/sistema/overrides
- /super-admin/sistema/logs
- /super-admin/sistema/emails

Rotas legadas mantidas como aliases:
- /super-admin/feature-overrides → Overrides
- /super-admin/plan-editor → Planos
- /super-admin/editor-de-planos → Planos
- /super-admin/override-de-features → Overrides

Arquivos de página criados em src/pages/super-admin/ usando SuperAdmin com prop defaultTab. SuperAdminNavigation.tsx usa Links com paths definidos.
