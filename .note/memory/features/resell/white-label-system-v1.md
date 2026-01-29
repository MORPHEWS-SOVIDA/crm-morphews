# Memory: features/resell/white-label-system-v1
Updated: just now

## Sistema White Label para Implementadores

### Conceito
Implementadores com plano White Label podem revender o sistema com sua própria marca, ocultando completamente a marca Morphews para seus clientes.

### Modelo de Negócio (Híbrido)
- **Plano Implementador White Label**: R$ 497/mês (vs R$ 297 do Implementador normal)
- **Comissões mantidas**: 40% na 1ª mensalidade, 10% recorrente (igual ao modelo normal)
- **Diferencial**: +R$ 200/mês = acesso ao branding customizado

### O que o White Label permite
1. **Site de Vendas Próprio** (`/pv2/:sales_page_slug`)
   - Logo customizado no header/footer
   - Nome da marca no lugar de "Morphews"
   - Cor primária personalizada
   - SEO com meta tags personalizadas
   - CTA redireciona para /planos?ref=slug (atribui vendas)

2. **Checkout Personalizado** (`/implementador/:slug`) ✅ IMPLEMENTADO
   - Logo do revendedor no header
   - Nome da marca customizado
   - Cor primária aplicada
   - Footer com "Powered by [Marca]"

3. **E-mails de Boas-Vindas** ✅ IMPLEMENTADO
   - Nome do remetente customizado
   - Logo no header do e-mail
   - Cor primária no gradiente
   - Contato de suporte customizado
   - Subject com nome da marca

4. **WhatsApp de Boas-Vindas** ✅ IMPLEMENTADO
   - Mensagem com nome da marca
   - Contato de suporte customizado

### Tabela: white_label_configs
```sql
id UUID PRIMARY KEY
implementer_id UUID NOT NULL (FK implementers)
brand_name TEXT NOT NULL -- "ATOMICsales"
logo_url TEXT
favicon_url TEXT
primary_color TEXT DEFAULT '#8B5CF6'
secondary_color TEXT DEFAULT '#ffffff'
sales_page_slug TEXT UNIQUE -- "atomicsales" -> /pv2/atomicsales
custom_domain TEXT -- Para futuro: atomicsales.com.br
email_from_name TEXT
email_logo_url TEXT
support_email TEXT
support_whatsapp TEXT
is_active BOOLEAN DEFAULT true
```

### Flags Adicionadas
- `subscription_plans.allows_white_label` - Se o plano permite White Label
- `implementers.is_white_label` - Se o implementador tem WL ativo
- `implementers.white_label_config_id` - Referência à config
- `implementer_sales.white_label_config_id` - De qual WL o cliente veio

### Componentes
- `WhiteLabelConfigPanel.tsx` - Painel de configuração no dashboard do implementador
- `WhiteLabelSalesPage.tsx` - Página pública de vendas (`/pv2/:slug`)

### Hooks
- `useWhiteLabelConfig()` - Config do implementador logado
- `useWhiteLabelBySlug()` - Busca config pública pelo slug
- `useCreateWhiteLabelConfig()` - Criar nova config
- `useUpdateWhiteLabelConfig()` - Atualizar config
- `useHasWhiteLabelPlan()` - Verificar se org tem plano WL

### Rotas
- `/pv2/:slug` - Página pública de vendas com branding do WL
- `/implementador` (aba White Label) - Configuração do branding
- `/implementador/:slug` - Checkout com branding WL (quando ativo)

### Edge Functions Atualizadas
- `send-welcome-email` - Aceita `whiteLabelBranding` para personalização
- `implementer-checkout` - Busca WL config e envia para e-mail/WhatsApp

### Plano White Label
- ID: `b7c3e8f9-1a2b-4c5d-6e7f-8a9b0c1d2e3f`
- Nome: "Implementador White Label"
- Preço: R$ 497/mês
- Permite White Label: true
- Visível no site: false (contratação direta)

### Próximos Passos (Opcionais)
1. Sistema de domínios customizados (DNS/CNAME)
2. Dashboard interno com branding parcial (logo na sidebar)
