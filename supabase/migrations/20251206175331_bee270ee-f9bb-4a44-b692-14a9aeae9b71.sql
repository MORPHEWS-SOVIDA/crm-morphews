-- Remover a política atual de INSERT
DROP POLICY IF EXISTS "Users can insert leads in their org" ON public.leads;

-- Criar nova política de INSERT mais simples e direta
-- Verificando se o usuário pertence à organização do lead sendo inserido
CREATE POLICY "Users can insert leads in their org" 
ON public.leads 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.user_id = auth.uid()
    AND organization_members.organization_id = leads.organization_id
  )
);