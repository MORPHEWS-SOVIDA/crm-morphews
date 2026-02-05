# Memory: features/ai/voice-ai-agents-v1
Updated: 2026-02-05

## Voice AI com ElevenLabs - Implementação Completa

Sistema de ligações por voz com IA usando ElevenLabs Conversational AI.

### Arquitetura

**Tabelas:**
- `voice_ai_calls` - Logs de chamadas (inbound/outbound) com energy_consumed
- `voice_ai_agents` - Configuração de agentes por organização (inclui elevenlabs_agent_id)
- `voice_ai_campaigns` - Campanhas de ligações outbound
- `voice_ai_agent_tools` - Tools/ações que o agente pode executar durante chamada
- `voice_ai_knowledge_base` - Base de conhecimento para treinar agente
- `voice_ai_automations` - Workflows pós-ligação
- `voice_ai_automation_logs` - Log de execuções das automações

**Edge Functions:**
- `elevenlabs-conversation-token` - Token WebRTC para conversação
- `elevenlabs-scribe-token` - Token para transcrição realtime
- `voice-ai-call` - Iniciar chamada e criar registro
- `voice-ai-call-end` - Finalizar chamada com transcrição e métricas

### Feature Flags e Permissões

**Feature Key:** `voice_ai_calls` (em plan_features)
- Separada de `bot_voice_responses` (TTS em mensagens)

**Permissões de Usuário:** (em user_permissions)
- `voice_ai_view` - Ver módulo e histórico
- `voice_ai_manage` - Configurar agentes e campanhas

**Custos de Energia:** (em ai_action_costs)
- `voice_ai_call_initiate` - 50⚡ (fixo para iniciar)
- `voice_ai_call_minute` - 100⚡/minuto de conversa
- `voice_ai_transcription` - 30⚡ (transcrição após chamada)
- `voice_ai_sentiment` - 20⚡ (análise de sentimento)

### Componentes Frontend

**Super Admin:**
- `VoiceAITab` - Painel completo de monitoramento e teste

**Tenants:**
- `src/pages/VoiceAI.tsx` - Página principal (rota /voice-ai)
- `VoiceAIAgentConfig` - CRUD de agentes ElevenLabs
- `VoiceAICallHistory` - Histórico de chamadas com transcrição
- `VoiceAITestPanel` - Testar agente com transcrição em tempo real

### Modelo de Negócio

- **API Key Centralizada**: Todos os tenants usam a conta ElevenLabs da Morphews
- **Cobrança por Energia**: Consumo medido e cobrado via sistema de energia IA existente

### Fluxo de Uso para Tenant

1. Acessar /voice-ai (requer permissão voice_ai_view)
2. Criar agente com Agent ID do ElevenLabs
3. Testar agente no painel
4. Usar em campanhas ou atendimento

### Próximos Passos

1. Integração com CRM para ligações automáticas de leads
2. Campanhas de recuperação de carrinho via voz
3. Webhooks para chamadas inbound (número de telefone próprio)
4. Dashboard de métricas de conversão por voz

### Tools na Chamada (Implementado)

Tipos de tools disponíveis:
- `transfer_human` - Transferir para humano com número configurável
- `book_appointment` - Agendar reunião (Cal.com, Calendly, Google Calendar)
- `dtmf` - Enviar teclas DTMF para navegação em URA
- `api_call` - Chamada API em tempo real
- `send_sms` - Enviar SMS com template
- `update_crm` - Atualizar dados no CRM
- `webhook` - Disparar webhook customizado

### Base de Conhecimento (Implementado)

Tipos de conteúdo:
- `text` - Texto livre (políticas, processos)
- `pdf` - Upload de documentos PDF
- `url` - URL de página web
- `qa_pair` - Pares de pergunta/resposta

### Automações Pós-Ligação (Implementado)

**Gatilhos:**
- call_ended, appointment_booked, transfer_requested
- sentiment_negative, sentiment_positive
- outcome_sale, outcome_no_answer

**Ações:**
- webhook, update_lead, send_notification
- create_task, send_email, send_sms, add_tag
