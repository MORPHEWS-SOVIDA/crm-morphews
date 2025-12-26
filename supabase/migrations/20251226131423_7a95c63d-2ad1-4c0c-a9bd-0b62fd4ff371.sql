
-- 1. Add new roles to the org_role enum
ALTER TYPE org_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE org_role ADD VALUE IF NOT EXISTS 'seller';
ALTER TYPE org_role ADD VALUE IF NOT EXISTS 'shipping';
ALTER TYPE org_role ADD VALUE IF NOT EXISTS 'finance';

-- 2. Create role_permissions table for customizable permissions per org
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role org_role NOT NULL,
  resource text NOT NULL, -- 'leads', 'products', 'sales', 'team', 'reports', 'settings', 'whatsapp', 'finance'
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, role, resource)
);

-- 3. Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Users can view their org permissions"
ON public.role_permissions FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Owners can manage permissions"
ON public.role_permissions FOR ALL
USING (
  organization_id = get_user_organization_id() 
  AND EXISTS (
    SELECT 1 FROM organization_members 
    WHERE user_id = auth.uid() 
    AND organization_id = role_permissions.organization_id 
    AND role = 'owner'
  )
);

-- 5. Function to initialize default permissions for a new org
CREATE OR REPLACE FUNCTION public.initialize_org_role_permissions(org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  roles org_role[] := ARRAY['owner', 'manager', 'admin', 'member', 'seller', 'shipping', 'finance']::org_role[];
  resources text[] := ARRAY['leads', 'products', 'sales', 'team', 'reports', 'settings', 'whatsapp', 'finance'];
  r org_role;
  res text;
BEGIN
  FOREACH r IN ARRAY roles LOOP
    FOREACH res IN ARRAY resources LOOP
      INSERT INTO role_permissions (organization_id, role, resource, can_view, can_create, can_edit, can_delete)
      VALUES (
        org_id,
        r,
        res,
        -- Default permissions based on role
        CASE 
          WHEN r = 'owner' THEN true
          WHEN r = 'manager' THEN true
          WHEN r = 'admin' THEN true
          WHEN r = 'seller' AND res IN ('leads', 'products', 'whatsapp') THEN true
          WHEN r = 'shipping' AND res IN ('leads', 'sales') THEN true
          WHEN r = 'finance' AND res IN ('leads', 'sales', 'finance', 'reports') THEN true
          WHEN r = 'member' AND res IN ('leads', 'products') THEN true
          ELSE false
        END,
        CASE 
          WHEN r = 'owner' THEN true
          WHEN r = 'manager' THEN true
          WHEN r = 'admin' THEN res NOT IN ('settings')
          WHEN r = 'seller' AND res = 'leads' THEN true
          ELSE false
        END,
        CASE 
          WHEN r = 'owner' THEN true
          WHEN r = 'manager' THEN true
          WHEN r = 'admin' THEN res NOT IN ('settings', 'team')
          WHEN r = 'seller' AND res = 'leads' THEN true
          ELSE false
        END,
        CASE 
          WHEN r = 'owner' THEN true
          WHEN r = 'manager' THEN res NOT IN ('settings', 'team')
          WHEN r = 'admin' THEN res NOT IN ('settings', 'team')
          ELSE false
        END
      )
      ON CONFLICT (organization_id, role, resource) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

-- 6. Function to check if user has permission for a specific action
CREATE OR REPLACE FUNCTION public.user_has_permission(
  _user_id uuid,
  _resource text,
  _action text -- 'view', 'create', 'edit', 'delete'
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role org_role;
  user_org_id uuid;
  has_perm boolean;
BEGIN
  -- Get user's organization and role
  SELECT om.organization_id, om.role INTO user_org_id, user_role
  FROM organization_members om
  WHERE om.user_id = _user_id
  LIMIT 1;
  
  IF user_org_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Owner always has all permissions
  IF user_role = 'owner' THEN
    RETURN true;
  END IF;
  
  -- Check specific permission
  SELECT 
    CASE _action
      WHEN 'view' THEN can_view
      WHEN 'create' THEN can_create
      WHEN 'edit' THEN can_edit
      WHEN 'delete' THEN can_delete
      ELSE false
    END INTO has_perm
  FROM role_permissions
  WHERE organization_id = user_org_id
    AND role = user_role
    AND resource = _resource;
  
  RETURN COALESCE(has_perm, false);
END;
$$;

-- 7. Trigger to update updated_at
CREATE TRIGGER update_role_permissions_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
