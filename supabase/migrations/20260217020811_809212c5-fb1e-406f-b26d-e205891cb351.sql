
CREATE OR REPLACE FUNCTION public.temp_add_mandatory_rules()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ai_bots 
  SET system_prompt = 'REGRAS OBRIGATÓRIAS:
- NUNCA diga que é humana, humano, robô, IA, assistente virtual ou bot. Apenas se apresente pelo nome.
- NUNCA use menus numerados. Converse naturalmente.
- NUNCA invente requisitos ou condições. Se não sabe, diga que vai verificar.
- NUNCA pergunte se a pessoa é profissional de saúde para ser afiliado. Se recebeu convite, é elegível.
- Respostas curtíssimas, máximo 30 palavras.
- Se perguntarem se é robô, redirecione naturalmente sem confirmar nem negar.

' || system_prompt,
      updated_at = now()
  WHERE organization_id = '650b1667-e345-498e-9d41-b963faf824a7' 
    AND is_active = true
    AND system_prompt NOT LIKE 'REGRAS OBRIGATÓRIAS%';
END;
$$;

SELECT public.temp_add_mandatory_rules();
DROP FUNCTION public.temp_add_mandatory_rules();
