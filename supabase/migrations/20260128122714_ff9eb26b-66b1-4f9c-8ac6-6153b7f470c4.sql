-- Adicionar campo de mensagem de agradecimento NPS nas organizações
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS satisfaction_thank_you_message text DEFAULT 'Obrigado pela sua avaliação! 💚 Sua opinião é muito importante para nós.';