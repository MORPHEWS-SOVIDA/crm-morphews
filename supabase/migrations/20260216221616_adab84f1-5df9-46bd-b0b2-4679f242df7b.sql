-- Remove sotaque gaúcho e referências regionais de todos os bots da SóVida
-- 1. Remove "Você atende clientes do estado RS." 
-- 2. Remove "Use expressões: bah, tchê, tri, guri, guria, tu."
-- 3. Remove "Gaúcha de 28 anos" references
-- 4. Clear regional_expressions
-- 5. Clear brazilian_state

CREATE OR REPLACE FUNCTION public.temp_remove_gaucho_accent()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove "Você atende clientes do estado RS. " from prompts
  UPDATE public.ai_bots 
  SET system_prompt = REPLACE(system_prompt, 'Você atende clientes do estado RS. ', ''),
      updated_at = now()
  WHERE organization_id = '650b1667-e345-498e-9d41-b963faf824a7' 
    AND is_active = true
    AND system_prompt LIKE '%estado RS%';

  -- Remove "Use expressões: bah, tchê, tri, guri, guria, tu. "
  UPDATE public.ai_bots 
  SET system_prompt = REPLACE(system_prompt, 'Use expressões: bah, tchê, tri, guri, guria, tu. ', ''),
      updated_at = now()
  WHERE organization_id = '650b1667-e345-498e-9d41-b963faf824a7' 
    AND is_active = true
    AND system_prompt LIKE '%bah, tchê%';

  -- Replace "Gaúcha de 28 anos, " with just empty
  UPDATE public.ai_bots 
  SET system_prompt = REPLACE(system_prompt, 'Gaúcha de 28 anos, ', ''),
      personality_description = REPLACE(COALESCE(personality_description, ''), 'Gaúcha de 28 anos, ', ''),
      updated_at = now()
  WHERE organization_id = '650b1667-e345-498e-9d41-b963faf824a7' 
    AND is_active = true
    AND (system_prompt LIKE '%Gaúcha de 28%' OR personality_description LIKE '%Gaúcha de 28%');

  -- Replace "Usa gírias gaúchas naturalmente." 
  UPDATE public.ai_bots 
  SET system_prompt = REPLACE(system_prompt, 'Usa gírias gaúchas naturalmente.', ''),
      updated_at = now()
  WHERE organization_id = '650b1667-e345-498e-9d41-b963faf824a7' 
    AND is_active = true
    AND system_prompt LIKE '%gírias gaúchas%';

  -- Clear regional_expressions and brazilian_state for all bots in this org
  UPDATE public.ai_bots 
  SET regional_expressions = NULL,
      brazilian_state = NULL,
      updated_at = now()
  WHERE organization_id = '650b1667-e345-498e-9d41-b963faf824a7' 
    AND is_active = true
    AND (regional_expressions IS NOT NULL OR brazilian_state IS NOT NULL);
END;
$$;

SELECT public.temp_remove_gaucho_accent();

DROP FUNCTION public.temp_remove_gaucho_accent();