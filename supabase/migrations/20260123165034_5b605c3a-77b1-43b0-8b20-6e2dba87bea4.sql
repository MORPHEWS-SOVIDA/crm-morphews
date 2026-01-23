-- 1. Dropar triggers duplicados que causam conflito
DROP TRIGGER IF EXISTS tr_create_owner_admin_permissions ON public.organization_members;
DROP TRIGGER IF EXISTS tr_update_owner_admin_permissions ON public.organization_members;

-- 2. Dropar as funções antigas que não são mais necessárias
DROP FUNCTION IF EXISTS public.create_owner_admin_permissions() CASCADE;
DROP FUNCTION IF EXISTS public.update_owner_admin_permissions() CASCADE;

-- 3. Recriar a função principal corrigida para lidar com todos os casos
CREATE OR REPLACE FUNCTION public.create_permissions_on_member_insert()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  default_perms jsonb;
  new_permission_id uuid;
  existing_perm_id uuid;
BEGIN
  -- Verificar se já existe uma permissão para este usuário nesta org
  SELECT id INTO existing_perm_id
  FROM public.user_permissions
  WHERE organization_id = NEW.organization_id AND user_id = NEW.user_id;
  
  IF existing_perm_id IS NOT NULL THEN
    -- Já existe, não fazer nada (evita conflito)
    RETURN NEW;
  END IF;

  -- Obter permissões padrão para o role
  default_perms := get_default_permissions_for_role(NEW.role::text);
  
  -- Inserir primeiro os campos obrigatórios
  INSERT INTO public.user_permissions (organization_id, user_id)
  VALUES (NEW.organization_id, NEW.user_id)
  RETURNING id INTO new_permission_id;
  
  -- Bloco 1: Dashboard + Leads
  UPDATE public.user_permissions SET
    dashboard_funnel_view = COALESCE((default_perms->>'dashboard_funnel_view')::boolean, false),
    dashboard_kanban_view = COALESCE((default_perms->>'dashboard_kanban_view')::boolean, false),
    seller_panel_view = COALESCE((default_perms->>'seller_panel_view')::boolean, false),
    sales_dashboard_view = COALESCE((default_perms->>'sales_dashboard_view')::boolean, false),
    leads_view = COALESCE((default_perms->>'leads_view')::boolean, true),
    leads_create = COALESCE((default_perms->>'leads_create')::boolean, true),
    leads_edit = COALESCE((default_perms->>'leads_edit')::boolean, true),
    leads_delete = COALESCE((default_perms->>'leads_delete')::boolean, false),
    leads_view_only_own = COALESCE((default_perms->>'leads_view_only_own')::boolean, false),
    leads_hide_new_button = COALESCE((default_perms->>'leads_hide_new_button')::boolean, false)
  WHERE id = new_permission_id;
  
  -- Bloco 2: Sales
  UPDATE public.user_permissions SET
    sales_view = COALESCE((default_perms->>'sales_view')::boolean, true),
    sales_view_all = COALESCE((default_perms->>'sales_view_all')::boolean, false),
    sales_create = COALESCE((default_perms->>'sales_create')::boolean, true),
    sales_edit_draft = COALESCE((default_perms->>'sales_edit_draft')::boolean, true),
    sales_confirm_payment = COALESCE((default_perms->>'sales_confirm_payment')::boolean, false),
    sales_validate_expedition = COALESCE((default_perms->>'sales_validate_expedition')::boolean, false),
    sales_dispatch = COALESCE((default_perms->>'sales_dispatch')::boolean, false),
    sales_mark_delivered = COALESCE((default_perms->>'sales_mark_delivered')::boolean, false),
    sales_mark_printed = COALESCE((default_perms->>'sales_mark_printed')::boolean, false),
    sales_cancel = COALESCE((default_perms->>'sales_cancel')::boolean, false),
    sales_hide_new_button = COALESCE((default_perms->>'sales_hide_new_button')::boolean, false)
  WHERE id = new_permission_id;
  
  -- Bloco 3: WhatsApp + AI + Demands
  UPDATE public.user_permissions SET
    whatsapp_view = COALESCE((default_perms->>'whatsapp_view')::boolean, true),
    whatsapp_send = COALESCE((default_perms->>'whatsapp_send')::boolean, true),
    whatsapp_v2_view = COALESCE((default_perms->>'whatsapp_v2_view')::boolean, false),
    whatsapp_manage_view = COALESCE((default_perms->>'whatsapp_manage_view')::boolean, false),
    whatsapp_ai_settings_view = COALESCE((default_perms->>'whatsapp_ai_settings_view')::boolean, false),
    ai_bots_view = COALESCE((default_perms->>'ai_bots_view')::boolean, false),
    demands_view = COALESCE((default_perms->>'demands_view')::boolean, false)
  WHERE id = new_permission_id;
  
  -- Bloco 4: Products + Settings
  UPDATE public.user_permissions SET
    products_view = COALESCE((default_perms->>'products_view')::boolean, true),
    products_manage = COALESCE((default_perms->>'products_manage')::boolean, false),
    products_view_cost = COALESCE((default_perms->>'products_view_cost')::boolean, false),
    settings_view = COALESCE((default_perms->>'settings_view')::boolean, false),
    settings_manage = COALESCE((default_perms->>'settings_manage')::boolean, false),
    settings_funnel_stages = COALESCE((default_perms->>'settings_funnel_stages')::boolean, false),
    settings_delivery_regions = COALESCE((default_perms->>'settings_delivery_regions')::boolean, false),
    settings_carriers = COALESCE((default_perms->>'settings_carriers')::boolean, false),
    settings_payment_methods = COALESCE((default_perms->>'settings_payment_methods')::boolean, false),
    settings_non_purchase_reasons = COALESCE((default_perms->>'settings_non_purchase_reasons')::boolean, false),
    settings_standard_questions = COALESCE((default_perms->>'settings_standard_questions')::boolean, false),
    settings_teams = COALESCE((default_perms->>'settings_teams')::boolean, false),
    settings_lead_sources = COALESCE((default_perms->>'settings_lead_sources')::boolean, false)
  WHERE id = new_permission_id;
  
  -- Bloco 5: Reports + Deliveries + Expedition
  UPDATE public.user_permissions SET
    reports_view = COALESCE((default_perms->>'reports_view')::boolean, false),
    sales_report_view = COALESCE((default_perms->>'sales_report_view')::boolean, false),
    expedition_report_view = COALESCE((default_perms->>'expedition_report_view')::boolean, false),
    deliveries_view_own = COALESCE((default_perms->>'deliveries_view_own')::boolean, false),
    deliveries_view_all = COALESCE((default_perms->>'deliveries_view_all')::boolean, false),
    expedition_view = COALESCE((default_perms->>'expedition_view')::boolean, false),
    receptive_module_access = COALESCE((default_perms->>'receptive_module_access')::boolean, false)
  WHERE id = new_permission_id;
  
  -- Bloco 6: Team + Instagram + Integrations
  UPDATE public.user_permissions SET
    team_view = COALESCE((default_perms->>'team_view')::boolean, false),
    team_add_member = COALESCE((default_perms->>'team_add_member')::boolean, false),
    team_edit_member = COALESCE((default_perms->>'team_edit_member')::boolean, false),
    team_delete_member = COALESCE((default_perms->>'team_delete_member')::boolean, false),
    team_change_permissions = COALESCE((default_perms->>'team_change_permissions')::boolean, false),
    team_change_role = COALESCE((default_perms->>'team_change_role')::boolean, false),
    team_change_commission = COALESCE((default_perms->>'team_change_commission')::boolean, false),
    team_toggle_manager = COALESCE((default_perms->>'team_toggle_manager')::boolean, false),
    instagram_view = COALESCE((default_perms->>'instagram_view')::boolean, false),
    integrations_view = COALESCE((default_perms->>'integrations_view')::boolean, false)
  WHERE id = new_permission_id;
  
  -- Bloco 7: Post Sale + SAC + Scheduled + Helper
  UPDATE public.user_permissions SET
    post_sale_view = COALESCE((default_perms->>'post_sale_view')::boolean, false),
    post_sale_manage = COALESCE((default_perms->>'post_sale_manage')::boolean, false),
    sac_view = COALESCE((default_perms->>'sac_view')::boolean, false),
    sac_manage = COALESCE((default_perms->>'sac_manage')::boolean, false),
    scheduled_messages_view = COALESCE((default_perms->>'scheduled_messages_view')::boolean, false),
    scheduled_messages_manage = COALESCE((default_perms->>'scheduled_messages_manage')::boolean, false),
    helper_donna_view = COALESCE((default_perms->>'helper_donna_view')::boolean, true)
  WHERE id = new_permission_id;
  
  RETURN NEW;
END;
$$;