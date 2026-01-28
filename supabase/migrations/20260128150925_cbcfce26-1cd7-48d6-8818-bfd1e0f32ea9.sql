
-- ============================================================================
-- MIGRAÇÃO: Popular organization_affiliates a partir de partner_associations
-- ============================================================================

-- 1. Inserir afiliados únicos (deduplica por email + org)
INSERT INTO organization_affiliates (
  organization_id,
  email,
  name,
  phone,
  affiliate_code,
  default_commission_type,
  default_commission_value,
  is_active,
  user_id
)
SELECT DISTINCT ON (pa.organization_id, LOWER(va.holder_email))
  pa.organization_id,
  LOWER(va.holder_email) as email,
  va.holder_name as name,
  NULL as phone,
  'AFF' || UPPER(SUBSTR(MD5(gen_random_uuid()::text), 1, 6)) as affiliate_code,
  COALESCE(pa.commission_type, 'percentage') as default_commission_type,
  COALESCE(pa.commission_value, 10) as default_commission_value,
  pa.is_active,
  va.user_id
FROM partner_associations pa
JOIN virtual_accounts va ON va.id = pa.virtual_account_id
WHERE pa.partner_type = 'affiliate'
  AND pa.is_active = true
  AND va.holder_email IS NOT NULL
  AND va.holder_email != ''
ON CONFLICT (organization_id, email) DO NOTHING;

-- 2. Criar função para sincronizar automaticamente quando um parceiro do tipo affiliate for aprovado
CREATE OR REPLACE FUNCTION sync_affiliate_to_organization_affiliates()
RETURNS TRIGGER AS $$
BEGIN
  -- Só sincroniza se for tipo affiliate
  IF NEW.partner_type = 'affiliate' AND NEW.is_active = true THEN
    -- Buscar dados da virtual_account
    INSERT INTO organization_affiliates (
      organization_id,
      email,
      name,
      phone,
      affiliate_code,
      default_commission_type,
      default_commission_value,
      is_active,
      user_id
    )
    SELECT 
      NEW.organization_id,
      LOWER(va.holder_email),
      va.holder_name,
      NULL,
      'AFF' || UPPER(SUBSTR(MD5(gen_random_uuid()::text), 1, 6)),
      COALESCE(NEW.commission_type, 'percentage'),
      COALESCE(NEW.commission_value, 10),
      true,
      va.user_id
    FROM virtual_accounts va
    WHERE va.id = NEW.virtual_account_id
      AND va.holder_email IS NOT NULL
      AND va.holder_email != ''
    ON CONFLICT (organization_id, email) DO UPDATE SET
      name = EXCLUDED.name,
      default_commission_type = EXCLUDED.default_commission_type,
      default_commission_value = EXCLUDED.default_commission_value,
      is_active = EXCLUDED.is_active,
      user_id = EXCLUDED.user_id,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. Trigger para sincronizar automaticamente
DROP TRIGGER IF EXISTS sync_partner_to_org_affiliates ON partner_associations;
CREATE TRIGGER sync_partner_to_org_affiliates
  AFTER INSERT OR UPDATE ON partner_associations
  FOR EACH ROW
  EXECUTE FUNCTION sync_affiliate_to_organization_affiliates();
