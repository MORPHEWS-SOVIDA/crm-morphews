-- Tabela para configuração de integração com Correios por tenant
CREATE TABLE public.correios_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  
  -- Credenciais de autenticação (criptografadas)
  id_correios TEXT, -- ID Correios (usuário)
  codigo_acesso_encrypted TEXT, -- Senha de componente (criptografada)
  contrato TEXT, -- Número do contrato
  cartao_postagem TEXT, -- Cartão de postagem
  
  -- Dados do remetente padrão
  sender_name TEXT,
  sender_cpf_cnpj TEXT,
  sender_street TEXT,
  sender_number TEXT,
  sender_complement TEXT,
  sender_neighborhood TEXT,
  sender_city TEXT,
  sender_state TEXT,
  sender_cep TEXT,
  sender_phone TEXT,
  sender_email TEXT,
  
  -- Configurações de serviço padrão
  default_service_code TEXT DEFAULT '03298', -- PAC por padrão
  default_package_type TEXT DEFAULT 'caixa', -- caixa, envelope, cilindro
  default_weight_grams INTEGER DEFAULT 500,
  default_height_cm INTEGER DEFAULT 10,
  default_width_cm INTEGER DEFAULT 15,
  default_length_cm INTEGER DEFAULT 20,
  
  -- Ambiente
  ambiente TEXT NOT NULL DEFAULT 'HOMOLOGACAO', -- PRODUCAO ou HOMOLOGACAO
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT correios_config_org_unique UNIQUE (organization_id)
);

-- Tabela para histórico de etiquetas geradas
CREATE TABLE public.correios_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  
  -- Dados da etiqueta
  tracking_code TEXT NOT NULL, -- Código de rastreio
  service_code TEXT NOT NULL, -- Ex: 03298 (PAC), 03220 (SEDEX)
  service_name TEXT,
  
  -- Dados do destinatário (snapshot)
  recipient_name TEXT NOT NULL,
  recipient_cpf_cnpj TEXT,
  recipient_street TEXT,
  recipient_number TEXT,
  recipient_complement TEXT,
  recipient_neighborhood TEXT,
  recipient_city TEXT,
  recipient_state TEXT,
  recipient_cep TEXT NOT NULL,
  recipient_phone TEXT,
  
  -- Dados do objeto
  weight_grams INTEGER,
  height_cm INTEGER,
  width_cm INTEGER,
  length_cm INTEGER,
  declared_value_cents INTEGER,
  
  -- Arquivos
  label_pdf_url TEXT, -- URL do PDF da etiqueta
  declaration_pdf_url TEXT, -- URL da declaração de conteúdo
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, generated, posted, cancelled
  correios_prepostagem_id TEXT, -- ID retornado pela API
  
  -- Metadados
  api_response JSONB, -- Resposta completa da API para debug
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  posted_at TIMESTAMP WITH TIME ZONE,
  
  created_by UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX idx_correios_labels_org ON public.correios_labels(organization_id);
CREATE INDEX idx_correios_labels_sale ON public.correios_labels(sale_id);
CREATE INDEX idx_correios_labels_tracking ON public.correios_labels(tracking_code);
CREATE INDEX idx_correios_labels_status ON public.correios_labels(status);
CREATE INDEX idx_correios_labels_created ON public.correios_labels(created_at DESC);

-- Enable RLS
ALTER TABLE public.correios_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correios_labels ENABLE ROW LEVEL SECURITY;

-- Função para verificar admin/owner
CREATE OR REPLACE FUNCTION public.is_org_admin_or_owner(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  )
$$;

-- RLS para correios_config (apenas admin/owner pode gerenciar)
CREATE POLICY "Org members can view correios config"
  ON public.correios_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = correios_config.organization_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can manage correios config"
  ON public.correios_config FOR ALL
  USING (public.is_org_admin_or_owner(organization_id))
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

-- RLS para correios_labels (membros podem ver, criar com permissão)
CREATE POLICY "Org members can view correios labels"
  ON public.correios_labels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = correios_labels.organization_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can create correios labels"
  ON public.correios_labels FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = correios_labels.organization_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can update correios labels"
  ON public.correios_labels FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = correios_labels.organization_id
        AND user_id = auth.uid()
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_correios_config_updated_at
  BEFORE UPDATE ON public.correios_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_correios_labels_updated_at
  BEFORE UPDATE ON public.correios_labels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();