-- Add new permission to hide "New Lead" button
-- This forces sellers to use the Add Receptivo module to create leads

ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS leads_hide_new_button boolean NOT NULL DEFAULT false;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.user_permissions.leads_hide_new_button IS 
'When true, hides the "+ Novo Lead" button from sidebar and leads list, forcing the user to create leads through Add Receptivo module';

-- Update the get_default_permissions_for_role function to include the new permission
CREATE OR REPLACE FUNCTION public.get_default_permissions_for_role(_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  CASE _role
    WHEN 'admin' THEN
      result := jsonb_build_object(
        'leads_view', true,
        'leads_view_only_own', false,
        'leads_create', true,
        'leads_edit', true,
        'leads_delete', true,
        'leads_hide_new_button', false,
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
        'whatsapp_v2_view', true,
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
        'receptive_module_access', true,
        'team_view', true,
        'instagram_view', true,
        'post_sale_view', true,
        'post_sale_manage', true,
        'sac_view', true,
        'sac_manage', true,
        'scheduled_messages_view', true,
        'scheduled_messages_manage', true
      );
    WHEN 'manager' THEN
      result := jsonb_build_object(
        'leads_view', true,
        'leads_view_only_own', false,
        'leads_create', true,
        'leads_edit', true,
        'leads_delete', false,
        'leads_hide_new_button', false,
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
        'whatsapp_v2_view', true,
        'products_view', true,
        'products_manage', true,
        'products_view_cost', true,
        'settings_view', true,
        'settings_manage', false,
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
        'receptive_module_access', true,
        'team_view', true,
        'instagram_view', true,
        'post_sale_view', true,
        'post_sale_manage', true,
        'sac_view', true,
        'sac_manage', true,
        'scheduled_messages_view', true,
        'scheduled_messages_manage', true
      );
    WHEN 'seller' THEN
      result := jsonb_build_object(
        'leads_view', true,
        'leads_view_only_own', true,
        'leads_create', true,
        'leads_edit', true,
        'leads_delete', false,
        'leads_hide_new_button', false,
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
        'whatsapp_v2_view', false,
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
        'sales_report_view', false,
        'expedition_report_view', false,
        'deliveries_view_own', true,
        'deliveries_view_all', false,
        'receptive_module_access', true,
        'team_view', false,
        'instagram_view', false,
        'post_sale_view', false,
        'post_sale_manage', false,
        'sac_view', true,
        'sac_manage', false,
        'scheduled_messages_view', true,
        'scheduled_messages_manage', false
      );
    ELSE
      -- Default minimal permissions for unknown roles
      result := jsonb_build_object(
        'leads_view', true,
        'leads_view_only_own', true,
        'leads_create', true,
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
        'sales_cancel', false,
        'whatsapp_view', false,
        'whatsapp_send', false,
        'whatsapp_v2_view', false,
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
        'receptive_module_access', false,
        'team_view', false,
        'instagram_view', false,
        'post_sale_view', false,
        'post_sale_manage', false,
        'sac_view', false,
        'sac_manage', false,
        'scheduled_messages_view', false,
        'scheduled_messages_manage', false
      );
  END CASE;
  
  RETURN result;
END;
$$;