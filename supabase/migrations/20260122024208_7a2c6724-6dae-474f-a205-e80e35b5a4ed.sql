-- 1) Adicionar campos de auto-close na tabela organizations (configuração global)
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS auto_close_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_close_bot_minutes integer DEFAULT 60,
ADD COLUMN IF NOT EXISTS auto_close_assigned_minutes integer DEFAULT 480,
ADD COLUMN IF NOT EXISTS auto_close_only_business_hours boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_close_business_start time DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS auto_close_business_end time DEFAULT '20:00',
ADD COLUMN IF NOT EXISTS auto_close_send_message boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_close_message_template text DEFAULT 'Olá! Como não recebemos resposta, estamos encerrando este atendimento. Caso precise, é só nos chamar novamente! 😊',
ADD COLUMN IF NOT EXISTS satisfaction_survey_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS satisfaction_survey_message text DEFAULT 'De 0 a 10, como você avalia este atendimento? Sua resposta nos ajuda a melhorar! 🙏';