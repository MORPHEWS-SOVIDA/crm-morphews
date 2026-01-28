-- =============================================================================
-- SISTEMA DE AFILIADOS V2 - ESTRUTURA LIMPA
-- =============================================================================

-- 1. Criar tabela de afiliados por organização (registro canônico de cada afiliado)
CREATE TABLE IF NOT EXISTS public.organization_affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Dados do afiliado
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  
  -- Código único do afiliado (gerado automaticamente)
  affiliate_code TEXT NOT NULL UNIQUE,
  
  -- Comissão padrão
  default_commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (default_commission_type IN ('percentage', 'fixed')),
  default_commission_value NUMERIC NOT NULL DEFAULT 10,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Opcional: vincular a um user_id se o afiliado tiver conta no sistema
  user_id UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint de unicidade: um email por organização
  UNIQUE(organization_id, email)
);

-- 2. Criar tabela de vínculos afiliado <-> checkout
CREATE TABLE IF NOT EXISTS public.checkout_affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_id UUID NOT NULL REFERENCES standalone_checkouts(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL REFERENCES organization_affiliates(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Comissão específica para este checkout (sobrescreve o padrão)
  commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
  commission_value NUMERIC NOT NULL DEFAULT 10,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: um afiliado só pode estar vinculado uma vez por checkout
  UNIQUE(checkout_id, affiliate_id)
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_org_affiliates_org ON organization_affiliates(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_affiliates_code ON organization_affiliates(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_org_affiliates_email ON organization_affiliates(organization_id, email);
CREATE INDEX IF NOT EXISTS idx_checkout_affiliate_links_checkout ON checkout_affiliate_links(checkout_id);
CREATE INDEX IF NOT EXISTS idx_checkout_affiliate_links_affiliate ON checkout_affiliate_links(affiliate_id);

-- 4. Habilitar RLS
ALTER TABLE public.organization_affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_affiliate_links ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para organization_affiliates
CREATE POLICY "Org admins can manage affiliates"
  ON organization_affiliates FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Affiliates can view own record"
  ON organization_affiliates FOR SELECT
  USING (user_id = auth.uid());

-- 6. Políticas RLS para checkout_affiliate_links
CREATE POLICY "Org admins can manage checkout affiliates"
  ON checkout_affiliate_links FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- 7. Trigger para updated_at
CREATE TRIGGER update_org_affiliates_updated_at
  BEFORE UPDATE ON organization_affiliates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. Função para gerar código de afiliado único
CREATE OR REPLACE FUNCTION generate_affiliate_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.affiliate_code IS NULL OR NEW.affiliate_code = '' THEN
    NEW.affiliate_code := 'AFF' || UPPER(SUBSTR(MD5(gen_random_uuid()::text), 1, 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER auto_generate_affiliate_code
  BEFORE INSERT ON organization_affiliates
  FOR EACH ROW
  EXECUTE FUNCTION generate_affiliate_code();

-- 9. Habilitar realtime para sincronização
ALTER PUBLICATION supabase_realtime ADD TABLE organization_affiliates;
ALTER PUBLICATION supabase_realtime ADD TABLE checkout_affiliate_links;