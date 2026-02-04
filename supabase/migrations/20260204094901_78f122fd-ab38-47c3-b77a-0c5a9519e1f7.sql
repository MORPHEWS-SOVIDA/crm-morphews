-- Add fallback instance IDs column to non_purchase_message_templates
ALTER TABLE public.non_purchase_message_templates 
ADD COLUMN IF NOT EXISTS fallback_instance_ids uuid[] DEFAULT NULL;

-- Add a comment to explain the column
COMMENT ON COLUMN public.non_purchase_message_templates.fallback_instance_ids IS 'Array of fallback WhatsApp instance IDs to try if the primary instance fails';