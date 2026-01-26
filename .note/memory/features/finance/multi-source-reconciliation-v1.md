# Memory: features/finance/multi-source-reconciliation-v1
Updated: just now

## Conciliação Multi-Fonte de Pagamentos

### Conceito
Sistema de conciliação semi-automática que permite vendedores associarem pagamentos recebidos via diferentes fontes (EfiPay PIX, Getnet TEF, Banrisul/Vero) às vendas pendentes.

### Fluxo
1. Vendedor marca venda como "Vai pagar antes"
2. Ao confirmar pagamento, sistema pergunta a **fonte**
3. Se fonte tem API → mostra transações pendentes não associadas
4. Vendedor seleciona → sistema vincula automaticamente

### Tabelas Criadas
- `incoming_transactions`: Armazena transações recebidas de fontes externas
  - Campos: source, source_transaction_id, amount_cents, payer_name, payer_document, status
  - Status: pending, matched, ignored
- `payment_sources`: Configuração de fontes por organização
  - Campos: source, display_name, credentials_encrypted, pix_key, webhook_secret

### Edge Functions
- `efipay-webhook`: Recebe notificações de PIX da EfiPay
  - URL: `${SUPABASE_URL}/functions/v1/efipay-webhook?org={org_id}&hmac={secret}`
  - Auto-match quando há exatamente 1 venda pendente com mesmo valor

### Componentes
- `PaymentSourceSelector`: Dialog para selecionar fonte e associar transação
- `useIncomingTransactions`: Hook para gerenciar transações pendentes
- `useMatchingTransactions`: Busca transações com valor similar (1% tolerância)

### RPC Functions
- `match_transaction_to_sale(p_transaction_id, p_sale_id, p_user_id)`: Associa transação à venda e atualiza status para pago

### Próximos Passos
1. Integrar `PaymentSourceSelector` no fluxo de confirmação de pagamento
2. Criar webhooks para Getnet e Banrisul/Vero
3. Adicionar configuração de fontes no Settings
