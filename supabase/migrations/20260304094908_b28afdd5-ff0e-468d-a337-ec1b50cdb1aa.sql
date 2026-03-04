-- Fix owner/admin permission provisioning on organization member creation
-- 1) Always sync permission rows on member insert (even if row already exists)
-- 2) Add backward-compatible mapping for legacy role-default keys
-- 3) Enforce full management permissions for owners
-- 4) Backfill existing owners currently missing admin-level permissions

CREATE OR REPLACE FUNCTION public.create_permissions_on_member_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  default_perms jsonb;
  target_permission_id uuid;
BEGIN
  -- Get role defaults
  default_perms := public.get_default_permissions_for_role(NEW.role::text);

  -- Ensure permission row exists; if it already exists, keep it and resync values
  INSERT INTO public.user_permissions (organization_id, user_id)
  VALUES (NEW.organization_id, NEW.user_id)
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET updated_at = now()
  RETURNING id INTO target_permission_id;

  -- Dashboard + Leads
  UPDATE public.user_permissions
  SET
    dashboard_funnel_view = COALESCE((default_perms->>'dashboard_funnel_view')::boolean, (default_perms->>'dashboard_view')::boolean, false),
    dashboard_kanban_view = COALESCE((default_perms->>'dashboard_kanban_view')::boolean, (default_perms->>'dashboard_view')::boolean, false),
    seller_panel_view = COALESCE((default_perms->>'seller_panel_view')::boolean, (default_perms->>'dashboard_view')::boolean, false),
    sales_dashboard_view = COALESCE((default_perms->>'sales_dashboard_view')::boolean, (default_perms->>'dashboard_view')::boolean, false),
    leads_view = COALESCE((default_perms->>'leads_view')::boolean, true),
    leads_create = COALESCE((default_perms->>'leads_create')::boolean, true),
    leads_edit = COALESCE((default_perms->>'leads_edit')::boolean, true),
    leads_delete = COALESCE((default_perms->>'leads_delete')::boolean, false),
    leads_view_only_own = COALESCE((default_perms->>'leads_view_only_own')::boolean, false),
    leads_hide_new_button = COALESCE((default_perms->>'leads_hide_new_button')::boolean, false)
  WHERE id = target_permission_id;

  -- Sales
  UPDATE public.user_permissions
  SET
    sales_view = COALESCE((default_perms->>'sales_view')::boolean, true),
    sales_view_all = COALESCE(
      (default_perms->>'sales_view_all')::boolean,
      CASE
        WHEN default_perms ? 'sales_view_only_own' THEN NOT COALESCE((default_perms->>'sales_view_only_own')::boolean, false)
        ELSE NULL
      END,
      false
    ),
    sales_create = COALESCE((default_perms->>'sales_create')::boolean, true),
    sales_edit_draft = COALESCE((default_perms->>'sales_edit_draft')::boolean, (default_perms->>'sales_edit')::boolean, false),
    sales_confirm_payment = COALESCE((default_perms->>'sales_confirm_payment')::boolean, false),
    sales_validate_expedition = COALESCE((default_perms->>'sales_validate_expedition')::boolean, false),
    sales_dispatch = COALESCE((default_perms->>'sales_dispatch')::boolean, false),
    sales_mark_delivered = COALESCE((default_perms->>'sales_mark_delivered')::boolean, false),
    sales_mark_printed = COALESCE((default_perms->>'sales_mark_printed')::boolean, false),
    sales_cancel = COALESCE((default_perms->>'sales_cancel')::boolean, false),
    sales_hide_new_button = COALESCE((default_perms->>'sales_hide_new_button')::boolean, false)
  WHERE id = target_permission_id;

  -- WhatsApp + AI + Demands
  UPDATE public.user_permissions
  SET
    whatsapp_view = COALESCE((default_perms->>'whatsapp_view')::boolean, true),
    whatsapp_send = COALESCE((default_perms->>'whatsapp_send')::boolean, true),
    whatsapp_v2_view = COALESCE((default_perms->>'whatsapp_v2_view')::boolean, false),
    whatsapp_manage_view = COALESCE((default_perms->>'whatsapp_manage_view')::boolean, (default_perms->>'whatsapp_manage')::boolean, false),
    whatsapp_ai_settings_view = COALESCE((default_perms->>'whatsapp_ai_settings_view')::boolean, false),
    ai_bots_view = COALESCE((default_perms->>'ai_bots_view')::boolean, false),
    demands_view = COALESCE((default_perms->>'demands_view')::boolean, false)
  WHERE id = target_permission_id;

  -- Products + Settings
  UPDATE public.user_permissions
  SET
    products_view = COALESCE((default_perms->>'products_view')::boolean, true),
    products_manage = COALESCE((default_perms->>'products_manage')::boolean, (default_perms->>'products_edit')::boolean, (default_perms->>'products_create')::boolean, false),
    products_view_cost = COALESCE((default_perms->>'products_view_cost')::boolean, false),
    settings_view = COALESCE((default_perms->>'settings_view')::boolean, false),
    settings_manage = COALESCE((default_perms->>'settings_manage')::boolean, (default_perms->>'settings_edit')::boolean, false),
    settings_funnel_stages = COALESCE((default_perms->>'settings_funnel_stages')::boolean, false),
    settings_delivery_regions = COALESCE((default_perms->>'settings_delivery_regions')::boolean, false),
    settings_carriers = COALESCE((default_perms->>'settings_carriers')::boolean, false),
    settings_payment_methods = COALESCE((default_perms->>'settings_payment_methods')::boolean, false),
    settings_non_purchase_reasons = COALESCE((default_perms->>'settings_non_purchase_reasons')::boolean, false),
    settings_standard_questions = COALESCE((default_perms->>'settings_standard_questions')::boolean, false),
    settings_teams = COALESCE((default_perms->>'settings_teams')::boolean, false),
    settings_lead_sources = COALESCE((default_perms->>'settings_lead_sources')::boolean, false)
  WHERE id = target_permission_id;

  -- Reports + Deliveries + Expedition
  UPDATE public.user_permissions
  SET
    reports_view = COALESCE((default_perms->>'reports_view')::boolean, false),
    sales_report_view = COALESCE((default_perms->>'sales_report_view')::boolean, false),
    expedition_report_view = COALESCE((default_perms->>'expedition_report_view')::boolean, false),
    deliveries_view_own = COALESCE((default_perms->>'deliveries_view_own')::boolean, false),
    deliveries_view_all = COALESCE((default_perms->>'deliveries_view_all')::boolean, false),
    expedition_view = COALESCE((default_perms->>'expedition_view')::boolean, false),
    receptive_module_access = COALESCE((default_perms->>'receptive_module_access')::boolean, false)
  WHERE id = target_permission_id;

  -- Team + Instagram + Integrations
  UPDATE public.user_permissions
  SET
    team_view = COALESCE((default_perms->>'team_view')::boolean, false),
    team_add_member = COALESCE((default_perms->>'team_add_member')::boolean, (default_perms->>'team_create')::boolean, false),
    team_edit_member = COALESCE((default_perms->>'team_edit_member')::boolean, (default_perms->>'team_edit')::boolean, false),
    team_delete_member = COALESCE((default_perms->>'team_delete_member')::boolean, (default_perms->>'team_delete')::boolean, false),
    team_change_permissions = COALESCE((default_perms->>'team_change_permissions')::boolean, (default_perms->>'team_edit')::boolean, false),
    team_change_role = COALESCE((default_perms->>'team_change_role')::boolean, (default_perms->>'team_edit')::boolean, false),
    team_change_commission = COALESCE((default_perms->>'team_change_commission')::boolean, (default_perms->>'commissions_edit')::boolean, false),
    team_toggle_manager = COALESCE((default_perms->>'team_toggle_manager')::boolean, false),
    instagram_view = COALESCE((default_perms->>'instagram_view')::boolean, false),
    integrations_view = COALESCE((default_perms->>'integrations_view')::boolean, false)
  WHERE id = target_permission_id;

  -- Post-sale + SAC + Scheduled + Helper
  UPDATE public.user_permissions
  SET
    post_sale_view = COALESCE((default_perms->>'post_sale_view')::boolean, false),
    post_sale_manage = COALESCE((default_perms->>'post_sale_manage')::boolean, (default_perms->>'post_sale_edit')::boolean, false),
    sac_view = COALESCE((default_perms->>'sac_view')::boolean, false),
    sac_manage = COALESCE((default_perms->>'sac_manage')::boolean, (default_perms->>'sac_edit')::boolean, false),
    scheduled_messages_view = COALESCE((default_perms->>'scheduled_messages_view')::boolean, false),
    scheduled_messages_manage = COALESCE((default_perms->>'scheduled_messages_manage')::boolean, false),
    helper_donna_view = COALESCE((default_perms->>'helper_donna_view')::boolean, true)
  WHERE id = target_permission_id;

  -- Owner must always be full admin within org user-permissions scope
  IF NEW.role = 'owner' THEN
    UPDATE public.user_permissions
    SET
      dashboard_funnel_view = true,
      dashboard_kanban_view = true,
      seller_panel_view = true,
      sales_dashboard_view = true,
      leads_view = true,
      leads_view_only_own = false,
      leads_create = true,
      leads_edit = true,
      leads_delete = true,
      leads_hide_new_button = false,
      sales_view = true,
      sales_view_all = true,
      sales_create = true,
      sales_edit_draft = true,
      sales_confirm_payment = true,
      sales_validate_expedition = true,
      sales_dispatch = true,
      sales_mark_delivered = true,
      sales_mark_printed = true,
      sales_cancel = true,
      sales_hide_new_button = false,
      whatsapp_view = true,
      whatsapp_send = true,
      whatsapp_v2_view = true,
      whatsapp_manage_view = true,
      whatsapp_ai_settings_view = true,
      ai_bots_view = true,
      demands_view = true,
      products_view = true,
      products_manage = true,
      products_view_cost = true,
      settings_view = true,
      settings_manage = true,
      settings_funnel_stages = true,
      settings_delivery_regions = true,
      settings_carriers = true,
      settings_payment_methods = true,
      settings_non_purchase_reasons = true,
      settings_standard_questions = true,
      settings_teams = true,
      settings_lead_sources = true,
      reports_view = true,
      sales_report_view = true,
      expedition_report_view = true,
      deliveries_view_own = true,
      deliveries_view_all = true,
      expedition_view = true,
      receptive_module_access = true,
      team_view = true,
      team_add_member = true,
      team_edit_member = true,
      team_delete_member = true,
      team_change_permissions = true,
      team_change_role = true,
      team_change_commission = true,
      team_toggle_manager = true,
      instagram_view = true,
      integrations_view = true,
      post_sale_view = true,
      post_sale_manage = true,
      sac_view = true,
      sac_manage = true,
      scheduled_messages_view = true,
      scheduled_messages_manage = true,
      helper_donna_view = true,
      updated_at = now()
    WHERE id = target_permission_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill existing owners so they immediately recover full admin permissions
UPDATE public.user_permissions up
SET
  dashboard_funnel_view = true,
  dashboard_kanban_view = true,
  seller_panel_view = true,
  sales_dashboard_view = true,
  leads_view = true,
  leads_view_only_own = false,
  leads_create = true,
  leads_edit = true,
  leads_delete = true,
  leads_hide_new_button = false,
  sales_view = true,
  sales_view_all = true,
  sales_create = true,
  sales_edit_draft = true,
  sales_confirm_payment = true,
  sales_validate_expedition = true,
  sales_dispatch = true,
  sales_mark_delivered = true,
  sales_mark_printed = true,
  sales_cancel = true,
  sales_hide_new_button = false,
  whatsapp_view = true,
  whatsapp_send = true,
  whatsapp_v2_view = true,
  whatsapp_manage_view = true,
  whatsapp_ai_settings_view = true,
  ai_bots_view = true,
  demands_view = true,
  products_view = true,
  products_manage = true,
  products_view_cost = true,
  settings_view = true,
  settings_manage = true,
  settings_funnel_stages = true,
  settings_delivery_regions = true,
  settings_carriers = true,
  settings_payment_methods = true,
  settings_non_purchase_reasons = true,
  settings_standard_questions = true,
  settings_teams = true,
  settings_lead_sources = true,
  reports_view = true,
  sales_report_view = true,
  expedition_report_view = true,
  deliveries_view_own = true,
  deliveries_view_all = true,
  expedition_view = true,
  receptive_module_access = true,
  team_view = true,
  team_add_member = true,
  team_edit_member = true,
  team_delete_member = true,
  team_change_permissions = true,
  team_change_role = true,
  team_change_commission = true,
  team_toggle_manager = true,
  instagram_view = true,
  integrations_view = true,
  post_sale_view = true,
  post_sale_manage = true,
  sac_view = true,
  sac_manage = true,
  scheduled_messages_view = true,
  scheduled_messages_manage = true,
  helper_donna_view = true,
  updated_at = now()
FROM public.organization_members om
WHERE om.organization_id = up.organization_id
  AND om.user_id = up.user_id
  AND om.role = 'owner';