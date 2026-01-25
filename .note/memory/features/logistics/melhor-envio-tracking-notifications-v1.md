# Memory: features/logistics/melhor-envio-tracking-notifications-v1
Updated: just now

## Integração de Notificações de Rastreio via WhatsApp

### Funcionalidade
O sistema permite configurar notificações automáticas via WhatsApp para cada status de rastreio do Melhor Envio. Quando um webhook de rastreio é recebido (postado, em trânsito, entregue, etc.), o sistema identifica o status e dispara a mensagem configurada para o cliente.

### Configuração (Menu Integrações)
- Card nativo "Melhor Envio - Rastreio" disponível em `/integracoes`
- Permite configurar templates por status (postado, em trânsito, na cidade, tentativas falhas, entregue)
- Instância WhatsApp fixa configurada na integração
- Opção de aplicar instância padrão para todos os status

### Componentes
- `MelhorEnvioTrackingIntegration.tsx`: Dialog de configuração
- `MelhorEnvioTrackingCard.tsx`: Card na listagem de integrações
- Reutiliza `TrackingStatusMessageEditor.tsx` para configurar mensagens

### Tabela Utilizada
- `carrier_tracking_statuses`: Armazena configuração por status (message_template, whatsapp_instance_id, media)

### Edge Function
- `melhor-envio-webhook`: Processa webhooks do Melhor Envio e dispara notificações
- Mapeamento de status Melhor Envio → status internos
- Criação de mensagens agendadas em `lead_scheduled_messages`

### Variáveis Disponíveis nos Templates
- `{{nome}}`: Nome completo do cliente
- `{{primeiro_nome}}`: Primeiro nome
- `{{vendedor}}`: Nome do vendedor responsável
- `{{produto}}`: Nome do produto
