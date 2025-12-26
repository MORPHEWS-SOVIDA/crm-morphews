-- Corrigir a view para não usar SECURITY DEFINER implícito
-- Recriar como view normal sem o security definer
DROP VIEW IF EXISTS public.whatsapp_conversations_view;

CREATE VIEW public.whatsapp_conversations_view 
WITH (security_invoker = true)
AS
SELECT
  c.*,
  i.name AS channel_name,
  i.provider AS channel_provider,
  i.phone_number AS channel_phone_number
FROM public.whatsapp_conversations c
JOIN public.whatsapp_instances i ON i.id = c.instance_id;