# Memory: features/finance/payment-link-and-telesales-v2-unified
Updated: just now

## Sistema de Link de Pagamento e Televendas - COMPLETO

### Rotas
- **`/cobrar`**: Página principal (menu Financeiro)
- **`/pagar/:slug`**: Checkout público para clientes pagarem

### Tipos de Link
1. **Link Multi-Uso**: Reutilizável, endereço opcional no checkout
2. **Link para Cliente**: 
   - Uso único (expira após pagamento)
   - Busca dados do CRM (Lead)
   - Pré-preenche: Nome, CPF, Telefone, Email e **Endereço**
   - Aviso se endereço incompleto (recomendado para cartão)

### Endereço e Aprovação de Cartão
A Pagar.me utiliza o endereço para análise antifraude, especialmente em tickets altos.
- **Link Multi-Uso**: Endereço opcional (expansível no checkout)
- **Link para Cliente**: Endereço puxado automaticamente do CRM
- Campos: `customer_cep`, `customer_street`, `customer_street_number`, `customer_neighborhood`, `customer_city`, `customer_state`, `customer_complement`

### Componentes
- `CreateClientPaymentLinkDialog.tsx`: Dialog para criar link vinculado a Lead
- `QuickPaymentLinkButton.tsx`: Botão de ação rápida
- `InlineTelesalesForm.tsx`: Dialog de venda digitada (cartão ao vivo)
- `PaymentActionsBar.tsx`: Barra unificada com link + televendas

### Taxas Padrão
- **Cartão**: 4,99% + R$1,00 | D+14 | Juros 2,69%/mês
- **PIX**: 0,99% + R$1,00 | D+1
- **Boleto**: 0,5% + R$4,00 | D+3

### Permissões
- `payment_gateways_manage`: Criar links de pagamento
- `telesales_manage`: Venda digitada de cartão
- `virtual_wallet_view`: Ver transações e carteira
