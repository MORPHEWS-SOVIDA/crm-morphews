# Memory: features/ecommerce/email-sequences-per-store-v1
Updated: just now

## Sistema de E-mails por Loja/Landing

### Arquitetura
O sistema de e-mail marketing agora permite sequências vinculadas diretamente a cada Storefront ou Landing Page específica, em vez de apenas à organização. Isso permite personalização granular por loja.

### Tabelas Modificadas
- `email_sequences`: Novos campos `storefront_id`, `landing_page_id`, `ai_generated`, `energy_cost_generation`
- `email_sends`: Novo campo `energy_cost` (padrão 10)
- `email_sequence_presets`: Templates padrão para cada tipo de sequência

### Tipos de Sequência Disponíveis
1. **Carrinho Abandonado** (`abandoned_cart`): 4 e-mails - imediato, 1h, 3h, 24h
2. **Pós-Compra** (`post_purchase`): 3 e-mails - confirmação, upsell 5min, rastreio 24h
3. **Recompra** (`recompra`): 2 e-mails - 30 dias e 90 dias após última compra
4. **Boas-vindas Lead** (`welcome_lead`): 2 e-mails - imediato e 24h depois

### Componentes
- `StorefrontEmailSequences.tsx`: Componente unificado para gerenciar sequências de e-mail
- Integrado em `StorefrontDetailManager.tsx` (aba "E-mails")
- Integrado em `LandingPageFormDialog.tsx` (aba "E-mails")

### Edge Functions
- `generate-email-sequence`: Gera sequências personalizadas usando IA (Gemini 2.5 Flash)
- `process-email-sequences`: Atualizado para debitar 10 energia por e-mail enviado

### Fluxo de Geração por IA
1. Usuário clica "Criar" em um tipo de sequência
2. Sistema busca presets padrão da tabela `email_sequence_presets`
3. Se há nome de produto/nicho, chama `generate-email-sequence` para personalizar
4. IA adapta assuntos e conteúdo ao contexto do produto
5. Sequência é criada e auto-ativada
6. Energia é debitada (10 × número de e-mails)

### Custo de Energia
- **Geração IA**: 10 energia × número de e-mails na sequência
- **Envio**: 10 energia por e-mail enviado

### RPC Criada
- `debit_organization_energy(org_id, amount, description)`: Função SECURITY DEFINER para débito atômico
