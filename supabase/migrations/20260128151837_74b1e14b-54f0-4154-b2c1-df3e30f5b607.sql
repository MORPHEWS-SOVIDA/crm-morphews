-- ============================================================================
-- CORREÇÃO: Popular organization_id faltante em virtual_accounts
-- E garantir consistência futura
-- ============================================================================

-- 1. Atualizar virtual_accounts sem organization_id usando dados de partner_associations
UPDATE virtual_accounts va
SET organization_id = (
  SELECT DISTINCT pa.organization_id
  FROM partner_associations pa
  WHERE pa.virtual_account_id = va.id
    AND pa.organization_id IS NOT NULL
  LIMIT 1
)
WHERE va.organization_id IS NULL
  AND EXISTS (
    SELECT 1 FROM partner_associations pa
    WHERE pa.virtual_account_id = va.id
      AND pa.organization_id IS NOT NULL
  );

-- 2. Verificar se ficou algum sem org (para garantir)
-- SELECT id, holder_name, holder_email, organization_id FROM virtual_accounts WHERE organization_id IS NULL;

-- 3. Criar função para garantir que virtual_accounts sempre tenha organization_id ao criar via partner
CREATE OR REPLACE FUNCTION ensure_virtual_account_has_org()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a virtual_account não tem org_id, atualiza com a do partner_association
  IF NEW.virtual_account_id IS NOT NULL THEN
    UPDATE virtual_accounts
    SET organization_id = NEW.organization_id
    WHERE id = NEW.virtual_account_id
      AND organization_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Trigger para garantir consistência futura
DROP TRIGGER IF EXISTS ensure_va_org_on_partner ON partner_associations;
CREATE TRIGGER ensure_va_org_on_partner
  AFTER INSERT OR UPDATE ON partner_associations
  FOR EACH ROW
  EXECUTE FUNCTION ensure_virtual_account_has_org();