-- First ensure the new columns exist with proper defaults
DO $$ 
BEGIN
  -- Add whatsapp_manage_view if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'whatsapp_manage_view') THEN
    ALTER TABLE public.user_permissions ADD COLUMN whatsapp_manage_view boolean DEFAULT true NOT NULL;
  END IF;
  
  -- Add ai_bots_view if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'ai_bots_view') THEN
    ALTER TABLE public.user_permissions ADD COLUMN ai_bots_view boolean DEFAULT true NOT NULL;
  END IF;
  
  -- Add demands_view if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'demands_view') THEN
    ALTER TABLE public.user_permissions ADD COLUMN demands_view boolean DEFAULT true NOT NULL;
  END IF;
END $$;

-- Drop and recreate the create_permissions_on_member_insert function with ALL columns
CREATE OR REPLACE FUNCTION public.create_permissions_on_member_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_perms jsonb;
BEGIN
  default_perms := get_default_permissions_for_role(NEW.role::text);
  
  INSERT INTO public.user_permissions (
    organization_id, user_id,
    -- Leads
    leads_view, leads_create, leads_edit, leads_delete, leads_view_only_own, leads_hide_new_button,
    -- Sales
    sales_view, sales_view_all, sales_create, sales_edit_draft, sales_confirm_payment, 
    sales_validate_expedition, sales_dispatch, sales_mark_delivered, sales_cancel,
    -- WhatsApp
    whatsapp_view, whatsapp_send, whatsapp_v2_view, whatsapp_manage_view,
    -- AI Bots
    ai_bots_view,
    -- Demands
    demands_view,
    -- Products
    products_view, products_manage, products_view_cost,
    -- Settings
    settings_view, settings_manage, settings_funnel_stages, settings_delivery_regions,
    settings_carriers, settings_payment_methods, settings_non_purchase_reasons,
    settings_standard_questions, settings_teams, settings_lead_sources,
    -- Reports
    reports_view, sales_report_view, expedition_report_view,
    -- Deliveries
    deliveries_view_own, deliveries_view_all,
    -- Post Sale
    post_sale_view, post_sale_manage,
    -- SAC
    sac_view, sac_manage,
    -- Modules
    receptive_module_access, team_view, instagram_view,
    -- Scheduled Messages
    scheduled_messages_view, scheduled_messages_manage
  ) VALUES (
    NEW.organization_id, NEW.user_id,
    -- Leads
    COALESCE((default_perms->>'leads_view')::boolean, true),
    COALESCE((default_perms->>'leads_create')::boolean, true),
    COALESCE((default_perms->>'leads_edit')::boolean, true),
    COALESCE((default_perms->>'leads_delete')::boolean, false),
    COALESCE((default_perms->>'leads_view_only_own')::boolean, false),
    COALESCE((default_perms->>'leads_hide_new_button')::boolean, false),
    -- Sales
    COALESCE((default_perms->>'sales_view')::boolean, true),
    COALESCE((default_perms->>'sales_view_all')::boolean, false),
    COALESCE((default_perms->>'sales_create')::boolean, true),
    COALESCE((default_perms->>'sales_edit_draft')::boolean, true),
    COALESCE((default_perms->>'sales_confirm_payment')::boolean, false),
    COALESCE((default_perms->>'sales_validate_expedition')::boolean, false),
    COALESCE((default_perms->>'sales_dispatch')::boolean, false),
    COALESCE((default_perms->>'sales_mark_delivered')::boolean, false),
    COALESCE((default_perms->>'sales_cancel')::boolean, false),
    -- WhatsApp
    COALESCE((default_perms->>'whatsapp_view')::boolean, true),
    COALESCE((default_perms->>'whatsapp_send')::boolean, true),
    COALESCE((default_perms->>'whatsapp_v2_view')::boolean, false),
    COALESCE((default_perms->>'whatsapp_manage_view')::boolean, false),
    -- AI Bots
    COALESCE((default_perms->>'ai_bots_view')::boolean, false),
    -- Demands
    COALESCE((default_perms->>'demands_view')::boolean, false),
    -- Products
    COALESCE((default_perms->>'products_view')::boolean, true),
    COALESCE((default_perms->>'products_manage')::boolean, false),
    COALESCE((default_perms->>'products_view_cost')::boolean, false),
    -- Settings
    COALESCE((default_perms->>'settings_view')::boolean, false),
    COALESCE((default_perms->>'settings_manage')::boolean, false),
    COALESCE((default_perms->>'settings_funnel_stages')::boolean, false),
    COALESCE((default_perms->>'settings_delivery_regions')::boolean, false),
    COALESCE((default_perms->>'settings_carriers')::boolean, false),
    COALESCE((default_perms->>'settings_payment_methods')::boolean, false),
    COALESCE((default_perms->>'settings_non_purchase_reasons')::boolean, false),
    COALESCE((default_perms->>'settings_standard_questions')::boolean, false),
    COALESCE((default_perms->>'settings_teams')::boolean, false),
    COALESCE((default_perms->>'settings_lead_sources')::boolean, false),
    -- Reports
    COALESCE((default_perms->>'reports_view')::boolean, false),
    COALESCE((default_perms->>'sales_report_view')::boolean, false),
    COALESCE((default_perms->>'expedition_report_view')::boolean, false),
    -- Deliveries
    COALESCE((default_perms->>'deliveries_view_own')::boolean, false),
    COALESCE((default_perms->>'deliveries_view_all')::boolean, false),
    -- Post Sale
    COALESCE((default_perms->>'post_sale_view')::boolean, false),
    COALESCE((default_perms->>'post_sale_manage')::boolean, false),
    -- SAC
    COALESCE((default_perms->>'sac_view')::boolean, false),
    COALESCE((default_perms->>'sac_manage')::boolean, false),
    -- Modules
    COALESCE((default_perms->>'receptive_module_access')::boolean, false),
    COALESCE((default_perms->>'team_view')::boolean, false),
    COALESCE((default_perms->>'instagram_view')::boolean, false),
    -- Scheduled Messages
    COALESCE((default_perms->>'scheduled_messages_view')::boolean, false),
    COALESCE((default_perms->>'scheduled_messages_manage')::boolean, false)
  )
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Drop old trigger and create new one
DROP TRIGGER IF EXISTS on_org_member_create_permissions ON public.organization_members;

CREATE TRIGGER on_org_member_create_permissions
  BEFORE INSERT ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.create_permissions_on_member_insert();