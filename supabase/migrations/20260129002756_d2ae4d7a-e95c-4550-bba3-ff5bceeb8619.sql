-- Create helper function for atomic implementer stats update
CREATE OR REPLACE FUNCTION public.increment_implementer_totals(
  p_implementer_id UUID,
  p_earnings_cents BIGINT,
  p_clients_count INTEGER DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE implementers
  SET 
    total_earnings_cents = COALESCE(total_earnings_cents, 0) + p_earnings_cents,
    total_clients = COALESCE(total_clients, 0) + p_clients_count,
    updated_at = now()
  WHERE id = p_implementer_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.increment_implementer_totals TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_implementer_totals TO service_role;