-- =====================================================
-- AUTO-CLOSE E PESQUISA DE SATISFAÇÃO (NPS) - WHATSAPP
-- =====================================================

-- 1) Adicionar novos campos na tabela whatsapp_instances para configuração avançada de auto-close
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS auto_close_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_close_bot_minutes integer DEFAULT 60,
ADD COLUMN IF NOT EXISTS auto_close_assigned_minutes integer DEFAULT 480,
ADD COLUMN IF NOT EXISTS auto_close_only_business_hours boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_close_business_start time DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS auto_close_business_end time DEFAULT '20:00',
ADD COLUMN IF NOT EXISTS auto_close_send_message boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_close_message_template text DEFAULT 'Olá! Como não recebemos resposta, estamos encerrando este atendimento. Caso precise, é só nos chamar novamente! 😊',
ADD COLUMN IF NOT EXISTS satisfaction_survey_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS satisfaction_survey_message text DEFAULT 'De 0 a 10, como você avalia este atendimento? Sua resposta nos ajuda a melhorar! 🙏';

-- 2) Criar tabela para armazenar respostas de satisfação
CREATE TABLE IF NOT EXISTS public.conversation_satisfaction_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  assigned_user_id uuid REFERENCES public.profiles(user_id),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  rating smallint CHECK (rating >= 0 AND rating <= 10),
  raw_response text,
  closed_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  is_pending_review boolean DEFAULT false,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(user_id),
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_satisfaction_org ON public.conversation_satisfaction_ratings(organization_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_instance ON public.conversation_satisfaction_ratings(instance_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_user ON public.conversation_satisfaction_ratings(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_rating ON public.conversation_satisfaction_ratings(rating);
CREATE INDEX IF NOT EXISTS idx_satisfaction_pending ON public.conversation_satisfaction_ratings(is_pending_review) WHERE is_pending_review = true;
CREATE INDEX IF NOT EXISTS idx_satisfaction_closed_at ON public.conversation_satisfaction_ratings(closed_at);

-- 3) Adicionar campo na conversa para marcar se aguarda resposta NPS
ALTER TABLE public.whatsapp_conversations
ADD COLUMN IF NOT EXISTS awaiting_satisfaction_response boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS satisfaction_sent_at timestamptz;

-- 4) Enable RLS
ALTER TABLE public.conversation_satisfaction_ratings ENABLE ROW LEVEL SECURITY;

-- 5) RLS Policies - leitura baseada na organização
CREATE POLICY "Users can view satisfaction ratings from their org"
  ON public.conversation_satisfaction_ratings
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Inserção via service role (edge function)
CREATE POLICY "Service role can insert satisfaction ratings"
  ON public.conversation_satisfaction_ratings
  FOR INSERT
  WITH CHECK (true);

-- Atualização para review
CREATE POLICY "Users can update ratings in their org"
  ON public.conversation_satisfaction_ratings
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- 6) Adicionar publication realtime para ratings
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_satisfaction_ratings;

-- 7) Função para calcular métricas NPS por instância
CREATE OR REPLACE FUNCTION public.get_instance_nps_metrics(
  p_instance_id uuid,
  p_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  total_responses int;
  promoters int;
  detractors int;
  passives int;
  nps_score numeric;
  avg_rating numeric;
  pending_reviews int;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE rating IS NOT NULL),
    COUNT(*) FILTER (WHERE rating >= 9),
    COUNT(*) FILTER (WHERE rating <= 6),
    COUNT(*) FILTER (WHERE rating >= 7 AND rating <= 8),
    COALESCE(AVG(rating) FILTER (WHERE rating IS NOT NULL), 0),
    COUNT(*) FILTER (WHERE is_pending_review = true)
  INTO total_responses, promoters, detractors, passives, avg_rating, pending_reviews
  FROM public.conversation_satisfaction_ratings
  WHERE instance_id = p_instance_id
    AND closed_at >= now() - (p_days || ' days')::interval;

  IF total_responses > 0 THEN
    nps_score := ((promoters::numeric / total_responses) - (detractors::numeric / total_responses)) * 100;
  ELSE
    nps_score := 0;
  END IF;

  result := jsonb_build_object(
    'total_responses', total_responses,
    'promoters', promoters,
    'detractors', detractors,
    'passives', passives,
    'nps_score', ROUND(nps_score, 1),
    'avg_rating', ROUND(avg_rating, 2),
    'pending_reviews', pending_reviews
  );

  RETURN result;
END;
$$;

-- 8) Função para obter métricas NPS agregadas por organização
CREATE OR REPLACE FUNCTION public.get_org_nps_metrics(
  p_organization_id uuid,
  p_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_responses', COUNT(*) FILTER (WHERE rating IS NOT NULL),
    'promoters', COUNT(*) FILTER (WHERE rating >= 9),
    'detractors', COUNT(*) FILTER (WHERE rating <= 6),
    'passives', COUNT(*) FILTER (WHERE rating >= 7 AND rating <= 8),
    'nps_score', ROUND(
      CASE 
        WHEN COUNT(*) FILTER (WHERE rating IS NOT NULL) > 0 THEN
          ((COUNT(*) FILTER (WHERE rating >= 9)::numeric / NULLIF(COUNT(*) FILTER (WHERE rating IS NOT NULL), 0)) 
           - (COUNT(*) FILTER (WHERE rating <= 6)::numeric / NULLIF(COUNT(*) FILTER (WHERE rating IS NOT NULL), 0))) * 100
        ELSE 0
      END, 1
    ),
    'avg_rating', ROUND(COALESCE(AVG(rating) FILTER (WHERE rating IS NOT NULL), 0), 2),
    'pending_reviews', COUNT(*) FILTER (WHERE is_pending_review = true),
    'by_user', (
      SELECT jsonb_agg(user_stats)
      FROM (
        SELECT jsonb_build_object(
          'user_id', assigned_user_id,
          'total', COUNT(*),
          'avg_rating', ROUND(COALESCE(AVG(rating), 0), 2),
          'detractors', COUNT(*) FILTER (WHERE rating <= 6)
        ) as user_stats
        FROM public.conversation_satisfaction_ratings
        WHERE organization_id = p_organization_id
          AND closed_at >= now() - (p_days || ' days')::interval
          AND assigned_user_id IS NOT NULL
        GROUP BY assigned_user_id
      ) sub
    )
  )
  INTO result
  FROM public.conversation_satisfaction_ratings
  WHERE organization_id = p_organization_id
    AND closed_at >= now() - (p_days || ' days')::interval;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;