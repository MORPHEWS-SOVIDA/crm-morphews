
-- Atualizar a política de leitura de virtual_accounts para incluir admins da org
DROP POLICY IF EXISTS "Org members can view related virtual_accounts" ON public.virtual_accounts;

CREATE POLICY "Org members can view related virtual_accounts"
ON public.virtual_accounts FOR SELECT
USING (
  -- Própria conta
  user_id = auth.uid()
  -- Admin/Owner vê todas as contas da organização
  OR (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid() 
      AND om.role IN ('owner', 'admin')
    )
  )
  -- Conta virtual de parceiro visível pela profile.organization_id
  OR (
    id IN (
      SELECT pa.virtual_account_id 
      FROM partner_associations pa 
      WHERE pa.organization_id IN (
        SELECT p.organization_id 
        FROM profiles p 
        WHERE p.user_id = auth.uid()
      )
    )
  )
  -- Conta virtual de afiliado visível pela profile.organization_id (legado)
  OR (
    id IN (
      SELECT aff.virtual_account_id 
      FROM affiliates aff 
      WHERE aff.organization_id IN (
        SELECT p.organization_id 
        FROM profiles p 
        WHERE p.user_id = auth.uid()
      )
    )
  )
);
