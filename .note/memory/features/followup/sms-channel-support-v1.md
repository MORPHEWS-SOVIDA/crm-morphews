 # Memory: features/followup/sms-channel-support-v1
 Updated: 2026-02-05
 
 Sistema de Follow-up Multi-Canal: Os templates de mensagens automáticas (non_purchase_message_templates) agora suportam dois canais de envio:
 - **WhatsApp**: Comportamento padrão com suporte a mídia (imagem, áudio, documento), cadeia de instâncias com fallback, e integração com Robô IA para assumir se nenhum vendedor responder.
 - **SMS**: Envia mensagens via integração FacilitaMóvel. Não suporta mídia nem fallback de robô. Utiliza sistema de créditos separado (sms_credits_balance). Limite de 160 caracteres por mensagem.
 
 **Campos adicionados:**
 - `non_purchase_message_templates.channel_type`: 'whatsapp' | 'sms' (default: 'whatsapp')
 - `lead_scheduled_messages.channel_type`: 'whatsapp' | 'sms' (default: 'whatsapp')
 - `lead_scheduled_messages.sms_phone`: Telefone formatado para envio SMS
 
 **Processamento:**
 A Edge Function `process-scheduled-messages` verifica o `channel_type` e redireciona para WhatsApp (Evolution API) ou SMS (FacilitaMóvel API) conforme configurado.