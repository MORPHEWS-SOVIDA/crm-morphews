-- Create lead_responsibles table for many-to-many relationship
CREATE TABLE public.lead_responsibles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, user_id)
);

-- Enable RLS
ALTER TABLE public.lead_responsibles ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_responsibles
CREATE POLICY "Users can view lead_responsibles of their org"
ON public.lead_responsibles FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert lead_responsibles in their org"
ON public.lead_responsibles FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update lead_responsibles of their org"
ON public.lead_responsibles FOR UPDATE
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete lead_responsibles of their org"
ON public.lead_responsibles FOR DELETE
USING (organization_id = get_user_organization_id());

-- Add can_see_all_leads to organization_members (default true for backwards compatibility)
ALTER TABLE public.organization_members
ADD COLUMN can_see_all_leads BOOLEAN NOT NULL DEFAULT true;

-- Create function to check if user can see a lead
CREATE OR REPLACE FUNCTION public.user_can_see_lead(_user_id uuid, _lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- User has can_see_all_leads permission
    SELECT 1 FROM public.organization_members om
    JOIN public.leads l ON l.organization_id = om.organization_id
    WHERE om.user_id = _user_id
    AND l.id = _lead_id
    AND om.can_see_all_leads = true
  )
  OR EXISTS (
    -- User is a responsible for this lead
    SELECT 1 FROM public.lead_responsibles lr
    WHERE lr.user_id = _user_id
    AND lr.lead_id = _lead_id
  )
$$;

-- Migrate existing assigned_to data to lead_responsibles (only where organization_id is NOT NULL)
INSERT INTO public.lead_responsibles (lead_id, user_id, organization_id)
SELECT DISTINCT l.id, p.user_id, l.organization_id
FROM public.leads l
JOIN public.profiles p ON (p.first_name || ' ' || p.last_name) = l.assigned_to
WHERE l.assigned_to IS NOT NULL 
  AND l.assigned_to != ''
  AND l.organization_id IS NOT NULL
  AND p.user_id IS NOT NULL
ON CONFLICT (lead_id, user_id) DO NOTHING;

-- Also add created_by as responsible if not already added (only where organization_id is NOT NULL)
INSERT INTO public.lead_responsibles (lead_id, user_id, organization_id)
SELECT l.id, l.created_by, l.organization_id
FROM public.leads l
WHERE l.created_by IS NOT NULL
  AND l.organization_id IS NOT NULL
ON CONFLICT (lead_id, user_id) DO NOTHING;

-- Update leads RLS policies to use new visibility logic
DROP POLICY IF EXISTS "Users can view leads of their org" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads of their org" ON public.leads;
DROP POLICY IF EXISTS "Users can delete leads of their org" ON public.leads;

-- New SELECT policy: can see if has permission or is responsible
CREATE POLICY "Users can view leads they have access to"
ON public.leads FOR SELECT
USING (
  organization_id = get_user_organization_id()
  AND user_can_see_lead(auth.uid(), id)
);

-- UPDATE and DELETE: same logic
CREATE POLICY "Users can update leads they have access to"
ON public.leads FOR UPDATE
USING (
  organization_id = get_user_organization_id()
  AND user_can_see_lead(auth.uid(), id)
);

CREATE POLICY "Users can delete leads they have access to"
ON public.leads FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND user_can_see_lead(auth.uid(), id)
);

-- Create indexes for performance
CREATE INDEX idx_lead_responsibles_lead_id ON public.lead_responsibles(lead_id);
CREATE INDEX idx_lead_responsibles_user_id ON public.lead_responsibles(user_id);
CREATE INDEX idx_lead_responsibles_org_id ON public.lead_responsibles(organization_id);