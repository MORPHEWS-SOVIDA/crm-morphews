-- Create internal schema for encryption functions
CREATE SCHEMA IF NOT EXISTS internal;

-- Create a helper function to get encryption key
CREATE OR REPLACE FUNCTION internal.get_encryption_key()
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key_text text;
BEGIN
  -- Use a generated key based on the database name and a static secret
  key_text := encode(digest(current_database() || '-morphews-fiscal-encryption-2024', 'sha256'), 'hex');
  RETURN decode(substring(key_text from 1 for 32), 'escape');
END;
$$;

-- Create encrypt function
CREATE OR REPLACE FUNCTION internal.encrypt_sensitive(plain_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF plain_text IS NULL OR plain_text = '' THEN
    RETURN NULL;
  END IF;
  RETURN encode(
    pgcrypto.encrypt(
      convert_to(plain_text, 'UTF8'),
      internal.get_encryption_key(),
      'aes'
    ),
    'base64'
  );
END;
$$;

-- Create decrypt function
CREATE OR REPLACE FUNCTION internal.decrypt_sensitive(encrypted_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF encrypted_text IS NULL OR encrypted_text = '' THEN
    RETURN NULL;
  END IF;
  RETURN convert_from(
    pgcrypto.decrypt(
      decode(encrypted_text, 'base64'),
      internal.get_encryption_key(),
      'aes'
    ),
    'UTF8'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- If decryption fails (data not encrypted or corrupt), return original
    RETURN encrypted_text;
END;
$$;

-- Revoke public access to internal schema
REVOKE ALL ON SCHEMA internal FROM public;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA internal FROM public;

-- Create a SECURITY DEFINER function to get decrypted credentials for edge functions
CREATE OR REPLACE FUNCTION public.get_fiscal_company_credentials(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  cnpj text,
  certificate_file_path text,
  certificate_password text,
  focus_nfe_token_homologacao text,
  focus_nfe_token_producao text,
  nfe_environment text,
  nfse_environment text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get the organization_id of the company
  SELECT fc.organization_id INTO v_org_id
  FROM fiscal_companies fc
  WHERE fc.id = p_company_id;
  
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Verify calling user has access to this organization
  IF NOT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = v_org_id
    AND om.user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    fc.id,
    fc.cnpj,
    fc.certificate_file_path,
    internal.decrypt_sensitive(fc.certificate_password_encrypted) as certificate_password,
    fc.focus_nfe_token_homologacao,
    fc.focus_nfe_token_producao,
    fc.nfe_environment,
    fc.nfse_environment
  FROM fiscal_companies fc
  WHERE fc.id = p_company_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_fiscal_company_credentials(uuid) TO authenticated;

-- Create trigger to auto-encrypt certificate password on insert/update
CREATE OR REPLACE FUNCTION internal.encrypt_fiscal_company_secrets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Encrypt certificate password if it's being set and doesn't look encrypted
  IF NEW.certificate_password_encrypted IS NOT NULL 
     AND NEW.certificate_password_encrypted != ''
     AND (TG_OP = 'INSERT' OR NEW.certificate_password_encrypted IS DISTINCT FROM OLD.certificate_password_encrypted) THEN
    -- Check if already encrypted (base64 pattern with minimum length)
    IF NEW.certificate_password_encrypted !~ '^[A-Za-z0-9+/]+=*$' OR length(NEW.certificate_password_encrypted) < 24 THEN
      NEW.certificate_password_encrypted := internal.encrypt_sensitive(NEW.certificate_password_encrypted);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS encrypt_fiscal_secrets_trigger ON fiscal_companies;
CREATE TRIGGER encrypt_fiscal_secrets_trigger
  BEFORE INSERT OR UPDATE ON fiscal_companies
  FOR EACH ROW
  EXECUTE FUNCTION internal.encrypt_fiscal_company_secrets();

-- Add comment to document sensitive columns
COMMENT ON COLUMN fiscal_companies.certificate_password_encrypted IS 'Encrypted certificate password - use get_fiscal_company_credentials() to access';
COMMENT ON COLUMN fiscal_companies.focus_nfe_token_homologacao IS 'Focus NFe API token for homologation environment - sensitive';
COMMENT ON COLUMN fiscal_companies.focus_nfe_token_producao IS 'Focus NFe API token for production environment - sensitive';