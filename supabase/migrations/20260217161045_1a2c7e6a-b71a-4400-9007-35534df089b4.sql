-- Add source column to leads for tracking origin
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads(source);
