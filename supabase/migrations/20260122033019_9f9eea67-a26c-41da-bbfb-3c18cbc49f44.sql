-- Add column for medical prescription turbo mode
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS whatsapp_document_medical_mode boolean DEFAULT false;