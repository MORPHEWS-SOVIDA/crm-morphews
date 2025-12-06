-- Remover a política atual
DROP POLICY IF EXISTS "Users can insert leads in their org" ON public.leads;

-- Criar nova política de INSERT para usuários AUTHENTICATED (não public)
CREATE POLICY "Users can insert leads in their org" 
ON public.leads 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.user_id = auth.uid()
    AND organization_members.organization_id = leads.organization_id
  )
);