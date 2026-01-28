
-- Fix RLS policy for virtual_accounts to ensure tenants can view their accounts
-- The issue is that profiles.organization_id lookup might fail due to RLS on profiles

DROP POLICY IF EXISTS "Users can view accessible virtual accounts" ON public.virtual_accounts;

CREATE POLICY "Users can view accessible virtual accounts" 
ON public.virtual_accounts
FOR SELECT
USING (
  -- User owns this virtual account directly
  user_id = auth.uid() 
  OR
  -- User is owner/admin of the organization
  organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
  )
  OR
  -- User belongs to this organization (simpler check via profiles)
  organization_id = (
    SELECT organization_id 
    FROM profiles 
    WHERE user_id = auth.uid()
    LIMIT 1
  )
);

-- Also add INSERT policy for creating virtual accounts
DROP POLICY IF EXISTS "Users can insert virtual accounts" ON public.virtual_accounts;

CREATE POLICY "Organization admins can insert virtual accounts"
ON public.virtual_accounts
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
  )
);

-- Add UPDATE policy
DROP POLICY IF EXISTS "Users can update virtual accounts" ON public.virtual_accounts;

CREATE POLICY "Users can update their virtual accounts"
ON public.virtual_accounts
FOR UPDATE
USING (
  user_id = auth.uid() 
  OR
  organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
  )
);
