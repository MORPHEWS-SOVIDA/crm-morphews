
-- Function to create full permissions for org owners/admins
CREATE OR REPLACE FUNCTION public.create_owner_admin_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create permissions for owner or admin roles
  IF NEW.role IN ('owner', 'admin') THEN
    INSERT INTO public.user_permissions (
      organization_id,
      user_id,
      leads_view,
      leads_create,
      leads_edit,
      leads_delete,
      sales_view,
      sales_view_all,
      sales_create,
      sales_edit_draft,
      sales_confirm_payment,
      sales_validate_expedition,
      sales_dispatch,
      sales_mark_delivered,
      sales_cancel,
      whatsapp_view,
      whatsapp_send,
      products_view,
      products_manage,
      products_view_cost,
      settings_view,
      settings_manage,
      reports_view,
      deliveries_view_own,
      deliveries_view_all,
      receptive_module_access,
      team_view,
      instagram_view,
      post_sale_view,
      post_sale_manage,
      sac_view,
      sac_manage
    ) VALUES (
      NEW.organization_id,
      NEW.user_id,
      true, -- leads_view
      true, -- leads_create
      true, -- leads_edit
      true, -- leads_delete
      true, -- sales_view
      true, -- sales_view_all
      true, -- sales_create
      true, -- sales_edit_draft
      true, -- sales_confirm_payment
      true, -- sales_validate_expedition
      true, -- sales_dispatch
      true, -- sales_mark_delivered
      true, -- sales_cancel
      true, -- whatsapp_view
      true, -- whatsapp_send
      true, -- products_view
      true, -- products_manage
      true, -- products_view_cost
      true, -- settings_view
      true, -- settings_manage
      true, -- reports_view
      true, -- deliveries_view_own
      true, -- deliveries_view_all
      true, -- receptive_module_access
      true, -- team_view
      true, -- instagram_view
      true, -- post_sale_view
      true, -- post_sale_manage
      true, -- sac_view
      true  -- sac_manage
    )
    ON CONFLICT (organization_id, user_id) 
    DO UPDATE SET
      leads_view = true,
      leads_create = true,
      leads_edit = true,
      leads_delete = true,
      sales_view = true,
      sales_view_all = true,
      sales_create = true,
      sales_edit_draft = true,
      sales_confirm_payment = true,
      sales_validate_expedition = true,
      sales_dispatch = true,
      sales_mark_delivered = true,
      sales_cancel = true,
      whatsapp_view = true,
      whatsapp_send = true,
      products_view = true,
      products_manage = true,
      products_view_cost = true,
      settings_view = true,
      settings_manage = true,
      reports_view = true,
      deliveries_view_own = true,
      deliveries_view_all = true,
      receptive_module_access = true,
      team_view = true,
      instagram_view = true,
      post_sale_view = true,
      post_sale_manage = true,
      sac_view = true,
      sac_manage = true,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new organization members
DROP TRIGGER IF EXISTS tr_create_owner_admin_permissions ON public.organization_members;
CREATE TRIGGER tr_create_owner_admin_permissions
  AFTER INSERT ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.create_owner_admin_permissions();

-- Also handle when role is updated to owner/admin
CREATE OR REPLACE FUNCTION public.update_owner_admin_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If role changed to owner or admin, give full permissions
  IF NEW.role IN ('owner', 'admin') AND (OLD.role IS NULL OR OLD.role NOT IN ('owner', 'admin')) THEN
    INSERT INTO public.user_permissions (
      organization_id,
      user_id,
      leads_view, leads_create, leads_edit, leads_delete,
      sales_view, sales_view_all, sales_create, sales_edit_draft,
      sales_confirm_payment, sales_validate_expedition, sales_dispatch,
      sales_mark_delivered, sales_cancel,
      whatsapp_view, whatsapp_send,
      products_view, products_manage, products_view_cost,
      settings_view, settings_manage, reports_view,
      deliveries_view_own, deliveries_view_all,
      receptive_module_access, team_view, instagram_view,
      post_sale_view, post_sale_manage, sac_view, sac_manage
    ) VALUES (
      NEW.organization_id, NEW.user_id,
      true, true, true, true,
      true, true, true, true,
      true, true, true,
      true, true,
      true, true,
      true, true, true,
      true, true, true,
      true, true,
      true, true, true,
      true, true, true, true
    )
    ON CONFLICT (organization_id, user_id) 
    DO UPDATE SET
      leads_view = true, leads_create = true, leads_edit = true, leads_delete = true,
      sales_view = true, sales_view_all = true, sales_create = true, sales_edit_draft = true,
      sales_confirm_payment = true, sales_validate_expedition = true, sales_dispatch = true,
      sales_mark_delivered = true, sales_cancel = true,
      whatsapp_view = true, whatsapp_send = true,
      products_view = true, products_manage = true, products_view_cost = true,
      settings_view = true, settings_manage = true, reports_view = true,
      deliveries_view_own = true, deliveries_view_all = true,
      receptive_module_access = true, team_view = true, instagram_view = true,
      post_sale_view = true, post_sale_manage = true, sac_view = true, sac_manage = true,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_update_owner_admin_permissions ON public.organization_members;
CREATE TRIGGER tr_update_owner_admin_permissions
  AFTER UPDATE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_owner_admin_permissions();

-- Fix existing owner for SOVIDA (user thiago@sonatura.com.br)
UPDATE public.user_permissions
SET 
  team_view = true,
  instagram_view = true,
  receptive_module_access = true
WHERE user_id = '6fee8f43-5efb-4752-a2ce-a70c8e9e3cd2'
  AND organization_id = '650b1667-e345-498e-9d41-b963faf824a7';
