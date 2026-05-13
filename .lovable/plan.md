## Diagnóstico

Venda `fc871bee-5445-47f2-b8bd-71ee4bfc4bae` (Leonan, R$647,80) tem **10 itens em vez de 5** — todos sem `combo_id`/`combo_item_parent_id`. O total da venda (`sales.total_cents = 64780`) está certo, mas os itens estão duplicados e os kits não estão estruturados como pai/filho.

**Causa raiz** (em `src/pages/EditSale.tsx`, função `handleSave`):

1. **Sem proteção contra clique duplo**: itens novos são marcados com `id: new_${Date.now()}` e inseridos no save. Após inserir, o state não é atualizado — se o usuário clicar Salvar de novo (ou a UI re-renderizar antes do redirect), **os mesmos itens são inseridos novamente**. Foi exatamente o que aconteceu (12:35:09 e 12:35:21, gap de 12s).
2. **Não conhece combos**: o `ProductSelectionDialog` permite escolher combos, mas o EditSale grava cada combo como uma linha plana com `combo_id = null` e `combo_item_parent_id = null` — perdendo a estrutura pai/filho que o `SaleDetail`, `Romaneio`, `Expedição` e split de comissões esperam.

## Correção em duas frentes

### 1. Corrigir os dados da venda fc871bee (one-shot)

Via `supabase--insert`:

- Apagar os 5 itens duplicados (timestamp `12:35:21.662715+00`).
- Apagar os 5 itens "soltos" restantes.
- Inserir nova estrutura pai/filho com base nos kits Balestrero já cadastrados:

| Pai (combo) | Preço pai | Filhos (preço 0) |
|---|---|---|
| Kit Power Combat (`aaa20c1c…5555…89006`) | R$379,80 | Balestrero POWER + Combat Creatina |
| Kit Omega 3 + NAC (`b1e57ec0…0001`) | R$119,00 | Omega Power + NAC Defense ×1 |
| Kit NAC + Hydra Power (`b1e57ec0…0002`) | R$149,00 | NAC Defense ×1 + Hydra Power |

Total continua R$647,80, bate com `sales.total_cents`.

### 2. Blindar `EditSale.tsx` para nunca mais acontecer

a) **Lock anti-duplo-clique**: o botão Salvar e o `handleSave` já têm `isSaving`, mas falta um `useRef` síncrono pra cobrir o gap entre `setIsSaving(true)` e o re-render. Adicionar `savingRef` que retorna cedo se já estiver salvando.

b) **Marcar inseridos como `!isNew` após o insert**: usar `.insert(...).select()` e atualizar o state com os IDs reais retornados, pra que um segundo save não reinsira.

c) **Explosão de combo no save** (espelhando a lógica do `ecommerce-checkout` documentada em `combo-explosion-v1`):

   - Se `item.combo_id` estiver presente, inserir 1 item PAI (com `combo_id`, preço total do combo, `combo_item_parent_id = null`) e usar o `id` retornado para inserir N itens FILHOS (com `combo_item_parent_id = pai.id`, `combo_id` preenchido, `unit_price_cents = 0`, `quantity` = qty do componente × qty do combo).
   - Buscar os componentes do combo via `product_combo_items` no momento do save.

d) **`ProductSelectionDialog` precisa propagar `combo_id`** quando o usuário escolhe um kit. Verificar se já manda — se não, ajustar a interface `EditableItem` e `handleAddProduct` pra carregar `combo_id`.

### Arquivos afetados

- `src/pages/EditSale.tsx` — lock síncrono, explosão de combos no save, atualização de state pós-insert.
- `src/components/sales/ProductSelectionDialog.tsx` — garantir que `combo_id` chega ao callback.
- `src/pages/EditSale.tsx` interface `EditableItem` — adicionar `combo_id?: string`.

### Fora do escopo (sugiro tarefa separada se quiser)

- `AddReceptivo.tsx` (criação de venda nova) e `payment-webhook` (sale paga via Pagarme) — fluxos diferentes, podem ter o mesmo gap. Posso auditar depois se confirmar.

## Validação

1. Re-abrir `/vendas/fc871bee-5445-47f2-b8bd-71ee4bfc4bae` — deve mostrar 3 kits pai com componentes indentados, total R$647,80.
2. Editar uma venda de teste, adicionar um kit, clicar Salvar 3x rápido → só 1 conjunto de itens deve ser gravado, com pai/filho corretos.

Confirma que aplico tudo isso?