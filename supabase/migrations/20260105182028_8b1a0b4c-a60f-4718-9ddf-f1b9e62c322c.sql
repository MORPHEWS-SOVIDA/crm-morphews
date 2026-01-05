-- Add granular settings permissions to user_permissions table
ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS settings_funnel_stages boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS settings_delivery_regions boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS settings_carriers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS settings_payment_methods boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS settings_non_purchase_reasons boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS settings_standard_questions boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS settings_teams boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS settings_lead_sources boolean NOT NULL DEFAULT false;

-- Update the get_default_permissions_for_role function to include new permissions
CREATE OR REPLACE FUNCTION public.get_default_permissions_for_role(_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _role = 'owner' OR _role = 'admin' THEN
    RETURN jsonb_build_object(
      'leads_view', true,
      'leads_create', true,
      'leads_edit', true,
      'leads_delete', true,
      'sales_view', true,
      'sales_view_all', true,
      'sales_create', true,
      'sales_edit_draft', true,
      'sales_confirm_payment', true,
      'sales_validate_expedition', true,
      'sales_dispatch', true,
      'sales_mark_delivered', true,
      'sales_cancel', true,
      'whatsapp_view', true,
      'whatsapp_send', true,
      'products_view', true,
      'products_manage', true,
      'products_view_cost', true,
      'settings_view', true,
      'settings_manage', true,
      'settings_funnel_stages', true,
      'settings_delivery_regions', true,
      'settings_carriers', true,
      'settings_payment_methods', true,
      'settings_non_purchase_reasons', true,
      'settings_standard_questions', true,
      'settings_teams', true,
      'settings_lead_sources', true,
      'reports_view', true,
      'deliveries_view_own', true,
      'deliveries_view_all', true,
      'receptive_module_access', true,
      'team_view', true,
      'instagram_view', true,
      'post_sale_view', true,
      'post_sale_manage', true,
      'sac_view', true,
      'sac_manage', true
    );
  ELSIF _role = 'manager' THEN
    RETURN jsonb_build_object(
      'leads_view', true,
      'leads_create', true,
      'leads_edit', true,
      'leads_delete', false,
      'sales_view', true,
      'sales_view_all', true,
      'sales_create', true,
      'sales_edit_draft', true,
      'sales_confirm_payment', true,
      'sales_validate_expedition', true,
      'sales_dispatch', true,
      'sales_mark_delivered', true,
      'sales_cancel', false,
      'whatsapp_view', true,
      'whatsapp_send', true,
      'products_view', true,
      'products_manage', true,
      'products_view_cost', true,
      'settings_view', true,
      'settings_manage', false,
      'settings_funnel_stages', false,
      'settings_delivery_regions', false,
      'settings_carriers', false,
      'settings_payment_methods', false,
      'settings_non_purchase_reasons', false,
      'settings_standard_questions', false,
      'settings_teams', false,
      'settings_lead_sources', false,
      'reports_view', true,
      'deliveries_view_own', true,
      'deliveries_view_all', true,
      'receptive_module_access', true,
      'team_view', true,
      'instagram_view', false,
      'post_sale_view', true,
      'post_sale_manage', true,
      'sac_view', true,
      'sac_manage', true
    );
  ELSIF _role = 'seller' THEN
    RETURN jsonb_build_object(
      'leads_view', true,
      'leads_create', true,
      'leads_edit', true,
      'leads_delete', false,
      'sales_view', true,
      'sales_view_all', false,
      'sales_create', true,
      'sales_edit_draft', true,
      'sales_confirm_payment', false,
      'sales_validate_expedition', false,
      'sales_dispatch', false,
      'sales_mark_delivered', false,
      'sales_cancel', false,
      'whatsapp_view', true,
      'whatsapp_send', true,
      'products_view', true,
      'products_manage', false,
      'products_view_cost', false,
      'settings_view', false,
      'settings_manage', false,
      'settings_funnel_stages', false,
      'settings_delivery_regions', false,
      'settings_carriers', false,
      'settings_payment_methods', false,
      'settings_non_purchase_reasons', false,
      'settings_standard_questions', false,
      'settings_teams', false,
      'settings_lead_sources', false,
      'reports_view', false,
      'deliveries_view_own', false,
      'deliveries_view_all', false,
      'receptive_module_access', false,
      'team_view', false,
      'instagram_view', false,
      'post_sale_view', false,
      'post_sale_manage', false,
      'sac_view', false,
      'sac_manage', false
    );
  ELSE
    RETURN jsonb_build_object(
      'leads_view', true,
      'leads_create', false,
      'leads_edit', false,
      'leads_delete', false,
      'sales_view', false,
      'sales_view_all', false,
      'sales_create', false,
      'sales_edit_draft', false,
      'sales_confirm_payment', false,
      'sales_validate_expedition', false,
      'sales_dispatch', false,
      'sales_mark_delivered', false,
      'sales_cancel', false,
      'whatsapp_view', false,
      'whatsapp_send', false,
      'products_view', true,
      'products_manage', false,
      'products_view_cost', false,
      'settings_view', false,
      'settings_manage', false,
      'settings_funnel_stages', false,
      'settings_delivery_regions', false,
      'settings_carriers', false,
      'settings_payment_methods', false,
      'settings_non_purchase_reasons', false,
      'settings_standard_questions', false,
      'settings_teams', false,
      'settings_lead_sources', false,
      'reports_view', false,
      'deliveries_view_own', false,
      'deliveries_view_all', false,
      'receptive_module_access', false,
      'team_view', false,
      'instagram_view', false,
      'post_sale_view', false,
      'post_sale_manage', false,
      'sac_view', false,
      'sac_manage', false
    );
  END IF;
END;
$$;

-- Update existing admin/owner users to have all settings permissions enabled
UPDATE public.user_permissions up
SET 
  settings_funnel_stages = true,
  settings_delivery_regions = true,
  settings_carriers = true,
  settings_payment_methods = true,
  settings_non_purchase_reasons = true,
  settings_standard_questions = true,
  settings_teams = true,
  settings_lead_sources = true
FROM public.organization_members om
WHERE up.user_id = om.user_id 
  AND up.organization_id = om.organization_id
  AND om.role IN ('owner', 'admin');