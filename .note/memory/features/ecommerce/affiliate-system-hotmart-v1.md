# Memory: features/ecommerce/affiliate-system-hotmart-v1
Updated: just now

## Sistema de Afiliados (Estilo Hotmart/Kiwify)

### Visão Geral
Implementação completa de gerenciamento de afiliados em todos os módulos de e-commerce:
- **Checkouts** (standalone)
- **Landing Pages**
- **Storefronts** (lojas)
- **Quizzes**

### Fluxo do Tenant (Lojista)
1. Acessa Checkout / Landing / Loja / Quiz
2. Clica na aba **"Afiliados"**
3. Adiciona afiliados da organização
4. Configura modelo de atribuição (Primeiro/Último clique)
5. Copia links com código do afiliado para enviar

### Fluxo do Afiliado
1. Acessa `/parceiro` (Portal do Parceiro)
2. Vê seção **"Meus Links de Divulgação"**
3. Visualiza ofertas disponíveis (checkouts, landings)
4. Copia link único com `?ref=CODIGO`
5. Divulga e recebe comissão quando houver venda

### Formato do Link
- Checkout: `/pay/{slug}?ref={affiliate_code}`
- Landing: `/l/{slug}?ref={affiliate_code}`
- Loja: `/loja/{slug}?ref={affiliate_code}`
- Quiz: `/quiz/{slug}?ref={affiliate_code}`

### Modelo de Atribuição
- **Último Clique** (padrão): O afiliado que trouxe o cliente por último recebe a comissão
- **Primeiro Clique**: O afiliado que apresentou o produto pela primeira vez recebe a comissão

Configurável por oferta nas colunas `attribution_model` em:
- `standalone_checkouts`
- `landing_pages`

### Tabelas Envolvidas
- `partner_associations`: Vínculos afiliado ↔ oferta (checkout/landing)
  - `linked_checkout_id`: Vínculo com checkout específico
  - `linked_landing_id`: Vínculo com landing page específica
  - `affiliate_code`: Código único do afiliado

### Componentes
- `AffiliatesTab.tsx` - Componente genérico reutilizável em todos os módulos
- `AffiliateOffersSection.tsx` - Seção no portal do afiliado
- `CheckoutAffiliatesTab.tsx` - Versão específica para checkout (legado)

### Integração Split Engine
O código `?ref=CODIGO` é capturado em:
- `cart-sync` edge function → salva no carrinho
- `ecommerce-checkout` → cria `affiliate_attributions`
- Split Engine → calcula comissão baseada na atribuição
