-- =====================================================
-- CORREÇÃO DE SEGURANÇA: Restringir tabelas sensíveis
-- =====================================================
-- Esta migration corrige a exposição pública de dados sensíveis
-- mantendo as funcionalidades existentes intactas.

-- =====================================================
-- 1. ai_model_costs - Restringir a master admins
-- A função consume_energy usa SECURITY DEFINER, então continua funcionando
-- =====================================================

DROP POLICY IF EXISTS "ai_model_costs_select" ON public.ai_model_costs;

-- Apenas master admins podem visualizar custos de modelos
CREATE POLICY "ai_model_costs_master_admin_select" 
ON public.ai_model_costs 
FOR SELECT 
USING (is_master_admin(auth.uid()));

-- Apenas master admins podem modificar
DROP POLICY IF EXISTS "ai_model_costs_update" ON public.ai_model_costs;
CREATE POLICY "ai_model_costs_master_admin_update" 
ON public.ai_model_costs 
FOR UPDATE 
USING (is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "ai_model_costs_insert" ON public.ai_model_costs;
CREATE POLICY "ai_model_costs_master_admin_insert" 
ON public.ai_model_costs 
FOR INSERT 
WITH CHECK (is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "ai_model_costs_delete" ON public.ai_model_costs;
CREATE POLICY "ai_model_costs_master_admin_delete" 
ON public.ai_model_costs 
FOR DELETE 
USING (is_master_admin(auth.uid()));

-- =====================================================
-- 2. ai_action_costs - Restringir a master admins
-- =====================================================

DROP POLICY IF EXISTS "ai_action_costs_select" ON public.ai_action_costs;

-- Apenas master admins podem visualizar custos de ações
CREATE POLICY "ai_action_costs_master_admin_select" 
ON public.ai_action_costs 
FOR SELECT 
USING (is_master_admin(auth.uid()));

-- Apenas master admins podem modificar
DROP POLICY IF EXISTS "ai_action_costs_update" ON public.ai_action_costs;
CREATE POLICY "ai_action_costs_master_admin_update" 
ON public.ai_action_costs 
FOR UPDATE 
USING (is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "ai_action_costs_insert" ON public.ai_action_costs;
CREATE POLICY "ai_action_costs_master_admin_insert" 
ON public.ai_action_costs 
FOR INSERT 
WITH CHECK (is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "ai_action_costs_delete" ON public.ai_action_costs;
CREATE POLICY "ai_action_costs_master_admin_delete" 
ON public.ai_action_costs 
FOR DELETE 
USING (is_master_admin(auth.uid()));

-- =====================================================
-- 3. secretary_message_templates - Restringir a master admins
-- Edge function usa service role, então continua funcionando
-- =====================================================

DROP POLICY IF EXISTS "Service role full access templates" ON public.secretary_message_templates;

-- Apenas master admins podem visualizar templates
CREATE POLICY "secretary_templates_master_admin_select" 
ON public.secretary_message_templates 
FOR SELECT 
USING (is_master_admin(auth.uid()));

-- Apenas master admins podem criar
CREATE POLICY "secretary_templates_master_admin_insert" 
ON public.secretary_message_templates 
FOR INSERT 
WITH CHECK (is_master_admin(auth.uid()));

-- Apenas master admins podem atualizar
CREATE POLICY "secretary_templates_master_admin_update" 
ON public.secretary_message_templates 
FOR UPDATE 
USING (is_master_admin(auth.uid()));

-- Apenas master admins podem deletar
CREATE POLICY "secretary_templates_master_admin_delete" 
ON public.secretary_message_templates 
FOR DELETE 
USING (is_master_admin(auth.uid()));

-- =====================================================
-- 4. subscription_plans - Remover política anon redundante
-- A view subscription_plans_public já expõe dados públicos de forma segura
-- =====================================================

DROP POLICY IF EXISTS "Anon can view active plans" ON public.subscription_plans;

-- =====================================================
-- 5. Garantir que a view subscription_plans_public use security_invoker
-- =====================================================

DROP VIEW IF EXISTS public.subscription_plans_public;

CREATE VIEW public.subscription_plans_public
WITH (security_invoker = on) AS
SELECT 
    id,
    name,
    price_cents,
    annual_price_cents,
    max_users,
    max_leads,
    extra_user_price_cents,
    extra_instance_price_cents,
    extra_energy_price_cents,
    included_whatsapp_instances,
    monthly_energy,
    is_active,
    is_visible_on_site,
    payment_provider,
    atomicpay_monthly_url,
    atomicpay_annual_url,
    created_at
FROM subscription_plans
WHERE is_active = true AND is_visible_on_site = true;

-- Permitir acesso público à view (para página de planos)
GRANT SELECT ON public.subscription_plans_public TO anon;
GRANT SELECT ON public.subscription_plans_public TO authenticated;

-- =====================================================
-- VERIFICAÇÃO: Funções SECURITY DEFINER existentes continuam funcionando
-- pois elas bypassam RLS (consume_energy, calculate_energy_cost, etc.)
-- =====================================================