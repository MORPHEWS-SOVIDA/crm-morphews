
-- Table to log actions taken on leads from VoIP 3C+ validation reports
CREATE TABLE public.voip_3c_action_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  validation_id UUID NOT NULL REFERENCES public.voip_3c_validations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  lead_id UUID NULL,
  lead_name TEXT NULL,
  lead_phone TEXT NULL,
  action_type TEXT NOT NULL, -- 'whatsapp_sent', 'stage_changed', 'assigned_seller', 'followup_created'
  action_details JSONB NULL, -- { new_stage: '...', seller_name: '...', followup_date: '...' }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voip_3c_action_logs ENABLE ROW LEVEL SECURITY;

-- Policies: org members can read/insert their own org's logs
CREATE POLICY "Members can view org action logs"
  ON public.voip_3c_action_logs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert org action logs"
  ON public.voip_3c_action_logs FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- Index for fast lookups
CREATE INDEX idx_voip_3c_action_logs_validation ON public.voip_3c_action_logs(validation_id);
CREATE INDEX idx_voip_3c_action_logs_org_created ON public.voip_3c_action_logs(organization_id, created_at DESC);
