-- lead_sources: permitir create/update/delete por organização
-- remover policies antigas que apenas permitiam admins
DROP POLICY IF EXISTS "Org admins can delete lead sources" ON public.lead_sources;
DROP POLICY IF EXISTS "Org admins can insert lead sources" ON public.lead_sources;
DROP POLICY IF EXISTS "Org admins can update lead sources" ON public.lead_sources;
DROP POLICY IF EXISTS "Users can view lead sources of their org" ON public.lead_sources;

-- permitir que qualquer membro da org faça select/insert/update/delete
CREATE POLICY "Org members can manage lead_sources"
  ON public.lead_sources
  FOR ALL
  USING (
    organization_id = public.get_user_organization_id()
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
  );