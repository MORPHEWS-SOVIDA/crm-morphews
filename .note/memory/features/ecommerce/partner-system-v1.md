# Memory: features/ecommerce/partner-system-v2
Updated: just now

## Sistema de Parceiros Morphews

### Conceito
O sistema de "Afiliados" foi expandido para "Parceiros", unificando 4 tipos:
- **Afiliado**: Divulga e gera vendas (responsável por estornos)
- **Co-produtor**: Participa da criação (responsável por estornos)
- **Indústria**: Produz/fornece (NÃO responsável por estornos)
- **Fábrica**: Manufatura (NÃO responsável por estornos)

### Dois Fluxos de Cadastro

#### 1. Convite Manual (Individual)
1. Admin preenche dados do parceiro no dialog
2. Sistema cria `partner_invitations` com `invite_code`
3. **Notificação automática**: Email + WhatsApp enviados via `partner-notification` edge function
4. Parceiro recebe link `/parceiro/convite/{code}` com credenciais
5. Ao aceitar, função `accept_partner_invitation()` cria conta

#### 2. Link Público (Massa)
1. Admin cria `partner_public_links` com:
   - Slug único (ex: "sovida", "evento-2024")
   - Configurações de comissão
   - Limite opcional de cadastros
2. Link compartilhado: `/convite-parceiros/{slug}`
3. Interessados preenchem formulário → cria `partner_applications` (status: pending)
4. Admin aprova/rejeita em "Solicitações"
5. **Ao aprovar**: `approve_partner_application()` cria:
   - Usuário (se não existir) com senha provisória
   - `virtual_account`
   - `partner_associations`
6. **Notificação automática**: Email + WhatsApp com credenciais de acesso

### Tabelas
- `partner_invitations`: Convites individuais
- `partner_associations`: Vínculos parceiro ↔ organização
- `partner_public_links`: Links públicos de cadastro em massa
- `partner_applications`: Solicitações pendentes/processadas

### Rotas
- `/ecommerce/parceiros` - Gestão (admin) com 3 abas: Parceiros, Solicitações, Links
- `/parceiro/convite/:code` - Aceite de convite individual
- `/convite-parceiros/:slug` - Formulário público de interesse
- `/parceiro` - Portal do parceiro (autenticado)

### Componentes
- `PartnersManager.tsx` - 3 abas principais
- `PublicLinksTab.tsx` - CRUD de links públicos
- `PartnerApplicationsTab.tsx` - Aprovação/rejeição de solicitações
- `PartnerApplicationPage.tsx` - Formulário público
- `PartnerInviteDialog.tsx` - Convite individual com notificação

### Edge Function
- `partner-notification` - Envia email (Resend) + WhatsApp (Evolution API global)
