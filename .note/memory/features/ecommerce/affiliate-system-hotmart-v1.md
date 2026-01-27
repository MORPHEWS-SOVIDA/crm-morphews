# Memory: features/ecommerce/affiliate-system-hotmart-v2
Updated: just now

## Sistema de Afiliados (Estilo Hotmart/Kiwify) - v2

### Visão Geral
Implementação completa de gerenciamento de afiliados em todos os módulos de e-commerce:
- **Checkouts** (standalone)
- **Landing Pages** (incluindo no dialog de configuração)
- **Storefronts** (lojas)
- **Quizzes**

### Mudanças v2
1. **Multi-seleção com Checkboxes**: Lista todos afiliados disponíveis com checkboxes para selecionar/deselecionar múltiplos
2. **Edição de Comissão Inline**: Botão para editar % diretamente na lista
3. **Cores Legíveis**: Uso de tokens semânticos do design system (não mais roxo ilegível)
4. **Suporte Completo a Storefronts e Quizzes**: Migration adicionou `linked_storefront_id` e `linked_quiz_id`
5. **Aba no LandingPageFormDialog**: Afiliados disponível no dialog de configuração rápida

### Fluxo do Tenant (Lojista)
1. Acessa Checkout / Landing / Loja / Quiz
2. Clica na aba **"Afiliados"**
3. **Visualiza todos os afiliados disponíveis** em lista com checkboxes
4. Marca/desmarca quem pode promover
5. Clica no botão de % para editar comissão personalizada
6. Copia links prontos para enviar

### Fluxo do Afiliado
1. Acessa `/parceiro` (Portal do Parceiro)
2. Vê seção **"Meus Links de Divulgação"**
3. Visualiza ofertas disponíveis (checkouts, landings, lojas, quizzes)
4. Copia link único com `?ref=CODIGO`
5. Divulga e recebe comissão quando houver venda

### Formato do Link
- Checkout: `/pay/{slug}?ref={affiliate_code}`
- Landing: `/l/{slug}?ref={affiliate_code}`
- Loja: `/loja/{slug}?ref={affiliate_code}`
- Quiz: `/quiz/{slug}?ref={affiliate_code}`

### Modelo de Atribuição
- **Último Clique** (padrão): Afiliado mais recente ganha
- **Primeiro Clique**: Primeiro afiliado a indicar ganha

### Tabela partner_associations
Colunas de vínculo:
- `linked_checkout_id`: Vínculo com checkout específico
- `linked_landing_id`: Vínculo com landing page específica
- `linked_storefront_id`: Vínculo com loja específica (NEW)
- `linked_quiz_id`: Vínculo com quiz específico (NEW)

### Componentes
- `AffiliatesTab.tsx` - Componente genérico com multi-seleção e edição de comissão
- `LandingPageFormDialog.tsx` - Dialog de configuração agora com aba Afiliados
- `LandingPageEditor.tsx` - Editor completo com aba Afiliados
- `StorefrontDetailManager.tsx` - Gerenciador de loja com aba Afiliados
- `QuizBuilderDialog.tsx` - Builder de quiz com aba Afiliados

### Integração Split Engine
O código `?ref=CODIGO` é capturado em:
- `cart-sync` edge function → salva no carrinho
- `ecommerce-checkout` → cria `affiliate_attributions`
- Split Engine → calcula comissão baseada na atribuição
