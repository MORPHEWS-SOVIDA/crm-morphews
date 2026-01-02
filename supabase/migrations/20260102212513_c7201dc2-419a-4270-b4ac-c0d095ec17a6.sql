
-- Add post-sale permissions to user_permissions table
ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS post_sale_view boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS post_sale_manage boolean NOT NULL DEFAULT false;

-- Create post_sale_surveys table
CREATE TABLE public.post_sale_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Survey status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'attempted')),
  
  -- Fixed questions
  received_order boolean,
  knows_how_to_use boolean,
  seller_rating integer CHECK (seller_rating IS NULL OR (seller_rating >= 0 AND seller_rating <= 10)),
  
  -- Continuous medication
  uses_continuous_medication boolean,
  continuous_medication_details text,
  
  -- Delivery-specific rating (depends on delivery type)
  delivery_type text, -- 'motoboy', 'carrier', 'counter'
  delivery_rating integer CHECK (delivery_rating IS NULL OR (delivery_rating >= 0 AND delivery_rating <= 10)),
  
  -- Metadata
  notes text,
  attempted_at timestamp with time zone,
  completed_at timestamp with time zone,
  completed_by uuid,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Ensure one survey per sale
  UNIQUE(sale_id)
);

-- Enable RLS
ALTER TABLE public.post_sale_surveys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view post_sale_surveys of their org"
ON public.post_sale_surveys
FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert post_sale_surveys in their org"
ON public.post_sale_surveys
FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update post_sale_surveys of their org"
ON public.post_sale_surveys
FOR UPDATE
USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can delete post_sale_surveys"
ON public.post_sale_surveys
FOR DELETE
USING (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id));

-- Create trigger for updated_at
CREATE TRIGGER update_post_sale_surveys_updated_at
BEFORE UPDATE ON public.post_sale_surveys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update get_default_permissions_for_role function to include post_sale permissions
CREATE OR REPLACE FUNCTION public.get_default_permissions_for_role(_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CASE _role
    WHEN 'owner' THEN
      RETURN jsonb_build_object(
        'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', true,
        'sales_view', true, 'sales_view_all', true, 'sales_create', true, 'sales_edit_draft', true, 'sales_confirm_payment', true,
        'sales_validate_expedition', true, 'sales_dispatch', true, 'sales_mark_delivered', true, 'sales_cancel', true,
        'whatsapp_view', true, 'whatsapp_send', true,
        'products_view', true, 'products_manage', true, 'products_view_cost', true,
        'settings_view', true, 'settings_manage', true,
        'reports_view', true,
        'deliveries_view_own', true, 'deliveries_view_all', true,
        'receptive_module_access', true,
        'team_view', true, 'instagram_view', true,
        'post_sale_view', true, 'post_sale_manage', true
      );
    WHEN 'admin' THEN
      RETURN jsonb_build_object(
        'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', true,
        'sales_view', true, 'sales_view_all', true, 'sales_create', true, 'sales_edit_draft', true, 'sales_confirm_payment', true,
        'sales_validate_expedition', true, 'sales_dispatch', true, 'sales_mark_delivered', true, 'sales_cancel', true,
        'whatsapp_view', true, 'whatsapp_send', true,
        'products_view', true, 'products_manage', true, 'products_view_cost', true,
        'settings_view', true, 'settings_manage', true,
        'reports_view', true,
        'deliveries_view_own', true, 'deliveries_view_all', true,
        'receptive_module_access', true,
        'team_view', true, 'instagram_view', true,
        'post_sale_view', true, 'post_sale_manage', true
      );
    WHEN 'manager' THEN
      RETURN jsonb_build_object(
        'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', false,
        'sales_view', true, 'sales_view_all', true, 'sales_create', true, 'sales_edit_draft', true, 'sales_confirm_payment', false,
        'sales_validate_expedition', true, 'sales_dispatch', true, 'sales_mark_delivered', true, 'sales_cancel', false,
        'whatsapp_view', true, 'whatsapp_send', true,
        'products_view', true, 'products_manage', false, 'products_view_cost', true,
        'settings_view', true, 'settings_manage', false,
        'reports_view', true,
        'deliveries_view_own', true, 'deliveries_view_all', true,
        'receptive_module_access', true,
        'team_view', true, 'instagram_view', true,
        'post_sale_view', true, 'post_sale_manage', true
      );
    WHEN 'seller' THEN
      RETURN jsonb_build_object(
        'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', false,
        'sales_view', true, 'sales_view_all', false, 'sales_create', true, 'sales_edit_draft', true, 'sales_confirm_payment', false,
        'sales_validate_expedition', false, 'sales_dispatch', false, 'sales_mark_delivered', false, 'sales_cancel', false,
        'whatsapp_view', true, 'whatsapp_send', true,
        'products_view', true, 'products_manage', false, 'products_view_cost', false,
        'settings_view', false, 'settings_manage', false,
        'reports_view', false,
        'deliveries_view_own', false, 'deliveries_view_all', false,
        'receptive_module_access', true,
        'team_view', false, 'instagram_view', false,
        'post_sale_view', false, 'post_sale_manage', false
      );
    WHEN 'shipping' THEN
      RETURN jsonb_build_object(
        'leads_view', false, 'leads_create', false, 'leads_edit', false, 'leads_delete', false,
        'sales_view', true, 'sales_view_all', true, 'sales_create', false, 'sales_edit_draft', false, 'sales_confirm_payment', false,
        'sales_validate_expedition', true, 'sales_dispatch', true, 'sales_mark_delivered', false, 'sales_cancel', false,
        'whatsapp_view', false, 'whatsapp_send', false,
        'products_view', true, 'products_manage', false, 'products_view_cost', false,
        'settings_view', false, 'settings_manage', false,
        'reports_view', false,
        'deliveries_view_own', false, 'deliveries_view_all', true,
        'receptive_module_access', false,
        'team_view', false, 'instagram_view', false,
        'post_sale_view', false, 'post_sale_manage', false
      );
    WHEN 'finance' THEN
      RETURN jsonb_build_object(
        'leads_view', false, 'leads_create', false, 'leads_edit', false, 'leads_delete', false,
        'sales_view', true, 'sales_view_all', true, 'sales_create', false, 'sales_edit_draft', false, 'sales_confirm_payment', true,
        'sales_validate_expedition', false, 'sales_dispatch', false, 'sales_mark_delivered', false, 'sales_cancel', false,
        'whatsapp_view', false, 'whatsapp_send', false,
        'products_view', false, 'products_manage', false, 'products_view_cost', true,
        'settings_view', false, 'settings_manage', false,
        'reports_view', true,
        'deliveries_view_own', false, 'deliveries_view_all', false,
        'receptive_module_access', false,
        'team_view', false, 'instagram_view', false,
        'post_sale_view', true, 'post_sale_manage', false
      );
    WHEN 'entregador' THEN
      RETURN jsonb_build_object(
        'leads_view', false, 'leads_create', false, 'leads_edit', false, 'leads_delete', false,
        'sales_view', false, 'sales_view_all', false, 'sales_create', false, 'sales_edit_draft', false, 'sales_confirm_payment', false,
        'sales_validate_expedition', false, 'sales_dispatch', false, 'sales_mark_delivered', true, 'sales_cancel', false,
        'whatsapp_view', false, 'whatsapp_send', false,
        'products_view', false, 'products_manage', false, 'products_view_cost', false,
        'settings_view', false, 'settings_manage', false,
        'reports_view', false,
        'deliveries_view_own', true, 'deliveries_view_all', false,
        'receptive_module_access', false,
        'team_view', false, 'instagram_view', false,
        'post_sale_view', false, 'post_sale_manage', false
      );
    ELSE -- member
      RETURN jsonb_build_object(
        'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', false,
        'sales_view', true, 'sales_view_all', false, 'sales_create', false, 'sales_edit_draft', false, 'sales_confirm_payment', false,
        'sales_validate_expedition', false, 'sales_dispatch', false, 'sales_mark_delivered', false, 'sales_cancel', false,
        'whatsapp_view', true, 'whatsapp_send', false,
        'products_view', true, 'products_manage', false, 'products_view_cost', false,
        'settings_view', false, 'settings_manage', false,
        'reports_view', false,
        'deliveries_view_own', false, 'deliveries_view_all', false,
        'receptive_module_access', false,
        'team_view', false, 'instagram_view', false,
        'post_sale_view', false, 'post_sale_manage', false
      );
  END CASE;
END;
$$;

-- Update trigger function to include new permissions
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
    sales_view, sales_view_all, sales_create, sales_edit_draft, sales_confirm_payment, 
    sales_validate_expedition, sales_dispatch, sales_mark_delivered, sales_cancel,
    whatsapp_view, whatsapp_send,
    products_view, products_manage, products_view_cost,
    settings_view, settings_manage,
    reports_view,
    deliveries_view_own, deliveries_view_all,
    post_sale_view, post_sale_manage
  ) VALUES (
    NEW.organization_id, NEW.user_id,
    (default_perms->>'leads_view')::boolean, (default_perms->>'leads_create')::boolean, 
    (default_perms->>'leads_edit')::boolean, (default_perms->>'leads_delete')::boolean,
    (default_perms->>'sales_view')::boolean, (default_perms->>'sales_view_all')::boolean,
    (default_perms->>'sales_create')::boolean, (default_perms->>'sales_edit_draft')::boolean, 
    (default_perms->>'sales_confirm_payment')::boolean, 
    (default_perms->>'sales_validate_expedition')::boolean, (default_perms->>'sales_dispatch')::boolean, 
    (default_perms->>'sales_mark_delivered')::boolean, (default_perms->>'sales_cancel')::boolean,
    (default_perms->>'whatsapp_view')::boolean, (default_perms->>'whatsapp_send')::boolean,
    (default_perms->>'products_view')::boolean, (default_perms->>'products_manage')::boolean,
    (default_perms->>'products_view_cost')::boolean,
    (default_perms->>'settings_view')::boolean, (default_perms->>'settings_manage')::boolean,
    (default_perms->>'reports_view')::boolean,
    (default_perms->>'deliveries_view_own')::boolean, (default_perms->>'deliveries_view_all')::boolean,
    COALESCE((default_perms->>'post_sale_view')::boolean, false),
    COALESCE((default_perms->>'post_sale_manage')::boolean, false)
  )
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;
