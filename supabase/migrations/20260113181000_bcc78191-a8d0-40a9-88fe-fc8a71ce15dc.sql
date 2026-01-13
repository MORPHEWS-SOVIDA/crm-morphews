-- Drop and recreate the function with correct parameter name
DROP FUNCTION IF EXISTS public.get_default_permissions_for_role(text);

CREATE FUNCTION public.get_default_permissions_for_role(p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  permissions_part1 jsonb;
  permissions_part2 jsonb;
  permissions_part3 jsonb;
BEGIN
  v_is_admin := p_role IN ('owner', 'admin');
  
  -- Build permissions in smaller chunks to avoid 100 argument limit
  permissions_part1 := jsonb_build_object(
    'leads_view', true,
    'leads_view_only_own', NOT v_is_admin,
    'leads_create', true,
    'leads_edit', true,
    'leads_delete', v_is_admin,
    'leads_hide_new_button', false,
    'sales_view', true,
    'sales_view_all', v_is_admin,
    'sales_create', v_is_admin,
    'sales_edit_draft', v_is_admin,
    'sales_confirm_payment', v_is_admin,
    'sales_validate_expedition', v_is_admin,
    'sales_dispatch', v_is_admin,
    'sales_mark_delivered', v_is_admin,
    'sales_mark_printed', v_is_admin,
    'sales_cancel', v_is_admin,
    'sales_hide_new_button', false,
    'whatsapp_view', true,
    'whatsapp_send', v_is_admin
  );
  
  permissions_part2 := jsonb_build_object(
    'whatsapp_v2_view', v_is_admin,
    'whatsapp_manage_view', v_is_admin,
    'ai_bots_view', v_is_admin,
    'demands_view', v_is_admin,
    'products_view', true,
    'products_manage', v_is_admin,
    'products_view_cost', v_is_admin,
    'settings_view', v_is_admin,
    'settings_manage', v_is_admin,
    'settings_funnel_stages', v_is_admin,
    'settings_delivery_regions', v_is_admin,
    'settings_carriers', v_is_admin,
    'settings_payment_methods', v_is_admin,
    'settings_non_purchase_reasons', v_is_admin,
    'settings_standard_questions', v_is_admin,
    'settings_teams', v_is_admin,
    'settings_lead_sources', v_is_admin,
    'reports_view', v_is_admin,
    'sales_report_view', v_is_admin,
    'expedition_report_view', v_is_admin
  );
  
  permissions_part3 := jsonb_build_object(
    'deliveries_view_own', true,
    'deliveries_view_all', v_is_admin,
    'receptive_module_access', true,
    'instagram_view', v_is_admin,
    'team_view', v_is_admin,
    'team_add_member', v_is_admin,
    'team_edit_member', v_is_admin,
    'team_delete_member', v_is_admin,
    'team_change_permissions', v_is_admin,
    'team_change_role', v_is_admin,
    'team_change_commission', v_is_admin,
    'team_toggle_manager', v_is_admin,
    'post_sale_view', v_is_admin,
    'post_sale_manage', v_is_admin,
    'sac_view', v_is_admin,
    'sac_manage', v_is_admin,
    'scheduled_messages_view', v_is_admin,
    'scheduled_messages_manage', v_is_admin
  );
  
  -- Merge all parts together
  RETURN permissions_part1 || permissions_part2 || permissions_part3;
END;
$$;