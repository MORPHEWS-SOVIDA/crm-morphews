-- Function to get cost_cents for sale items (workaround for types not yet regenerated)
CREATE OR REPLACE FUNCTION public.get_sale_items_costs(item_ids uuid[])
RETURNS TABLE(id uuid, cost_cents integer) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT si.id, si.cost_cents
  FROM sale_items si
  WHERE si.id = ANY(item_ids);
$$;

-- Function to update cost_cents for a sale item
CREATE OR REPLACE FUNCTION public.update_sale_item_cost(p_item_id uuid, p_cost_cents integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sale_items
  SET cost_cents = p_cost_cents
  WHERE id = p_item_id;
END;
$$;

-- Function to get summary of manipulated product costs
CREATE OR REPLACE FUNCTION public.get_manipulated_costs_summary(p_organization_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_items', COUNT(*),
    'items_with_cost', COUNT(*) FILTER (WHERE si.cost_cents IS NOT NULL),
    'items_without_cost', COUNT(*) FILTER (WHERE si.cost_cents IS NULL),
    'total_revenue', COALESCE(SUM(si.total_cents), 0),
    'total_cost', COALESCE(SUM(si.cost_cents), 0),
    'margin', COALESCE(SUM(si.total_cents), 0) - COALESCE(SUM(si.cost_cents), 0),
    'margin_percent', CASE 
      WHEN COALESCE(SUM(si.total_cents), 0) > 0 
      THEN ROUND(((COALESCE(SUM(si.total_cents), 0) - COALESCE(SUM(si.cost_cents), 0))::numeric / SUM(si.total_cents)::numeric) * 100, 1)
      ELSE 0 
    END
  ) INTO result
  FROM sale_items si
  INNER JOIN sales s ON s.id = si.sale_id
  WHERE si.requisition_number IS NOT NULL
  AND s.organization_id = p_organization_id;
  
  RETURN result;
END;
$$;