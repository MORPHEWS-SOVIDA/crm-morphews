-- Finaliza as 13 vendas restantes do fechamento #158 (motoboy) que travaram no loop
WITH target_sales AS (
  SELECT s.id, s.printed_at, s.expedition_validated_at, s.dispatched_at, s.delivered_at, s.payment_confirmed_at
  FROM sales s
  JOIN pickup_closing_sales pcs ON pcs.sale_id = s.id
  WHERE pcs.closing_id = '79a9b46a-dfa8-4155-b628-0a86288f0a04'
    AND s.status NOT IN ('finalized','cancelled','returned')
)
UPDATE sales s SET
  status = 'finalized',
  finalized_at = '2026-04-17 21:20:28.369+00',
  finalized_by = '6fee8f43-5efb-4752-a2ce-a70c8e9e3cd2',
  printed_at = COALESCE(s.printed_at, '2026-04-17 21:20:28.369+00'),
  expedition_validated_at = COALESCE(s.expedition_validated_at, '2026-04-17 21:20:28.369+00'),
  dispatched_at = COALESCE(s.dispatched_at, '2026-04-17 21:20:28.369+00'),
  delivered_at = COALESCE(s.delivered_at, '2026-04-17 21:20:28.369+00'),
  delivery_status = COALESCE(s.delivery_status, 'delivered_normal'),
  payment_confirmed_at = COALESCE(s.payment_confirmed_at, '2026-04-17 21:20:28.369+00'),
  payment_confirmed_by = COALESCE(s.payment_confirmed_by, '6fee8f43-5efb-4752-a2ce-a70c8e9e3cd2')
FROM target_sales t
WHERE s.id = t.id;

-- Completa checkpoints pendentes
UPDATE sale_checkpoints sc SET
  completed_at = '2026-04-17 21:20:28.369+00',
  completed_by = '6fee8f43-5efb-4752-a2ce-a70c8e9e3cd2',
  notes = COALESCE(sc.notes, 'FINALIZAÇÃO SEM HUMANO — etapa concluída pelo processo de FINALIZAÇÃO')
WHERE sc.sale_id IN (
  SELECT pcs.sale_id FROM pickup_closing_sales pcs
  WHERE pcs.closing_id = '79a9b46a-dfa8-4155-b628-0a86288f0a04'
)
AND sc.checkpoint_type IN ('printed','pending_expedition','dispatched','delivered','payment_confirmed')
AND sc.completed_at IS NULL;