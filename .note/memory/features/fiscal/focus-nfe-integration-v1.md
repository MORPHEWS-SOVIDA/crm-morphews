# Memory: features/fiscal/focus-nfe-integration-v1
Updated: now

## Focus NFe Integration

### Visão Geral
Integração com Focus NFe para emissão de NF-e (produtos) e NFS-e (serviços). Token global configurado como secret `FOCUS_NFE_TOKEN`.

### Tabelas Criadas
- `fiscal_companies`: Empresas/CNPJs por tenant com certificado A1
- `fiscal_invoices`: Notas fiscais emitidas
- `fiscal_invoice_events`: Histórico de eventos (webhook)

### Campos Fiscais em Produtos (lead_products)
- `fiscal_ncm`: NCM 8 dígitos
- `fiscal_cfop`: CFOP padrão
- `fiscal_cst`: CST/CSOSN
- `fiscal_origin`: 0-8 (origem da mercadoria)
- `fiscal_product_type`: 'product', 'service', 'mixed'
- `fiscal_lc116_code`: Código LC 116 para serviços
- `fiscal_iss_aliquota`: Alíquota ISS para NFS-e

### Edge Functions
- `focus-nfe-emit`: Emite nota fiscal (chamado com sale_id, invoice_type, fiscal_company_id opcional)
- `focus-nfe-webhook`: Recebe callbacks do Focus NFe para atualizar status (valida header X-Webhook-Secret)
- `focus-nfe-status`: Consulta status de nota no Focus NFe
- `focus-nfe-register-hooks`: Registra webhooks automaticamente via API Focus NFe

### Registro de Webhooks
O botão "Webhooks" no FiscalCompaniesManager chama `focus-nfe-register-hooks` que:
- Usa `/v2/hooks` da API Focus NFe
- Envia `authorization_key` e `authorization_header: X-Webhook-Secret`
- Registra eventos 'nfe' e 'nfse' simultaneamente

### Webhook URL
`https://rriizlxqfpfpdflgxjtj.supabase.co/functions/v1/focus-nfe-webhook`

### Componentes
- `FiscalCompaniesManager`: Gestão de CNPJs/certificados em Settings
- `FiscalInvoicesManager`: Lista de notas emitidas em Settings
- `SaleInvoiceCard`: Card de emissão em SaleDetail

### Hooks
- `useFiscalCompanies.ts`: CRUD de empresas fiscais
- `useFiscalInvoices.ts`: CRUD de notas + mutations de emissão

### Localização
- Settings: Tab "Notas Fiscais" (apenas admin/owner)
- ProductForm: Seção "Dados Fiscais"
- SaleDetail: Card "Notas Fiscais" na coluna direita

### Fluxo de Emissão
1. Usuário clica "Emitir NF" na venda
2. Seleciona tipo (NFe/NFSe) e empresa (se múltiplas)
3. Edge function cria registro e envia para Focus NFe
4. Focus NFe processa e envia webhook de retorno
5. Status atualizado automaticamente

### Próximos Passos
- Implementar cancelamento de nota
- Adicionar filtro de empresa no ProductForm
- Considerar emissão automática após confirmação de pagamento
