-- Drop and recreate get_tenant_channels function to fix phone_e164 column reference
DROP FUNCTION IF EXISTS public.get_tenant_channels(uuid);

CREATE FUNCTION public.get_tenant_channels(_tenant_id uuid)
RETURNS TABLE(
  channel_id uuid,
  channel_name text,
  provider text,
  phone_e164 text,
  status text,
  is_connected boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id AS channel_id,
    name AS channel_name,
    provider,
    phone_number AS phone_e164,
    status,
    is_connected
  FROM public.channels
  WHERE organization_id = _tenant_id
  ORDER BY created_at ASC;
$$;