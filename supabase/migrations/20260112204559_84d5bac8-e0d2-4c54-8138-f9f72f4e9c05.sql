-- Add granular team management permissions
ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS team_add_member boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS team_edit_member boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS team_delete_member boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS team_change_permissions boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS team_change_role boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS team_change_commission boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS team_toggle_manager boolean NOT NULL DEFAULT false;

-- Update existing admins, owners, and managers to have team management permissions
UPDATE public.user_permissions up
SET 
  team_add_member = true,
  team_edit_member = true,
  team_delete_member = true,
  team_change_permissions = true,
  team_change_role = true,
  team_change_commission = true,
  team_toggle_manager = true
FROM public.organization_members om
WHERE up.user_id = om.user_id 
  AND up.organization_id = om.organization_id 
  AND om.role IN ('owner', 'admin');

-- Update managers to have basic team management (add, edit, but not permissions/role changes)
UPDATE public.user_permissions up
SET 
  team_add_member = true,
  team_edit_member = true,
  team_delete_member = false,
  team_change_permissions = false,
  team_change_role = false,
  team_change_commission = true,
  team_toggle_manager = false
FROM public.organization_members om
WHERE up.user_id = om.user_id 
  AND up.organization_id = om.organization_id 
  AND om.role = 'manager';

-- Update function to include new permissions in defaults
CREATE OR REPLACE FUNCTION public.get_default_permissions_for_role(p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CASE p_role
    WHEN 'owner', 'admin' THEN
      RETURN jsonb_build_object(
        'leads_view', true, 'leads_view_only_own', false, 'leads_create', true, 'leads_edit', true, 'leads_delete', true, 'leads_hide_new_button', false,
        'sales_view', true, 'sales_view_all', true, 'sales_create', true, 'sales_edit_draft', true, 'sales_confirm_payment', true, 'sales_validate_expedition', true, 'sales_dispatch', true, 'sales_mark_delivered', true, 'sales_cancel', true,
        'whatsapp_view', true, 'whatsapp_send', true, 'whatsapp_v2_view', true, 'whatsapp_manage_view', true, 'ai_bots_view', true, 'demands_view', true,
        'products_view', true, 'products_manage', true, 'products_view_cost', true,
        'settings_view', true, 'settings_manage', true, 'settings_funnel_stages', true, 'settings_delivery_regions', true, 'settings_carriers', true, 'settings_payment_methods', true, 'settings_non_purchase_reasons', true, 'settings_standard_questions', true, 'settings_teams', true, 'settings_lead_sources', true,
        'reports_view', true, 'sales_report_view', true, 'expedition_report_view', true,
        'deliveries_view_own', true, 'deliveries_view_all', true,
        'receptive_module_access', true,
        'team_view', true, 'instagram_view', true,
        'team_add_member', true, 'team_edit_member', true, 'team_delete_member', true, 'team_change_permissions', true, 'team_change_role', true, 'team_change_commission', true, 'team_toggle_manager', true,
        'post_sale_view', true, 'post_sale_manage', true,
        'sac_view', true, 'sac_manage', true,
        'scheduled_messages_view', true, 'scheduled_messages_manage', true
      );
    WHEN 'manager' THEN
      RETURN jsonb_build_object(
        'leads_view', true, 'leads_view_only_own', false, 'leads_create', true, 'leads_edit', true, 'leads_delete', false, 'leads_hide_new_button', false,
        'sales_view', true, 'sales_view_all', true, 'sales_create', true, 'sales_edit_draft', true, 'sales_confirm_payment', false, 'sales_validate_expedition', false, 'sales_dispatch', false, 'sales_mark_delivered', false, 'sales_cancel', false,
        'whatsapp_view', true, 'whatsapp_send', true, 'whatsapp_v2_view', false, 'whatsapp_manage_view', false, 'ai_bots_view', false, 'demands_view', true,
        'products_view', true, 'products_manage', false, 'products_view_cost', true,
        'settings_view', true, 'settings_manage', false, 'settings_funnel_stages', false, 'settings_delivery_regions', false, 'settings_carriers', false, 'settings_payment_methods', false, 'settings_non_purchase_reasons', false, 'settings_standard_questions', false, 'settings_teams', false, 'settings_lead_sources', false,
        'reports_view', true, 'sales_report_view', true, 'expedition_report_view', false,
        'deliveries_view_own', false, 'deliveries_view_all', false,
        'receptive_module_access', true,
        'team_view', true, 'instagram_view', false,
        'team_add_member', true, 'team_edit_member', true, 'team_delete_member', false, 'team_change_permissions', false, 'team_change_role', false, 'team_change_commission', true, 'team_toggle_manager', false,
        'post_sale_view', true, 'post_sale_manage', true,
        'sac_view', true, 'sac_manage', true,
        'scheduled_messages_view', true, 'scheduled_messages_manage', true
      );
    WHEN 'seller' THEN
      RETURN jsonb_build_object(
        'leads_view', true, 'leads_view_only_own', false, 'leads_create', true, 'leads_edit', true, 'leads_delete', false, 'leads_hide_new_button', false,
        'sales_view', true, 'sales_view_all', false, 'sales_create', true, 'sales_edit_draft', true, 'sales_confirm_payment', false, 'sales_validate_expedition', false, 'sales_dispatch', false, 'sales_mark_delivered', false, 'sales_cancel', false,
        'whatsapp_view', true, 'whatsapp_send', true, 'whatsapp_v2_view', false, 'whatsapp_manage_view', false, 'ai_bots_view', false, 'demands_view', false,
        'products_view', true, 'products_manage', false, 'products_view_cost', false,
        'settings_view', false, 'settings_manage', false, 'settings_funnel_stages', false, 'settings_delivery_regions', false, 'settings_carriers', false, 'settings_payment_methods', false, 'settings_non_purchase_reasons', false, 'settings_standard_questions', false, 'settings_teams', false, 'settings_lead_sources', false,
        'reports_view', false, 'sales_report_view', false, 'expedition_report_view', false,
        'deliveries_view_own', false, 'deliveries_view_all', false,
        'receptive_module_access', true,
        'team_view', false, 'instagram_view', false,
        'team_add_member', false, 'team_edit_member', false, 'team_delete_member', false, 'team_change_permissions', false, 'team_change_role', false, 'team_change_commission', false, 'team_toggle_manager', false,
        'post_sale_view', false, 'post_sale_manage', false,
        'sac_view', false, 'sac_manage', false,
        'scheduled_messages_view', false, 'scheduled_messages_manage', false
      );
    WHEN 'shipping' THEN
      RETURN jsonb_build_object(
        'leads_view', false, 'leads_view_only_own', false, 'leads_create', false, 'leads_edit', false, 'leads_delete', false, 'leads_hide_new_button', false,
        'sales_view', true, 'sales_view_all', true, 'sales_create', false, 'sales_edit_draft', false, 'sales_confirm_payment', false, 'sales_validate_expedition', true, 'sales_dispatch', true, 'sales_mark_delivered', false, 'sales_cancel', false,
        'whatsapp_view', false, 'whatsapp_send', false, 'whatsapp_v2_view', false, 'whatsapp_manage_view', false, 'ai_bots_view', false, 'demands_view', false,
        'products_view', true, 'products_manage', false, 'products_view_cost', false,
        'settings_view', false, 'settings_manage', false, 'settings_funnel_stages', false, 'settings_delivery_regions', false, 'settings_carriers', false, 'settings_payment_methods', false, 'settings_non_purchase_reasons', false, 'settings_standard_questions', false, 'settings_teams', false, 'settings_lead_sources', false,
        'reports_view', false, 'sales_report_view', false, 'expedition_report_view', true,
        'deliveries_view_own', false, 'deliveries_view_all', false,
        'receptive_module_access', false,
        'team_view', false, 'instagram_view', false,
        'team_add_member', false, 'team_edit_member', false, 'team_delete_member', false, 'team_change_permissions', false, 'team_change_role', false, 'team_change_commission', false, 'team_toggle_manager', false,
        'post_sale_view', false, 'post_sale_manage', false,
        'sac_view', false, 'sac_manage', false,
        'scheduled_messages_view', false, 'scheduled_messages_manage', false
      );
    WHEN 'delivery' THEN
      RETURN jsonb_build_object(
        'leads_view', false, 'leads_view_only_own', false, 'leads_create', false, 'leads_edit', false, 'leads_delete', false, 'leads_hide_new_button', false,
        'sales_view', false, 'sales_view_all', false, 'sales_create', false, 'sales_edit_draft', false, 'sales_confirm_payment', false, 'sales_validate_expedition', false, 'sales_dispatch', false, 'sales_mark_delivered', true, 'sales_cancel', false,
        'whatsapp_view', false, 'whatsapp_send', false, 'whatsapp_v2_view', false, 'whatsapp_manage_view', false, 'ai_bots_view', false, 'demands_view', false,
        'products_view', false, 'products_manage', false, 'products_view_cost', false,
        'settings_view', false, 'settings_manage', false, 'settings_funnel_stages', false, 'settings_delivery_regions', false, 'settings_carriers', false, 'settings_payment_methods', false, 'settings_non_purchase_reasons', false, 'settings_standard_questions', false, 'settings_teams', false, 'settings_lead_sources', false,
        'reports_view', false, 'sales_report_view', false, 'expedition_report_view', false,
        'deliveries_view_own', true, 'deliveries_view_all', false,
        'receptive_module_access', false,
        'team_view', false, 'instagram_view', false,
        'team_add_member', false, 'team_edit_member', false, 'team_delete_member', false, 'team_change_permissions', false, 'team_change_role', false, 'team_change_commission', false, 'team_toggle_manager', false,
        'post_sale_view', false, 'post_sale_manage', false,
        'sac_view', false, 'sac_manage', false,
        'scheduled_messages_view', false, 'scheduled_messages_manage', false
      );
    WHEN 'finance' THEN
      RETURN jsonb_build_object(
        'leads_view', false, 'leads_view_only_own', false, 'leads_create', false, 'leads_edit', false, 'leads_delete', false, 'leads_hide_new_button', false,
        'sales_view', true, 'sales_view_all', true, 'sales_create', false, 'sales_edit_draft', false, 'sales_confirm_payment', true, 'sales_validate_expedition', false, 'sales_dispatch', false, 'sales_mark_delivered', false, 'sales_cancel', false,
        'whatsapp_view', false, 'whatsapp_send', false, 'whatsapp_v2_view', false, 'whatsapp_manage_view', false, 'ai_bots_view', false, 'demands_view', false,
        'products_view', true, 'products_manage', false, 'products_view_cost', true,
        'settings_view', false, 'settings_manage', false, 'settings_funnel_stages', false, 'settings_delivery_regions', false, 'settings_carriers', false, 'settings_payment_methods', false, 'settings_non_purchase_reasons', false, 'settings_standard_questions', false, 'settings_teams', false, 'settings_lead_sources', false,
        'reports_view', true, 'sales_report_view', true, 'expedition_report_view', false,
        'deliveries_view_own', false, 'deliveries_view_all', false,
        'receptive_module_access', false,
        'team_view', false, 'instagram_view', false,
        'team_add_member', false, 'team_edit_member', false, 'team_delete_member', false, 'team_change_permissions', false, 'team_change_role', false, 'team_change_commission', false, 'team_toggle_manager', false,
        'post_sale_view', false, 'post_sale_manage', false,
        'sac_view', false, 'sac_manage', false,
        'scheduled_messages_view', false, 'scheduled_messages_manage', false
      );
    ELSE -- member or unknown
      RETURN jsonb_build_object(
        'leads_view', true, 'leads_view_only_own', false, 'leads_create', true, 'leads_edit', true, 'leads_delete', false, 'leads_hide_new_button', false,
        'sales_view', true, 'sales_view_all', false, 'sales_create', false, 'sales_edit_draft', false, 'sales_confirm_payment', false, 'sales_validate_expedition', false, 'sales_dispatch', false, 'sales_mark_delivered', false, 'sales_cancel', false,
        'whatsapp_view', true, 'whatsapp_send', false, 'whatsapp_v2_view', false, 'whatsapp_manage_view', false, 'ai_bots_view', false, 'demands_view', false,
        'products_view', true, 'products_manage', false, 'products_view_cost', false,
        'settings_view', false, 'settings_manage', false, 'settings_funnel_stages', false, 'settings_delivery_regions', false, 'settings_carriers', false, 'settings_payment_methods', false, 'settings_non_purchase_reasons', false, 'settings_standard_questions', false, 'settings_teams', false, 'settings_lead_sources', false,
        'reports_view', false, 'sales_report_view', false, 'expedition_report_view', false,
        'deliveries_view_own', false, 'deliveries_view_all', false,
        'receptive_module_access', false,
        'team_view', false, 'instagram_view', false,
        'team_add_member', false, 'team_edit_member', false, 'team_delete_member', false, 'team_change_permissions', false, 'team_change_role', false, 'team_change_commission', false, 'team_toggle_manager', false,
        'post_sale_view', false, 'post_sale_manage', false,
        'sac_view', false, 'sac_manage', false,
        'scheduled_messages_view', false, 'scheduled_messages_manage', false
      );
  END CASE;
END;
$$;

-- Update trigger function to include new team permissions
CREATE OR REPLACE FUNCTION public.initialize_user_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_defaults jsonb;
BEGIN
  v_role := NEW.role;
  v_defaults := get_default_permissions_for_role(v_role);
  
  INSERT INTO public.user_permissions (
    organization_id, user_id,
    leads_view, leads_view_only_own, leads_create, leads_edit, leads_delete, leads_hide_new_button,
    sales_view, sales_view_all, sales_create, sales_edit_draft, sales_confirm_payment, sales_validate_expedition, sales_dispatch, sales_mark_delivered, sales_cancel,
    whatsapp_view, whatsapp_send, whatsapp_v2_view, whatsapp_manage_view, ai_bots_view, demands_view,
    products_view, products_manage, products_view_cost,
    settings_view, settings_manage, settings_funnel_stages, settings_delivery_regions, settings_carriers, settings_payment_methods, settings_non_purchase_reasons, settings_standard_questions, settings_teams, settings_lead_sources,
    reports_view, sales_report_view, expedition_report_view,
    deliveries_view_own, deliveries_view_all,
    receptive_module_access,
    team_view, instagram_view,
    team_add_member, team_edit_member, team_delete_member, team_change_permissions, team_change_role, team_change_commission, team_toggle_manager,
    post_sale_view, post_sale_manage,
    sac_view, sac_manage,
    scheduled_messages_view, scheduled_messages_manage
  ) VALUES (
    NEW.organization_id, NEW.user_id,
    COALESCE((v_defaults->>'leads_view')::boolean, true),
    COALESCE((v_defaults->>'leads_view_only_own')::boolean, false),
    COALESCE((v_defaults->>'leads_create')::boolean, true),
    COALESCE((v_defaults->>'leads_edit')::boolean, true),
    COALESCE((v_defaults->>'leads_delete')::boolean, false),
    COALESCE((v_defaults->>'leads_hide_new_button')::boolean, false),
    COALESCE((v_defaults->>'sales_view')::boolean, true),
    COALESCE((v_defaults->>'sales_view_all')::boolean, false),
    COALESCE((v_defaults->>'sales_create')::boolean, false),
    COALESCE((v_defaults->>'sales_edit_draft')::boolean, false),
    COALESCE((v_defaults->>'sales_confirm_payment')::boolean, false),
    COALESCE((v_defaults->>'sales_validate_expedition')::boolean, false),
    COALESCE((v_defaults->>'sales_dispatch')::boolean, false),
    COALESCE((v_defaults->>'sales_mark_delivered')::boolean, false),
    COALESCE((v_defaults->>'sales_cancel')::boolean, false),
    COALESCE((v_defaults->>'whatsapp_view')::boolean, true),
    COALESCE((v_defaults->>'whatsapp_send')::boolean, false),
    COALESCE((v_defaults->>'whatsapp_v2_view')::boolean, false),
    COALESCE((v_defaults->>'whatsapp_manage_view')::boolean, false),
    COALESCE((v_defaults->>'ai_bots_view')::boolean, false),
    COALESCE((v_defaults->>'demands_view')::boolean, false),
    COALESCE((v_defaults->>'products_view')::boolean, true),
    COALESCE((v_defaults->>'products_manage')::boolean, false),
    COALESCE((v_defaults->>'products_view_cost')::boolean, false),
    COALESCE((v_defaults->>'settings_view')::boolean, false),
    COALESCE((v_defaults->>'settings_manage')::boolean, false),
    COALESCE((v_defaults->>'settings_funnel_stages')::boolean, false),
    COALESCE((v_defaults->>'settings_delivery_regions')::boolean, false),
    COALESCE((v_defaults->>'settings_carriers')::boolean, false),
    COALESCE((v_defaults->>'settings_payment_methods')::boolean, false),
    COALESCE((v_defaults->>'settings_non_purchase_reasons')::boolean, false),
    COALESCE((v_defaults->>'settings_standard_questions')::boolean, false),
    COALESCE((v_defaults->>'settings_teams')::boolean, false),
    COALESCE((v_defaults->>'settings_lead_sources')::boolean, false),
    COALESCE((v_defaults->>'reports_view')::boolean, false),
    COALESCE((v_defaults->>'sales_report_view')::boolean, false),
    COALESCE((v_defaults->>'expedition_report_view')::boolean, false),
    COALESCE((v_defaults->>'deliveries_view_own')::boolean, false),
    COALESCE((v_defaults->>'deliveries_view_all')::boolean, false),
    COALESCE((v_defaults->>'receptive_module_access')::boolean, false),
    COALESCE((v_defaults->>'team_view')::boolean, false),
    COALESCE((v_defaults->>'instagram_view')::boolean, false),
    COALESCE((v_defaults->>'team_add_member')::boolean, false),
    COALESCE((v_defaults->>'team_edit_member')::boolean, false),
    COALESCE((v_defaults->>'team_delete_member')::boolean, false),
    COALESCE((v_defaults->>'team_change_permissions')::boolean, false),
    COALESCE((v_defaults->>'team_change_role')::boolean, false),
    COALESCE((v_defaults->>'team_change_commission')::boolean, false),
    COALESCE((v_defaults->>'team_toggle_manager')::boolean, false),
    COALESCE((v_defaults->>'post_sale_view')::boolean, false),
    COALESCE((v_defaults->>'post_sale_manage')::boolean, false),
    COALESCE((v_defaults->>'sac_view')::boolean, false),
    COALESCE((v_defaults->>'sac_manage')::boolean, false),
    COALESCE((v_defaults->>'scheduled_messages_view')::boolean, false),
    COALESCE((v_defaults->>'scheduled_messages_manage')::boolean, false)
  )
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;