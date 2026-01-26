-- Table to persist AI suggestions until seller takes action
CREATE TABLE public.ai_lead_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  lead_name TEXT NOT NULL,
  lead_whatsapp TEXT,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('followup', 'products')),
  reason TEXT NOT NULL,
  suggested_action TEXT CHECK (suggested_action IN ('ligar', 'whatsapp', 'agendar')),
  suggested_script TEXT,
  recommended_products TEXT[],
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'dismissed')),
  feedback TEXT CHECK (feedback IN ('positive', 'negative')),
  feedback_note TEXT,
  energy_consumed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE,
  feedback_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.ai_lead_suggestions ENABLE ROW LEVEL SECURITY;

-- Policies for sellers to see their own suggestions
CREATE POLICY "Users can view their own suggestions"
ON public.ai_lead_suggestions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own suggestions"
ON public.ai_lead_suggestions
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy for edge function to insert (service role)
CREATE POLICY "Service role can insert suggestions"
ON public.ai_lead_suggestions
FOR INSERT
WITH CHECK (true);

-- Index for fast queries
CREATE INDEX idx_ai_lead_suggestions_user_status ON public.ai_lead_suggestions(user_id, status);
CREATE INDEX idx_ai_lead_suggestions_org_type ON public.ai_lead_suggestions(organization_id, suggestion_type);
CREATE INDEX idx_ai_lead_suggestions_created ON public.ai_lead_suggestions(created_at DESC);