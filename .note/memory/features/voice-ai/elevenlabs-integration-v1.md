# Memory: features/voice-ai/elevenlabs-integration-v1
Updated: just now

## Voice AI com ElevenLabs - Implementação Inicial

Sistema de ligações por voz com IA usando ElevenLabs Conversational AI.

### Arquitetura

**Tabelas:**
- `voice_ai_calls` - Logs de chamadas (inbound/outbound)
- `voice_ai_agents` - Configuração de agentes por organização
- `voice_ai_campaigns` - Campanhas de ligações outbound

**Edge Functions:**
- `elevenlabs-conversation-token` - Token WebRTC para conversação
- `elevenlabs-scribe-token` - Token para transcrição realtime
- `voice-ai-call` - Iniciar chamada e criar registro
- `voice-ai-call-end` - Finalizar chamada com transcrição e métricas

### Componentes Frontend

- `useVoiceAI` hook - Gerenciamento de chamadas
- `VoiceAITestPanel` - Painel de teste com transcrição
- `VoiceAITab` - Aba no Super Admin para gestão

### Fluxo de Uso

1. Criar agente no ElevenLabs (Conversational AI)
2. Configurar agent_id no sistema
3. Iniciar chamada via hook ou componente
4. Sistema conecta via WebRTC com token
5. Transcrição em tempo real
6. Ao encerrar, salva transcrição, sentimento e outcome

### Próximos Passos

1. Integração com CRM para ligações automáticas
2. Campanhas de recuperação de carrinho
3. Webhooks para chamadas inbound
4. Dashboard de métricas de conversão
