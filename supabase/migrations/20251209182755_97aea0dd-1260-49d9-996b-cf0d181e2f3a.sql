-- Add a column to store the real phone number for sending messages
-- The phone_number column will keep the original format for conversation identification
-- The sendable_phone column will store the E.164 format for actually sending messages

ALTER TABLE whatsapp_conversations 
ADD COLUMN IF NOT EXISTS sendable_phone TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_sendable_phone 
ON whatsapp_conversations(sendable_phone) 
WHERE sendable_phone IS NOT NULL;

-- Comment explaining the columns
COMMENT ON COLUMN whatsapp_conversations.phone_number IS 'Original phone/JID from webhook (may be LID format for conversation identification)';
COMMENT ON COLUMN whatsapp_conversations.sendable_phone IS 'E.164 format phone number for sending messages (e.g., 5521982083745)';