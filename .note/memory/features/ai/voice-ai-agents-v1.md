# Memory: features/ai/voice-ai-agents-v1
Updated: now

## Voice AI com ElevenLabs - Implementação Completa

Sistema de ligações por voz com IA usando ElevenLabs Conversational AI.

### Arquitetura

**Tabelas:**
- `voice_ai_calls` - Logs de chamadas (inbound/outbound) com energy_consumed
- `voice_ai_agents` - Configuração de agentes por organização (inclui elevenlabs_agent_id)
- `voice_ai_campaigns` - Campanhas de ligações outbound

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
