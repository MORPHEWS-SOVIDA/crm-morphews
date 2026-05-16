UPDATE public.integrations
SET auto_message_text = 'Olá {{nome}}, tudo bom?

Vi que você acabou de abandonar o carrinho do Life 3.0. Ficou com alguma dúvida? Como posso te ajudar?

Se quiser finalizar agora, é só clicar 👉 {{link}}',
    auto_message_enabled = true
WHERE id = '8199b225-0702-4b4c-b26a-c3f88f7f01ee';

UPDATE public.integrations
SET status = 'inactive', is_paused = true, pause_reason = 'Duplicada de 8199b225 (Tri Viva - Carrinho abandonado). Mantida desativada para histórico.'
WHERE id = 'a42f4f76-e6f1-4938-afc3-ba6dd40e00c1';