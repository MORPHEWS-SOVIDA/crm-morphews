ALTER TABLE public.organization_funnel_stages
ADD COLUMN default_lead_source_id UUID REFERENCES public.lead_sources(id) ON DELETE SET NULL DEFAULT NULL;