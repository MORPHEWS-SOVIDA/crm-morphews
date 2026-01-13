-- Add sales_hide_new_button permission column
ALTER TABLE public.user_permissions
ADD COLUMN IF NOT EXISTS sales_hide_new_button boolean NOT NULL DEFAULT false;

-- Update the trigger function to include the new column
CREATE OR REPLACE FUNCTION public.initialize_user_permissions()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id uuid;
  v_user_role text;
  v_is_owner boolean;
  v_is_admin boolean;
BEGIN
  -- Get the organization_id from the new user role
  v_org_id := NEW.organization_id;
  v_user_role := NEW.role;
  
  -- Check if user is owner or admin
  v_is_owner := EXISTS (
    SELECT 1 FROM organizations WHERE id = v_org_id AND owner_id = NEW.user_id
  );
  v_is_admin := v_user_role = 'admin';
  
  -- Insert default permissions based on role
  INSERT INTO public.user_permissions (
    organization_id,
    user_id,
    leads_view, leads_view_only_own, leads_create, leads_edit, leads_delete, leads_hide_new_button,
    sales_view, sales_view_all, sales_create, sales_edit_draft, sales_confirm_payment,
    sales_validate_expedition, sales_dispatch, sales_mark_delivered, sales_mark_printed, sales_cancel,
    sales_hide_new_button,
    whatsapp_view, whatsapp_send, whatsapp_v2_view, whatsapp_manage_view,
    ai_bots_view, demands_view,
    products_view, products_manage, products_view_cost,
    settings_view, settings_manage,
    settings_funnel_stages, settings_delivery_regions, settings_carriers, settings_payment_methods,
    settings_non_purchase_reasons, settings_standard_questions, settings_teams, settings_lead_sources,
    reports_view, sales_report_view, expedition_report_view,
    deliveries_view_own, deliveries_view_all,
    receptive_module_access, instagram_view,
    team_view, team_add_member, team_edit_member, team_delete_member,
    team_change_permissions, team_change_role, team_change_commission, team_toggle_manager,
    post_sale_view, post_sale_manage,
    sac_view, sac_manage,
    scheduled_messages_view, scheduled_messages_manage
  ) VALUES (
    v_org_id,
    NEW.user_id,
    -- Leads: everyone can view, only own for non-admin, create/edit for all
    true, NOT (v_is_owner OR v_is_admin), true, true, v_is_owner OR v_is_admin, false,
    -- Sales: view for all, others for owner/admin
    true, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin,
    v_is_owner OR v_is_admin, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin,
    false, -- sales_hide_new_button defaults to false
    -- WhatsApp
    true, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin,
    -- AI Bots, Demands
    v_is_owner OR v_is_admin, v_is_owner OR v_is_admin,
    -- Products
    true, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin,
    -- Settings
    v_is_owner OR v_is_admin, v_is_owner OR v_is_admin,
    v_is_owner OR v_is_admin, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin,
    v_is_owner OR v_is_admin, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin,
    -- Reports
    v_is_owner OR v_is_admin, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin,
    -- Deliveries
    true, v_is_owner OR v_is_admin,
    -- Modules
    true, v_is_owner OR v_is_admin,
    -- Team
    v_is_owner OR v_is_admin, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin,
    v_is_owner OR v_is_admin, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin,
    -- Post-sale
    v_is_owner OR v_is_admin, v_is_owner OR v_is_admin,
    -- SAC
    v_is_owner OR v_is_admin, v_is_owner OR v_is_admin,
    -- Scheduled Messages
    v_is_owner OR v_is_admin, v_is_owner OR v_is_admin
  )
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update get_default_permissions_for_role to include new column
CREATE OR REPLACE FUNCTION public.get_default_permissions_for_role(p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  v_is_admin := p_role IN ('admin', 'owner');
  
  RETURN jsonb_build_object(
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
    'whatsapp_send', v_is_admin,
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
    'expedition_report_view', v_is_admin,
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
END;
$$;