-- Remove the restrictive lead visibility rule (leads_view_only_own) and allow all authenticated org members to view all leads.
-- This keeps data private to the organization (still protected by RLS) and preserves full history.

BEGIN;

-- Replace SELECT policy on leads
DROP POLICY IF EXISTS "Users can view leads based on permissions" ON public.leads;

CREATE POLICY "Org members can view leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT om.organization_id
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
);

COMMIT;