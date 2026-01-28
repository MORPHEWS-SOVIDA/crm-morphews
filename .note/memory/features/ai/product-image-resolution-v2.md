# Memory: features/ai/product-image-resolution-v2
Updated: 2026-01-28

## Problema Corrigido
Ao trocar de especialista (ex: Bambu → Nori), o bot enviava a imagem do produto anterior porque a resolução de mídia era baseada em:
1. Keywords na resposta da IA (não na mensagem do usuário)
2. Cache/estado de mídia não resetado entre trocas

## Nova Lógica (Product-Scoped)

### Detecção de Produto
- Produto detectado a partir da **MENSAGEM DO USUÁRIO**, não da resposta da IA
- Usa scoring para match mais específico (nome completo > palavras individuais)

### Galeria de Imagens Ordenada
Cada produto tem uma galeria ordenada:
1. `image_url` (foto principal)
2. `label_image_url` (rótulo)
3. `ecommerce_images[]` (fotos adicionais)

### Handling de "Outra Foto"
Detecta padrões como "outra foto", "mais fotos", "outro ângulo" e:
1. Consulta histórico de mensagens (`whatsapp_messages`) para ver quais imagens já foram enviadas
2. Envia a próxima imagem não enviada da galeria
3. Se todas já foram enviadas, não envia nada (deixa a IA responder)

### Reset de Estado
- Não há mais estado de mídia em memória
- Cada requisição consulta o banco para verificar imagens já enviadas
- Troca de especialista não herda contexto de mídia

## Funções Modificadas
- `sendProductMedia()` - Refatorada completamente
- `detectProductFromUserMessage()` - Nova função
- `getProductImageGallery()` - Nova função
- `isAskingForMorePhotos()` - Nova função
- `getProductImagesSentInConversation()` - Nova função

## Acceptance Criteria ✅
- "Quero a cadeira Nori" → Imagem Nori (nunca Bambu)
- "E a cadeira Carioca?" → Imagem Carioca
- "Tem outra foto?" (2 imagens) → Segunda imagem do mesmo produto
- "Tem outra foto?" (1 imagem) → Apenas texto, sem imagem
