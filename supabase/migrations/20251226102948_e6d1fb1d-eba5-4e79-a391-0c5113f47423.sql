-- Add stable chat_id and group support columns
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS chat_id text,
  ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS group_subject text,
  ADD COLUMN IF NOT EXISTS display_name text;

-- Create unique index on org + chat_id (stable key)
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversations_org_chat_id_uidx
  ON public.whatsapp_conversations (organization_id, chat_id)
  WHERE chat_id IS NOT NULL;

-- Backfill chat_id with phone_number for existing rows
UPDATE public.whatsapp_conversations
SET chat_id = phone_number
WHERE chat_id IS NULL;

-- Update display_name based on existing data
UPDATE public.whatsapp_conversations
SET display_name = COALESCE(contact_name, phone_number)
WHERE display_name IS NULL;