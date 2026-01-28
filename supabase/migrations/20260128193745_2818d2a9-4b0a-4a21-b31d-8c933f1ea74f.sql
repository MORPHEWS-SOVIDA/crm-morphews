-- Fix infinite recursion in virtual_accounts RLS
-- Create SECURITY DEFINER functions to break the recursion cycle

-- Function to get user's organization IDs (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  UNION
  SELECT organization_id FROM profiles WHERE user_id = auth.uid()
$$;

-- Function to get user's virtual account IDs (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_virtual_account_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM virtual_accounts WHERE user_id = auth.uid()
$$;

-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Org members can view related virtual_accounts" ON public.virtual_accounts;

-- Create a simpler, non-recursive policy for virtual_accounts
CREATE POLICY "Users can view accessible virtual accounts" 
ON public.virtual_accounts 
FOR SELECT 
USING (
  user_id = auth.uid()
  OR
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
  OR
  organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Fix partner_associations policy to use security definer function
DROP POLICY IF EXISTS "Partners can view their associations" ON public.partner_associations;

CREATE POLICY "Partners can view their associations" 
ON public.partner_associations 
FOR SELECT 
USING (
  virtual_account_id IN (SELECT public.get_user_virtual_account_ids())
  OR
  organization_id IN (SELECT public.get_user_org_ids())
);

-- Fix virtual_transactions policy
DROP POLICY IF EXISTS "Dono vê suas transações" ON public.virtual_transactions;

CREATE POLICY "User can view their transactions" 
ON public.virtual_transactions 
FOR SELECT 
USING (
  virtual_account_id IN (SELECT public.get_user_virtual_account_ids())
  OR
  virtual_account_id IN (
    SELECT id FROM virtual_accounts 
    WHERE organization_id IN (SELECT public.get_user_org_ids())
  )
);