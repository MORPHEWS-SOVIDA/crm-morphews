-- Add interpretation settings to ai_bots table
ALTER TABLE public.ai_bots 
ADD COLUMN IF NOT EXISTS interpret_audio BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS interpret_documents BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS interpret_images BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS document_reply_message TEXT DEFAULT 'Nossa IA analisou seu documento e identificou as seguintes informações:',
ADD COLUMN IF NOT EXISTS image_reply_message TEXT DEFAULT 'Nossa IA analisou sua imagem e identificou:';