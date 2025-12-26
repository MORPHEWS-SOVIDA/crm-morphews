-- lead_products: permitir create/update/delete por organização
-- remover policies antigas que apenas permitiam admins
DROP POLICY IF EXISTS "Org admins can delete lead products" ON public.lead_products;
DROP POLICY IF EXISTS "Org admins can insert lead products" ON public.lead_products;
DROP POLICY IF EXISTS "Org admins can update lead products" ON public.lead_products;
DROP POLICY IF EXISTS "Users can view lead products of their org" ON public.lead_products;

-- permitir que qualquer membro da org faça select/insert/update/delete
CREATE POLICY "Org members can manage lead_products"
  ON public.lead_products
  FOR ALL
  USING (
    organization_id = public.get_user_organization_id()
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
  );