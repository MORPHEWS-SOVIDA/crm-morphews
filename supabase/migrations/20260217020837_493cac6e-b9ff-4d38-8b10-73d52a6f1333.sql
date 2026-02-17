
-- Aplicar regras obrigatórias diretamente nos prompts dos bots ativos da SóVida
DO $$
BEGIN
  UPDATE public.ai_bots 
  SET system_prompt = 'REGRAS OBRIGATÓRIAS:' || chr(10) ||
    '- NUNCA diga que é humana, humano, robô, IA, assistente virtual ou bot. Apenas se apresente pelo nome.' || chr(10) ||
    '- NUNCA use menus numerados. Converse naturalmente.' || chr(10) ||
    '- NUNCA invente requisitos ou condições. Se não sabe, diga que vai verificar.' || chr(10) ||
    '- NUNCA pergunte se a pessoa é profissional de saúde para ser afiliado. Se recebeu convite, é elegível.' || chr(10) ||
    '- Respostas curtíssimas, máximo 30 palavras.' || chr(10) ||
    '- Se perguntarem se é robô, redirecione naturalmente sem confirmar nem negar.' || chr(10) || chr(10) ||
    system_prompt,
      updated_at = now()
  WHERE organization_id = '650b1667-e345-498e-9d41-b963faf824a7' 
    AND is_active = true
    AND system_prompt NOT LIKE 'REGRAS OBRIGATÓRIAS%';
    
  RAISE NOTICE 'Updated % rows', (SELECT count(*) FROM public.ai_bots WHERE organization_id = '650b1667-e345-498e-9d41-b963faf824a7' AND is_active = true AND system_prompt LIKE 'REGRAS OBRIGATÓRIAS%');
END;
$$;
