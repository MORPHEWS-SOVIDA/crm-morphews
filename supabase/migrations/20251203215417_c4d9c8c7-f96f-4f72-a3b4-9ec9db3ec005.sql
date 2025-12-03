-- Drop existing policies that don't check organization
DROP POLICY IF EXISTS "Authenticated users can view lead products" ON public.lead_products;
DROP POLICY IF EXISTS "Admins can insert lead products" ON public.lead_products;
DROP POLICY IF EXISTS "Admins can update lead products" ON public.lead_products;
DROP POLICY IF EXISTS "Admins can delete lead products" ON public.lead_products;

DROP POLICY IF EXISTS "Authenticated users can view lead sources" ON public.lead_sources;
DROP POLICY IF EXISTS "Admins can insert lead sources" ON public.lead_sources;
DROP POLICY IF EXISTS "Admins can update lead sources" ON public.lead_sources;
DROP POLICY IF EXISTS "Admins can delete lead sources" ON public.lead_sources;

-- Create org-isolated policies for lead_products
CREATE POLICY "Users can view lead products of their org"
ON public.lead_products FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Org admins can insert lead products"
ON public.lead_products FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id() 
  AND is_org_admin(auth.uid(), organization_id)
);

CREATE POLICY "Org admins can update lead products"
ON public.lead_products FOR UPDATE
USING (
  organization_id = get_user_organization_id() 
  AND is_org_admin(auth.uid(), organization_id)
);

CREATE POLICY "Org admins can delete lead products"
ON public.lead_products FOR DELETE
USING (
  organization_id = get_user_organization_id() 
  AND is_org_admin(auth.uid(), organization_id)
);

-- Create org-isolated policies for lead_sources
CREATE POLICY "Users can view lead sources of their org"
ON public.lead_sources FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Org admins can insert lead sources"
ON public.lead_sources FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id() 
  AND is_org_admin(auth.uid(), organization_id)
);

CREATE POLICY "Org admins can update lead sources"
ON public.lead_sources FOR UPDATE
USING (
  organization_id = get_user_organization_id() 
  AND is_org_admin(auth.uid(), organization_id)
);

CREATE POLICY "Org admins can delete lead sources"
ON public.lead_sources FOR DELETE
USING (
  organization_id = get_user_organization_id() 
  AND is_org_admin(auth.uid(), organization_id)
);