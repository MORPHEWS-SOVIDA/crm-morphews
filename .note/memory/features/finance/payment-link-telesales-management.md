# Memory: features/finance/payment-link-telesales-management
Updated: just now

Gestão de Links de Pagamento e Televendas: Suporta a criação de links de pagamento e o processamento manual de cartões. O cálculo de parcelamento utiliza juros simples (Total = Base * (1 + Taxa/100)) para evitar distorções em parcelamentos longos (ex: 12x). Por preferência de conversão, as opções de parcelamento não devem exibir rótulos indicando juros (ex: "(com juros)") ao cliente, mesmo quando aplicados. O sistema de busca de CEP possui resiliência automática, alternando de ViaCEP para BrasilAPI após falha ou timeout de 8 segundos.

## Juros por Conta do Vendedor/Empresa
- Campos na tabela `payment_links`: `interest_bearer` ('customer' | 'seller'), `max_interest_free_installments`
- Componente reutilizável: `InterestBearerSelector.tsx`
- Quando `interest_bearer = 'seller'`:
  - O checkout não cobra juros do cliente até `max_interest_free_installments` parcelas
  - O vendedor vê aviso com custo estimado dos juros e valor líquido que a empresa receberá
  - Para comissão e metas, o valor considerado é o líquido (sem os juros absorvidos)
- Presente em: CreateClientPaymentLinkDialog, QuickPaymentLinkButton, InlineTelesalesForm, TelesalesTab
- O PaymentLinkCheckout respeita o `interest_bearer` do link para calcular parcelas
