import { supabase } from '@/integrations/supabase/client';

/**
 * Categorias de produto que NÃO exigem bipe de QR code para despacho.
 * Manipulados e serviços não têm etiqueta serial física.
 */
const EXEMPT_CATEGORIES = new Set(['manipulado', 'servico', 'ebook', 'info_video_aula']);

export interface MissingScanDetail {
  product_id: string;
  product_name: string;
  required: number;
  scanned: number;
}

export interface QrDispatchValidationResult {
  ok: boolean;
  missing: MissingScanDetail[];
}

/**
 * Trava dura para despacho: verifica se todos os produtos da venda que possuem
 * QR code ativo (existem etiquetas seriais cadastradas para o produto na org)
 * tiveram a quantidade necessária bipada/associada à venda.
 *
 * Manipulados e serviços são isentos.
 */
export async function validateQrScansForDispatch(
  saleId: string,
  organizationId: string
): Promise<QrDispatchValidationResult> {
  // 1) Itens da venda
  const { data: items, error: itemsErr } = await supabase
    .from('sale_items')
    .select('product_id, product_name, quantity')
    .eq('sale_id', saleId);

  if (itemsErr) throw itemsErr;
  if (!items || items.length === 0) {
    return { ok: true, missing: [] };
  }

  // Agregar quantidade requerida por produto
  const required = new Map<string, { name: string; qty: number }>();
  for (const it of items) {
    if (!it.product_id) continue;
    const cur = required.get(it.product_id);
    const qty = Number(it.quantity || 0);
    if (cur) {
      cur.qty += qty;
    } else {
      required.set(it.product_id, { name: it.product_name || 'Produto', qty });
    }
  }

  const productIds = Array.from(required.keys());
  if (productIds.length === 0) return { ok: true, missing: [] };

  // 2) Categorias dos produtos (para excluir manipulados/serviços)
  const { data: products, error: prodErr } = await supabase
    .from('lead_products')
    .select('id, category')
    .in('id', productIds)
    .eq('organization_id', organizationId);

  if (prodErr) throw prodErr;

  const exemptIds = new Set<string>();
  for (const p of products || []) {
    if (EXEMPT_CATEGORIES.has((p as any).category)) exemptIds.add(p.id);
  }

  const trackableIds = productIds.filter((id) => !exemptIds.has(id));
  if (trackableIds.length === 0) return { ok: true, missing: [] };

  // 3) Quais desses produtos têm QR ativo? (existe pelo menos 1 etiqueta serial cadastrada)
  const { data: anySerials, error: serialErr } = await supabase
    .from('product_serial_labels')
    .select('product_id')
    .eq('organization_id', organizationId)
    .in('product_id', trackableIds);

  if (serialErr) throw serialErr;

  const qrActiveIds = new Set((anySerials || []).map((r: any) => r.product_id));
  if (qrActiveIds.size === 0) return { ok: true, missing: [] };

  // 4) Quantos seriais já foram bipados/associados a essa venda por produto
  const qrActiveArr = Array.from(qrActiveIds);
  const { data: scanned, error: scanErr } = await supabase
    .from('product_serial_labels')
    .select('product_id')
    .eq('organization_id', organizationId)
    .eq('sale_id', saleId)
    .in('product_id', qrActiveArr);

  if (scanErr) throw scanErr;

  const scannedCount = new Map<string, number>();
  for (const r of scanned || []) {
    scannedCount.set(r.product_id, (scannedCount.get(r.product_id) || 0) + 1);
  }

  // 5) Comparar e montar lista de pendências
  const missing: MissingScanDetail[] = [];
  for (const pid of qrActiveArr) {
    const req = required.get(pid)!;
    const scn = scannedCount.get(pid) || 0;
    if (scn < req.qty) {
      missing.push({
        product_id: pid,
        product_name: req.name,
        required: req.qty,
        scanned: scn,
      });
    }
  }

  return { ok: missing.length === 0, missing };
}

export function formatMissingScansMessage(missing: MissingScanDetail[]): string {
  const lines = missing.map(
    (m) => `• ${m.product_name}: ${m.scanned}/${m.required} bipado(s)`
  );
  return [
    '🚫 DESPACHO BLOQUEADO — faltam bipes de QR code:',
    ...lines,
    '',
    'Bipe TODAS as unidades dos produtos rastreados antes de despachar.',
    'Manipulados e serviços são isentos.',
  ].join('\n');
}
