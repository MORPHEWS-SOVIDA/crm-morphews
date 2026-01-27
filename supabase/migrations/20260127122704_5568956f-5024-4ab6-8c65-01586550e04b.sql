-- Add WhatsApp number field to quiz_steps for result CTA
ALTER TABLE public.quiz_steps
ADD COLUMN IF NOT EXISTS result_whatsapp_number TEXT;