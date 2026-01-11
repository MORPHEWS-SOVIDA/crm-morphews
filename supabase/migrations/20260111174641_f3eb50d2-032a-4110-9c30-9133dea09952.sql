-- Tabela para agendar múltiplos robôs por instância com horários específicos
CREATE TABLE public.instance_bot_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES public.ai_bots(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  days_of_week INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}', -- 0=Dom, 1=Seg, ..., 6=Sab
  start_time TIME NOT NULL DEFAULT '00:00',
  end_time TIME NOT NULL DEFAULT '23:59',
  priority INTEGER NOT NULL DEFAULT 0, -- Maior prioridade = preferência quando há overlap
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(instance_id, bot_id) -- Um robô só pode ter um agendamento por instância
);

-- Índices para performance
CREATE INDEX idx_instance_bot_schedules_instance ON public.instance_bot_schedules(instance_id);
CREATE INDEX idx_instance_bot_schedules_org ON public.instance_bot_schedules(organization_id);
CREATE INDEX idx_instance_bot_schedules_active ON public.instance_bot_schedules(instance_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.instance_bot_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view schedules in their organization"
ON public.instance_bot_schedules
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage schedules"
ON public.instance_bot_schedules
FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_instance_bot_schedules_updated_at
BEFORE UPDATE ON public.instance_bot_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para buscar o robô ativo baseado no horário/dia atual
CREATE OR REPLACE FUNCTION public.get_active_bot_for_instance(
  p_instance_id UUID,
  p_current_time TIME DEFAULT CURRENT_TIME,
  p_current_day INTEGER DEFAULT EXTRACT(DOW FROM CURRENT_DATE)::INTEGER
)
RETURNS UUID AS $$
DECLARE
  v_bot_id UUID;
BEGIN
  SELECT bot_id INTO v_bot_id
  FROM public.instance_bot_schedules
  WHERE instance_id = p_instance_id
    AND is_active = true
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
  
  RETURN v_bot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Migrar dados existentes: criar agendamentos para instâncias que já têm active_bot_id
INSERT INTO public.instance_bot_schedules (instance_id, bot_id, organization_id, days_of_week, start_time, end_time, priority)
SELECT 
  wi.id as instance_id,
  wi.active_bot_id as bot_id,
  wi.organization_id,
  COALESCE(ab.working_days, ARRAY[0,1,2,3,4,5,6]) as days_of_week,
  COALESCE(ab.working_hours_start, '00:00')::TIME as start_time,
  COALESCE(ab.working_hours_end, '23:59')::TIME as end_time,
  0 as priority
FROM public.whatsapp_instances wi
JOIN public.ai_bots ab ON ab.id = wi.active_bot_id
WHERE wi.active_bot_id IS NOT NULL;

-- Realtime para atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.instance_bot_schedules;