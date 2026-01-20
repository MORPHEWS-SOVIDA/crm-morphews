-- Add webhook_data column to leads table to store raw webhook payload
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS webhook_data jsonb DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.leads.webhook_data IS 'Stores raw payload from webhook integrations for reference';

-- Create index for querying leads with webhook data
CREATE INDEX IF NOT EXISTS idx_leads_has_webhook_data ON public.leads (organization_id) WHERE webhook_data IS NOT NULL;