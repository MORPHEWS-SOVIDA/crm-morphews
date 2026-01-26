-- Permitir agendar time/roteador sem bot_id
ALTER TABLE public.instance_bot_schedules
  ALTER COLUMN bot_id DROP NOT NULL;

-- Garantir que exatamente UMA entidade está definida (bot OU time OU roteador)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'instance_bot_schedules'
      AND c.conname = 'instance_bot_schedules_one_entity_chk'
  ) THEN
    ALTER TABLE public.instance_bot_schedules
      ADD CONSTRAINT instance_bot_schedules_one_entity_chk
      CHECK (
        ((bot_id IS NOT NULL)::int + (team_id IS NOT NULL)::int + (keyword_router_id IS NOT NULL)::int) = 1
      );
  END IF;
END $$;

-- Restaurar unicidade por instância para cada tipo (equivalente ao constraint antigo, mas compatível com times/roteadores)
CREATE UNIQUE INDEX IF NOT EXISTS uq_instance_bot_schedules_instance_bot
  ON public.instance_bot_schedules(instance_id, bot_id)
  WHERE bot_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_instance_bot_schedules_instance_team
  ON public.instance_bot_schedules(instance_id, team_id)
  WHERE team_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_instance_bot_schedules_instance_keyword_router
  ON public.instance_bot_schedules(instance_id, keyword_router_id)
  WHERE keyword_router_id IS NOT NULL;