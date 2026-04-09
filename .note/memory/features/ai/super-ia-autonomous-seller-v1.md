# Memory: features/ai/super-ia-autonomous-seller-v1
Updated: just now

## Super IA — Vendedor Autônomo

Sistema de agente vendedor autônomo que opera 100% na VPS com integração profunda ao CRM.

### Infraestrutura Criada (Lovable)

**Tabela `ai_followup_queue`:**
- Fila de follow-ups gerados por IA com status tracking
- Trigger types: cron_inactive, event_stage_change, event_cart_abandon, event_post_sale, event_payment_declined, manual
- Status flow: pending → generating → ready → sending → sent

**Coluna `organizations.ai_followup_config`:**
- JSON com config: enabled, inactive_hours, max_followups_per_lead, cooldown_hours, triggers (booleans), ai_model, working_hours

**Edge Function `super-ia-context`:**
- `get_full_context`: Retorna TUDO sobre um lead (preferências, resumos, mensagens, vendas, funil, produtos, follow-ups)
- `get_inactive_leads`: Busca leads elegíveis para follow-up (respeitando cooldown e max)
- `save_followup`: VPS salva follow-up gerado na fila
- `update_followup_status`: VPS atualiza status após envio
- `get_dashboard_stats`: Frontend busca métricas

**Triggers de Banco:**
- `trg_ai_followup_sales`: Pós-venda (48h) e pagamento recusado (30min)
- `trg_ai_followup_leads`: Mudança de etapa no funil (15min)

**Frontend `/super-ia`:**
- Dashboard com métricas (fila, enviados 24h/7d, memória IA)
- Fila de follow-ups com status e mensagens
- Configuração completa (timing, gatilhos, horário)

### Fluxo VPS (a implementar)

1. **Cron (30 min)**: Chama `get_inactive_leads` → Para cada lead, chama `get_full_context` → Claude gera follow-up curto e humano → `save_followup` → Envia via Evolution API → `update_followup_status`

2. **Agente Enriquecido**: Antes de responder, chama `get_full_context` e injeta no prompt do Claude. Após conversa encerrada, chama `lead-memory-analyze` para salvar aprendizados.

### Tabelas de Memória Existentes
- `lead_ai_preferences`: Preferências aprendidas (interesses, orçamento, estilo, objeções)
- `lead_conversation_summaries`: Resumos com sentimento, tópicos e próximos passos
