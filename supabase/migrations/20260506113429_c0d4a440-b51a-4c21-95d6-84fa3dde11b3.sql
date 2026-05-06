UPDATE sale_checkpoints sc
SET completed_at = '2026-04-30 22:40:00+00'
FROM sales s
WHERE sc.sale_id = s.id
  AND sc.checkpoint_type = 'delivered'
  AND s.romaneio_number IN (13299, 13294, 13292, 13277, 13276, 13271, 13256, 13247, 13230, 13226, 13223, 13222, 13218, 13211, 13169, 13161, 13145, 13123, 13113, 13098, 13092, 12990, 12859);