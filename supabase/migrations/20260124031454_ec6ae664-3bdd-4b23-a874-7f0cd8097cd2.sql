-- Adicionar campos de condições contextuais avançadas na tabela bot_team_routes
ALTER TABLE public.bot_team_routes 
ADD COLUMN IF NOT EXISTS condition_type TEXT NOT NULL DEFAULT 'keyword',
ADD COLUMN IF NOT EXISTS crm_conditions JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sentiment_conditions TEXT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS time_conditions JSONB DEFAULT NULL;

-- Atualizar o route_type para condition_type (retrocompatibilidade)
UPDATE public.bot_team_routes 
SET condition_type = route_type 
WHERE condition_type = 'keyword';

-- Adicionar comentários explicativos
COMMENT ON COLUMN public.bot_team_routes.condition_type IS 'Tipo de condição: keyword, intent, crm_status, sentiment, time, combined';
COMMENT ON COLUMN public.bot_team_routes.crm_conditions IS 'Condições baseadas no CRM: {"has_purchase": true, "is_new_lead": false, "has_open_ticket": true}';
COMMENT ON COLUMN public.bot_team_routes.sentiment_conditions IS 'Array de sentimentos: ["angry", "frustrated", "complaint"]';
COMMENT ON COLUMN public.bot_team_routes.time_conditions IS 'Condições de horário: {"outside_business_hours": true, "days_of_week": [0,6]}';

-- Índice para consultas de condições
CREATE INDEX IF NOT EXISTS idx_bot_team_routes_condition_type ON public.bot_team_routes(condition_type);
CREATE INDEX IF NOT EXISTS idx_bot_team_routes_crm_conditions ON public.bot_team_routes USING gin(crm_conditions);

-- Adicionar campo para descrição amigável da rota
ALTER TABLE public.bot_team_routes
ADD COLUMN IF NOT EXISTS condition_label TEXT DEFAULT NULL;

COMMENT ON COLUMN public.bot_team_routes.condition_label IS 'Descrição amigável da condição para exibição na UI';