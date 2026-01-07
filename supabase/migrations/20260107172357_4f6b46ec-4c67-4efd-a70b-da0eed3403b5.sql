
-- ============================================
-- CORREÇÃO DE SEGURANÇA - PARTE 1
-- ============================================

-- 1. Recriar VIEW channels com SECURITY INVOKER
-- Isso faz a view respeitar as políticas RLS da tabela base
DROP VIEW IF EXISTS public.channels;

CREATE VIEW public.channels
WITH (security_invoker = true)
AS SELECT 
    id,
    organization_id AS tenant_id,
    provider,
    phone_number AS phone_e164,
    COALESCE(wasender_session_id, z_api_instance_id) AS external_account_id,
    wasender_api_key,
    z_api_token,
    z_api_client_token,
    status,
    name,
    is_connected,
    monthly_price_cents,
    payment_source,
    qr_code_base64,
    created_at,
    updated_at
FROM public.whatsapp_instances;

-- Garantir que a view tem as permissões corretas
GRANT SELECT ON public.channels TO authenticated;
GRANT SELECT ON public.channels TO anon;

-- 2. TABELA SUBSCRIPTION_PLANS - Restringir acesso
DROP POLICY IF EXISTS "Anyone can view subscription plans" ON public.subscription_plans;

-- Apenas usuários autenticados podem ver planos
CREATE POLICY "Authenticated users can view subscription plans"
ON public.subscription_plans
FOR SELECT
TO authenticated
USING (true);

-- 3. CORRIGIR POLÍTICAS USING(true) PROBLEMÁTICAS

-- 3.1 discount_coupons - restringir UPDATE
DROP POLICY IF EXISTS "Users can increment coupon usage" ON public.discount_coupons;

CREATE POLICY "Authenticated users can increment coupon usage"
ON public.discount_coupons
FOR UPDATE
TO authenticated
USING (
  is_active = true
  AND (max_uses IS NULL OR current_uses < max_uses)
  AND (valid_until IS NULL OR valid_until > now())
)
WITH CHECK (current_uses >= 0);

-- 3.2 error_logs - restringir INSERT
DROP POLICY IF EXISTS "Anyone can insert error logs" ON public.error_logs;

CREATE POLICY "Org members can insert error logs"
ON public.error_logs
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IS NULL 
  OR public.is_tenant_member(auth.uid(), organization_id)
);

-- 3.3 interested_leads - validação básica anti-spam
DROP POLICY IF EXISTS "Anyone can insert interested leads" ON public.interested_leads;

CREATE POLICY "Anyone can create interested leads with validation"
ON public.interested_leads
FOR INSERT
WITH CHECK (
  name IS NOT NULL 
  AND length(trim(name)) >= 2
  AND whatsapp IS NOT NULL 
  AND length(regexp_replace(whatsapp, '[^0-9]', '', 'g')) >= 10
);
