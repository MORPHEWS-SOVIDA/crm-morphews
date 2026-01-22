-- =====================================================
-- Tabela de custos de modelos de IA
-- Permite calcular margem de 500% sobre custo real
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ai_model_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key text UNIQUE NOT NULL,
  model_name text NOT NULL,
  provider text NOT NULL DEFAULT 'lovable',
  
  -- Custos reais em USD (por 1M tokens)
  input_cost_per_million_tokens numeric(10,4) DEFAULT 0,
  output_cost_per_million_tokens numeric(10,4) DEFAULT 0,
  
  -- Custo fixo por chamada (para modelos de imagem/áudio)
  fixed_cost_usd numeric(10,6) DEFAULT 0,
  
  -- Energia cobrada do cliente por 1000 tokens (com margem 500%)
  energy_per_1000_tokens integer DEFAULT 10,
  
  -- Energia fixa por chamada (imagem, documento, áudio)
  energy_per_call integer DEFAULT 0,
  
  -- Multiplicador de margem (5 = 500%)
  margin_multiplier numeric(5,2) DEFAULT 5.00,
  
  -- Metadados
  is_active boolean DEFAULT true,
  supports_vision boolean DEFAULT false,
  supports_audio boolean DEFAULT false,
  max_context_tokens integer DEFAULT 128000,
  notes text,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Tabela para custos por tipo de ação
CREATE TABLE IF NOT EXISTS public.ai_action_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key text UNIQUE NOT NULL,
  action_name text NOT NULL,
  description text,
  
  base_energy_cost integer NOT NULL DEFAULT 10,
  default_model_key text,
  is_fixed_cost boolean DEFAULT true,
  estimated_real_cost_usd numeric(10,6) DEFAULT 0,
  
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS
ALTER TABLE public.ai_model_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_action_costs ENABLE ROW LEVEL SECURITY;

-- Políticas: leitura pública
DROP POLICY IF EXISTS "ai_model_costs_select" ON public.ai_model_costs;
CREATE POLICY "ai_model_costs_select" ON public.ai_model_costs FOR SELECT USING (true);

DROP POLICY IF EXISTS "ai_action_costs_select" ON public.ai_action_costs;
CREATE POLICY "ai_action_costs_select" ON public.ai_action_costs FOR SELECT USING (true);

-- Adicionar colunas ao log de energia
ALTER TABLE public.energy_usage_log 
ADD COLUMN IF NOT EXISTS model_used text,
ADD COLUMN IF NOT EXISTS real_cost_usd numeric(10,6);

-- =====================================================
-- Inserir modelos disponíveis com custos reais aproximados
-- =====================================================
INSERT INTO public.ai_model_costs (model_key, model_name, provider, input_cost_per_million_tokens, output_cost_per_million_tokens, fixed_cost_usd, energy_per_call, energy_per_1000_tokens, margin_multiplier, supports_vision, supports_audio, notes) VALUES
  -- Google Gemini
  ('google/gemini-3-flash-preview', 'Gemini 3 Flash Preview', 'google', 0.075, 0.30, 0, 0, 5, 5.00, true, true, 'Modelo padrão recomendado'),
  ('google/gemini-2.5-flash', 'Gemini 2.5 Flash', 'google', 0.075, 0.30, 0, 0, 5, 5.00, true, true, 'Bom custo-benefício'),
  ('google/gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite', 'google', 0.0375, 0.15, 0, 0, 3, 5.00, false, false, 'Tarefas simples'),
  ('google/gemini-2.5-pro', 'Gemini 2.5 Pro', 'google', 1.25, 5.00, 0, 0, 15, 5.00, true, true, 'Alta precisão'),
  ('google/gemini-3-pro-preview', 'Gemini 3 Pro Preview', 'google', 1.50, 6.00, 0, 0, 18, 5.00, true, true, 'Máxima qualidade'),
  ('google/gemini-2.5-flash-image', 'Gemini 2.5 Flash Image', 'google', 0, 0, 0.04, 200, 0, 5.00, false, false, 'Geração de imagens'),
  ('google/gemini-3-pro-image-preview', 'Gemini 3 Pro Image', 'google', 0, 0, 0.05, 250, 0, 5.00, false, false, 'Geração de imagens premium'),
  -- OpenAI
  ('openai/gpt-5', 'GPT-5', 'openai', 5.00, 15.00, 0, 0, 25, 5.00, true, false, 'Modelo premium OpenAI'),
  ('openai/gpt-5-mini', 'GPT-5 Mini', 'openai', 0.15, 0.60, 0, 0, 8, 5.00, true, false, 'Custo médio'),
  ('openai/gpt-5-nano', 'GPT-5 Nano', 'openai', 0.075, 0.30, 0, 0, 5, 5.00, false, false, 'Econômico'),
  ('openai/gpt-5.2', 'GPT-5.2', 'openai', 6.00, 18.00, 0, 0, 30, 5.00, true, true, 'Mais avançado OpenAI'),
  ('openai/whisper', 'OpenAI Whisper', 'openai', 0, 0, 0.006, 50, 0, 5.00, false, true, 'Transcrição de áudio'),
  ('openai/text-embedding-3-small', 'Text Embedding 3', 'openai', 0.02, 0, 0, 0, 1, 5.00, false, false, 'Embeddings RAG')
ON CONFLICT (model_key) DO UPDATE SET
  model_name = EXCLUDED.model_name,
  input_cost_per_million_tokens = EXCLUDED.input_cost_per_million_tokens,
  output_cost_per_million_tokens = EXCLUDED.output_cost_per_million_tokens,
  fixed_cost_usd = EXCLUDED.fixed_cost_usd,
  energy_per_call = EXCLUDED.energy_per_call,
  energy_per_1000_tokens = EXCLUDED.energy_per_1000_tokens,
  supports_vision = EXCLUDED.supports_vision,
  supports_audio = EXCLUDED.supports_audio,
  notes = EXCLUDED.notes,
  updated_at = now();

-- =====================================================
-- Inserir custos por tipo de ação
-- =====================================================
INSERT INTO public.ai_action_costs (action_key, action_name, description, base_energy_cost, default_model_key, is_fixed_cost, estimated_real_cost_usd) VALUES
  ('text_response', 'Resposta de Texto (Bot)', 'Resposta do chatbot via IA', 10, 'google/gemini-3-flash-preview', false, 0.0005),
  ('welcome_message', 'Mensagem de Boas-Vindas', 'Primeira mensagem do bot', 1, 'google/gemini-3-flash-preview', true, 0.0001),
  ('audio_transcription', 'Transcrição de Áudio (WhatsApp)', 'Transcrever áudio recebido', 50, 'openai/whisper', true, 0.006),
  ('call_transcription', 'Transcrição de Ligação', 'Transcrever gravação de call', 50, 'openai/whisper', true, 0.01),
  ('call_analysis', 'Análise de Qualidade de Call', 'Analisar transcrição de ligação', 20, 'google/gemini-2.5-flash', true, 0.002),
  ('image_analysis', 'Análise de Imagem', 'Interpretar foto enviada', 30, 'google/gemini-2.5-flash', true, 0.003),
  ('image_medical_turbo', 'Análise de Receita (Foto)', 'Modo turbo para fotos de receitas', 50, 'google/gemini-2.5-pro', true, 0.008),
  ('document_reading', 'Leitura de Documento (PDF)', 'Extrair dados de PDF', 100, 'google/gemini-2.5-flash', true, 0.01),
  ('document_medical_turbo', 'Leitura de Receita (PDF)', 'Modo turbo para receitas PDF', 150, 'google/gemini-2.5-pro', true, 0.02),
  ('lead_memory_analyze', 'Análise de Memória do Lead', 'Extrair preferências e contexto', 100, 'google/gemini-2.5-flash', true, 0.01),
  ('lead_intelligence', 'Sugestão IA (Follow-up)', 'Gerar sugestões inteligentes', 30, 'google/gemini-2.5-flash', true, 0.003),
  ('embedding_generation', 'Geração de Embeddings', 'Vetorizar texto para RAG', 5, 'openai/text-embedding-3-small', false, 0.0001),
  ('bot_avatar_generation', 'Geração de Avatar', 'Criar imagem de avatar IA', 200, 'google/gemini-2.5-flash-image', true, 0.04)
ON CONFLICT (action_key) DO UPDATE SET
  action_name = EXCLUDED.action_name,
  description = EXCLUDED.description,
  base_energy_cost = EXCLUDED.base_energy_cost,
  default_model_key = EXCLUDED.default_model_key,
  estimated_real_cost_usd = EXCLUDED.estimated_real_cost_usd,
  updated_at = now();

-- =====================================================
-- Função para calcular energia baseada em modelo
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_energy_cost(
  p_model_key text,
  p_input_tokens integer DEFAULT 0,
  p_output_tokens integer DEFAULT 0,
  p_action_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_model ai_model_costs%ROWTYPE;
  v_action ai_action_costs%ROWTYPE;
  v_energy_cost integer;
  v_real_cost_usd numeric;
BEGIN
  SELECT * INTO v_model FROM ai_model_costs WHERE model_key = p_model_key;
  
  IF v_model IS NULL THEN
    v_energy_cost := GREATEST(1, (p_input_tokens + p_output_tokens) / 100);
    RETURN jsonb_build_object('energy_cost', v_energy_cost, 'real_cost_usd', 0, 'model_found', false);
  END IF;
  
  IF p_action_key IS NOT NULL THEN
    SELECT * INTO v_action FROM ai_action_costs WHERE action_key = p_action_key;
    IF v_action IS NOT NULL AND v_action.is_fixed_cost THEN
      RETURN jsonb_build_object(
        'energy_cost', v_action.base_energy_cost,
        'real_cost_usd', v_action.estimated_real_cost_usd,
        'model_found', true,
        'is_fixed', true
      );
    END IF;
  END IF;
  
  v_real_cost_usd := (p_input_tokens::numeric / 1000000 * v_model.input_cost_per_million_tokens) +
                     (p_output_tokens::numeric / 1000000 * v_model.output_cost_per_million_tokens);
  
  v_energy_cost := GREATEST(1, CEIL((p_input_tokens + p_output_tokens)::numeric / 1000 * v_model.energy_per_1000_tokens));
  
  RETURN jsonb_build_object(
    'energy_cost', v_energy_cost,
    'real_cost_usd', ROUND(v_real_cost_usd, 6),
    'model_found', true,
    'is_fixed', false,
    'margin_multiplier', v_model.margin_multiplier
  );
END;
$$;

-- Comentários
COMMENT ON TABLE public.ai_model_costs IS 'Custos por modelo de IA - margem 500%';
COMMENT ON TABLE public.ai_action_costs IS 'Custos fixos por tipo de ação de IA';