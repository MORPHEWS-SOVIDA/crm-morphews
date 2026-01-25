# Memory: features/ecommerce/standalone-checkouts-v1
Updated: just now

## Sistema de Checkouts Standalone

### Objetivo
Permitir venda direta via link sem necessidade de loja ou landing page. Ideal para operações x1, afiliados e tráfego direto.

### URL Pública
- `/pay/:slug` - Página de checkout público

### Tipos de Checkout
- **One-Step**: Todos os campos na mesma tela
- **Two-Step**: Lead → Pagamento
- **Three-Step**: Dados → Frete → Pagamento

### Elementos Visuais (Builder)
1. **Cronômetro de Urgência**: Contagem regressiva configurável (5-60 min)
2. **Banner Superior**: Texto + cores customizáveis
3. **Depoimentos**: Carrossel com avaliações (tabela `checkout_testimonials`)
4. **Garantia**: Selo com dias e texto configurável
5. **Trust Badges**: Pagamento seguro, devolução, suporte

### Order Bump
- Produto adicional com desconto exclusivo
- Configuração: produto, desconto %, headline, descrição

### Personalização Visual (Tema)
- Cor primária, fundo, texto
- Família de fonte (Inter, Poppins, Roboto, etc.)
- Border radius
- Estilo do botão (sólido, contorno, gradiente)

### Métodos de Pagamento
- PIX (com desconto opcional)
- Cartão de Crédito (parcelamento)
- Boleto

### Tracking
- Facebook Pixel ID
- Google Analytics ID
- TikTok Pixel ID
- Meta title/description (SEO)

### Tabelas
- `standalone_checkouts`: Configuração principal
- `checkout_testimonials`: Depoimentos vinculados

### Componentes
- `CheckoutsManager.tsx`: Lista e gerencia checkouts
- `CheckoutFormDialog.tsx`: Criação/edição de checkout
- `CheckoutBuilderDialog.tsx`: Editor visual (elementos, depoimentos, tema)
- `PublicCheckoutPage.tsx`: Página pública para cliente final

### Hooks
- `useStandaloneCheckouts.ts`: CRUD completo + hook público

### Rota Admin
- `/ecommerce/checkouts` (aba na sidebar do E-commerce)
