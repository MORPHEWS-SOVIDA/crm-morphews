
-- =====================================================
-- FIX 1: Remove API keys from channels view
-- =====================================================
DROP VIEW IF EXISTS public.channels;

CREATE VIEW public.channels WITH (security_invoker = true) AS
SELECT 
  id,
  organization_id AS tenant_id,
  provider,
  phone_number AS phone_e164,
  COALESCE(wasender_session_id, z_api_instance_id) AS external_account_id,
  status,
  name,
  is_connected,
  monthly_price_cents,
  payment_source,
  qr_code_base64,
  created_at,
  updated_at
FROM public.whatsapp_instances;

-- =====================================================
-- FIX 2: Recreate whatsapp_conversations_view with security_invoker instead of definer
-- =====================================================
DROP VIEW IF EXISTS public.whatsapp_conversations_view;

CREATE VIEW public.whatsapp_conversations_view WITH (security_invoker = true) AS
SELECT 
  c.id,
  c.instance_id,
  c.organization_id,
  c.phone_number,
  c.contact_name,
  c.contact_profile_pic,
  c.lead_id,
  c.unread_count,
  c.last_message_at,
  c.created_at,
  c.updated_at,
  c.sendable_phone,
  c.contact_id,
  c.customer_phone_e164,
  c.status,
  c.assigned_user_id,
  c.current_instance_id,
  c.chat_id,
  c.is_group,
  c.group_subject,
  c.display_name,
  c.assigned_at,
  c.closed_at,
  c.last_customer_message_at,
  c.handling_bot_id,
  c.bot_started_at,
  c.bot_messages_count,
  c.bot_energy_consumed,
  c.bot_qualification_step,
  c.bot_qualification_completed,
  c.designated_user_id,
  c.designated_at,
  c.original_instance_name,
  l.name AS lead_name,
  l.stage AS lead_stage,
  l.instagram AS lead_instagram,
  i.name AS channel_name,
  i.phone_number AS channel_phone_number,
  i.is_connected AS instance_is_connected,
  i.deleted_at AS instance_deleted_at,
  CASE 
    WHEN c.instance_id IS NULL THEN 'deleted'
    WHEN i.deleted_at IS NOT NULL THEN 'deleted'
    WHEN i.is_connected = false THEN 'disconnected'
    ELSE 'connected'
  END AS instance_status
FROM public.whatsapp_conversations c
LEFT JOIN public.leads l ON c.lead_id = l.id
LEFT JOIN public.whatsapp_instances i ON c.instance_id = i.id;

-- =====================================================
-- Create secure function for Edge Functions to get credentials (server-side only)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_instance_credentials(p_instance_id uuid)
RETURNS TABLE(
  wasender_api_key text,
  z_api_token text,
  z_api_client_token text,
  evolution_instance_id text,
  evolution_api_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get user's organization
  v_org_id := get_user_organization_id();
  
  -- Verify caller has access to this instance
  IF NOT EXISTS (
    SELECT 1 FROM whatsapp_instances
    WHERE id = p_instance_id
    AND organization_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'Access denied to instance credentials';
  END IF;
  
  RETURN QUERY
  SELECT 
    wi.wasender_api_key,
    wi.z_api_token,
    wi.z_api_client_token,
    wi.evolution_instance_id,
    wi.evolution_api_token
  FROM whatsapp_instances wi
  WHERE wi.id = p_instance_id
    AND wi.organization_id = v_org_id;
END;
$$;
