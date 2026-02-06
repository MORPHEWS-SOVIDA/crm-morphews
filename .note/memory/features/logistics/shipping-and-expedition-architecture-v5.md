# Memory: features/logistics/shipping-and-expedition-architecture-v5
Updated: just now

Logística de Envio e Expedição: Integra cotações via Correios e Melhor Envio (URL de produção: 'https://melhorenvio.com.br/api/v2') com geração de etiquetas em modo 'public'. O fluxo 'Add Receptivo' possui um mecanismo de fallback 'Prosseguir sem Melhor Envio' para falhas de API. O sistema impõe validação de endereço rigorosa: se o lead não possuir CEP, logradouro, cidade ou UF válidos, a opção 'Transportadora' é desativada e o sistema alterna automaticamente para 'Retirada no Balcão' (pickup). A interface permite a edição de dados fiscais (NCM/CFOP) em notas rejeitadas.

## Transportadora Manual (sem integração)
- Na tela de venda (MelhorEnvioLabelSection), o vendedor pode adicionar código de rastreio manualmente, mesmo SEM Melhor Envio configurado
- O campo de rastreio manual aparece SEMPRE, com opção de gerar etiqueta via Melhor Envio apenas quando configurado
- No DeliveryTypeSelector, a seção "outra transportadora" é SEMPRE visível, não apenas quando há transportadoras manuais cadastradas
- Informação clara de que o rastreio pode ser adicionado depois
- Tracking code salvo diretamente na coluna `tracking_code` da tabela `sales`
