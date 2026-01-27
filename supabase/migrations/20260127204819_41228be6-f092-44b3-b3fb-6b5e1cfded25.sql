-- Atualizar a política RLS de virtual_accounts para permitir que membros da organização
-- vejam as contas virtuais de parceiros associados à sua organização

-- Primeiro, remover a política existente
DROP POLICY IF EXISTS "Dono vê sua conta virtual" ON public.virtual_accounts;

-- Criar nova política mais abrangente
CREATE POLICY "Org members can view related virtual_accounts" 
  ON public.virtual_accounts 
  FOR SELECT
  USING (
    -- O próprio dono da conta
    user_id = auth.uid() 
    OR 
    -- Conta pertence à organização do usuário
    organization_id IN (
      SELECT profiles.organization_id
      FROM profiles
      WHERE profiles.user_id = auth.uid()
    )
    OR
    -- Conta está vinculada a um parceiro da organização do usuário
    id IN (
      SELECT pa.virtual_account_id 
      FROM partner_associations pa
      WHERE pa.organization_id IN (
        SELECT profiles.organization_id
        FROM profiles
        WHERE profiles.user_id = auth.uid()
      )
    )
    OR
    -- Conta está vinculada a um afiliado da organização do usuário (tabela legada)
    id IN (
      SELECT aff.virtual_account_id 
      FROM affiliates aff
      WHERE aff.organization_id IN (
        SELECT profiles.organization_id
        FROM profiles
        WHERE profiles.user_id = auth.uid()
      )
    )
  );