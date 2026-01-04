-- Create teams table for each organization
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Add team_id to organization_members
ALTER TABLE public.organization_members 
ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- RLS policies for teams
CREATE POLICY "Users can view teams from their organization"
ON public.teams FOR SELECT
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can insert teams"
ON public.teams FOR INSERT
WITH CHECK (
  organization_id = public.get_user_organization_id() 
  AND public.is_org_admin(auth.uid(), organization_id)
);

CREATE POLICY "Admins can update teams"
ON public.teams FOR UPDATE
USING (
  organization_id = public.get_user_organization_id() 
  AND public.is_org_admin(auth.uid(), organization_id)
);

CREATE POLICY "Admins can delete teams"
ON public.teams FOR DELETE
USING (
  organization_id = public.get_user_organization_id() 
  AND public.is_org_admin(auth.uid(), organization_id)
);

-- Index for performance
CREATE INDEX idx_teams_organization_id ON public.teams(organization_id);
CREATE INDEX idx_organization_members_team_id ON public.organization_members(team_id);

-- Trigger for updated_at
CREATE TRIGGER update_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();