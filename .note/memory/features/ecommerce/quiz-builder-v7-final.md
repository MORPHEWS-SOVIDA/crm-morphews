# Memory: features/ecommerce/quiz-builder-v8-fullpage
Updated: just now

## Quiz Builder - Página Dedicada (v8)

### Mudança Principal
O editor de Quiz foi migrado de um Dialog (popup) para uma **página dedicada em tela cheia** em `/ecommerce/quiz/edit/:id`, similar ao editor de Landing Pages.

### Problemas Resolvidos
1. **Popup não funcional**: Dialog não tinha scroll adequado e UI era comprimida
2. **Afiliados com multi-seleção**: Agora usa o AffiliatesTab refatorado com checkboxes
3. **Edição de comissão inline**: Possível alterar % diretamente na lista de afiliados

### Nova Estrutura de Arquivos
- `src/pages/ecommerce/QuizEditor.tsx` - Página dedicada em tela cheia
- `src/components/ecommerce/quiz/QuizManager.tsx` - Lista de quizzes (navega para editor)
- `src/components/ecommerce/quiz/QuizBuilderDialog.tsx` - **Legado** (mantido para compatibilidade)
- `src/components/ecommerce/quiz/QuizStepEditor.tsx` - Editor de cada etapa
- `src/components/ecommerce/quiz/QuizSettingsPanel.tsx` - Configurações do quiz
- `src/components/ecommerce/affiliates/AffiliatesTab.tsx` - Multi-seleção de afiliados

### Rotas
- `/ecommerce/quiz` - Lista de quizzes (QuizManager)
- `/ecommerce/quiz/edit/:id` - Editor em tela cheia (QuizEditor)
- `/quiz/:slug` - Página pública do quiz

### Fluxo do Usuário
1. Acessa `/ecommerce/quiz`
2. Clica "Novo Quiz" → Dialog simples para nome/slug
3. Ao salvar, navega para `/ecommerce/quiz/edit/:id`
4. Editor em tela cheia com 3 abas:
   - **Etapas**: Lista à esquerda + editor à direita
   - **Configurações**: Aparência, pixels, automações
   - **Afiliados**: Multi-seleção com checkboxes e edição de comissão

### Tipos de Etapa Suportados
- `single_choice` - Escolha única
- `multiple_choice` - Múltipla escolha
- `text_input` - Campo de texto
- `number_input` - Campo numérico
- `lead_capture` - Captura de lead (nome, email, WhatsApp, CPF)
- `imc_calculator` - Calculadora de IMC
- `info` - Informativo
- `result` - Tela de resultado com CTA

### Integração com Afiliados
O AffiliatesTab usa `linked_quiz_id` para vincular afiliados ao quiz específico, permitindo que cada afiliado tenha um link único `/quiz/:slug?ref=CODIGO` para divulgação.
