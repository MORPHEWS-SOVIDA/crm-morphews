# Memory: features/finance/payment-link-and-telesales-v1
Updated: now

Sistema de Link de Pagamento e Televendas (/cobrar): Permite que lojistas gerem links de cobrança customizados e realizem vendas digitadas (telesales) integradas ao Pagar.me V5. 

## Taxas e Prazos por Método de Pagamento
- **Cartão de Crédito**: 4,99% + R$1,00 (D+15). A taxa fixa de R$1,00 cobre custos de anti-fraude e processamento do gateway.
- **PIX**: 0,99% + R$1,00 (D+1)
- **Boleto**: 0,5% + R$4,00 (D+3)

## Regra de Juros de Parcelamento
Os juros de parcelamento (2,69% a.m.) pagos pelo cliente são receita exclusiva do Super Admin (Plataforma) e **não** integram o saldo do lojista. Exemplo:
- Venda R$100 em 3x
- Cliente paga R$100 + juros (~R$8,07) = R$108,07
- Lojista recebe R$100 - taxas (4,99% + R$1,00)
- Plataforma captura R$8,07 (juros) + taxa plataforma

## Funcionalidades
- Gestão de transações com `base_amount` e `interest_amount` separados
- Cadastro de conta bancária para saque (taxa de R$3,80 por saque)
- Permissões granulares por usuário
- Atalhos de cobrança integrados aos módulos de 'Add Receptivo' e 'Vendas'
- Geração de links automáticos com valor final ou cobrança inline via televendas

## Arquivos Principais
- `supabase/functions/process-payment-link/index.ts` - Edge function de processamento
- `src/components/payment-links/InlineTelesalesForm.tsx` - Formulário de televendas
- `src/pages/PaymentLinkCheckout.tsx` - Checkout de link de pagamento
- `src/components/payment-links/WalletTab.tsx` - Carteira e dados bancários
