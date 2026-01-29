-- =====================================================
-- TracZAP Phase 1: CAPI Events per Funnel Stage
-- =====================================================

-- 1. Add CAPI event configuration to funnel stages
ALTER TABLE public.organization_funnel_stages
ADD COLUMN IF NOT EXISTS capi_event_name TEXT CHECK (capi_event_name IN ('Lead', 'Contact', 'Schedule', 'Purchase', 'CompleteRegistration', 'SubmitApplication', 'ViewContent', NULL)),
ADD COLUMN IF NOT EXISTS capi_custom_event TEXT;

COMMENT ON COLUMN public.organization_funnel_stages.capi_event_name IS 'Meta CAPI standard event to fire when lead enters this stage';
COMMENT ON COLUMN public.organization_funnel_stages.capi_custom_event IS 'Custom event name if using non-standard events';

-- 2. Enhance lead_stage_history with CAPI tracking
ALTER TABLE public.lead_stage_history
ADD COLUMN IF NOT EXISTS capi_event_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS capi_event_name TEXT,
ADD COLUMN IF NOT EXISTS capi_event_id TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

COMMENT ON COLUMN public.lead_stage_history.capi_event_sent IS 'Whether CAPI event was successfully dispatched';
COMMENT ON COLUMN public.lead_stage_history.capi_event_name IS 'The CAPI event name that was sent';
COMMENT ON COLUMN public.lead_stage_history.capi_event_id IS 'Unique event_id for Meta deduplication';
COMMENT ON COLUMN public.lead_stage_history.source IS 'manual, whatsapp, automation, webhook, ecommerce';

-- 3. Create TracZAP configuration table per organization
CREATE TABLE IF NOT EXISTS public.traczap_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Auto-tracking toggles
  auto_track_new_leads BOOLEAN DEFAULT true,
  auto_track_stage_changes BOOLEAN DEFAULT true,
  auto_track_purchases BOOLEAN DEFAULT true,
  -- Default UTM parameters for WhatsApp links
  default_utm_source TEXT DEFAULT 'whatsapp',
  default_utm_medium TEXT DEFAULT 'direct',
  default_utm_campaign TEXT,
  -- Created
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.traczap_config ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their organization traczap config"
  ON public.traczap_config FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage traczap config"
  ON public.traczap_config FOR ALL
  USING (
    organization_id IN (
      SELECT p.organization_id FROM public.profiles p
      JOIN public.organization_members om ON om.user_id = p.user_id AND om.organization_id = p.organization_id
      WHERE p.user_id = auth.uid() AND om.role IN ('admin', 'owner')
    )
  );

-- 4. Index for faster queries on stage history
CREATE INDEX IF NOT EXISTS idx_lead_stage_history_capi 
  ON public.lead_stage_history(organization_id, created_at DESC)
  WHERE capi_event_sent = true;

-- 5. Update timestamp trigger
CREATE OR REPLACE FUNCTION update_traczap_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS traczap_config_updated_at ON public.traczap_config;
CREATE TRIGGER traczap_config_updated_at
  BEFORE UPDATE ON public.traczap_config
  FOR EACH ROW
  EXECUTE FUNCTION update_traczap_config_updated_at();