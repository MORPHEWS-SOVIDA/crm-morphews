 # Memory: features/ai/voice-ai-dashboard-v1
 Updated: just now
 
 Dashboard Voice AI Completo com Campanhas Outbound:
 
 **Abas principais:**
 - **Dashboard**: Cards de saldo de minutos, estatísticas (total, receptivas, ativas, tempo médio), taxa de atendimento e agendamentos. Filtros por período (hoje/7d/30d).
 - **Agentes**: Configuração de robôs de voz com ElevenLabs Agent ID e Biblioteca de Vozes integrada.
 - **Testar**: Painel para chamadas de teste.
 
 **Sub-abas no Dashboard:**
 - **Receptivas (Inbound)**: Histórico de chamadas recebidas.
 - **Ativas (Campanhas Outbound)**: Lista de campanhas de disparo em massa.
 - **Histórico Completo**: Todas as chamadas.
 
 **Tabelas criadas:**
 - `voice_ai_call_logs`: Logs de todas as chamadas com transcrição, sentimento e outcome.
 - `voice_ai_outbound_campaigns`: Campanhas de ligação ativa em massa.
 - `voice_ai_campaign_contacts`: Contatos das campanhas (CSV import).
 
 **Novas funcionalidades:**
 - **VoiceLibrary**: Biblioteca visual de vozes ElevenLabs com preview de áudio, filtros por gênero/sotaque.
 - **CampaignCreateModal**: Wizard 3 etapas (Informações > Upload CSV > Revisão) com validação de telefones.
 - **process-outbound-campaign**: Edge function para processar campanhas (start/pause/resume/process_batch).
 - **useCampaignActions**: Hook para controlar campanhas via UI.
 
 **Próximos passos:** Editor de script avançado, webhooks de status de chamada, analytics detalhado.