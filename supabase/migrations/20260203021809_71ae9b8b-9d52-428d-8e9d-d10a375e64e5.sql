-- Atualizar custos de energia do Voice AI com margem correta (5x)
-- Custo real ElevenLabs: ~$0.10/min
-- Para 500% margem: precisamos cobrar $0.50/min em energia
-- Se $10 = 10.000 energia, então $0.50 = 500 energia por minuto

UPDATE public.ai_action_costs 
SET 
  base_energy_cost = 50,
  estimated_real_cost_usd = 0.01
WHERE action_key = 'voice_ai_call_initiate';

UPDATE public.ai_action_costs 
SET 
  base_energy_cost = 500,  -- Era 100, agora 500 para margem de 500%
  estimated_real_cost_usd = 0.10
WHERE action_key = 'voice_ai_call_minute';

UPDATE public.ai_action_costs 
SET 
  base_energy_cost = 30,
  estimated_real_cost_usd = 0.005
WHERE action_key = 'voice_ai_transcription';

UPDATE public.ai_action_costs 
SET 
  base_energy_cost = 20,
  estimated_real_cost_usd = 0.002
WHERE action_key = 'voice_ai_sentiment';