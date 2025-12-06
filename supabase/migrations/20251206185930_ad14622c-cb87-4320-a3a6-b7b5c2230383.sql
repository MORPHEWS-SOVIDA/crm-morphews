
-- SOLUÇÃO: Permitir insert para qualquer usuário autenticado que pertença a ALGUMA organização
-- E esteja inserindo o lead na organização correta

-- Drop ALL policies on leads first
DROP POLICY IF EXISTS "Users can insert leads in their org" ON public.leads;
DROP POLICY IF EXISTS "Users can view leads they have access to" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads they have access to" ON public.leads;
DROP POLICY IF EXISTS "Users can delete leads they have access to" ON public.leads;

-- Recreate with simpler, working policies
-- INSERT: User must be authenticated and member of the target organization
CREATE POLICY "Users can insert leads in their org" 
ON public.leads 
FOR INSERT 
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- SELECT: Users can see leads from their org (simplified)
CREATE POLICY "Users can view leads in their org" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- UPDATE: Users can update leads from their org  
CREATE POLICY "Users can update leads in their org" 
ON public.leads 
FOR UPDATE 
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- DELETE: Users can delete leads from their org
CREATE POLICY "Users can delete leads in their org" 
ON public.leads 
FOR DELETE 
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);
