-- Corrigir política de INSERT para industries (precisa de WITH CHECK)
DROP POLICY IF EXISTS "Tenants podem gerenciar suas indústrias" ON public.industries;

CREATE POLICY "Tenants podem gerenciar suas indústrias"
  ON public.industries FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );