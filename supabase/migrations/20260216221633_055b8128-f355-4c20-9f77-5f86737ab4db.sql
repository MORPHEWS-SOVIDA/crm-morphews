CREATE OR REPLACE FUNCTION public.temp_fix_remaining_gaucho()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ai_bots 
  SET system_prompt = REPLACE(system_prompt, ' Usa gírias gaúchas naturalmente.', ''),
      updated_at = now()
  WHERE organization_id = '650b1667-e345-498e-9d41-b963faf824a7' 
    AND is_active = true
    AND system_prompt LIKE '%gírias gaúchas%';

  UPDATE public.ai_bots 
  SET system_prompt = REPLACE(system_prompt, 'Nunca parece um robô. ', ''),
      updated_at = now()
  WHERE organization_id = '650b1667-e345-498e-9d41-b963faf824a7' 
    AND is_active = true
    AND system_prompt LIKE '%Nunca parece um robô%';
END;
$$;

SELECT public.temp_fix_remaining_gaucho();
DROP FUNCTION public.temp_fix_remaining_gaucho();