-- Create table for continuous medications catalog
CREATE TABLE public.continuous_medications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, normalized_name)
);

-- Enable RLS
ALTER TABLE public.continuous_medications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view medications from their organization"
ON public.continuous_medications
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert medications in their organization"
ON public.continuous_medications
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update medications in their organization"
ON public.continuous_medications
FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_continuous_medications_org_name ON public.continuous_medications(organization_id, normalized_name);
CREATE INDEX idx_continuous_medications_usage ON public.continuous_medications(organization_id, usage_count DESC);

-- Trigger to update updated_at
CREATE TRIGGER update_continuous_medications_updated_at
BEFORE UPDATE ON public.continuous_medications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();