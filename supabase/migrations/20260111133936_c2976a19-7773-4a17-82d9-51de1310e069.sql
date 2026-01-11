
-- =============================================================================
-- FASE 1: INFRAESTRUTURA DE ROBÔS IA E SISTEMA DE ENERGIA
-- =============================================================================

-- 1. Tabela de Energia por Organização
CREATE TABLE IF NOT EXISTS public.organization_energy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  included_energy integer NOT NULL DEFAULT 10000,
  bonus_energy integer NOT NULL DEFAULT 0,
  used_energy integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- 2. Tabela de Robôs IA
CREATE TABLE IF NOT EXISTS public.ai_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  avatar_url text,
  gender varchar(20) NOT NULL DEFAULT 'neutral',
  brazilian_state varchar(2),
  age_range varchar(20) NOT NULL DEFAULT '26-35',
  service_type varchar(50) NOT NULL DEFAULT 'sales',
  response_length varchar(20) NOT NULL DEFAULT 'medium',
  company_differential text,
  personality_description text,
  regional_expressions text[],
  system_prompt text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  working_hours_start time DEFAULT '08:00',
  working_hours_end time DEFAULT '18:00',
  working_days integer[] DEFAULT ARRAY[1,2,3,4,5],
  out_of_hours_message text DEFAULT 'Obrigado pelo contato! Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Retornaremos assim que possível.',
  transfer_keywords text[] DEFAULT ARRAY['falar com atendente', 'falar com humano', 'atendente humano', 'pessoa real'],
  max_messages_before_transfer integer DEFAULT 10,
  transfer_on_confusion boolean DEFAULT true,
  welcome_message text DEFAULT 'Olá! Sou o assistente virtual. Como posso ajudá-lo hoje?',
  transfer_message text DEFAULT 'Vou transferir você para um de nossos atendentes. Um momento, por favor.',
  max_energy_per_message integer DEFAULT 50,
  max_energy_per_conversation integer DEFAULT 500,
  initial_qualification_enabled boolean DEFAULT false,
  initial_questions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Base de Conhecimento do Robô
CREATE TABLE IF NOT EXISTS public.ai_bot_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.ai_bots(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  knowledge_type varchar(20) NOT NULL,
  title varchar(200),
  question text,
  answer text,
  content_url text,
  is_active boolean NOT NULL DEFAULT true,
  priority integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Produtos Vinculados ao Robô
CREATE TABLE IF NOT EXISTS public.ai_bot_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.ai_bots(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bot_id, product_id)
);

-- 5. Histórico de Consumo de Energia
CREATE TABLE IF NOT EXISTS public.energy_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bot_id uuid REFERENCES public.ai_bots(id) ON DELETE SET NULL,
  conversation_id uuid,
  action_type varchar(50) NOT NULL,
  energy_consumed integer NOT NULL,
  tokens_used integer,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Vinculação Robô ↔ Instância WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_instance_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  bot_id uuid NOT NULL REFERENCES public.ai_bots(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  priority integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(instance_id, bot_id)
);

-- 7. Adicionar active_bot_id na instância
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS active_bot_id uuid REFERENCES public.ai_bots(id) ON DELETE SET NULL;

-- 8. Adicionar campos de robô nas conversas
ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS handling_bot_id uuid REFERENCES public.ai_bots(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS bot_started_at timestamptz,
ADD COLUMN IF NOT EXISTS bot_messages_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS bot_energy_consumed integer DEFAULT 0;

-- 9. Atualizar constraint de status para incluir 'with_bot'
ALTER TABLE public.whatsapp_conversations DROP CONSTRAINT IF EXISTS whatsapp_conversations_status_check;
ALTER TABLE public.whatsapp_conversations 
ADD CONSTRAINT whatsapp_conversations_status_check 
CHECK (status = ANY (ARRAY['with_bot'::text, 'pending'::text, 'autodistributed'::text, 'assigned'::text, 'closed'::text]));

-- 10. Índices para performance
CREATE INDEX IF NOT EXISTS idx_organization_energy_org ON public.organization_energy(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_bots_org ON public.ai_bots(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_bots_active ON public.ai_bots(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_bot_knowledge_bot ON public.ai_bot_knowledge(bot_id);
CREATE INDEX IF NOT EXISTS idx_ai_bot_products_bot ON public.ai_bot_products(bot_id);
CREATE INDEX IF NOT EXISTS idx_energy_usage_org ON public.energy_usage_log(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instance_bots_instance ON public.whatsapp_instance_bots(instance_id);
CREATE INDEX IF NOT EXISTS idx_conversations_with_bot ON public.whatsapp_conversations(instance_id, status) WHERE status = 'with_bot';

-- 11. RLS Policies
ALTER TABLE public.organization_energy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_bot_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_bot_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.energy_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_instance_bots ENABLE ROW LEVEL SECURITY;

-- Policies usando organization_members para verificar role
CREATE POLICY "Users can view their org energy" ON public.organization_energy
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage org energy" ON public.organization_energy
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Users can view their org bots" ON public.ai_bots
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage bots" ON public.ai_bots
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Users can view bot knowledge" ON public.ai_bot_knowledge
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage bot knowledge" ON public.ai_bot_knowledge
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Users can view bot products" ON public.ai_bot_products
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage bot products" ON public.ai_bot_products
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Users can view their org energy log" ON public.energy_usage_log
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "System can insert energy log" ON public.energy_usage_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view instance bots" ON public.whatsapp_instance_bots
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage instance bots" ON public.whatsapp_instance_bots
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- 12. Função para consumir energia
CREATE OR REPLACE FUNCTION public.consume_energy(
  p_organization_id uuid,
  p_bot_id uuid,
  p_conversation_id uuid,
  p_action_type text,
  p_energy_amount integer,
  p_tokens_used integer DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available_energy integer;
BEGIN
  SELECT (included_energy + bonus_energy - used_energy)
  INTO v_available_energy
  FROM organization_energy
  WHERE organization_id = p_organization_id;
  
  IF v_available_energy IS NULL THEN
    INSERT INTO organization_energy (organization_id, included_energy, bonus_energy, used_energy)
    VALUES (p_organization_id, 10000, 0, 0)
    ON CONFLICT (organization_id) DO NOTHING;
    v_available_energy := 10000;
  END IF;
  
  IF v_available_energy < p_energy_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Energia insuficiente',
      'available_energy', v_available_energy,
      'required_energy', p_energy_amount
    );
  END IF;
  
  UPDATE organization_energy
  SET used_energy = used_energy + p_energy_amount, updated_at = now()
  WHERE organization_id = p_organization_id;
  
  INSERT INTO energy_usage_log (organization_id, bot_id, conversation_id, action_type, energy_consumed, tokens_used, details)
  VALUES (p_organization_id, p_bot_id, p_conversation_id, p_action_type, p_energy_amount, p_tokens_used, p_details);
  
  IF p_conversation_id IS NOT NULL THEN
    UPDATE whatsapp_conversations
    SET bot_energy_consumed = COALESCE(bot_energy_consumed, 0) + p_energy_amount,
        bot_messages_count = CASE WHEN p_action_type = 'text_response' THEN COALESCE(bot_messages_count, 0) + 1 ELSE bot_messages_count END
    WHERE id = p_conversation_id;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'energy_consumed', p_energy_amount, 'remaining_energy', v_available_energy - p_energy_amount);
END;
$$;

-- 13. Função para verificar energia disponível
CREATE OR REPLACE FUNCTION public.get_available_energy(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_energy RECORD;
BEGIN
  SELECT included_energy, bonus_energy, used_energy, (included_energy + bonus_energy - used_energy) as available, reset_at
  INTO v_energy FROM organization_energy WHERE organization_id = p_organization_id;
  
  IF v_energy IS NULL THEN
    INSERT INTO organization_energy (organization_id) VALUES (p_organization_id)
    RETURNING included_energy, bonus_energy, used_energy, (included_energy + bonus_energy - used_energy) as available, reset_at INTO v_energy;
  END IF;
  
  RETURN jsonb_build_object('included_energy', v_energy.included_energy, 'bonus_energy', v_energy.bonus_energy, 'used_energy', v_energy.used_energy, 'available_energy', v_energy.available, 'reset_at', v_energy.reset_at);
END;
$$;

-- 14. Função para iniciar atendimento com robô
CREATE OR REPLACE FUNCTION public.start_bot_handling(p_conversation_id uuid, p_bot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE whatsapp_conversations
  SET status = 'with_bot', handling_bot_id = p_bot_id, bot_started_at = now(), bot_messages_count = 0, bot_energy_consumed = 0, updated_at = now()
  WHERE id = p_conversation_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 15. Função para transferir do robô para humano
CREATE OR REPLACE FUNCTION public.transfer_from_bot_to_human(p_conversation_id uuid, p_user_id uuid DEFAULT NULL, p_reason text DEFAULT 'Transferido manualmente')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance_id uuid;
  v_org_id uuid;
  v_distribution_mode text;
  v_next_user uuid;
BEGIN
  SELECT c.instance_id, c.organization_id, i.distribution_mode
  INTO v_instance_id, v_org_id, v_distribution_mode
  FROM whatsapp_conversations c
  JOIN whatsapp_instances i ON c.instance_id = i.id
  WHERE c.id = p_conversation_id;
  
  IF p_user_id IS NOT NULL THEN
    UPDATE whatsapp_conversations
    SET status = 'assigned', assigned_user_id = p_user_id, assigned_at = now(), handling_bot_id = NULL, updated_at = now()
    WHERE id = p_conversation_id;
    
    INSERT INTO whatsapp_conversation_assignments (conversation_id, organization_id, to_user_id, action, notes)
    VALUES (p_conversation_id, v_org_id, p_user_id, 'bot_transfer', p_reason);
    
    RETURN jsonb_build_object('success', true, 'status', 'assigned', 'user_id', p_user_id);
  END IF;
  
  IF v_distribution_mode = 'auto' THEN
    v_next_user := get_next_available_user_for_distribution(v_instance_id, v_org_id);
    
    IF v_next_user IS NOT NULL THEN
      UPDATE whatsapp_conversations
      SET status = 'autodistributed', designated_user_id = v_next_user, designated_at = now(), handling_bot_id = NULL, updated_at = now()
      WHERE id = p_conversation_id;
      
      INSERT INTO whatsapp_conversation_assignments (conversation_id, organization_id, to_user_id, action, notes)
      VALUES (p_conversation_id, v_org_id, v_next_user, 'bot_transfer', p_reason);
      
      RETURN jsonb_build_object('success', true, 'status', 'autodistributed', 'designated_user_id', v_next_user);
    END IF;
  END IF;
  
  UPDATE whatsapp_conversations
  SET status = 'pending', handling_bot_id = NULL, updated_at = now()
  WHERE id = p_conversation_id;
  
  INSERT INTO whatsapp_conversation_assignments (conversation_id, organization_id, action, notes)
  VALUES (p_conversation_id, v_org_id, 'bot_transfer', p_reason);
  
  RETURN jsonb_build_object('success', true, 'status', 'pending');
END;
$$;

-- 16. Função para gerar system prompt
CREATE OR REPLACE FUNCTION public.generate_bot_system_prompt(
  p_gender text, p_state text, p_age_range text, p_service_type text,
  p_response_length text, p_company_differential text, p_personality_description text, p_regional_expressions text[]
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_prompt text;
  v_gender_text text;
  v_age_text text;
  v_service_text text;
  v_length_text text;
BEGIN
  v_gender_text := CASE p_gender WHEN 'male' THEN 'Você é um atendente masculino.' WHEN 'female' THEN 'Você é uma atendente feminina.' ELSE 'Você é um assistente virtual neutro.' END;
  v_age_text := CASE p_age_range WHEN '18-25' THEN 'Use linguagem jovem, informal, moderna. Pode usar emojis com moderação.' WHEN '26-35' THEN 'Use linguagem profissional mas acessível.' WHEN '36-50' THEN 'Use linguagem formal e objetiva.' WHEN '50+' THEN 'Use linguagem muito formal e tradicional.' ELSE 'Use linguagem profissional.' END;
  v_service_text := CASE p_service_type WHEN 'sales' THEN 'Seu objetivo é ajudar o cliente a conhecer produtos e realizar vendas.' WHEN 'support' THEN 'Seu objetivo é fornecer suporte técnico.' WHEN 'sac' THEN 'Seu objetivo é atender reclamações.' WHEN 'social_selling' THEN 'Seu objetivo é criar relacionamento.' WHEN 'qualification' THEN 'Seu objetivo é qualificar leads.' ELSE 'Seu objetivo é ajudar o cliente.' END;
  v_length_text := CASE p_response_length WHEN 'short' THEN 'Dê respostas curtas, máximo 50 palavras.' WHEN 'medium' THEN 'Dê respostas de 50-100 palavras.' WHEN 'detailed' THEN 'Dê respostas detalhadas.' ELSE 'Dê respostas apropriadas ao contexto.' END;
  
  v_prompt := v_gender_text || ' ' || v_age_text || ' ' || v_service_text || ' ' || v_length_text;
  
  IF p_state IS NOT NULL THEN v_prompt := v_prompt || ' Você atende clientes do estado ' || p_state || '.'; END IF;
  IF p_regional_expressions IS NOT NULL AND array_length(p_regional_expressions, 1) > 0 THEN v_prompt := v_prompt || ' Use expressões: ' || array_to_string(p_regional_expressions, ', ') || '.'; END IF;
  IF p_company_differential IS NOT NULL THEN v_prompt := v_prompt || ' Diferencial: ' || p_company_differential || '.'; END IF;
  IF p_personality_description IS NOT NULL THEN v_prompt := v_prompt || ' Personalidade: ' || p_personality_description || '.'; END IF;
  
  v_prompt := v_prompt || ' Sempre seja educado e prestativo. Se não souber, ofereça transferir para humano.';
  
  RETURN v_prompt;
END;
$$;

-- 17. Trigger para gerar system_prompt automaticamente
CREATE OR REPLACE FUNCTION public.trigger_generate_bot_prompt()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.system_prompt := generate_bot_system_prompt(NEW.gender, NEW.brazilian_state, NEW.age_range, NEW.service_type, NEW.response_length, NEW.company_differential, NEW.personality_description, NEW.regional_expressions);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_ai_bots_generate_prompt ON public.ai_bots;
CREATE TRIGGER trigger_ai_bots_generate_prompt
  BEFORE INSERT OR UPDATE ON public.ai_bots
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generate_bot_prompt();
