-- ============================================================================
-- Voice AI Feature for AI Bots
-- ============================================================================

-- 1. Add voice columns to ai_bots table
ALTER TABLE public.ai_bots
ADD COLUMN IF NOT EXISTS voice_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS voice_id text DEFAULT 'JBFqnCBsd6RMkjVDRZzb',
ADD COLUMN IF NOT EXISTS voice_name text DEFAULT 'George',
ADD COLUMN IF NOT EXISTS audio_response_probability integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS voice_style text DEFAULT 'natural';

COMMENT ON COLUMN public.ai_bots.voice_enabled IS 'Whether this bot can respond with audio messages';
COMMENT ON COLUMN public.ai_bots.voice_id IS 'ElevenLabs voice ID for TTS';
COMMENT ON COLUMN public.ai_bots.voice_name IS 'Display name of the selected voice';
COMMENT ON COLUMN public.ai_bots.audio_response_probability IS 'Percentage chance (0-100) of responding with audio instead of text';
COMMENT ON COLUMN public.ai_bots.voice_style IS 'Voice style: natural, expressive, calm';

-- 2. Add feature flag for voice responses
-- Add to AVAILABLE_FEATURES in code: bot_voice_responses

-- 3. Add voice TTS action cost
INSERT INTO public.ai_action_costs (
  action_key,
  action_name,
  base_energy_cost,
  description,
  is_active,
  is_fixed_cost,
  estimated_real_cost_usd
) VALUES 
(
  'voice_tts_short',
  'Voz IA - Mensagem Curta (<50 chars)',
  15,
  'Geração de áudio curto via ElevenLabs TTS',
  true,
  true,
  0.001
),
(
  'voice_tts_medium',
  'Voz IA - Mensagem Média (50-200 chars)',
  40,
  'Geração de áudio médio via ElevenLabs TTS',
  true,
  true,
  0.003
),
(
  'voice_tts_long',
  'Voz IA - Mensagem Longa (>200 chars)',
  100,
  'Geração de áudio longo via ElevenLabs TTS',
  true,
  true,
  0.008
)
ON CONFLICT (action_key) DO UPDATE SET
  action_name = EXCLUDED.action_name,
  base_energy_cost = EXCLUDED.base_energy_cost,
  description = EXCLUDED.description,
  estimated_real_cost_usd = EXCLUDED.estimated_real_cost_usd;

-- 4. Create storage bucket for bot audio files
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('bot-audio', 'bot-audio', true, 5242880) -- 5MB limit
ON CONFLICT (id) DO NOTHING;

-- 5. Create storage policies for bot audio
CREATE POLICY "Bot audio is publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'bot-audio');

CREATE POLICY "Authenticated users can upload bot audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'bot-audio' AND auth.role() = 'authenticated');

CREATE POLICY "Service role can manage bot audio"
ON storage.objects FOR ALL
USING (bucket_id = 'bot-audio')
WITH CHECK (bucket_id = 'bot-audio');