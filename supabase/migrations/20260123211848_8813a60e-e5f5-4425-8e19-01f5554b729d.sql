-- Tabela para configurar grupos de roteamento por primeira mensagem (keyword de entrada)
CREATE TABLE public.keyword_bot_routers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  fallback_bot_id UUID NOT NULL REFERENCES public.ai_bots(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para mapear palavras-chave → robô específico
CREATE TABLE public.keyword_bot_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  router_id UUID NOT NULL REFERENCES public.keyword_bot_routers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  keywords TEXT[] NOT NULL, -- array de palavras que ativam esse robô
  target_bot_id UUID NOT NULL REFERENCES public.ai_bots(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 0, -- maior prioridade = verificado primeiro
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar coluna na instância para referenciar o roteador por keyword
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS keyword_router_id UUID REFERENCES public.keyword_bot_routers(id) ON DELETE SET NULL;

-- Habilitar RLS
ALTER TABLE public.keyword_bot_routers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_bot_rules ENABLE ROW LEVEL SECURITY;

-- Políticas para keyword_bot_routers
CREATE POLICY "Users can view their org keyword routers" 
ON public.keyword_bot_routers FOR SELECT 
USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create keyword routers for their org" 
ON public.keyword_bot_routers FOR INSERT 
WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their org keyword routers" 
ON public.keyword_bot_routers FOR UPDATE 
USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their org keyword routers" 
ON public.keyword_bot_routers FOR DELETE 
USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Políticas para keyword_bot_rules
CREATE POLICY "Users can view their org keyword rules" 
ON public.keyword_bot_rules FOR SELECT 
USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create keyword rules for their org" 
ON public.keyword_bot_rules FOR INSERT 
WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their org keyword rules" 
ON public.keyword_bot_rules FOR UPDATE 
USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their org keyword rules" 
ON public.keyword_bot_rules FOR DELETE 
USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Índices para performance
CREATE INDEX idx_keyword_routers_org ON public.keyword_bot_routers(organization_id);
CREATE INDEX idx_keyword_rules_router ON public.keyword_bot_rules(router_id);
CREATE INDEX idx_keyword_rules_priority ON public.keyword_bot_rules(router_id, priority DESC);

-- Trigger para updated_at
CREATE TRIGGER update_keyword_bot_routers_updated_at
BEFORE UPDATE ON public.keyword_bot_routers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();