-- =====================================================
-- TracZAP Phase 3: Smart Links with UTM tracking
-- =====================================================

-- Table to store generated WhatsApp links with tracking
CREATE TABLE IF NOT EXISTS public.traczap_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Link details
  name TEXT NOT NULL, -- User-friendly name like "Instagram Bio Link"
  slug TEXT NOT NULL, -- Short code for URL (unique per org)
  
  -- WhatsApp destination
  whatsapp_number TEXT NOT NULL, -- Target WhatsApp number
  default_message TEXT, -- Pre-filled message
  
  -- UTM Parameters
  utm_source TEXT NOT NULL DEFAULT 'whatsapp',
  utm_medium TEXT DEFAULT 'link',
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  clicks_count INTEGER DEFAULT 0,
  leads_count INTEGER DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Unique slug per organization
  CONSTRAINT traczap_links_org_slug_unique UNIQUE (organization_id, slug)
);

-- Table to track link clicks
CREATE TABLE IF NOT EXISTS public.traczap_link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.traczap_links(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Click data
  clicked_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  
  -- Attribution (populated later when lead is created)
  lead_id UUID REFERENCES public.leads(id),
  sale_id UUID REFERENCES public.sales(id)
);

-- RLS Policies
ALTER TABLE public.traczap_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traczap_link_clicks ENABLE ROW LEVEL SECURITY;

-- Links: org members can manage
CREATE POLICY "traczap_links_select" ON public.traczap_links
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "traczap_links_insert" ON public.traczap_links
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "traczap_links_update" ON public.traczap_links
  FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "traczap_links_delete" ON public.traczap_links
  FOR DELETE USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  );

-- Clicks: org members can view
CREATE POLICY "traczap_link_clicks_select" ON public.traczap_link_clicks
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  );

-- Clicks: public insert (for tracking)
CREATE POLICY "traczap_link_clicks_insert" ON public.traczap_link_clicks
  FOR INSERT WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_traczap_links_org ON public.traczap_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_traczap_links_slug ON public.traczap_links(organization_id, slug);
CREATE INDEX IF NOT EXISTS idx_traczap_link_clicks_link ON public.traczap_link_clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_traczap_link_clicks_org ON public.traczap_link_clicks(organization_id);