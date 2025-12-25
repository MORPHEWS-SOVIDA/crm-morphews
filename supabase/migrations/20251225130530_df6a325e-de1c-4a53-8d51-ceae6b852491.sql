-- =============================================================================
-- FASE 1: FUNDAÇÃO MULTI-TENANT
-- =============================================================================
-- Este migration consolida a estrutura multi-tenant existente e adiciona
-- funções utilitárias para padronização.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. FUNÇÃO current_tenant_id() - Alias padronizado para get_user_organization_id
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_user_organization_id()
$$;

COMMENT ON FUNCTION public.current_tenant_id() IS 
'Retorna o ID do tenant (organization) do usuário autenticado. Alias para get_user_organization_id().';

-- -----------------------------------------------------------------------------
-- 2. FUNÇÃO is_tenant_member() - Verifica se usuário pertence ao tenant
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
    AND organization_id = _tenant_id
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

COMMENT ON FUNCTION public.is_tenant_member(uuid, uuid) IS 
'Verifica se o usuário pertence ao tenant especificado.';

-- -----------------------------------------------------------------------------
-- 3. FUNÇÃO get_tenant_role() - Retorna o papel do usuário no tenant
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_tenant_role(_user_id uuid, _tenant_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.organization_members
  WHERE user_id = _user_id
  AND organization_id = _tenant_id
  LIMIT 1
$$;

COMMENT ON FUNCTION public.get_tenant_role(uuid, uuid) IS 
'Retorna o papel (owner, admin, member) do usuário no tenant.';

-- -----------------------------------------------------------------------------
-- 4. FUNÇÃO is_tenant_admin() - Verifica se é admin/owner do tenant
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
    AND organization_id = _tenant_id
    AND role IN ('owner', 'admin')
  )
$$;

COMMENT ON FUNCTION public.is_tenant_admin(uuid, uuid) IS 
'Verifica se o usuário é owner ou admin do tenant.';

-- -----------------------------------------------------------------------------
-- 5. VIEW channels - Visão padronizada dos canais WhatsApp
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.channels AS
SELECT 
  wi.id,
  wi.organization_id AS tenant_id,
  wi.provider,
  wi.phone_number AS phone_e164,
  COALESCE(wi.wasender_session_id, wi.z_api_instance_id) AS external_account_id,
  wi.wasender_api_key,
  wi.z_api_token,
  wi.z_api_client_token,
  wi.status,
  wi.name,
  wi.is_connected,
  wi.monthly_price_cents,
  wi.payment_source,
  wi.qr_code_base64,
  wi.created_at,
  wi.updated_at
FROM public.whatsapp_instances wi;

COMMENT ON VIEW public.channels IS 
'View padronizada que expõe whatsapp_instances como channels para o multi-atendimento.';

-- -----------------------------------------------------------------------------
-- 6. VIEW channel_users - Visão padronizada de usuários por canal
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.channel_users AS
SELECT 
  wiu.id,
  wiu.instance_id AS channel_id,
  wiu.user_id,
  wiu.can_view,
  wiu.can_send,
  wiu.created_at,
  wi.organization_id AS tenant_id
FROM public.whatsapp_instance_users wiu
JOIN public.whatsapp_instances wi ON wi.id = wiu.instance_id;

COMMENT ON VIEW public.channel_users IS 
'View padronizada que expõe whatsapp_instance_users como channel_users.';

-- -----------------------------------------------------------------------------
-- 7. VIEW threads - Visão padronizada das conversas
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.threads AS
SELECT 
  wc.id,
  wc.organization_id AS tenant_id,
  wc.instance_id AS channel_id,
  wc.phone_number,
  wc.sendable_phone,
  wc.contact_name,
  wc.contact_profile_pic,
  wc.lead_id,
  wc.unread_count,
  wc.last_message_at,
  wc.created_at,
  wc.updated_at,
  -- Campos que serão adicionados na Fase 2 (placeholder)
  NULL::uuid AS contact_id,
  'open'::text AS status,
  NULL::uuid AS assigned_user_id
FROM public.whatsapp_conversations wc;

COMMENT ON VIEW public.threads IS 
'View padronizada que expõe whatsapp_conversations como threads. Contact_id, status e assigned_user_id serão adicionados na Fase 2.';

-- -----------------------------------------------------------------------------
-- 8. FUNÇÃO get_user_tenants() - Lista todos os tenants do usuário
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_tenants(_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  user_role text,
  joined_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    o.id AS tenant_id,
    o.name AS tenant_name,
    o.slug AS tenant_slug,
    om.role::text AS user_role,
    om.created_at AS joined_at
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = _user_id
  ORDER BY om.created_at ASC
$$;

COMMENT ON FUNCTION public.get_user_tenants(uuid) IS 
'Retorna todos os tenants aos quais o usuário pertence com seus papéis.';

-- -----------------------------------------------------------------------------
-- 9. FUNÇÃO get_tenant_channels() - Lista canais do tenant
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_tenant_channels(_tenant_id uuid DEFAULT current_tenant_id())
RETURNS TABLE (
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
    phone_e164,
    status,
    is_connected
  FROM public.channels
  WHERE tenant_id = _tenant_id
  ORDER BY created_at ASC
$$;

COMMENT ON FUNCTION public.get_tenant_channels(uuid) IS 
'Retorna todos os canais WhatsApp do tenant especificado.';

-- -----------------------------------------------------------------------------
-- 10. FUNÇÃO get_tenant_stats() - Estatísticas do tenant
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_tenant_stats(_tenant_id uuid DEFAULT current_tenant_id())
RETURNS TABLE (
  total_channels bigint,
  connected_channels bigint,
  total_conversations bigint,
  unread_conversations bigint,
  total_leads bigint,
  total_members bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    (SELECT COUNT(*) FROM public.whatsapp_instances WHERE organization_id = _tenant_id) AS total_channels,
    (SELECT COUNT(*) FROM public.whatsapp_instances WHERE organization_id = _tenant_id AND is_connected = true) AS connected_channels,
    (SELECT COUNT(*) FROM public.whatsapp_conversations WHERE organization_id = _tenant_id) AS total_conversations,
    (SELECT COUNT(*) FROM public.whatsapp_conversations WHERE organization_id = _tenant_id AND unread_count > 0) AS unread_conversations,
    (SELECT COUNT(*) FROM public.leads WHERE organization_id = _tenant_id) AS total_leads,
    (SELECT COUNT(*) FROM public.organization_members WHERE organization_id = _tenant_id) AS total_members
$$;

COMMENT ON FUNCTION public.get_tenant_stats(uuid) IS 
'Retorna estatísticas resumidas do tenant.';

-- -----------------------------------------------------------------------------
-- 11. Índices adicionais para performance
-- -----------------------------------------------------------------------------
-- Índice para busca de conversas por tenant + status (preparação para Fase 2)
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_tenant_last_msg 
ON public.whatsapp_conversations(organization_id, last_message_at DESC NULLS LAST);

-- Índice para busca de mensagens por conversa + data
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_created 
ON public.whatsapp_messages(conversation_id, created_at DESC);

-- Índice para busca de leads por tenant + stage
CREATE INDEX IF NOT EXISTS idx_leads_tenant_stage 
ON public.leads(organization_id, stage);

-- Índice para busca de membros por tenant
CREATE INDEX IF NOT EXISTS idx_org_members_tenant 
ON public.organization_members(organization_id);

-- Índice para busca de instâncias por tenant
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_tenant_connected 
ON public.whatsapp_instances(organization_id, is_connected);