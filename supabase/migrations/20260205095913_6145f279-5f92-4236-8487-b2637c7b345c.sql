-- Create voice_ai_call_logs table for tracking all calls
CREATE TABLE public.voice_ai_call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.voice_ai_agents(id) ON DELETE SET NULL,
  
  -- Call direction and status
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'in-progress', 'completed', 'failed', 'busy', 'no-answer', 'canceled')),
  
  -- Caller/Callee info
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  caller_id_number TEXT, -- The number used to make the call (for outbound)
  
  -- Lead association (if linked)
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  lead_name TEXT,
  
  -- Twilio metadata
  twilio_call_sid TEXT UNIQUE,
  twilio_parent_call_sid TEXT,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  answered_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER DEFAULT 0,
  
  -- Billing
  minutes_consumed INTEGER DEFAULT 0,
  cost_cents INTEGER DEFAULT 0,
  
  -- Transcription & Analysis
  transcription TEXT,
  transcription_summary TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', NULL)),
  key_topics TEXT[],
  
  -- Outcome
  outcome TEXT CHECK (outcome IN ('appointment_booked', 'callback_requested', 'sale_closed', 'info_provided', 'transferred', 'voicemail', 'hung_up', 'no_outcome', NULL)),
  outcome_notes TEXT,
  
  -- Campaign (for outbound)
  campaign_id UUID,
  campaign_batch_id UUID,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voice_ai_call_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own org call logs" ON public.voice_ai_call_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.organization_id = voice_ai_call_logs.organization_id
    )
  );

CREATE POLICY "Users can insert own org call logs" ON public.voice_ai_call_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.organization_id = voice_ai_call_logs.organization_id
    )
  );

CREATE POLICY "Users can update own org call logs" ON public.voice_ai_call_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.organization_id = voice_ai_call_logs.organization_id
    )
  );

-- Index for performance
CREATE INDEX idx_voice_ai_call_logs_org_date ON public.voice_ai_call_logs(organization_id, started_at DESC);
CREATE INDEX idx_voice_ai_call_logs_direction ON public.voice_ai_call_logs(organization_id, direction);
CREATE INDEX idx_voice_ai_call_logs_status ON public.voice_ai_call_logs(organization_id, status);
CREATE INDEX idx_voice_ai_call_logs_twilio_sid ON public.voice_ai_call_logs(twilio_call_sid);

-- Create voice_ai_outbound_campaigns table
CREATE TABLE public.voice_ai_outbound_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.voice_ai_agents(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  caller_id_number TEXT, -- Number to use for outbound calls
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled')),
  
  -- Scheduling
  scheduled_start_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Settings
  calls_per_minute INTEGER DEFAULT 5,
  max_concurrent_calls INTEGER DEFAULT 10,
  max_retries INTEGER DEFAULT 2,
  retry_delay_minutes INTEGER DEFAULT 30,
  working_hours_start TIME DEFAULT '09:00',
  working_hours_end TIME DEFAULT '18:00',
  working_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5], -- Mon-Fri
  
  -- Stats
  total_contacts INTEGER DEFAULT 0,
  calls_attempted INTEGER DEFAULT 0,
  calls_connected INTEGER DEFAULT 0,
  calls_completed INTEGER DEFAULT 0,
  appointments_booked INTEGER DEFAULT 0,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voice_ai_outbound_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own org campaigns" ON public.voice_ai_outbound_campaigns
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.organization_id = voice_ai_outbound_campaigns.organization_id
    )
  );

-- Create campaign contacts table
CREATE TABLE public.voice_ai_campaign_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.voice_ai_outbound_campaigns(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Contact info
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  custom_data JSONB,
  
  -- Lead association
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'calling', 'completed', 'failed', 'skipped')),
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  
  -- Call result
  call_log_id UUID REFERENCES public.voice_ai_call_logs(id) ON DELETE SET NULL,
  outcome TEXT,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voice_ai_campaign_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own org contacts" ON public.voice_ai_campaign_contacts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.organization_id = voice_ai_campaign_contacts.organization_id
    )
  );

-- Index for campaign processing
CREATE INDEX idx_voice_ai_campaign_contacts_pending ON public.voice_ai_campaign_contacts(campaign_id, status) WHERE status = 'pending';