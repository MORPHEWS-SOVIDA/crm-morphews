
-- Criar função SECURITY DEFINER para verificar se usuário pertence à organização
-- Esta função bypassa RLS e verifica diretamente
CREATE OR REPLACE FUNCTION public.user_can_insert_to_org(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
    AND organization_id = _org_id
  )
$$;

-- Atualizar a política de INSERT para usar a função SECURITY DEFINER
DROP POLICY IF EXISTS "Users can insert leads in their org" ON public.leads;

CREATE POLICY "Users can insert leads in their org" 
ON public.leads 
FOR INSERT 
WITH CHECK (
  public.user_can_insert_to_org(auth.uid(), organization_id)
);
