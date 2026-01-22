-- Add AI model selection columns to organizations (for global document/image processing)
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS ai_model_document text DEFAULT 'google/gemini-2.5-flash',
ADD COLUMN IF NOT EXISTS ai_model_image text DEFAULT 'google/gemini-2.5-flash';

-- Add AI model selection column to ai_bots (for chat/conversation)
ALTER TABLE public.ai_bots
ADD COLUMN IF NOT EXISTS ai_model_chat text DEFAULT 'google/gemini-3-flash-preview';

-- Add comments for documentation
COMMENT ON COLUMN public.organizations.ai_model_document IS 'AI model to use for document interpretation (PDFs, etc.)';
COMMENT ON COLUMN public.organizations.ai_model_image IS 'AI model to use for image interpretation';
COMMENT ON COLUMN public.ai_bots.ai_model_chat IS 'AI model to use for chat/conversation responses';