# Memory: features/finance/partner-notifications-v1
Updated: just now

## Notificações Automáticas para Parceiros

### Descrição
Quando uma venda é confirmada (pagamento aprovado), todos os parceiros que recebem comissão são notificados automaticamente via **WhatsApp** e **Email**.

### Parceiros Notificados
- **Afiliados** (via organization_affiliates ou partner_associations legacy)
- **Co-produtores** (via coproducers table)
- **Indústrias** (via product_industry_costs)
- **Fábricas** (via product_factory_costs)

### Mensagem
**WhatsApp:**
```
🎉 Parabéns, [NOME]!

Hora de comemorar! Saiu uma venda com seu link!

💰 Sua comissão: R$ XX,XX
👤 Cliente: [NOME DO CLIENTE]
📦 Tipo: [Afiliado/Co-produtor/etc]

Acesse crm.morphews.com/login e confira os detalhes! 🚀
```

**Email:**
- Template HTML responsivo com branding Morphews
- Destaque visual para o valor da comissão
- Botão CTA para acessar o painel

### Arquitetura Técnica
- **Módulo**: `supabase/functions/payment-webhook/partner-notifications.ts`
- **Integração**: Chamado pelo `split-engine.ts` após todos os splits serem processados
- **WhatsApp**: Usa a instância admin configurada em `system_settings.admin_whatsapp_instance`
- **Email**: Usa Resend API via `RESEND_API_KEY`
- **Execução**: Async (não bloqueia o webhook de pagamento)

### Coleta de Contatos
- **Afiliados**: email de `organization_affiliates`, telefone de `profiles.whatsapp`
- **Co-produtores**: email de `virtual_accounts.holder_email`, telefone via `profiles`
- **Indústrias/Fábricas**: email e phone diretamente das tabelas `industries`/`factories`

### Trigger
As notificações são disparadas automaticamente quando:
1. Webhook de pagamento recebe confirmação (order.paid)
2. Split engine processa os splits com sucesso
3. Cada parceiro que teve split criado é adicionado à lista de notificação
