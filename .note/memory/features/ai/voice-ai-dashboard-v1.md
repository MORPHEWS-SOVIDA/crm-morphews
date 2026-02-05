 # Memory: features/ai/voice-ai-dashboard-v1
 Updated: 2026-02-05
 
 Dashboard Voice AI Completo: A página /voice-ai foi reestruturada com:
 
 **Abas principais:**
 - **Dashboard**: Cards de saldo de minutos, estatísticas (total, receptivas, ativas, tempo médio), taxa de atendimento e agendamentos. Filtros por período (hoje/7d/30d).
 - **Agentes**: Configuração de robôs de voz com ElevenLabs Agent ID.
 - **Testar**: Painel para chamadas de teste.
 
 **Sub-abas no Dashboard:**
 - **Receptivas (Inbound)**: Histórico de chamadas recebidas.
 - **Ativas (Campanhas Outbound)**: Lista de campanhas de disparo em massa.
 - **Histórico Completo**: Todas as chamadas.
 
 **Tabelas criadas:**
 - `voice_ai_call_logs`: Logs de todas as chamadas com transcrição, sentimento e outcome.
 - `voice_ai_outbound_campaigns`: Campanhas de ligação ativa em massa.
 - `voice_ai_campaign_contacts`: Contatos das campanhas (CSV import).
 
 **Próximos passos:** Implementar biblioteca de vozes, editor de script avançado, e processamento de campanhas outbound.