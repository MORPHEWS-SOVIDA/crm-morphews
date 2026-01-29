# Memory: features/resell/implementer-system-v1
Updated: just now

## Sistema de Implementadores Morphews

### Conceito
Implementadores são revendedores certificados que vendem planos Morphews com serviço de implementação.

### Modelos de Venda

#### 1. Com Implementação (Link Customizado)
- Implementador cria link em `/implementador` com plano + taxa de implementação
- Cliente paga: Mensalidade + Taxa de Implementação
- **Checkout**: Formulário inline com PIX, Boleto e Cartão de Crédito (Pagar.me V5)
- **Comissões**:
  - Taxa de Implementação: 88% implementador, 12% plataforma
  - 1ª Mensalidade: 40% para implementador
  - Mensalidades seguintes: 10% para implementador

#### 2. Indicação (Link Referral)
- Implementador usa código `?ref=IMP-XXXXXX` no site de planos (/planos) ou checkout (/checkout)
- **Comissões**:
  - 1ª Mensalidade: 40% para implementador
  - Mensalidades seguintes: 10% para implementador

### Regras de Negócio
- Comissão recorrente: Só enquanto implementador mantiver plano próprio ativo (R$297/mês)
- Taxa de implementação: Livre (sem limites de valor)
- Plano Implementador: R$297/mês com todas features liberadas para demonstração
- Captura de referência: Funciona em `/planos` E `/checkout`

### Tabelas
- `implementers` - Registro de implementadores (user_id, referral_code, totals)
- `implementer_sales` - Clientes trazidos por implementadores
- `implementer_commissions` - Histórico de comissões (implementation_fee, first_month, recurring)
- `implementer_checkout_links` - Links customizados com taxa de implementação
- `implementer_pending_checkouts` - Checkouts PIX/Boleto aguardando confirmação

### Rotas
- `/implementador` - Dashboard do implementador (autenticado)
- `/implementador/:slug` - Checkout público com taxa de implementação

### Edge Functions
- `implementer-checkout` - Cria pedido Pagar.me V5 com mensalidade + taxa (PIX/Boleto/Cartão)
- `create-checkout` - Passa `implementerRef` nos metadados do Stripe para referências
- `stripe-webhook` - Processa comissões no checkout.session.completed e invoice.paid

### Componentes
- `ImplementerDashboard.tsx` - Dashboard completo com stats, links, clientes e comissões
- `CreateCheckoutLinkDialog.tsx` - Dialog para criar links com taxa
- `ImplementerCheckoutPage.tsx` - Página pública de checkout com formulário inline de cartão

### Dashboard do Implementador (Completo)
- Cards de estatísticas: Total Ganhos, Clientes Ativos, Pendente, Já Recebido
- Link de Indicação com botão de copiar
- Tabs: Links de Checkout, Clientes, Comissões
- Histórico detalhado de comissões com status (pendente/pago)

### Plano Implementador
- ID: `943ced78-8722-4402-8bd4-52b635d45d3e`
- Preço: R$297/mês
- Todas features habilitadas (99 usuários, 50k energia, 5 WhatsApp)
- Não visível no site (contratação direta)

### Validações
- Checkout só processa se implementador tiver assinatura ativa
- Comissão recorrente (10%) só é gerada se implementador mantiver plano ativo
- Email duplicado é bloqueado no checkout
