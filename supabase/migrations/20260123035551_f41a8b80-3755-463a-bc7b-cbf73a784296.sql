-- ============================================================
-- UTM TRACKING & ATTRIBUTION SYSTEM
-- Implementação superior ao Tintim com atribuição end-to-end
-- ============================================================

-- 1. Adicionar campos UTM na tabela leads (first-touch attribution)
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS utm_term TEXT,
ADD COLUMN IF NOT EXISTS utm_content TEXT,
ADD COLUMN IF NOT EXISTS src TEXT,
ADD COLUMN IF NOT EXISTS fbclid TEXT,
ADD COLUMN IF NOT EXISTS gclid TEXT,
ADD COLUMN IF NOT EXISTS ttclid TEXT,
ADD COLUMN IF NOT EXISTS first_touch_url TEXT,
ADD COLUMN IF NOT EXISTS first_touch_referrer TEXT,
ADD COLUMN IF NOT EXISTS first_touch_at TIMESTAMP WITH TIME ZONE;

-- 2. Adicionar campos UTM na tabela sales (conversion attribution)
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS utm_term TEXT,
ADD COLUMN IF NOT EXISTS utm_content TEXT,
ADD COLUMN IF NOT EXISTS src TEXT,
ADD COLUMN IF NOT EXISTS fbclid TEXT,
ADD COLUMN IF NOT EXISTS gclid TEXT,
ADD COLUMN IF NOT EXISTS ttclid TEXT,
ADD COLUMN IF NOT EXISTS checkout_url TEXT,
ADD COLUMN IF NOT EXISTS conversion_sent_to_meta BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS conversion_sent_to_google BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS conversion_sent_at TIMESTAMP WITH TIME ZONE;

-- 3. Criar tabela para log de conversões enviadas (auditoria)
CREATE TABLE IF NOT EXISTS public.conversion_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- 'Purchase', 'Lead', 'InitiateCheckout', 'AddToCart'
  platform TEXT NOT NULL, -- 'meta', 'google', 'tiktok'
  event_id TEXT, -- ID único do evento enviado
  payload JSONB, -- Payload enviado para a API
  response JSONB, -- Resposta da API
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- 4. Criar tabela para configurações de pixel/API por organização
CREATE TABLE IF NOT EXISTS public.tracking_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  -- Meta (Facebook) Conversions API
  meta_pixel_id TEXT,
  meta_access_token TEXT,
  meta_test_event_code TEXT,
  meta_enabled BOOLEAN DEFAULT FALSE,
  -- Google Ads Conversions API
  google_ads_customer_id TEXT,
  google_conversion_action_id TEXT,
  google_developer_token TEXT,
  google_enabled BOOLEAN DEFAULT FALSE,
  -- TikTok Events API
  tiktok_pixel_id TEXT,
  tiktok_access_token TEXT,
  tiktok_enabled BOOLEAN DEFAULT FALSE,
  -- Config
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. RLS para conversion_events
ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view conversion events"
ON public.conversion_events
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "System can insert conversion events"
ON public.conversion_events
FOR INSERT
WITH CHECK (true);

-- 6. RLS para tracking_config
ALTER TABLE public.tracking_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can manage tracking config"
ON public.tracking_config
FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- 7. Índices para performance de relatórios
CREATE INDEX IF NOT EXISTS idx_leads_utm_source ON public.leads(utm_source) WHERE utm_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_utm_campaign ON public.leads(utm_campaign) WHERE utm_campaign IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_fbclid ON public.leads(fbclid) WHERE fbclid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_gclid ON public.leads(gclid) WHERE gclid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_utm_source ON public.sales(utm_source) WHERE utm_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_utm_campaign ON public.sales(utm_campaign) WHERE utm_campaign IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_fbclid ON public.sales(fbclid) WHERE fbclid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_gclid ON public.sales(gclid) WHERE gclid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversion_events_org ON public.conversion_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_sale ON public.conversion_events(sale_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_platform ON public.conversion_events(platform);

-- 8. Trigger para updated_at em tracking_config
CREATE OR REPLACE TRIGGER update_tracking_config_updated_at
BEFORE UPDATE ON public.tracking_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();