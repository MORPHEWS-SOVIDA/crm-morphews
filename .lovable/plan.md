
# 🚀 Super IA - Vendedor do Futuro

## Situação Atual
Já existe infraestrutura significativa que NÃO está sendo usada:
- ✅ `lead_ai_preferences` — preferências aprendidas por IA (tabela existe, não é consumida pelo agente)
- ✅ `lead_conversation_summaries` — resumos de conversas (existe, não é injetada no prompt)
- ✅ `lead-memory-analyze` — Edge Function que extrai tudo isso (existe, não é chamada automaticamente)
- ✅ CRM Tools (ReAct) — agente já pode buscar produtos, pedidos, mover leads (existe na VPS)
- ✅ `lead_followups` — sistema de follow-ups (existe, mas é manual)
- ❌ **Nada disso está integrado** — o agente responde "sem memória"

## Plano de Implementação

### Fase 1: Banco de Dados (Lovable)
Criar tabela `ai_followup_queue` para o cron da VPS:
- `organization_id`, `lead_id`, `conversation_id`
- `trigger_type`: 'cron_inactive' | 'event_stage_change' | 'event_cart_abandon' | 'event_post_sale'
- `context_snapshot`: JSON com preferências, resumo, último tópico
- `generated_message`: mensagem gerada pela IA
- `status`: 'pending' | 'sent' | 'skipped' | 'failed'
- `scheduled_for`, `sent_at`

### Fase 2: Edge Function `super-ia-context` (Lovable → VPS consome)
Endpoint que o VPS chama para obter TUDO sobre um lead:
- Preferências aprendidas (`lead_ai_preferences`)
- Últimos resumos (`lead_conversation_summaries`)
- Histórico de compras (`sales`)
- Posição no funil (`leads` + `organization_funnel_stages`)
- Follow-ups pendentes (`lead_followups`)
- Últimas 30 mensagens da conversa
- Produtos da organização

### Fase 3: Motor de Follow-up na VPS
Cron job que roda a cada 30 min:
1. Busca leads inativos há X horas (configurável por organização)
2. Chama `super-ia-context` para cada lead
3. Usa Claude (Anthropic) para gerar mensagem contextual curta e humana
4. Insere na `ai_followup_queue` com status 'pending'
5. Envia via Evolution API
6. Atualiza status para 'sent'

### Fase 4: Enriquecimento do Agente (VPS)
Modificar o motor de execução na VPS para:
1. Antes de responder, chamar `super-ia-context` e injetar no prompt
2. Novas tools: `schedule_followup`, `update_lead_notes`, `create_sale_proposal`
3. Após cada conversa encerrada, chamar `lead-memory-analyze` automaticamente
4. Usar Claude Sonnet como modelo principal (ANTHROPIC_API_KEY da VPS)

### Fase 5: Frontend `/super-ia` (Lovable)
Dashboard unificado com:
- **Visão geral**: leads ativos, follow-ups pendentes, taxa de conversão
- **Fila de follow-ups**: mensagens geradas aguardando envio/aprovação
- **Memória do lead**: card com preferências e resumos aprendidos
- **Configuração**: tempos de inatividade, gatilhos, modelo de IA
- **Logs de atividade**: o que o agente fez automaticamente

### Fase 6: Gatilhos por Evento
Triggers no banco que inserem na `ai_followup_queue`:
- Lead mudou de etapa no funil → follow-up contextual
- Carrinho abandonado → recuperação
- Compra concluída → pós-venda/upsell após X dias
- Lead sem resposta há X horas → reengajamento

### Primeiro Deploy: Sonatura (thiago@sonatura.com.br / 555181330321)
1. Configurar agente com Claude via VPS
2. Ativar memória automática
3. Ativar follow-up cron de 2h
4. Monitorar via `/super-ia`

## Arquitetura Final
```
WhatsApp → Evolution API → VPS (webhook)
  → Consulta super-ia-context (Lovable DB)
  → Claude (Anthropic API direto)
  → CRM Tools (via vps-bridge)
  → Resposta via Evolution API
  → Salva memória (lead-memory-analyze)

Cron VPS (30min)
  → Busca leads inativos
  → Consulta super-ia-context
  → Claude gera follow-up
  → Envia via Evolution API
```
