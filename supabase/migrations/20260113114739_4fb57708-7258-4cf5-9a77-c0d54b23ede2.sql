-- Add "printed" permission to user_permissions
ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS sales_mark_printed BOOLEAN NOT NULL DEFAULT true;

-- Add printed_at and printed_by columns to sales table
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS printed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS printed_by UUID;

-- Update checkpoint type constraints for both tables
DO $$
BEGIN
  -- Drop and recreate constraint for sale_checkpoints
  ALTER TABLE public.sale_checkpoints 
  DROP CONSTRAINT IF EXISTS sale_checkpoints_checkpoint_type_check;
  
  ALTER TABLE public.sale_checkpoints 
  ADD CONSTRAINT sale_checkpoints_checkpoint_type_check 
  CHECK (checkpoint_type IN ('printed', 'pending_expedition', 'dispatched', 'delivered', 'payment_confirmed'));
  
  -- Drop and recreate constraint for sale_checkpoint_history
  ALTER TABLE public.sale_checkpoint_history 
  DROP CONSTRAINT IF EXISTS sale_checkpoint_history_checkpoint_type_check;
  
  ALTER TABLE public.sale_checkpoint_history 
  ADD CONSTRAINT sale_checkpoint_history_checkpoint_type_check 
  CHECK (checkpoint_type IN ('printed', 'pending_expedition', 'dispatched', 'delivered', 'payment_confirmed'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Constraints may already exist or have different names';
END $$;

-- Update the get_default_permissions_for_role function to include new permission
CREATE OR REPLACE FUNCTION public.get_default_permissions_for_role(p_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_perms JSONB;
  extra_perms JSONB;
BEGIN
  -- Base permissions for all roles
  base_perms := '{
    "leads_view": true,
    "leads_view_only_own": false,
    "leads_create": true,
    "leads_edit": true,
    "leads_delete": false,
    "leads_hide_new_button": false,
    "sales_view": true,
    "sales_view_all": false,
    "sales_create": false,
    "sales_edit_draft": false,
    "sales_confirm_payment": false,
    "sales_validate_expedition": false,
    "sales_dispatch": false,
    "sales_mark_delivered": false,
    "sales_mark_printed": false,
    "sales_cancel": false,
    "whatsapp_view": true,
    "whatsapp_send": false,
    "whatsapp_v2_view": false,
    "whatsapp_manage_view": false,
    "ai_bots_view": false,
    "demands_view": false,
    "products_view": true,
    "products_manage": false,
    "products_view_cost": false,
    "settings_view": false,
    "settings_manage": false,
    "settings_funnel_stages": false,
    "settings_delivery_regions": false,
    "settings_carriers": false,
    "settings_payment_methods": false,
    "settings_non_purchase_reasons": false,
    "settings_standard_questions": false,
    "settings_teams": false,
    "settings_lead_sources": false,
    "reports_view": false,
    "sales_report_view": false,
    "expedition_report_view": false,
    "deliveries_view_own": false,
    "deliveries_view_all": false,
    "receptive_module_access": false,
    "team_view": false,
    "team_add_member": false,
    "team_edit_member": false,
    "team_delete_member": false,
    "team_change_permissions": false,
    "team_change_role": false,
    "team_change_commission": false,
    "team_toggle_manager": false,
    "instagram_view": false,
    "post_sale_view": false,
    "post_sale_manage": false,
    "sac_view": false,
    "sac_manage": false,
    "scheduled_messages_view": false,
    "scheduled_messages_manage": false
  }'::jsonb;

  -- Role-specific overrides
  IF p_role IN ('owner', 'admin') THEN
    extra_perms := '{
      "leads_view": true,
      "leads_create": true,
      "leads_edit": true,
      "leads_delete": true,
      "sales_view": true,
      "sales_view_all": true,
      "sales_create": true,
      "sales_edit_draft": true,
      "sales_confirm_payment": true,
      "sales_validate_expedition": true,
      "sales_dispatch": true,
      "sales_mark_delivered": true,
      "sales_mark_printed": true,
      "sales_cancel": true,
      "whatsapp_view": true,
      "whatsapp_send": true,
      "whatsapp_v2_view": true,
      "whatsapp_manage_view": true,
      "ai_bots_view": true,
      "demands_view": true,
      "products_view": true,
      "products_manage": true,
      "products_view_cost": true,
      "settings_view": true,
      "settings_manage": true,
      "settings_funnel_stages": true,
      "settings_delivery_regions": true,
      "settings_carriers": true,
      "settings_payment_methods": true,
      "settings_non_purchase_reasons": true,
      "settings_standard_questions": true,
      "settings_teams": true,
      "settings_lead_sources": true,
      "reports_view": true,
      "sales_report_view": true,
      "expedition_report_view": true,
      "deliveries_view_own": true,
      "deliveries_view_all": true,
      "receptive_module_access": true,
      "team_view": true,
      "team_add_member": true,
      "team_edit_member": true,
      "team_delete_member": true,
      "team_change_permissions": true,
      "team_change_role": true,
      "team_change_commission": true,
      "team_toggle_manager": true,
      "instagram_view": true,
      "post_sale_view": true,
      "post_sale_manage": true,
      "sac_view": true,
      "sac_manage": true,
      "scheduled_messages_view": true,
      "scheduled_messages_manage": true
    }'::jsonb;
  ELSIF p_role = 'manager' THEN
    extra_perms := '{
      "leads_view": true,
      "leads_create": true,
      "leads_edit": true,
      "sales_view": true,
      "sales_view_all": true,
      "sales_create": true,
      "sales_edit_draft": true,
      "sales_validate_expedition": true,
      "sales_dispatch": true,
      "sales_mark_printed": true,
      "whatsapp_view": true,
      "whatsapp_send": true,
      "products_view": true,
      "settings_view": true,
      "reports_view": true,
      "deliveries_view_own": true,
      "deliveries_view_all": true,
      "receptive_module_access": true,
      "team_view": true,
      "post_sale_view": true,
      "sac_view": true,
      "scheduled_messages_view": true
    }'::jsonb;
  ELSIF p_role = 'expedition' THEN
    extra_perms := '{
      "sales_view": true,
      "sales_view_all": true,
      "sales_validate_expedition": true,
      "sales_dispatch": true,
      "sales_mark_printed": true,
      "deliveries_view_all": true,
      "expedition_report_view": true
    }'::jsonb;
  ELSIF p_role = 'motoboy' THEN
    extra_perms := '{
      "sales_view": true,
      "sales_mark_delivered": true,
      "deliveries_view_own": true
    }'::jsonb;
  ELSIF p_role = 'financial' THEN
    extra_perms := '{
      "sales_view": true,
      "sales_view_all": true,
      "sales_confirm_payment": true,
      "reports_view": true,
      "sales_report_view": true
    }'::jsonb;
  ELSIF p_role = 'seller' THEN
    extra_perms := '{
      "leads_view": true,
      "leads_create": true,
      "leads_edit": true,
      "sales_view": true,
      "sales_create": true,
      "sales_edit_draft": true,
      "whatsapp_view": true,
      "whatsapp_send": true,
      "receptive_module_access": true
    }'::jsonb;
  ELSE
    extra_perms := '{}'::jsonb;
  END IF;

  RETURN base_perms || extra_perms;
END;
$$;

-- Comment for documentation
COMMENT ON COLUMN public.user_permissions.sales_mark_printed IS 'Permission to mark sales as printed (Impresso stage)';