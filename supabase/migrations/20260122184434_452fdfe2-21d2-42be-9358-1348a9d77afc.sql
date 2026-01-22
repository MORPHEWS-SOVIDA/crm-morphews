-- =============================================================
-- Tabela de configuração de envio automático de notas fiscais
-- =============================================================

CREATE TABLE IF NOT EXISTS public.fiscal_auto_send_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Email config
  email_enabled BOOLEAN NOT NULL DEFAULT false,
  resend_api_key_encrypted TEXT,  -- Encrypted with pgcrypto
  email_from_name TEXT DEFAULT 'Sua Empresa',
  email_from_address TEXT,  -- Must be verified domain in Resend
  email_subject_template TEXT DEFAULT 'Nota Fiscal #{invoice_number} - {company_name}',
  email_body_template TEXT DEFAULT 'Prezado(a) {recipient_name},

Segue anexa a Nota Fiscal Eletrônica referente à sua compra.

Número da Nota: {invoice_number}
Valor Total: {total_value}
Data de Emissão: {emission_date}

Atenciosamente,
{company_name}',
  email_send_danfe BOOLEAN NOT NULL DEFAULT true,
  email_send_xml BOOLEAN NOT NULL DEFAULT true,
  
  -- WhatsApp config
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  whatsapp_instance_id UUID REFERENCES public.whatsapp_instances(id),
  whatsapp_message_template TEXT DEFAULT '🧾 Nota Fiscal #{invoice_number}

Olá {recipient_name}! Sua nota fiscal foi emitida com sucesso.

Valor: {total_value}
Data: {emission_date}

Acesse o PDF da DANFE:
{danfe_url}',
  whatsapp_send_danfe BOOLEAN NOT NULL DEFAULT true,
  whatsapp_send_xml BOOLEAN NOT NULL DEFAULT false,
  
  CONSTRAINT fiscal_auto_send_config_org_unique UNIQUE (organization_id)
);

-- Enable RLS
ALTER TABLE public.fiscal_auto_send_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their org fiscal auto send config"
ON public.fiscal_auto_send_config
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage their org fiscal auto send config"
ON public.fiscal_auto_send_config
FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_fiscal_auto_send_config_org 
ON public.fiscal_auto_send_config(organization_id);

-- Trigger for updated_at
CREATE TRIGGER update_fiscal_auto_send_config_updated_at
BEFORE UPDATE ON public.fiscal_auto_send_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();