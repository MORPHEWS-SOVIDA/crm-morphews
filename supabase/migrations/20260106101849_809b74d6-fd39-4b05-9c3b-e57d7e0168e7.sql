
-- =====================================================
-- FIX RLS POLICIES TO USE GRANULAR USER PERMISSIONS
-- =====================================================

-- Helper function to check if user has a specific permission
CREATE OR REPLACE FUNCTION public.user_has_settings_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    CASE _permission
      WHEN 'funnel_stages' THEN COALESCE(up.settings_funnel_stages, false)
      WHEN 'delivery_regions' THEN COALESCE(up.settings_delivery_regions, false)
      WHEN 'carriers' THEN COALESCE(up.settings_carriers, false)
      WHEN 'payment_methods' THEN COALESCE(up.settings_payment_methods, false)
      WHEN 'non_purchase_reasons' THEN COALESCE(up.settings_non_purchase_reasons, false)
      WHEN 'standard_questions' THEN COALESCE(up.settings_standard_questions, false)
      WHEN 'teams' THEN COALESCE(up.settings_teams, false)
      WHEN 'lead_sources' THEN COALESCE(up.settings_lead_sources, false)
      WHEN 'products_manage' THEN COALESCE(up.products_manage, false)
      ELSE false
    END
  FROM user_permissions up
  WHERE up.user_id = _user_id
    AND up.organization_id = get_user_organization_id()
  LIMIT 1
$$;

-- =====================================================
-- 1. STANDARD QUESTIONS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage standard questions" ON public.standard_questions;

CREATE POLICY "Users with permission can manage standard questions"
ON public.standard_questions
FOR ALL
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'standard_questions')
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'standard_questions')
  )
);

-- =====================================================
-- 2. STANDARD QUESTION OPTIONS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage question options" ON public.standard_question_options;

CREATE POLICY "Users with permission can manage question options"
ON public.standard_question_options
FOR ALL
USING (
  question_id IN (
    SELECT sq.id FROM standard_questions sq
    WHERE sq.organization_id = get_user_organization_id()
      AND (
        is_org_admin(auth.uid(), sq.organization_id)
        OR user_has_settings_permission(auth.uid(), 'standard_questions')
      )
  )
)
WITH CHECK (
  question_id IN (
    SELECT sq.id FROM standard_questions sq
    WHERE sq.organization_id = get_user_organization_id()
      AND (
        is_org_admin(auth.uid(), sq.organization_id)
        OR user_has_settings_permission(auth.uid(), 'standard_questions')
      )
  )
);

-- =====================================================
-- 3. SHIPPING CARRIERS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage carriers" ON public.shipping_carriers;

CREATE POLICY "Users with permission can manage carriers"
ON public.shipping_carriers
FOR ALL
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'carriers')
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'carriers')
  )
);

-- =====================================================
-- 4. DELIVERY REGIONS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage regions" ON public.delivery_regions;

CREATE POLICY "Users with permission can manage regions"
ON public.delivery_regions
FOR ALL
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'delivery_regions')
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'delivery_regions')
  )
);

-- =====================================================
-- 5. DELIVERY REGION SCHEDULES
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage schedules" ON public.delivery_region_schedules;

CREATE POLICY "Users with permission can manage schedules"
ON public.delivery_region_schedules
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM delivery_regions dr
    WHERE dr.id = delivery_region_schedules.region_id
      AND dr.organization_id = get_user_organization_id()
      AND (
        is_org_admin(auth.uid(), dr.organization_id)
        OR user_has_settings_permission(auth.uid(), 'delivery_regions')
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM delivery_regions dr
    WHERE dr.id = delivery_region_schedules.region_id
      AND dr.organization_id = get_user_organization_id()
      AND (
        is_org_admin(auth.uid(), dr.organization_id)
        OR user_has_settings_permission(auth.uid(), 'delivery_regions')
      )
  )
);

-- =====================================================
-- 6. DELIVERY REGION USERS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage region users" ON public.delivery_region_users;

CREATE POLICY "Users with permission can manage region users"
ON public.delivery_region_users
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM delivery_regions dr
    WHERE dr.id = delivery_region_users.region_id
      AND dr.organization_id = get_user_organization_id()
      AND (
        is_org_admin(auth.uid(), dr.organization_id)
        OR user_has_settings_permission(auth.uid(), 'delivery_regions')
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM delivery_regions dr
    WHERE dr.id = delivery_region_users.region_id
      AND dr.organization_id = get_user_organization_id()
      AND (
        is_org_admin(auth.uid(), dr.organization_id)
        OR user_has_settings_permission(auth.uid(), 'delivery_regions')
      )
  )
);

-- =====================================================
-- 7. PAYMENT METHODS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage payment methods" ON public.payment_methods;

CREATE POLICY "Users with permission can manage payment methods"
ON public.payment_methods
FOR ALL
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'payment_methods')
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'payment_methods')
  )
);

-- =====================================================
-- 8. NON PURCHASE REASONS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage non_purchase_reasons" ON public.non_purchase_reasons;

CREATE POLICY "Users with permission can manage non_purchase_reasons"
ON public.non_purchase_reasons
FOR ALL
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'non_purchase_reasons')
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'non_purchase_reasons')
  )
);

-- =====================================================
-- 9. TEAMS
-- =====================================================
DROP POLICY IF EXISTS "Admins can insert teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can update teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can delete teams" ON public.teams;

CREATE POLICY "Users with permission can insert teams"
ON public.teams
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'teams')
  )
);

CREATE POLICY "Users with permission can update teams"
ON public.teams
FOR UPDATE
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'teams')
  )
);

CREATE POLICY "Users with permission can delete teams"
ON public.teams
FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'teams')
  )
);

-- =====================================================
-- 10. LEAD SOURCES
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage lead sources" ON public.lead_sources;

CREATE POLICY "Users with permission can manage lead sources"
ON public.lead_sources
FOR ALL
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'lead_sources')
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'lead_sources')
  )
);

-- =====================================================
-- 11. ORGANIZATION FUNNEL STAGES
-- =====================================================
DROP POLICY IF EXISTS "Org admins can insert stages" ON public.organization_funnel_stages;
DROP POLICY IF EXISTS "Org admins can update stages" ON public.organization_funnel_stages;
DROP POLICY IF EXISTS "Org admins can delete stages" ON public.organization_funnel_stages;

CREATE POLICY "Users with permission can insert stages"
ON public.organization_funnel_stages
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'funnel_stages')
  )
);

CREATE POLICY "Users with permission can update stages"
ON public.organization_funnel_stages
FOR UPDATE
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'funnel_stages')
  )
);

CREATE POLICY "Users with permission can delete stages"
ON public.organization_funnel_stages
FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'funnel_stages')
  )
);

-- =====================================================
-- 12. PRODUCT QUESTIONS
-- =====================================================
DROP POLICY IF EXISTS "Admins can insert questions" ON public.product_questions;
DROP POLICY IF EXISTS "Admins can update questions" ON public.product_questions;
DROP POLICY IF EXISTS "Admins can delete questions" ON public.product_questions;

CREATE POLICY "Users with permission can insert product questions"
ON public.product_questions
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'products_manage')
  )
);

CREATE POLICY "Users with permission can update product questions"
ON public.product_questions
FOR UPDATE
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'products_manage')
  )
);

CREATE POLICY "Users with permission can delete product questions"
ON public.product_questions
FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'products_manage')
  )
);

-- =====================================================
-- 13. PRODUCT STANDARD QUESTIONS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage product standard questions" ON public.product_standard_questions;

CREATE POLICY "Users with permission can manage product standard questions"
ON public.product_standard_questions
FOR ALL
USING (
  product_id IN (
    SELECT lp.id FROM lead_products lp
    WHERE lp.organization_id = get_user_organization_id()
      AND (
        is_org_admin(auth.uid(), lp.organization_id)
        OR user_has_settings_permission(auth.uid(), 'products_manage')
      )
  )
)
WITH CHECK (
  product_id IN (
    SELECT lp.id FROM lead_products lp
    WHERE lp.organization_id = get_user_organization_id()
      AND (
        is_org_admin(auth.uid(), lp.organization_id)
        OR user_has_settings_permission(auth.uid(), 'products_manage')
      )
  )
);

-- =====================================================
-- 14. PRODUCT USER VISIBILITY
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage product visibility" ON public.product_user_visibility;

CREATE POLICY "Users with permission can manage product visibility"
ON public.product_user_visibility
FOR ALL
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'products_manage')
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'products_manage')
  )
);

-- =====================================================
-- 15. PAYMENT RELATED TABLES
-- =====================================================

-- Payment Acquirers
DROP POLICY IF EXISTS "Admins can manage acquirers" ON public.payment_acquirers;

CREATE POLICY "Users with permission can manage acquirers"
ON public.payment_acquirers
FOR ALL
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'payment_methods')
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'payment_methods')
  )
);

-- Payment Bank Destinations
DROP POLICY IF EXISTS "Admins can manage bank destinations" ON public.payment_bank_destinations;

CREATE POLICY "Users with permission can manage bank destinations"
ON public.payment_bank_destinations
FOR ALL
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'payment_methods')
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'payment_methods')
  )
);

-- Payment CNPJ Destinations
DROP POLICY IF EXISTS "Admins can manage cnpj destinations" ON public.payment_cnpj_destinations;

CREATE POLICY "Users with permission can manage cnpj destinations"
ON public.payment_cnpj_destinations
FOR ALL
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'payment_methods')
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'payment_methods')
  )
);

-- Payment Cost Centers
DROP POLICY IF EXISTS "Admins can manage cost centers" ON public.payment_cost_centers;

CREATE POLICY "Users with permission can manage cost centers"
ON public.payment_cost_centers
FOR ALL
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'payment_methods')
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'payment_methods')
  )
);

-- Payment Transaction Fees
DROP POLICY IF EXISTS "Admins can manage transaction fees" ON public.payment_method_transaction_fees;

CREATE POLICY "Users with permission can manage transaction fees"
ON public.payment_method_transaction_fees
FOR ALL
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'payment_methods')
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'payment_methods')
  )
);

-- =====================================================
-- 16. DELIVERY RETURN REASONS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage return reasons" ON public.delivery_return_reasons;

CREATE POLICY "Users with permission can manage return reasons"
ON public.delivery_return_reasons
FOR ALL
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'delivery_regions')
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'delivery_regions')
  )
);

-- =====================================================
-- 17. SALES MANAGER TEAM MEMBERS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage team members" ON public.sales_manager_team_members;

CREATE POLICY "Users with permission can manage sales manager team members"
ON public.sales_manager_team_members
FOR ALL
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'teams')
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR user_has_settings_permission(auth.uid(), 'teams')
  )
);
