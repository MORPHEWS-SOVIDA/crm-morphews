-- Add 'delivery' role to org_role enum
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'delivery';

-- Create user-level permissions table for granular control
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Leads permissions
  leads_view BOOLEAN NOT NULL DEFAULT true,
  leads_create BOOLEAN NOT NULL DEFAULT true,
  leads_edit BOOLEAN NOT NULL DEFAULT true,
  leads_delete BOOLEAN NOT NULL DEFAULT false,
  
  -- Sales permissions
  sales_view BOOLEAN NOT NULL DEFAULT true,
  sales_create BOOLEAN NOT NULL DEFAULT true,
  sales_edit_draft BOOLEAN NOT NULL DEFAULT true,
  sales_confirm_payment BOOLEAN NOT NULL DEFAULT false,
  sales_validate_expedition BOOLEAN NOT NULL DEFAULT false,
  sales_dispatch BOOLEAN NOT NULL DEFAULT false,
  sales_mark_delivered BOOLEAN NOT NULL DEFAULT false,
  sales_cancel BOOLEAN NOT NULL DEFAULT false,
  
  -- WhatsApp permissions
  whatsapp_view BOOLEAN NOT NULL DEFAULT true,
  whatsapp_send BOOLEAN NOT NULL DEFAULT true,
  
  -- Products & Settings permissions
  products_view BOOLEAN NOT NULL DEFAULT true,
  products_manage BOOLEAN NOT NULL DEFAULT false,
  settings_view BOOLEAN NOT NULL DEFAULT false,
  settings_manage BOOLEAN NOT NULL DEFAULT false,
  
  -- Reports permissions
  reports_view BOOLEAN NOT NULL DEFAULT false,
  
  -- Delivery specific
  deliveries_view_own BOOLEAN NOT NULL DEFAULT false,
  deliveries_view_all BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(organization_id, user_id)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Policies for user_permissions
CREATE POLICY "Admins can manage user permissions" 
ON public.user_permissions 
FOR ALL 
USING (
  organization_id = get_user_organization_id() 
  AND is_org_admin(auth.uid(), organization_id)
)
WITH CHECK (
  organization_id = get_user_organization_id() 
  AND is_org_admin(auth.uid(), organization_id)
);

CREATE POLICY "Users can view their own permissions" 
ON public.user_permissions 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can view permissions in their org" 
ON public.user_permissions 
FOR SELECT 
USING (organization_id = get_user_organization_id());

-- Function to get default permissions by role
CREATE OR REPLACE FUNCTION public.get_default_permissions_for_role(_role text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN CASE _role
    WHEN 'owner' THEN jsonb_build_object(
      'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', true,
      'sales_view', true, 'sales_create', true, 'sales_edit_draft', true, 
      'sales_confirm_payment', true, 'sales_validate_expedition', true, 
      'sales_dispatch', true, 'sales_mark_delivered', true, 'sales_cancel', true,
      'whatsapp_view', true, 'whatsapp_send', true,
      'products_view', true, 'products_manage', true,
      'settings_view', true, 'settings_manage', true,
      'reports_view', true,
      'deliveries_view_own', true, 'deliveries_view_all', true
    )
    WHEN 'admin' THEN jsonb_build_object(
      'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', true,
      'sales_view', true, 'sales_create', true, 'sales_edit_draft', true, 
      'sales_confirm_payment', true, 'sales_validate_expedition', true, 
      'sales_dispatch', true, 'sales_mark_delivered', true, 'sales_cancel', true,
      'whatsapp_view', true, 'whatsapp_send', true,
      'products_view', true, 'products_manage', true,
      'settings_view', true, 'settings_manage', true,
      'reports_view', true,
      'deliveries_view_own', true, 'deliveries_view_all', true
    )
    WHEN 'manager' THEN jsonb_build_object(
      'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', false,
      'sales_view', true, 'sales_create', true, 'sales_edit_draft', true, 
      'sales_confirm_payment', false, 'sales_validate_expedition', true, 
      'sales_dispatch', true, 'sales_mark_delivered', true, 'sales_cancel', false,
      'whatsapp_view', true, 'whatsapp_send', true,
      'products_view', true, 'products_manage', true,
      'settings_view', true, 'settings_manage', false,
      'reports_view', true,
      'deliveries_view_own', true, 'deliveries_view_all', true
    )
    WHEN 'seller' THEN jsonb_build_object(
      'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', false,
      'sales_view', true, 'sales_create', true, 'sales_edit_draft', true, 
      'sales_confirm_payment', false, 'sales_validate_expedition', false, 
      'sales_dispatch', false, 'sales_mark_delivered', false, 'sales_cancel', false,
      'whatsapp_view', true, 'whatsapp_send', true,
      'products_view', true, 'products_manage', false,
      'settings_view', false, 'settings_manage', false,
      'reports_view', false,
      'deliveries_view_own', false, 'deliveries_view_all', false
    )
    WHEN 'shipping' THEN jsonb_build_object(
      'leads_view', true, 'leads_create', false, 'leads_edit', false, 'leads_delete', false,
      'sales_view', true, 'sales_create', false, 'sales_edit_draft', false, 
      'sales_confirm_payment', false, 'sales_validate_expedition', true, 
      'sales_dispatch', true, 'sales_mark_delivered', false, 'sales_cancel', false,
      'whatsapp_view', false, 'whatsapp_send', false,
      'products_view', true, 'products_manage', false,
      'settings_view', false, 'settings_manage', false,
      'reports_view', false,
      'deliveries_view_own', false, 'deliveries_view_all', true
    )
    WHEN 'finance' THEN jsonb_build_object(
      'leads_view', true, 'leads_create', false, 'leads_edit', false, 'leads_delete', false,
      'sales_view', true, 'sales_create', false, 'sales_edit_draft', false, 
      'sales_confirm_payment', true, 'sales_validate_expedition', false, 
      'sales_dispatch', false, 'sales_mark_delivered', false, 'sales_cancel', true,
      'whatsapp_view', false, 'whatsapp_send', false,
      'products_view', true, 'products_manage', false,
      'settings_view', false, 'settings_manage', false,
      'reports_view', true,
      'deliveries_view_own', false, 'deliveries_view_all', false
    )
    WHEN 'delivery' THEN jsonb_build_object(
      'leads_view', true, 'leads_create', false, 'leads_edit', false, 'leads_delete', false,
      'sales_view', true, 'sales_create', false, 'sales_edit_draft', false, 
      'sales_confirm_payment', false, 'sales_validate_expedition', false, 
      'sales_dispatch', false, 'sales_mark_delivered', true, 'sales_cancel', false,
      'whatsapp_view', false, 'whatsapp_send', false,
      'products_view', false, 'products_manage', false,
      'settings_view', false, 'settings_manage', false,
      'reports_view', false,
      'deliveries_view_own', true, 'deliveries_view_all', false
    )
    ELSE jsonb_build_object(
      'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', false,
      'sales_view', true, 'sales_create', false, 'sales_edit_draft', false, 
      'sales_confirm_payment', false, 'sales_validate_expedition', false, 
      'sales_dispatch', false, 'sales_mark_delivered', false, 'sales_cancel', false,
      'whatsapp_view', true, 'whatsapp_send', false,
      'products_view', true, 'products_manage', false,
      'settings_view', false, 'settings_manage', false,
      'reports_view', false,
      'deliveries_view_own', false, 'deliveries_view_all', false
    )
  END;
END;
$$;

-- Trigger to create default permissions when org member is added
CREATE OR REPLACE FUNCTION public.create_default_user_permissions()
RETURNS trigger
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
    leads_view, leads_create, leads_edit, leads_delete,
    sales_view, sales_create, sales_edit_draft, sales_confirm_payment, 
    sales_validate_expedition, sales_dispatch, sales_mark_delivered, sales_cancel,
    whatsapp_view, whatsapp_send,
    products_view, products_manage,
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
    (default_perms->>'settings_view')::boolean, (default_perms->>'settings_manage')::boolean,
    (default_perms->>'reports_view')::boolean,
    (default_perms->>'deliveries_view_own')::boolean, (default_perms->>'deliveries_view_all')::boolean
  )
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_org_member_create_permissions
  AFTER INSERT ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_user_permissions();

-- Backfill permissions for existing members
INSERT INTO public.user_permissions (
  organization_id, user_id,
  leads_view, leads_create, leads_edit, leads_delete,
  sales_view, sales_create, sales_edit_draft, sales_confirm_payment, 
  sales_validate_expedition, sales_dispatch, sales_mark_delivered, sales_cancel,
  whatsapp_view, whatsapp_send,
  products_view, products_manage,
  settings_view, settings_manage,
  reports_view,
  deliveries_view_own, deliveries_view_all
)
SELECT 
  om.organization_id, om.user_id,
  (get_default_permissions_for_role(om.role::text)->>'leads_view')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'leads_create')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'leads_edit')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'leads_delete')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'sales_view')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'sales_create')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'sales_edit_draft')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'sales_confirm_payment')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'sales_validate_expedition')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'sales_dispatch')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'sales_mark_delivered')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'sales_cancel')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'whatsapp_view')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'whatsapp_send')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'products_view')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'products_manage')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'settings_view')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'settings_manage')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'reports_view')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'deliveries_view_own')::boolean,
  (get_default_permissions_for_role(om.role::text)->>'deliveries_view_all')::boolean
FROM public.organization_members om
ON CONFLICT (organization_id, user_id) DO NOTHING;