
## 📊 Problemas Reais (dados da Atomicat)

**Viviane Velloso** — 3 webhooks em 2 minutos:
- 01:34 → Compra Recusada (criou lead)
- 01:35 → Compra Recusada DUPLICADO (1min depois!)
- 01:36 → ATOMICAT2026 aprovada

**Priscilla** — mesma coisa, 2x "Compra Recusada" em 6min

**Suelen** — 4 webhooks: Pix Gerado 2x + Aprovada + Carrinho Abandonado

Cada webhook recusado agenda mensagens automáticas = SPAM pro cliente.

---

## 🛠️ Solução em 3 Partes

### 1. Cooldown por Lead + Integração (NOVO)
Na tabela `integrations`, adicionar campo **`dedup_cooldown_minutes`** (default: null = desativado).

**Lógica:** Antes de processar, checar se existe `integration_logs` com `status=success` para o **mesmo lead + mesma integração** nos últimos X minutos. Se sim → logar como `deduplicated` e retornar 200 (aceita o webhook mas não processa).

**Exemplo:** "Compra Recusada" com cooldown de 30min → Viviane recebe apenas 1 processamento, não 2.

### 2. Preservar Dados do Lead (não sobrescrever)
Atualmente linha 1073: `webhook_data: payload` → **sobrescreve tudo**.

**Mudança:**
- `webhook_data` guarda apenas o **último** payload (manter comportamento, é útil)
- Mas **salvar histórico** na tabela `lead_webhook_history` (já existe!)
- Não sobrescrever `name`, `email`, `address` com dados piores
- Não resetar `stage` se o novo stage é "pior" (ex: não voltar de "aprovada" para "recusada")

### 3. Deduplicar Mensagens Agendadas
Antes de inserir `lead_scheduled_messages`, checar se já existem mensagens **pending** para o mesmo `lead_id` + `template_id`. Se sim → não duplicar.

---

## 🎯 UI: Toggle no painel de Integrações
No card de cada integração em `/integracoes`, adicionar:
- **Switch "Proteção anti-duplicação"** com campo de minutos (5, 10, 15, 30, 60)
- Tooltip explicando: "Ignora webhooks repetidos do mesmo cliente dentro do período"

---

## 📋 Hierarquia de Stages (não regredir)
Definir ordem: `cloud` < `unclassified` < `waiting_payment` < `paid` < `delivered`
Se o lead já está em `paid`, um webhook de "compra recusada" NÃO deve voltar para `waiting_payment`.
**Exceção configurável:** O cliente pode escolher "sempre atualizar stage" se quiser.
