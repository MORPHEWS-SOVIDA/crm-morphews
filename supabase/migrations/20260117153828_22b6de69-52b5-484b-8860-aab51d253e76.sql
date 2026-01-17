
-- Add new permissions for separate dashboard views and seller panel
ALTER TABLE user_permissions 
ADD COLUMN IF NOT EXISTS dashboard_funnel_view boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS dashboard_kanban_view boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS seller_panel_view boolean NOT NULL DEFAULT true;

-- Update the get_default_permissions_for_role function to include new permissions
CREATE OR REPLACE FUNCTION public.get_default_permissions_for_role(p_role text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  base_perms jsonb;
  sales_perms jsonb;
  other_perms jsonb;
  settings_perms jsonb;
  team_perms jsonb;
  dashboard_perms jsonb;
BEGIN
  -- Dashboard permissions - separate for clarity
  dashboard_perms := jsonb_build_object(
    'dashboard_funnel_view', CASE WHEN p_role IN ('owner', 'admin', 'manager', 'seller') THEN true ELSE false END,
    'dashboard_kanban_view', CASE WHEN p_role IN ('owner', 'admin', 'manager', 'seller') THEN true ELSE false END,
    'seller_panel_view', CASE WHEN p_role IN ('owner', 'admin', 'manager', 'seller') THEN true ELSE false END
  );

  -- Base permissions (leads, products, basic access)
  base_perms := jsonb_build_object(
    'leads_view', true,
    'leads_view_only_own', CASE WHEN p_role = 'seller' THEN true ELSE false END,
    'leads_create', CASE WHEN p_role IN ('owner', 'admin', 'manager', 'seller') THEN true ELSE false END,
    'leads_edit', CASE WHEN p_role IN ('owner', 'admin', 'manager', 'seller') THEN true ELSE false END,
    'leads_delete', CASE WHEN p_role IN ('owner', 'admin', 'manager') THEN true ELSE false END,
    'leads_hide_new_button', false,
    'products_view', true,
    'products_manage', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'products_view_cost', CASE WHEN p_role IN ('owner', 'admin', 'manager') THEN true ELSE false END
  );
  
  -- Sales permissions
  sales_perms := jsonb_build_object(
    'sales_view', true,
    'sales_view_all', CASE WHEN p_role IN ('owner', 'admin', 'manager', 'financial') THEN true ELSE false END,
    'sales_create', CASE WHEN p_role IN ('owner', 'admin', 'manager', 'seller') THEN true ELSE false END,
    'sales_edit_draft', CASE WHEN p_role IN ('owner', 'admin', 'manager', 'seller') THEN true ELSE false END,
    'sales_confirm_payment', CASE WHEN p_role IN ('owner', 'admin', 'financial') THEN true ELSE false END,
    'sales_validate_expedition', CASE WHEN p_role IN ('owner', 'admin', 'expedition') THEN true ELSE false END,
    'sales_dispatch', CASE WHEN p_role IN ('owner', 'admin', 'expedition') THEN true ELSE false END,
    'sales_mark_delivered', CASE WHEN p_role IN ('owner', 'admin', 'motoboy', 'expedition') THEN true ELSE false END,
    'sales_mark_printed', CASE WHEN p_role IN ('owner', 'admin', 'expedition') THEN true ELSE false END,
    'sales_cancel', CASE WHEN p_role IN ('owner', 'admin', 'manager') THEN true ELSE false END,
    'sales_hide_new_button', false
  );
  
  -- WhatsApp, AI, Demands, Instagram
  other_perms := jsonb_build_object(
    'whatsapp_view', CASE WHEN p_role IN ('owner', 'admin', 'manager', 'seller') THEN true ELSE false END,
    'whatsapp_send', CASE WHEN p_role IN ('owner', 'admin', 'manager', 'seller') THEN true ELSE false END,
    'whatsapp_v2_view', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'whatsapp_manage_view', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'ai_bots_view', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'demands_view', CASE WHEN p_role IN ('owner', 'admin', 'manager') THEN true ELSE false END,
    'instagram_view', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'reports_view', CASE WHEN p_role IN ('owner', 'admin', 'financial') THEN true ELSE false END,
    'sales_report_view', CASE WHEN p_role IN ('owner', 'admin', 'financial', 'manager') THEN true ELSE false END,
    'expedition_report_view', CASE WHEN p_role IN ('owner', 'admin', 'expedition') THEN true ELSE false END,
    'deliveries_view_own', CASE WHEN p_role IN ('owner', 'admin', 'motoboy', 'expedition') THEN true ELSE false END,
    'deliveries_view_all', CASE WHEN p_role IN ('owner', 'admin', 'expedition') THEN true ELSE false END,
    'receptive_module_access', CASE WHEN p_role IN ('owner', 'admin', 'manager', 'seller') THEN true ELSE false END
  );
  
  -- Settings permissions
  settings_perms := jsonb_build_object(
    'settings_view', CASE WHEN p_role IN ('owner', 'admin', 'manager') THEN true ELSE false END,
    'settings_manage', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'settings_funnel_stages', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'settings_delivery_regions', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'settings_carriers', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'settings_payment_methods', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'settings_non_purchase_reasons', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'settings_standard_questions', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'settings_teams', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'settings_lead_sources', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END
  );
  
  -- Team permissions
  team_perms := jsonb_build_object(
    'team_view', CASE WHEN p_role IN ('owner', 'admin', 'manager') THEN true ELSE false END,
    'team_add_member', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'team_edit_member', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'team_delete_member', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'team_change_permissions', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'team_change_role', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'team_change_commission', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'team_toggle_manager', CASE WHEN p_role IN ('owner', 'admin') THEN true ELSE false END,
    'post_sale_view', CASE WHEN p_role IN ('owner', 'admin', 'manager', 'seller') THEN true ELSE false END,
    'post_sale_manage', CASE WHEN p_role IN ('owner', 'admin', 'manager', 'seller') THEN true ELSE false END,
    'sac_view', CASE WHEN p_role IN ('owner', 'admin', 'manager') THEN true ELSE false END,
    'sac_manage', CASE WHEN p_role IN ('owner', 'admin', 'manager') THEN true ELSE false END,
    'scheduled_messages_view', CASE WHEN p_role IN ('owner', 'admin', 'manager', 'seller') THEN true ELSE false END,
    'scheduled_messages_manage', CASE WHEN p_role IN ('owner', 'admin', 'manager', 'seller') THEN true ELSE false END
  );
  
  -- Merge all permissions using || operator
  result := dashboard_perms || base_perms || sales_perms || other_perms || settings_perms || team_perms;
  
  RETURN result;
END;
$$;

-- Grant permissions to existing owners/admins
UPDATE user_permissions up
SET 
  dashboard_funnel_view = true,
  dashboard_kanban_view = true,
  seller_panel_view = true
FROM organization_members om
WHERE up.user_id = om.user_id 
  AND up.organization_id = om.organization_id
  AND om.role IN ('owner', 'admin');
