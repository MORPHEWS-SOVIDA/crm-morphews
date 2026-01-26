-- Atualizar política para permitir que managers também gerenciem templates
DROP POLICY IF EXISTS "Admins can manage message templates" ON public.non_purchase_message_templates;

CREATE POLICY "Admins and managers can manage message templates"
  ON public.non_purchase_message_templates
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );