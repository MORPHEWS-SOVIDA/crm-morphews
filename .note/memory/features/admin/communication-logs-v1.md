# Memory: features/admin/communication-logs-v1
Updated: now

## Histórico de Comunicações Unificado

O Super Admin agora possui uma aba centralizada **"Comunicações"** (em Sistema) que exibe todos os WhatsApp e Emails enviados pela plataforma.

### Tabela: `system_communication_logs`
- **channel**: 'whatsapp' ou 'email'
- **source**: Origem da mensagem (partner_notification, secretary, onboarding, ecommerce, cart_recovery)
- **recipient_phone/email**: Destinatário
- **organization_id/name**: Contexto do tenant (quando aplicável)
- **message_content**: Conteúdo completo
- **status**: sent, failed, pending
- **metadata**: JSON com dados extras (tipo de parceiro, comissão, etc.)

### Fontes que logam:
1. **partner_notification**: Notificações de comissão para afiliados, co-produtores, indústrias e fábricas
2. (Futuro) secretary, onboarding, ecommerce

### Filtros disponíveis:
- Por destinatário (nome, telefone, email)
- Por canal (WhatsApp/Email)
- Por fonte/origem
- Por status (enviado/falha)
- Por organização

### Acesso:
- RLS: Apenas admins da plataforma (`has_admin_role`)
- Caminho: `/super-admin` → Sistema → Comunicações
