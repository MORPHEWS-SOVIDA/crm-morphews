CREATE OR REPLACE FUNCTION public.get_serial_stock_overview(p_organization_id uuid)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  prefix text,
  min_code text,
  max_code text,
  total bigint,
  in_stock bigint,
  assigned bigint,
  shipped bigint,
  stocked_by uuid,
  stocked_by_name text,
  stocked_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    psl.product_id,
    COALESCE(lp.name, 'Produto desconhecido') as product_name,
    regexp_replace(psl.serial_code, '\d+$', '') as prefix,
    min(psl.serial_code) as min_code,
    max(psl.serial_code) as max_code,
    count(*)::bigint as total,
    count(*) FILTER (WHERE psl.status = 'in_stock')::bigint as in_stock,
    count(*) FILTER (WHERE psl.status = 'assigned')::bigint as assigned,
    count(*) FILTER (WHERE psl.status = 'shipped')::bigint as shipped,
    psl.stocked_by,
    COALESCE(p.first_name || ' ' || p.last_name, '') as stocked_by_name,
    max(psl.stocked_at) as stocked_at
  FROM product_serial_labels psl
  LEFT JOIN lead_products lp ON lp.id = psl.product_id
  LEFT JOIN profiles p ON p.user_id = psl.stocked_by
  WHERE psl.organization_id = p_organization_id
    AND psl.product_id IS NOT NULL
  GROUP BY psl.product_id, lp.name, regexp_replace(psl.serial_code, '\d+$', ''), psl.stocked_by, p.first_name, p.last_name
  ORDER BY lp.name, max(psl.stocked_at) DESC NULLS LAST;
$$;