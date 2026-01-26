-- Adicionar colunas para suportar Times de Robôs e Roteadores por Palavra-chave
ALTER TABLE public.instance_bot_schedules 
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.bot_teams(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS keyword_router_id UUID REFERENCES public.keyword_bot_routers(id) ON DELETE CASCADE;

-- Remover a constraint de unicidade existente para permitir novos tipos
ALTER TABLE public.instance_bot_schedules 
  DROP CONSTRAINT IF EXISTS instance_bot_schedules_instance_id_bot_id_key;

-- Índices para busca eficiente
CREATE INDEX IF NOT EXISTS idx_instance_bot_schedules_team_id ON public.instance_bot_schedules(team_id);
CREATE INDEX IF NOT EXISTS idx_instance_bot_schedules_keyword_router_id ON public.instance_bot_schedules(keyword_router_id);