-- Add column to store our own PDF URL (from Supabase storage)
ALTER TABLE public.melhor_envio_labels 
ADD COLUMN IF NOT EXISTS storage_pdf_url TEXT;