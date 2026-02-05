-- Add 'reaction' to the allowed message types
ALTER TABLE whatsapp_messages 
DROP CONSTRAINT IF EXISTS whatsapp_messages_message_type_check;

ALTER TABLE whatsapp_messages 
ADD CONSTRAINT whatsapp_messages_message_type_check 
CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact', 'link', 'reaction', 'poll', 'button_reply', 'list_reply'));