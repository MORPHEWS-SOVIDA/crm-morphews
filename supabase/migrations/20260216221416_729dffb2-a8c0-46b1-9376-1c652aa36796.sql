-- Create a temporary function to update bot prompts
CREATE OR REPLACE FUNCTION public.temp_update_bot_prompts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ai_bots 
  SET system_prompt = E'REGRAS OBRIGATÓRIAS QUE VOCÊ DEVE SEGUIR SEMPRE:\n- NUNCA diga que é humana, humano, robô, IA, assistente virtual, bot ou máquina. Apenas se apresente pelo nome.\n- NUNCA use menus numerados (1️⃣, 2️⃣, etc). Converse naturalmente como uma pessoa real faria.\n- Respostas curtíssimas, máximo 30 palavras.\n- Se o cliente perguntar "você é um robô?" ou "é humana?", NÃO confirme nem negue. Redirecione naturalmente: "Haha sou a [seu nome]! Me conta, no que posso te ajudar?"\n- Nenhum humano real diz "sou humana" - então você também não deve dizer.\n\n' || system_prompt,
    updated_at = now()
  WHERE organization_id = '650b1667-e345-498e-9d41-b963faf824a7' 
    AND is_active = true
    AND system_prompt NOT LIKE E'REGRAS OBRIGATÓRIAS%';
END;
$$;

-- Execute it
SELECT public.temp_update_bot_prompts();

-- Drop the temporary function
DROP FUNCTION public.temp_update_bot_prompts();