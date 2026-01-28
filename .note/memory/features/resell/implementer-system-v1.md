# Memory: features/resell/implementer-system-v1
Updated: just now

## Sistema de Implementadores Morphews

### Conceito
Implementadores são revendedores certificados que vendem planos Morphews com serviço de implementação.

### Modelos de Venda

#### 1. Com Implementação (Link Customizado)
- Implementador cria link em `/implementador` com plano + taxa de implementação
- Cliente paga: Mensalidade + Taxa de Implementação
- **Comissões**:
  - Taxa de Implementação: 88% implementador, 12% plataforma
  - 1ª Mensalidade: 40% para implementador
  - Mensalidades seguintes: 10% para implementador

#### 2. Indicação (Link Referral)
- Implementador usa código `?ref=IMP-XXXXXX` no site de planos
- **Comissões**:
  - 1ª Mensalidade: 40% para implementador
  - Mensalidades seguintes: 10% para implementador

### Regras de Negócio
- Comissão recorrente: Vitalícia, MAS só enquanto implementador mantiver plano ativo (R$297/mês)
- Taxa de implementação: Livre (sem limites de valor)
- Plano Implementador: R$297/mês com todas features liberadas para demonstração

### Tabelas
- `implementers` - Registro de implementadores (user_id, referral_code, totals)
- `implementer_sales` - Clientes trazidos por implementadores
- `implementer_commissions` - Histórico de comissões (implementation_fee, first_month, recurring)
- `implementer_checkout_links` - Links customizados com taxa de implementação

### Rotas
- `/implementador` - Dashboard do implementador (autenticado)
- `/implementador/:slug` - Checkout público com taxa de implementação

### Edge Functions
- `implementer-checkout` - Cria sessão Stripe com mensalidade + taxa
- `stripe-webhook` - Processa comissões no checkout.session.completed e invoice.paid

### Componentes
- `ImplementerDashboard.tsx` - Dashboard com stats, links, clientes e comissões
- `CreateCheckoutLinkDialog.tsx` - Dialog para criar links com taxa
- `ImplementerCheckoutPage.tsx` - Página pública de checkout

### Plano Implementador
- ID: `943ced78-8722-4402-8bd4-52b635d45d3e`
- Preço: R$297/mês
- Todas features habilitadas
- Não visível no site (contratação direta)
