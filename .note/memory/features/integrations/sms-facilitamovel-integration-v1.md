# Memory: features/integrations/sms-facilitamovel-integration-v1
Updated: 2026-02-05

## Integração SMS via FacilitaMóvel

Sistema de envio de SMS usando a API HTTP do FacilitaMóvel, com billing separado (não usa energias).

### Precificação SMS
- 500 SMS = R$ 75,00 (R$ 0,15/SMS)
- 2.000 SMS = R$ 240,00 (R$ 0,12/SMS)
- 5.000 SMS = R$ 500,00 (R$ 0,10/SMS)
- 10.000 SMS = R$ 900,00 (R$ 0,09/SMS)

### Tabelas
- `sms_packages` - Pacotes disponíveis para compra
- `sms_credits_balance` - Saldo por organização
- `sms_credits_purchases` - Histórico de compras
- `sms_usage` - Log de envios com status
- `sms_provider_config` - Credenciais FacilitaMóvel por org

### Edge Functions
- `facilita-send-sms` - Envia SMS via API FacilitaMóvel
- `facilita-sms-webhook` - Recebe status e respostas (MO)

### URLs de Webhook (configurar no FacilitaMóvel)

**Status:**
```
{SUPABASE_URL}/functions/v1/facilita-sms-webhook?type=status&fone=#phone&idSMS=#smsId&statusEntregue=#status&chaveCliente=#externalkey&dataPostagem=#dataPostagem
```

**Respostas (MO):**
```
{SUPABASE_URL}/functions/v1/facilita-sms-webhook?type=response&fone=#phone&datahora=#datahora&mensagem=#msg&smsId=#smsId&externalKey=#externalKey
```

### Componentes Frontend
- `SmsConfigManager` - Aba em Configurações para gerenciar SMS
- `useSmsCredits` hook - Gerenciamento de saldo, envio e config

### Códigos de Status FacilitaMóvel
- 1: Login inválido
- 2: Sem créditos
- 3: Celular inválido
- 4: Mensagem inválida
- 5: Mensagem agendada
- 6: Mensagem enviada

### Webhook Status
- 1: Enfileirada
- 2: Agendada
- 3: Enviando
- 4: Entregue
- 5: Erro