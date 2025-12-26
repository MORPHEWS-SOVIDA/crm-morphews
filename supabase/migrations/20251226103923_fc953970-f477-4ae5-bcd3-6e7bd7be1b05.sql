-- Recreate whatsapp_conversations_view with lead data and computed title
DROP VIEW IF EXISTS public.whatsapp_conversations_view;

CREATE VIEW public.whatsapp_conversations_view AS
SELECT 
  c.*,
  l.name as lead_name,
  l.email as lead_email,
  l.whatsapp as lead_whatsapp,
  l.stage as lead_stage,
  l.instagram as lead_instagram,
  l.secondary_phone as lead_secondary_phone,
  COALESCE(
    c.display_name,
    CASE WHEN c.is_group THEN COALESCE(c.group_subject, 'Grupo') END,
    l.name,
    c.phone_number
  ) as title
FROM public.whatsapp_conversations c
LEFT JOIN public.leads l ON l.id = c.lead_id;