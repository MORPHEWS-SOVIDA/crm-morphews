-- Adicionar configurações globais de WhatsApp IA na organização
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS whatsapp_ai_memory_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_ai_learning_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_ai_seller_briefing_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_document_reading_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_document_auto_reply_message text DEFAULT 'Nossa IA recebeu seu arquivo e interpretou assim:';

-- Remover as colunas antigas das instâncias (mover para configuração global)
ALTER TABLE public.whatsapp_instances
DROP COLUMN IF EXISTS ai_memory_enabled,
DROP COLUMN IF EXISTS ai_learning_enabled,
DROP COLUMN IF EXISTS ai_seller_briefing_enabled;

-- Tabela para armazenar documentos processados e suas interpretações
CREATE TABLE IF NOT EXISTS public.whatsapp_document_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  
  -- Documento original
  document_url text NOT NULL,
  document_type text NOT NULL DEFAULT 'pdf',
  
  -- Interpretação
  raw_text text,
  summary text,
  structured_data jsonb,
  
  -- Para receitas médicas
  medications jsonb,
  prescriber_info jsonb,
  
  -- Status
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  
  -- Ação tomada
  auto_replied boolean DEFAULT false,
  seller_notified boolean DEFAULT false,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- RLS
ALTER TABLE public.whatsapp_document_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view document readings from their organization"
ON public.whatsapp_document_readings
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage document readings"
ON public.whatsapp_document_readings
FOR ALL
USING (true)
WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_document_readings_org ON public.whatsapp_document_readings(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_readings_conversation ON public.whatsapp_document_readings(conversation_id);
CREATE INDEX IF NOT EXISTS idx_document_readings_status ON public.whatsapp_document_readings(status);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_document_readings;