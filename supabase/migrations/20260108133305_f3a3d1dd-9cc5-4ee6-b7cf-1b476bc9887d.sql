-- Add leads_view_only_own permission to control visibility
ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS leads_view_only_own boolean NOT NULL DEFAULT false;

-- Create lead_ownership_transfers table to track lead transfers
CREATE TABLE IF NOT EXISTS public.lead_ownership_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_user_id uuid, -- null if first assignment
  to_user_id uuid NOT NULL,
  transferred_by uuid NOT NULL, -- who performed the transfer
  transfer_reason text NOT NULL, -- 'cadastro', 'atendimento_whatsapp', 'manual', etc
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_ownership_transfers ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_ownership_transfers
CREATE POLICY "Users can view transfers in their org"
  ON public.lead_ownership_transfers FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert transfers in their org"
  ON public.lead_ownership_transfers FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_lead_ownership_transfers_lead_id ON public.lead_ownership_transfers(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_ownership_transfers_org_id ON public.lead_ownership_transfers(organization_id);

-- Update the leads SELECT policy to respect leads_view_only_own permission
DROP POLICY IF EXISTS "Users can view leads in their org" ON public.leads;

CREATE POLICY "Users can view leads based on permissions"
  ON public.leads FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
    AND (
      -- Admin/owner can see all
      EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.user_id = auth.uid() 
        AND om.organization_id = leads.organization_id
        AND om.role IN ('owner', 'admin')
      )
      OR
      -- User has leads_view_only_own = false (can see all)
      EXISTS (
        SELECT 1 FROM user_permissions up
        WHERE up.user_id = auth.uid()
        AND up.organization_id = leads.organization_id
        AND up.leads_view_only_own = false
      )
      OR
      -- User has leads_view_only_own = true, only see leads they're responsible for
      EXISTS (
        SELECT 1 FROM lead_responsibles lr
        WHERE lr.lead_id = leads.id
        AND lr.user_id = auth.uid()
      )
      OR
      -- User created the lead
      leads.created_by = auth.uid()
    )
  );