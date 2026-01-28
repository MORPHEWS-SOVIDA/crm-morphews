
-- 1. Trigger para sincronizar user_id quando virtual_accounts for atualizado
CREATE OR REPLACE FUNCTION sync_virtual_account_user_to_affiliates()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o user_id foi definido/alterado
  IF NEW.user_id IS NOT NULL AND (OLD.user_id IS NULL OR OLD.user_id != NEW.user_id) THEN
    -- Atualizar organization_affiliates pelo email
    UPDATE organization_affiliates
    SET user_id = NEW.user_id, updated_at = now()
    WHERE LOWER(email) = LOWER(NEW.holder_email)
      AND (user_id IS NULL OR user_id != NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. Trigger na virtual_accounts
DROP TRIGGER IF EXISTS sync_va_user_to_affiliates ON virtual_accounts;
CREATE TRIGGER sync_va_user_to_affiliates
  AFTER UPDATE OF user_id ON virtual_accounts
  FOR EACH ROW
  EXECUTE FUNCTION sync_virtual_account_user_to_affiliates();

-- 3. Também sincronizar quando usuário faz login e profiles é atualizado
-- Criar função que sincroniza baseado no email do profile
CREATE OR REPLACE FUNCTION sync_profile_to_affiliates()
RETURNS TRIGGER AS $$
DECLARE
  v_email text;
BEGIN
  -- Buscar email do usuário
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
  
  IF v_email IS NOT NULL THEN
    -- Atualizar organization_affiliates onde email bate
    UPDATE organization_affiliates
    SET user_id = NEW.user_id, updated_at = now()
    WHERE LOWER(email) = LOWER(v_email)
      AND user_id IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Trigger no profiles (dispara no INSERT - primeiro login)
DROP TRIGGER IF EXISTS sync_profile_to_affiliates_trigger ON profiles;
CREATE TRIGGER sync_profile_to_affiliates_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_to_affiliates();

-- 5. Correção retroativa: Sincronizar todos os affiliates pendentes
UPDATE organization_affiliates oa
SET user_id = u.id, updated_at = now()
FROM auth.users u
WHERE LOWER(oa.email) = LOWER(u.email)
  AND oa.user_id IS NULL;
