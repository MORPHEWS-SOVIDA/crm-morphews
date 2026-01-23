-- Dropar o trigger existente com CASCADE
DROP TRIGGER IF EXISTS on_org_member_create_permissions ON public.organization_members;
DROP TRIGGER IF EXISTS create_permissions_on_member_insert ON public.organization_members;
DROP FUNCTION IF EXISTS public.create_permissions_on_member_insert() CASCADE;

-- Recriar a função com abordagem em blocos para evitar limite de 100 argumentos
CREATE OR REPLACE FUNCTION public.create_permissions_on_member_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  default_perms jsonb;
  new_permission_id uuid;
BEGIN
  -- Obter permissões padrão para o role
  default_perms := get_default_permissions_for_role(NEW.role::text);
  
  -- Inserir primeiro os campos obrigatórios
  INSERT INTO public.user_permissions (organization_id, user_id)
  VALUES (NEW.organization_id, NEW.user_id)
  RETURNING id INTO new_permission_id;
  
  -- Atualizar com as permissões em blocos menores (evita limite de 100 args)
  -- Bloco 1: Leads
  UPDATE public.user_permissions SET
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
    sales_cancel = COALESCE((default_perms->>'sales_cancel')::boolean, false)
  WHERE id = new_permission_id;
  
  -- Bloco 3: WhatsApp + AI + Demands
  UPDATE public.user_permissions SET
    whatsapp_view = COALESCE((default_perms->>'whatsapp_view')::boolean, true),
    whatsapp_send = COALESCE((default_perms->>'whatsapp_send')::boolean, true),
    whatsapp_v2_view = COALESCE((default_perms->>'whatsapp_v2_view')::boolean, false),
    whatsapp_manage_view = COALESCE((default_perms->>'whatsapp_manage_view')::boolean, false),
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
  
  -- Bloco 5: Reports + Deliveries + Post Sale + SAC
  UPDATE public.user_permissions SET
    reports_view = COALESCE((default_perms->>'reports_view')::boolean, false),
    sales_report_view = COALESCE((default_perms->>'sales_report_view')::boolean, false),
    expedition_report_view = COALESCE((default_perms->>'expedition_report_view')::boolean, false),
    deliveries_view_own = COALESCE((default_perms->>'deliveries_view_own')::boolean, false),
    deliveries_view_all = COALESCE((default_perms->>'deliveries_view_all')::boolean, false),
    post_sale_view = COALESCE((default_perms->>'post_sale_view')::boolean, false),
    post_sale_manage = COALESCE((default_perms->>'post_sale_manage')::boolean, false),
    sac_view = COALESCE((default_perms->>'sac_view')::boolean, false),
    sac_manage = COALESCE((default_perms->>'sac_manage')::boolean, false)
  WHERE id = new_permission_id;
  
  -- Bloco 6: Modules + Scheduled Messages
  UPDATE public.user_permissions SET
    receptive_module_access = COALESCE((default_perms->>'receptive_module_access')::boolean, false),
    team_view = COALESCE((default_perms->>'team_view')::boolean, false),
    instagram_view = COALESCE((default_perms->>'instagram_view')::boolean, false),
    scheduled_messages_view = COALESCE((default_perms->>'scheduled_messages_view')::boolean, false),
    scheduled_messages_manage = COALESCE((default_perms->>'scheduled_messages_manage')::boolean, false)
  WHERE id = new_permission_id;
  
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Permissões já existem para este usuário/org
    RETURN NEW;
END;
$function$;

-- Recriar o trigger com nome consistente
CREATE TRIGGER on_org_member_create_permissions
  AFTER INSERT ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.create_permissions_on_member_insert();