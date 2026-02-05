-- Add webhooks_configured column to track which numbers have webhooks set up
ALTER TABLE public.voice_phone_numbers 
ADD COLUMN IF NOT EXISTS webhooks_configured boolean DEFAULT false;