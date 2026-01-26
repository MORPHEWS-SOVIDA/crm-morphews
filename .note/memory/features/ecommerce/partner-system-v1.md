# Memory: features/ecommerce/partner-system-v1
Updated: just now

## Sistema de Parceiros Morphews

### Conceito
O sistema de "Afiliados" foi expandido para "Parceiros", unificando 4 tipos de parceiros:
- **Afiliado**: Divulga e gera vendas (responsável por estornos)
- **Co-produtor**: Participa da criação (responsável por estornos)
- **Indústria**: Produz/fornece (NÃO responsável por estornos)
- **Fábrica**: Manufatura (NÃO responsável por estornos)

### Fluxo de Convite
1. Tenant cria convite com: nome, email, WhatsApp, tipo de parceiro
2. Define comissão (% ou fixo) e responsabilidade por estornos/chargebacks
3. Sistema gera link único: `/parceiro/convite/{invite_code}`
4. Parceiro acessa link, cria conta ou faz login
5. Ao aceitar, função SQL `accept_partner_invitation()` cria:
   - `virtual_account` (se não existir)
   - `partner_associations` (vínculo com org + configurações)
   - Atualiza `profiles.is_partner = true`

### Tabelas Criadas
- `partner_invitations`: Convites pendentes/aceitos
- `partner_associations`: Vínculos parceiro ↔ organização

### Rotas
- `/ecommerce/parceiros` - Gestão de parceiros (admin)
- `/parceiro/convite/:code` - Aceite de convite (público)
- `/parceiro` - Portal do parceiro (autenticado)

### Componentes Principais
- `src/pages/ecommerce/EcommerceParceiros.tsx`
- `src/components/ecommerce/partners/PartnersManager.tsx`
- `src/components/ecommerce/partners/PartnerInviteDialog.tsx`
- `src/components/ecommerce/partners/PartnersList.tsx`
- `src/components/ecommerce/partners/PendingInvitations.tsx`
- `src/pages/partner/PartnerInvitePage.tsx`
- `src/pages/partner/PartnerPortal.tsx`
- `src/hooks/ecommerce/usePartners.ts`

### Menu Atualizado
- "Afiliados" + "Indústrias" → "Parceiros" (unificado)
