-- Add location filter to serial stock RPCs and add per-location summary RPC

CREATE OR REPLACE FUNCTION public.get_serial_stock_products(
  p_organization_id uuid,
  p_location_id uuid DEFAULT NULL
)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  total bigint,
  in_stock bigint,
  assigned bigint,
  shipped bigint,
  prefix_count bigint,
  last_stocked_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    psl.product_id,
    COALESCE(lp.name, 'Produto desconhecido') as product_name,
    count(*)::bigint as total,
    count(*) FILTER (WHERE psl.status = 'in_stock')::bigint as in_stock,
    count(*) FILTER (WHERE psl.status = 'assigned')::bigint as assigned,
    count(*) FILTER (WHERE psl.status = 'shipped')::bigint as shipped,
    count(DISTINCT regexp_replace(psl.serial_code, '\d+$', ''))::bigint as prefix_count,
    max(psl.stocked_at) as last_stocked_at
  FROM product_serial_labels psl
  LEFT JOIN lead_products lp ON lp.id = psl.product_id
  WHERE psl.organization_id = p_organization_id
    AND psl.product_id IS NOT NULL
    AND (p_location_id IS NULL OR psl.stock_location_id = p_location_id)
  GROUP BY psl.product_id, lp.name
  ORDER BY lp.name;
$$;

CREATE OR REPLACE FUNCTION public.get_serial_stock_overview(
  p_organization_id uuid,
  p_location_id uuid DEFAULT NULL
)
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
    AND (p_location_id IS NULL OR psl.stock_location_id = p_location_id)
  GROUP BY psl.product_id, lp.name, regexp_replace(psl.serial_code, '\d+$', ''), psl.stocked_by, p.first_name, p.last_name
  ORDER BY lp.name, regexp_replace(psl.serial_code, '\d+$', ''), max(psl.stocked_at) DESC NULLS LAST;
$$;

-- Per-location summary for header cards
CREATE OR REPLACE FUNCTION public.get_serial_stock_by_location(p_organization_id uuid)
RETURNS TABLE(
  location_id uuid,
  location_name text,
  location_code text,
  is_default boolean,
  total bigint,
  in_stock bigint,
  assigned bigint,
  shipped bigint,
  product_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sl.id as location_id,
    sl.name as location_name,
    sl.code as location_code,
    sl.is_default,
    count(psl.id)::bigint as total,
    count(psl.id) FILTER (WHERE psl.status = 'in_stock')::bigint as in_stock,
    count(psl.id) FILTER (WHERE psl.status = 'assigned')::bigint as assigned,
    count(psl.id) FILTER (WHERE psl.status = 'shipped')::bigint as shipped,
    count(DISTINCT psl.product_id)::bigint as product_count
  FROM stock_locations sl
  LEFT JOIN product_serial_labels psl 
    ON psl.stock_location_id = sl.id 
    AND psl.organization_id = p_organization_id
    AND psl.product_id IS NOT NULL
  WHERE sl.organization_id = p_organization_id
    AND sl.is_active = true
  GROUP BY sl.id, sl.name, sl.code, sl.is_default
  ORDER BY sl.is_default DESC, sl.name;
$$;