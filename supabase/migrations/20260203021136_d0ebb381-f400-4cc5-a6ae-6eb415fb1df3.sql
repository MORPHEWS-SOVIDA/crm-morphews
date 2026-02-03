-- =============================================
-- Voice AI Agents - Complete Feature Setup
-- =============================================

-- 1. Add permission columns for Voice AI to user_permissions table
ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS voice_ai_view boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS voice_ai_manage boolean DEFAULT false;

-- 2. Insert feature key for Voice AI into plan_features for ALL existing plans
INSERT INTO public.plan_features (plan_id, feature_key, is_enabled)
SELECT 
  sp.id as plan_id,
  'voice_ai_calls' as feature_key,
  false as is_enabled -- Disabled by default, enable per plan
FROM subscription_plans sp
WHERE NOT EXISTS (
  SELECT 1 FROM plan_features pf 
  WHERE pf.plan_id = sp.id AND pf.feature_key = 'voice_ai_calls'
)
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- 3. Insert AI action costs for Voice AI calls
INSERT INTO public.ai_action_costs (
  action_key, 
  action_name, 
  base_energy_cost, 
  description, 
  is_active,
  is_fixed_cost
) VALUES 
  ('voice_ai_call_minute', 'Voice AI - Minuto de Ligação', 100, 'Consumo de energia por minuto de chamada com IA (conversação WebRTC)', true, false),
  ('voice_ai_call_initiate', 'Voice AI - Iniciar Ligação', 50, 'Custo fixo para iniciar uma ligação de voz IA', true, true),
  ('voice_ai_transcription', 'Voice AI - Transcrição de Chamada', 30, 'Transcrição automática da ligação após encerrar', true, true),
  ('voice_ai_sentiment', 'Voice AI - Análise de Sentimento', 20, 'Análise de sentimento e outcome da chamada', true, true)
ON CONFLICT (action_key) DO UPDATE SET
  action_name = EXCLUDED.action_name,
  base_energy_cost = EXCLUDED.base_energy_cost,
  description = EXCLUDED.description;

-- 4. Add energy_consumed column to voice_ai_calls if not exists
ALTER TABLE public.voice_ai_calls 
ADD COLUMN IF NOT EXISTS energy_consumed integer DEFAULT 0;

-- 5. Add agent_id column to voice_ai_agents for ElevenLabs agent configuration
ALTER TABLE public.voice_ai_agents 
ADD COLUMN IF NOT EXISTS elevenlabs_agent_id text,
ADD COLUMN IF NOT EXISTS voice_id text,
ADD COLUMN IF NOT EXISTS voice_name text,
ADD COLUMN IF NOT EXISTS welcome_message text,
ADD COLUMN IF NOT EXISTS system_prompt text;

-- 6. Create RLS policies for voice_ai tables for regular tenants

-- voice_ai_agents: Tenants can manage their own agents
DROP POLICY IF EXISTS "voice_ai_agents_org_access" ON public.voice_ai_agents;
CREATE POLICY "voice_ai_agents_org_access" ON public.voice_ai_agents
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- voice_ai_calls: Tenants can view/manage their own calls  
DROP POLICY IF EXISTS "voice_ai_calls_org_access" ON public.voice_ai_calls;
CREATE POLICY "voice_ai_calls_org_access" ON public.voice_ai_calls
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- voice_ai_campaigns: Tenants can manage their own campaigns
DROP POLICY IF EXISTS "voice_ai_campaigns_org_access" ON public.voice_ai_campaigns;
CREATE POLICY "voice_ai_campaigns_org_access" ON public.voice_ai_campaigns
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- 7. Enable RLS on all voice tables
ALTER TABLE public.voice_ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_ai_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_ai_campaigns ENABLE ROW LEVEL SECURITY;

-- 8. Grant permissions for owners/admins to manage voice_ai by adding to defaults
-- (This will be applied when new users are created or defaults are reset)
COMMENT ON COLUMN public.user_permissions.voice_ai_view IS 'Ver módulo Voice AI e histórico de chamadas';
COMMENT ON COLUMN public.user_permissions.voice_ai_manage IS 'Configurar agentes e iniciar campanhas Voice AI';