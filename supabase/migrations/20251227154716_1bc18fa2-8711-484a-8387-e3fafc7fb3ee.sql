-- Create error logs table for super admin monitoring
CREATE TABLE public.error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_details JSONB,
  source TEXT, -- 'whatsapp', 'api', 'client', etc.
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can read all logs (via service role)
-- Org admins can see their own org's logs
CREATE POLICY "Org members can view their own error logs"
ON public.error_logs
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- Allow insert from anywhere (for edge functions and client)
CREATE POLICY "Anyone can insert error logs"
ON public.error_logs
FOR INSERT
WITH CHECK (true);

-- Add index for fast queries
CREATE INDEX idx_error_logs_org_created ON public.error_logs(organization_id, created_at DESC);
CREATE INDEX idx_error_logs_type ON public.error_logs(error_type);