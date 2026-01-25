# Memory: features/ecommerce/cart-and-sales-automation-v1
Updated: just now

## Automação de Carrinhos e Vendas

### Tabela ecommerce_automation_config - Novos Campos
- `default_seller_id`: UUID do vendedor padrão para atribuição de vendas via e-commerce
- `cart_recovery_reason_id`: Referência a `non_purchase_reasons` para follow-up automático de carrinho abandonado
- `paid_notification_funnel_stage_id`: Etapa do funil para mover o lead quando pagamento é confirmado

### Configurações de Carrinhos (/ecommerce/carrinhos)
O dialog de "Configurações de Automação" foi refatorado para incluir:
1. **Vendedor Padrão**: Seletor de usuários da organização para atribuição automática
2. **Follow-up de Recuperação**: Seletor de motivos de não-compra (cadência de mensagens) em vez de simples toggle "Enviar WhatsApp"
3. **Etapa do Funil**: Mover lead para etapa específica quando venda é confirmada
4. **Delay configurável**: Tempo de espera após abandono antes de iniciar follow-up

### Configurações de Vendas (/ecommerce/vendas)
Novo componente `SalesAutomationDialog.tsx` adicionado com:
- Seletor de vendedor padrão
- Etapa do funil para venda confirmada
- Toggle de notificação da equipe

### Padrão de Follow-up
O sistema agora segue o mesmo padrão das integrações de webhook:
- Em vez de perguntar "Enviar WhatsApp?", pergunta "Qual follow-up automático usar?"
- Isso conecta ao sistema existente de `non_purchase_reasons` que já gerencia cadências de mensagens

### Componentes Atualizados
- `src/pages/ecommerce/EcommerceCarrinhos.tsx`: Refatorado dialog de automação
- `src/pages/ecommerce/EcommerceVendas.tsx`: Adicionado botão de configuração
- `src/components/ecommerce/SalesAutomationDialog.tsx`: Novo componente

### Correção de Pedido Não Encontrado
- Adicionado logging detalhado em `EcommerceOrderDetail.tsx`
- Melhorada UI de erro com botão "Tentar novamente" e exibição do ID
- Problema pode ser relacionado a sessão/RLS no navegador de produção
