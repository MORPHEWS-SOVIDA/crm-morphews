-- Create lead_source_history table to track multiple sources per lead
CREATE TABLE public.lead_source_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.lead_sources(id) ON DELETE CASCADE,
  recorded_by UUID,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.lead_source_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view source history of their org"
  ON public.lead_source_history
  FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can insert source history in their org"
  ON public.lead_source_history
  FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());

-- Index for faster queries
CREATE INDEX idx_lead_source_history_lead_id ON public.lead_source_history(lead_id);
CREATE INDEX idx_lead_source_history_org ON public.lead_source_history(organization_id);