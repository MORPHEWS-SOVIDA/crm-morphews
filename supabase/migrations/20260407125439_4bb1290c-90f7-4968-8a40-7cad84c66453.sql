
UPDATE public.whatsapp_instances
SET status = 'active', is_connected = true, updated_at = now()
WHERE organization_id = '950d92d3-56d2-4ccc-aa6a-5f3261debf22'
  AND status = 'pending'
  AND deleted_at IS NULL;
