-- Atualizar função para retornar qualquer tipo de agente configurado (bot, team ou router)
-- Retorna um objeto JSON com o tipo e ID do agente

CREATE OR REPLACE FUNCTION public.get_any_agent_for_instance(p_instance_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  -- Buscar o agendamento ativo de maior prioridade (independente do horário)
  -- Prioridade: bot_id > team_id > keyword_router_id
  SELECT 
    CASE 
      WHEN bot_id IS NOT NULL THEN jsonb_build_object('type', 'bot', 'id', bot_id)
      WHEN team_id IS NOT NULL THEN jsonb_build_object('type', 'team', 'id', team_id)
      WHEN keyword_router_id IS NOT NULL THEN jsonb_build_object('type', 'router', 'id', keyword_router_id)
      ELSE NULL
    END INTO v_result
  FROM public.instance_bot_schedules
  WHERE instance_id = p_instance_id
    AND is_active = true
    AND (bot_id IS NOT NULL OR team_id IS NOT NULL OR keyword_router_id IS NOT NULL)
  ORDER BY priority DESC, created_at ASC
  LIMIT 1;
  
  RETURN v_result;
END;
$function$;

-- Atualizar função para retornar agente ativo no horário atual
CREATE OR REPLACE FUNCTION public.get_active_agent_for_instance(
  p_instance_id uuid,
  p_current_time time without time zone DEFAULT ((now() at time zone 'America/Sao_Paulo')::time),
  p_current_day integer DEFAULT (EXTRACT(dow FROM (now() at time zone 'America/Sao_Paulo')::date))::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  SELECT 
    CASE 
      WHEN bot_id IS NOT NULL THEN jsonb_build_object('type', 'bot', 'id', bot_id)
      WHEN team_id IS NOT NULL THEN jsonb_build_object('type', 'team', 'id', team_id)
      WHEN keyword_router_id IS NOT NULL THEN jsonb_build_object('type', 'router', 'id', keyword_router_id)
      ELSE NULL
    END INTO v_result
  FROM public.instance_bot_schedules
  WHERE instance_id = p_instance_id
    AND is_active = true
    AND (bot_id IS NOT NULL OR team_id IS NOT NULL OR keyword_router_id IS NOT NULL)
    AND p_current_day = ANY(days_of_week)
    AND (
      -- Caso normal: start < end (ex: 08:00 - 18:00)
      (start_time <= end_time AND p_current_time >= start_time AND p_current_time <= end_time)
      OR
      -- Caso overnight: start > end (ex: 18:00 - 08:00)
      (start_time > end_time AND (p_current_time >= start_time OR p_current_time <= end_time))
    )
  ORDER BY priority DESC, created_at ASC
  LIMIT 1;

  RETURN v_result;
END;
$function$;

-- Manter as funções antigas para compatibilidade, mas atualizá-las para também considerar teams e routers
-- (retornando o bot inicial do time quando aplicável)

CREATE OR REPLACE FUNCTION public.get_any_bot_for_instance(p_instance_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bot_id uuid;
  v_team_id uuid;
BEGIN
  -- Primeiro, buscar bot direto
  SELECT bot_id INTO v_bot_id
  FROM public.instance_bot_schedules
  WHERE instance_id = p_instance_id
    AND is_active = true
    AND bot_id IS NOT NULL
  ORDER BY priority DESC, created_at ASC
  LIMIT 1;
  
  IF v_bot_id IS NOT NULL THEN
    RETURN v_bot_id;
  END IF;
  
  -- Se não há bot direto, buscar team e retornar o initial_bot_id do time
  SELECT team_id INTO v_team_id
  FROM public.instance_bot_schedules
  WHERE instance_id = p_instance_id
    AND is_active = true
    AND team_id IS NOT NULL
  ORDER BY priority DESC, created_at ASC
  LIMIT 1;
  
  IF v_team_id IS NOT NULL THEN
    SELECT initial_bot_id INTO v_bot_id
    FROM public.bot_teams
    WHERE id = v_team_id AND is_active = true;
    RETURN v_bot_id;
  END IF;
  
  -- Se não há team, verificar router (retornar o primeiro bot do router)
  -- Por ora, routers não têm um bot padrão, então retorna null
  
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_active_bot_for_instance(
  p_instance_id uuid,
  p_current_time time without time zone DEFAULT ((now() at time zone 'America/Sao_Paulo')::time),
  p_current_day integer DEFAULT (EXTRACT(dow FROM (now() at time zone 'America/Sao_Paulo')::date))::integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bot_id uuid;
  v_team_id uuid;
BEGIN
  -- Primeiro, buscar bot direto dentro do horário
  SELECT bot_id INTO v_bot_id
  FROM public.instance_bot_schedules
  WHERE instance_id = p_instance_id
    AND is_active = true
    AND bot_id IS NOT NULL
    AND p_current_day = ANY(days_of_week)
    AND (
      (start_time <= end_time AND p_current_time >= start_time AND p_current_time <= end_time)
      OR
      (start_time > end_time AND (p_current_time >= start_time OR p_current_time <= end_time))
    )
  ORDER BY priority DESC, created_at ASC
  LIMIT 1;
  
  IF v_bot_id IS NOT NULL THEN
    RETURN v_bot_id;
  END IF;
  
  -- Se não há bot direto, buscar team dentro do horário e retornar o initial_bot_id
  SELECT team_id INTO v_team_id
  FROM public.instance_bot_schedules
  WHERE instance_id = p_instance_id
    AND is_active = true
    AND team_id IS NOT NULL
    AND p_current_day = ANY(days_of_week)
    AND (
      (start_time <= end_time AND p_current_time >= start_time AND p_current_time <= end_time)
      OR
      (start_time > end_time AND (p_current_time >= start_time OR p_current_time <= end_time))
    )
  ORDER BY priority DESC, created_at ASC
  LIMIT 1;
  
  IF v_team_id IS NOT NULL THEN
    SELECT initial_bot_id INTO v_bot_id
    FROM public.bot_teams
    WHERE id = v_team_id AND is_active = true;
    RETURN v_bot_id;
  END IF;
  
  RETURN NULL;
END;
$function$;