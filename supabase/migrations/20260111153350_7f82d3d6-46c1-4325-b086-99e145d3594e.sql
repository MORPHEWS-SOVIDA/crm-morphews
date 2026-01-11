-- Add qualification tracking columns to whatsapp_conversations
ALTER TABLE public.whatsapp_conversations
ADD COLUMN IF NOT EXISTS bot_qualification_step integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS bot_qualification_completed boolean DEFAULT false;

-- Add text_value column to lead_standard_question_answers for text type answers
ALTER TABLE public.lead_standard_question_answers
ADD COLUMN IF NOT EXISTS text_value text;

-- Create index for faster qualification lookups
CREATE INDEX IF NOT EXISTS idx_conversations_qualification 
ON public.whatsapp_conversations (id) 
WHERE bot_qualification_completed = false;