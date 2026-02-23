
-- Fix the initialize_user_permissions trigger to properly detect owners
-- The old code checked organizations.owner_id which doesn't exist
-- Now it checks if the member role is 'owner' or 'admin'
CREATE OR REPLACE FUNCTION public.initialize_user_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_user_role text;
  v_is_owner boolean;
  v_is_admin boolean;
BEGIN
  v_org_id := NEW.organization_id;
  v_user_role := NEW.role;
  
  -- Check if user is owner or admin based on organization_members role
  v_is_owner := v_user_role = 'owner';
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
    scheduled_messages_view, scheduled_messages_manage,
    helper_donna_view, whatsapp_ai_settings_view, integrations_view,
    dashboard_funnel_view, dashboard_kanban_view
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
    -- Team - OWNERS AND ADMINS GET FULL TEAM MANAGEMENT
    v_is_owner OR v_is_admin, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin,
    v_is_owner OR v_is_admin, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin,
    -- Post-sale
    v_is_owner OR v_is_admin, v_is_owner OR v_is_admin,
    -- SAC
    v_is_owner OR v_is_admin, v_is_owner OR v_is_admin,
    -- Scheduled Messages
    v_is_owner OR v_is_admin, v_is_owner OR v_is_admin,
    -- Helper, WhatsApp AI settings, Integrations
    true, v_is_owner OR v_is_admin, v_is_owner OR v_is_admin,
    -- Dashboard views
    true, true
  )
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;
