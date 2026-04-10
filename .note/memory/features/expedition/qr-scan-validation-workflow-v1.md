# Memory: features/expedition/qr-scan-validation-workflow-v1
Updated: just now

## Fluxo de Validação por QR Code na Expedição

### QR Code no Romaneio
- Romaneios (A5/A5x2/Thermal) incluem QR code que aponta para `/expedicao/validar/{saleId}`
- URL de produção: `https://crm-morphews.lovable.app/expedicao/validar/{saleId}`
- Ao escanear, a colaboradora da expedição é levada diretamente para a tela de conferência do pedido

### Página de Validação Mobile (`/expedicao/validar/:saleId`)
- Componente: `src/pages/ExpeditionValidatePage.tsx`
- Mobile-first: layout otimizado para celular na mão
- Mostra resumo do pedido (cliente, produtos, quantidades, valor)
- Usa `SaleScanValidation` em modo `separation` para bipar cada produto
- Ao completar scan de TODOS os itens, marca automaticamente checkpoint `pending_expedition` (Separado)

### Obrigatoriedade do Scan
- No `SaleCheckpointsCard`, o botão "Validar Expedição" agora:
  - Se a venda TEM itens → abre scanner dialog (obrigatório bipar todos)
  - Se a venda NÃO tem itens → abre confirmação direta (fallback)
- Lógica: se tem 3 produtos com 12 unidades total, a expedição precisa bipar 12 QR codes de etiquetas seriais
- Impede avanço de etapa sem conferência física

### Componentes Envolvidos
- `src/pages/ExpeditionValidatePage.tsx` — página mobile de validação
- `src/components/serial-labels/SaleScanValidation.tsx` — lógica de scan e progresso
- `src/components/sales/SaleCheckpointsCard.tsx` — enforce scan no checkpoint
- `src/pages/RomaneioPrint.tsx` — QR code atualizado
