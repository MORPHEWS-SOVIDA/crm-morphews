-- =============================================================================
-- CORREÇÃO: Adicionar search_path às funções que faltaram
-- =============================================================================

-- Recriar normalize_phone_e164 com search_path
CREATE OR REPLACE FUNCTION public.normalize_phone_e164(phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  clean text;
BEGIN
  -- Remove tudo que não é dígito
  clean := regexp_replace(phone, '[^0-9]', '', 'g');
  
  -- Se vazio, retorna null
  IF clean = '' OR clean IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Adiciona código do Brasil se parecer número brasileiro (até 11 dígitos sem código)
  IF length(clean) <= 11 AND NOT clean LIKE '55%' THEN
    clean := '55' || clean;
  END IF;
  
  RETURN clean;
END;
$$;

-- Recriar find_contact_by_phone como SECURITY INVOKER (não precisa de SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.find_contact_by_phone(
  _organization_id uuid,
  _phone text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  normalized_phone text;
  contact_id_result uuid;
BEGIN
  normalized_phone := normalize_phone_e164(_phone);
  
  IF normalized_phone IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT ci.contact_id INTO contact_id_result
  FROM contact_identities ci
  WHERE ci.organization_id = _organization_id
    AND ci.type = 'phone'
    AND ci.value_normalized = normalized_phone
  LIMIT 1;
  
  RETURN contact_id_result;
END;
$$;