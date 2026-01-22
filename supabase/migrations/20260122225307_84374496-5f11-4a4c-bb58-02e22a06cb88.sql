-- Tabela para serviços de frete habilitados por organização
CREATE TABLE public.correios_enabled_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_code TEXT NOT NULL,
  service_name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, service_code)
);

-- RLS
ALTER TABLE public.correios_enabled_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view enabled services of their org"
  ON public.correios_enabled_services FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage enabled services of their org"
  ON public.correios_enabled_services FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

-- Cache de cotações para otimizar performance
CREATE TABLE public.correios_quote_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  origin_cep TEXT NOT NULL,
  destination_cep TEXT NOT NULL,
  weight_grams INTEGER NOT NULL,
  service_code TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  delivery_days INTEGER,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '12 hours')
);

-- Índices para busca eficiente no cache
CREATE INDEX idx_correios_cache_lookup ON public.correios_quote_cache (
  organization_id, origin_cep, destination_cep, weight_grams, service_code
);
CREATE INDEX idx_correios_cache_expiry ON public.correios_quote_cache (expires_at);

-- RLS para cache (apenas leitura interna, escrita via service role)
ALTER TABLE public.correios_quote_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cache of their org"
  ON public.correios_quote_cache FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

-- Trigger para atualizar updated_at
CREATE TRIGGER set_correios_services_updated_at
  BEFORE UPDATE ON public.correios_enabled_services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir serviços padrão (PAC e SEDEX) para organizações existentes que têm correios_config
INSERT INTO public.correios_enabled_services (organization_id, service_code, service_name, position)
SELECT 
  cc.organization_id,
  '03220',
  'SEDEX - Entrega expressa',
  1
FROM correios_config cc
ON CONFLICT DO NOTHING;

INSERT INTO public.correios_enabled_services (organization_id, service_code, service_name, position)
SELECT 
  cc.organization_id,
  '03298',
  'PAC - Entrega econômica',
  2
FROM correios_config cc
ON CONFLICT DO NOTHING;