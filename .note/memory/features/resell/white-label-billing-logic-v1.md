# Memory: features/resell/white-label-billing-logic-v1
Updated: now

Regras de Custo Mínimo para Planos White Label: O sistema impõe um custo de plataforma dinâmico (calculatePlatformCost) que o revendedor deve cobrir ao criar seus planos. Os custos obrigatórios incluem: R$ 50,00 por instância de WhatsApp adicional (1 inclusa), R$ 2,00 por usuário adicional (3 inclusos), R$ 150,00 pela ativação de NF-e (inclui 100 notas, R$ 0,10 por nota extra), R$ 125,00 para Tracking/Pixel, um mínimo de 1.000 unidades de energia de IA e R$ 7,00 por cada 1.000 unidades de energia extra. A taxa de setup tem 12% retido pela plataforma (88% para o revendedor). A interface de criação de planos valida em tempo real se o preço final é superior ao custo total da plataforma para garantir a rentabilidade da operação.

Configurações do Parceiro White Label (em /white-admin/configuracoes):
- Resend API Key: Parceiro pode configurar sua própria chave do Resend para enviar emails personalizados com sua marca
- WhatsApp de Boas-Vindas: Seleção de instância conectada para enviar mensagens de boas-vindas com credenciais
- Toggles para ativar/desativar envio via email e/ou WhatsApp

Fluxo de Checkout White Label:
- Landing page (/:slug) direciona para checkout (/:slug/checkout/:planSlug) ao clicar em "Contratar"
- Pagamento processado via Pagar.me V5 na conta da plataforma
- Edge function 'white-label-checkout' cria usuário, organização, subscription e envia credenciais
- Welcome email usa branding do parceiro (logo, cor, nome da marca)
- Opção de enviar senha por WhatsApp usando instância configurada pelo parceiro
