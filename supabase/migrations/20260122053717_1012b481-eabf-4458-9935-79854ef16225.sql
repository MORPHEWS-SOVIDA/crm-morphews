-- Add helper_donna_view permission column to user_permissions
ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS helper_donna_view BOOLEAN NOT NULL DEFAULT true;

-- Update the default permissions function to include helper_donna_view
CREATE OR REPLACE FUNCTION public.get_default_permissions_for_role(p_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  base_perms JSONB;
  role_perms JSONB;
BEGIN
  -- Base permissions (everyone gets these)
  base_perms := jsonb_build_object(
    'dashboard_funnel_view', false,
    'dashboard_kanban_view', false,
    'seller_panel_view', false,
    'sales_dashboard_view', false,
    'leads_view', false,
    'leads_view_only_own', false,
    'leads_create', false,
    'leads_edit', false,
    'leads_delete', false,
    'leads_hide_new_button', false,
    'sales_view', false,
    'sales_view_all', false,
    'sales_create', false,
    'sales_edit_draft', false,
    'sales_confirm_payment', false,
    'sales_validate_expedition', false,
    'sales_dispatch', false,
    'sales_mark_delivered', false,
    'sales_mark_printed', false,
    'sales_cancel', false,
    'sales_hide_new_button', false,
    'whatsapp_view', false,
    'whatsapp_send', false,
    'whatsapp_v2_view', false,
    'whatsapp_manage_view', false,
    'whatsapp_ai_settings_view', false,
    'ai_bots_view', false,
    'demands_view', false,
    'products_view', false,
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
    'sales_report_view', false,
    'expedition_report_view', false,
    'deliveries_view_own', false,
    'deliveries_view_all', false,
    'expedition_view', false,
    'receptive_module_access', false,
    'instagram_view', false,
    'integrations_view', false,
    'team_view', false,
    'team_add_member', false,
    'team_edit_member', false,
    'team_delete_member', false,
    'team_change_permissions', false,
    'team_change_role', false,
    'team_change_commission', false,
    'team_toggle_manager', false,
    'post_sale_view', false,
    'post_sale_manage', false,
    'sac_view', false,
    'sac_manage', false,
    'scheduled_messages_view', false,
    'scheduled_messages_manage', false,
    'helper_donna_view', true
  );

  -- Role-specific permissions
  CASE p_role
    WHEN 'owner' THEN
      role_perms := jsonb_build_object(
        'dashboard_funnel_view', true,
        'dashboard_kanban_view', true,
        'seller_panel_view', true,
        'sales_dashboard_view', true,
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
        'sales_mark_printed', true,
        'sales_cancel', true,
        'whatsapp_view', true,
        'whatsapp_send', true,
        'whatsapp_v2_view', true,
        'whatsapp_manage_view', true,
        'whatsapp_ai_settings_view', true,
        'ai_bots_view', true,
        'demands_view', true,
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
        'sales_report_view', true,
        'expedition_report_view', true,
        'deliveries_view_own', true,
        'deliveries_view_all', true,
        'expedition_view', true,
        'receptive_module_access', true,
        'instagram_view', true,
        'integrations_view', true,
        'team_view', true,
        'team_add_member', true,
        'team_edit_member', true,
        'team_delete_member', true,
        'team_change_permissions', true,
        'team_change_role', true,
        'team_change_commission', true,
        'team_toggle_manager', true,
        'post_sale_view', true,
        'post_sale_manage', true,
        'sac_view', true,
        'sac_manage', true,
        'scheduled_messages_view', true,
        'scheduled_messages_manage', true,
        'helper_donna_view', true
      );
    WHEN 'admin' THEN
      role_perms := jsonb_build_object(
        'dashboard_funnel_view', true,
        'dashboard_kanban_view', true,
        'seller_panel_view', true,
        'sales_dashboard_view', true,
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
        'sales_mark_printed', true,
        'sales_cancel', true,
        'whatsapp_view', true,
        'whatsapp_send', true,
        'whatsapp_v2_view', true,
        'whatsapp_manage_view', true,
        'whatsapp_ai_settings_view', true,
        'ai_bots_view', true,
        'demands_view', true,
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
        'sales_report_view', true,
        'expedition_report_view', true,
        'deliveries_view_own', true,
        'deliveries_view_all', true,
        'expedition_view', true,
        'receptive_module_access', true,
        'instagram_view', true,
        'integrations_view', true,
        'team_view', true,
        'team_add_member', true,
        'team_edit_member', true,
        'team_delete_member', false,
        'team_change_permissions', true,
        'team_change_role', true,
        'team_change_commission', true,
        'team_toggle_manager', true,
        'post_sale_view', true,
        'post_sale_manage', true,
        'sac_view', true,
        'sac_manage', true,
        'scheduled_messages_view', true,
        'scheduled_messages_manage', true,
        'helper_donna_view', true
      );
    WHEN 'manager' THEN
      role_perms := jsonb_build_object(
        'dashboard_funnel_view', true,
        'dashboard_kanban_view', true,
        'seller_panel_view', true,
        'sales_dashboard_view', true,
        'leads_view', true,
        'leads_create', true,
        'leads_edit', true,
        'sales_view', true,
        'sales_view_all', true,
        'sales_create', true,
        'sales_edit_draft', true,
        'sales_confirm_payment', true,
        'sales_dispatch', true,
        'whatsapp_view', true,
        'whatsapp_send', true,
        'whatsapp_v2_view', true,
        'products_view', true,
        'reports_view', true,
        'sales_report_view', true,
        'team_view', true,
        'post_sale_view', true,
        'post_sale_manage', true,
        'helper_donna_view', true
      );
    WHEN 'seller' THEN
      role_perms := jsonb_build_object(
        'dashboard_funnel_view', true,
        'dashboard_kanban_view', true,
        'seller_panel_view', true,
        'leads_view', true,
        'leads_view_only_own', true,
        'leads_create', true,
        'leads_edit', true,
        'sales_view', true,
        'sales_create', true,
        'sales_edit_draft', true,
        'whatsapp_view', true,
        'whatsapp_send', true,
        'whatsapp_v2_view', true,
        'products_view', true,
        'receptive_module_access', true,
        'helper_donna_view', true
      );
    WHEN 'financial' THEN
      role_perms := jsonb_build_object(
        'sales_view', true,
        'sales_view_all', true,
        'sales_confirm_payment', true,
        'reports_view', true,
        'sales_report_view', true,
        'helper_donna_view', true
      );
    WHEN 'expedition' THEN
      role_perms := jsonb_build_object(
        'sales_view', true,
        'sales_view_all', true,
        'sales_validate_expedition', true,
        'sales_dispatch', true,
        'sales_mark_printed', true,
        'expedition_view', true,
        'deliveries_view_all', true,
        'products_view', true,
        'helper_donna_view', false
      );
    WHEN 'motoboy' THEN
      role_perms := jsonb_build_object(
        'deliveries_view_own', true,
        'sales_mark_delivered', true,
        'sales_confirm_payment', true,
        'helper_donna_view', false
      );
    ELSE
      role_perms := '{}'::JSONB;
  END CASE;

  -- Merge base with role-specific (role overrides base)
  result := base_perms || role_perms;
  
  RETURN result;
END;
$$;