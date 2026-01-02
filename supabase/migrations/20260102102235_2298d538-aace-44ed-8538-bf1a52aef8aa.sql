-- Add products_view_cost permission column
ALTER TABLE public.user_permissions 
ADD COLUMN products_view_cost BOOLEAN NOT NULL DEFAULT false;

-- Update existing owner/admin permissions to have cost visibility by default
UPDATE public.user_permissions up
SET products_view_cost = true
FROM public.organization_members om
WHERE up.user_id = om.user_id 
  AND up.organization_id = om.organization_id
  AND om.role IN ('owner', 'admin', 'manager', 'finance');

-- Update the get_default_permissions_for_role function to include new permission
CREATE OR REPLACE FUNCTION public.get_default_permissions_for_role(_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  CASE _role
    WHEN 'owner' THEN
      RETURN jsonb_build_object(
        'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', true,
        'sales_view', true, 'sales_create', true, 'sales_edit_draft', true, 'sales_confirm_payment', true,
        'sales_validate_expedition', true, 'sales_dispatch', true, 'sales_mark_delivered', true, 'sales_cancel', true,
        'whatsapp_view', true, 'whatsapp_send', true,
        'products_view', true, 'products_manage', true, 'products_view_cost', true,
        'settings_view', true, 'settings_manage', true,
        'reports_view', true,
        'deliveries_view_own', true, 'deliveries_view_all', true,
        'receptive_module_access', true,
        'team_view', true, 'instagram_view', true
      );
    WHEN 'admin' THEN
      RETURN jsonb_build_object(
        'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', true,
        'sales_view', true, 'sales_create', true, 'sales_edit_draft', true, 'sales_confirm_payment', true,
        'sales_validate_expedition', true, 'sales_dispatch', true, 'sales_mark_delivered', true, 'sales_cancel', true,
        'whatsapp_view', true, 'whatsapp_send', true,
        'products_view', true, 'products_manage', true, 'products_view_cost', true,
        'settings_view', true, 'settings_manage', true,
        'reports_view', true,
        'deliveries_view_own', true, 'deliveries_view_all', true,
        'receptive_module_access', true,
        'team_view', true, 'instagram_view', true
      );
    WHEN 'manager' THEN
      RETURN jsonb_build_object(
        'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', false,
        'sales_view', true, 'sales_create', true, 'sales_edit_draft', true, 'sales_confirm_payment', false,
        'sales_validate_expedition', true, 'sales_dispatch', true, 'sales_mark_delivered', true, 'sales_cancel', false,
        'whatsapp_view', true, 'whatsapp_send', true,
        'products_view', true, 'products_manage', false, 'products_view_cost', true,
        'settings_view', true, 'settings_manage', false,
        'reports_view', true,
        'deliveries_view_own', true, 'deliveries_view_all', true,
        'receptive_module_access', true,
        'team_view', true, 'instagram_view', true
      );
    WHEN 'seller' THEN
      RETURN jsonb_build_object(
        'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', false,
        'sales_view', true, 'sales_create', true, 'sales_edit_draft', true, 'sales_confirm_payment', false,
        'sales_validate_expedition', false, 'sales_dispatch', false, 'sales_mark_delivered', false, 'sales_cancel', false,
        'whatsapp_view', true, 'whatsapp_send', true,
        'products_view', true, 'products_manage', false, 'products_view_cost', false,
        'settings_view', false, 'settings_manage', false,
        'reports_view', false,
        'deliveries_view_own', false, 'deliveries_view_all', false,
        'receptive_module_access', true,
        'team_view', false, 'instagram_view', false
      );
    WHEN 'shipping' THEN
      RETURN jsonb_build_object(
        'leads_view', false, 'leads_create', false, 'leads_edit', false, 'leads_delete', false,
        'sales_view', true, 'sales_create', false, 'sales_edit_draft', false, 'sales_confirm_payment', false,
        'sales_validate_expedition', true, 'sales_dispatch', true, 'sales_mark_delivered', false, 'sales_cancel', false,
        'whatsapp_view', false, 'whatsapp_send', false,
        'products_view', true, 'products_manage', false, 'products_view_cost', false,
        'settings_view', false, 'settings_manage', false,
        'reports_view', false,
        'deliveries_view_own', false, 'deliveries_view_all', true,
        'receptive_module_access', false,
        'team_view', false, 'instagram_view', false
      );
    WHEN 'finance' THEN
      RETURN jsonb_build_object(
        'leads_view', false, 'leads_create', false, 'leads_edit', false, 'leads_delete', false,
        'sales_view', true, 'sales_create', false, 'sales_edit_draft', false, 'sales_confirm_payment', true,
        'sales_validate_expedition', false, 'sales_dispatch', false, 'sales_mark_delivered', false, 'sales_cancel', false,
        'whatsapp_view', false, 'whatsapp_send', false,
        'products_view', false, 'products_manage', false, 'products_view_cost', true,
        'settings_view', false, 'settings_manage', false,
        'reports_view', true,
        'deliveries_view_own', false, 'deliveries_view_all', false,
        'receptive_module_access', false,
        'team_view', false, 'instagram_view', false
      );
    WHEN 'entregador' THEN
      RETURN jsonb_build_object(
        'leads_view', false, 'leads_create', false, 'leads_edit', false, 'leads_delete', false,
        'sales_view', false, 'sales_create', false, 'sales_edit_draft', false, 'sales_confirm_payment', false,
        'sales_validate_expedition', false, 'sales_dispatch', false, 'sales_mark_delivered', true, 'sales_cancel', false,
        'whatsapp_view', false, 'whatsapp_send', false,
        'products_view', false, 'products_manage', false, 'products_view_cost', false,
        'settings_view', false, 'settings_manage', false,
        'reports_view', false,
        'deliveries_view_own', true, 'deliveries_view_all', false,
        'receptive_module_access', false,
        'team_view', false, 'instagram_view', false
      );
    ELSE -- member
      RETURN jsonb_build_object(
        'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', false,
        'sales_view', true, 'sales_create', false, 'sales_edit_draft', false, 'sales_confirm_payment', false,
        'sales_validate_expedition', false, 'sales_dispatch', false, 'sales_mark_delivered', false, 'sales_cancel', false,
        'whatsapp_view', true, 'whatsapp_send', false,
        'products_view', true, 'products_manage', false, 'products_view_cost', false,
        'settings_view', false, 'settings_manage', false,
        'reports_view', false,
        'deliveries_view_own', false, 'deliveries_view_all', false,
        'receptive_module_access', false,
        'team_view', false, 'instagram_view', false
      );
  END CASE;
END;
$function$;

-- Update create_default_user_permissions to include products_view_cost
CREATE OR REPLACE FUNCTION public.create_default_user_permissions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  default_perms jsonb;
BEGIN
  default_perms := get_default_permissions_for_role(NEW.role::text);
  
  INSERT INTO public.user_permissions (
    organization_id, user_id,
    leads_view, leads_create, leads_edit, leads_delete,
    sales_view, sales_create, sales_edit_draft, sales_confirm_payment, 
    sales_validate_expedition, sales_dispatch, sales_mark_delivered, sales_cancel,
    whatsapp_view, whatsapp_send,
    products_view, products_manage, products_view_cost,
    settings_view, settings_manage,
    reports_view,
    deliveries_view_own, deliveries_view_all
  ) VALUES (
    NEW.organization_id, NEW.user_id,
    (default_perms->>'leads_view')::boolean, (default_perms->>'leads_create')::boolean, 
    (default_perms->>'leads_edit')::boolean, (default_perms->>'leads_delete')::boolean,
    (default_perms->>'sales_view')::boolean, (default_perms->>'sales_create')::boolean, 
    (default_perms->>'sales_edit_draft')::boolean, (default_perms->>'sales_confirm_payment')::boolean, 
    (default_perms->>'sales_validate_expedition')::boolean, (default_perms->>'sales_dispatch')::boolean, 
    (default_perms->>'sales_mark_delivered')::boolean, (default_perms->>'sales_cancel')::boolean,
    (default_perms->>'whatsapp_view')::boolean, (default_perms->>'whatsapp_send')::boolean,
    (default_perms->>'products_view')::boolean, (default_perms->>'products_manage')::boolean,
    (default_perms->>'products_view_cost')::boolean,
    (default_perms->>'settings_view')::boolean, (default_perms->>'settings_manage')::boolean,
    (default_perms->>'reports_view')::boolean,
    (default_perms->>'deliveries_view_own')::boolean, (default_perms->>'deliveries_view_all')::boolean
  )
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;