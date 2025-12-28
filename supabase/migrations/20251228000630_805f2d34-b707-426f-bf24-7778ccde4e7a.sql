
-- Create table for non-purchase reasons configuration per tenant
CREATE TABLE public.non_purchase_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_stage_id UUID REFERENCES public.organization_funnel_stages(id) ON DELETE SET NULL,
  followup_hours INTEGER DEFAULT 0,
  webhook_url TEXT,
  followup_webhook_url TEXT,
  lead_visibility TEXT NOT NULL DEFAULT 'assigned_only' CHECK (lead_visibility IN ('assigned_only', 'all_sellers')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_non_purchase_reasons_org ON public.non_purchase_reasons(organization_id);

-- Enable RLS
ALTER TABLE public.non_purchase_reasons ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view reasons of their org
CREATE POLICY "Users can view non_purchase_reasons of their org"
ON public.non_purchase_reasons
FOR SELECT
USING (organization_id = get_user_organization_id());

-- Policy: Admins can manage reasons
CREATE POLICY "Admins can manage non_purchase_reasons"
ON public.non_purchase_reasons
FOR ALL
USING (
  organization_id = get_user_organization_id() 
  AND is_org_admin(auth.uid(), organization_id)
)
WITH CHECK (
  organization_id = get_user_organization_id() 
  AND is_org_admin(auth.uid(), organization_id)
);

-- Create trigger for updated_at
CREATE TRIGGER update_non_purchase_reasons_updated_at
BEFORE UPDATE ON public.non_purchase_reasons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
