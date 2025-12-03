-- Table to store Google OAuth tokens for each user
CREATE TABLE public.google_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own tokens
CREATE POLICY "Users can view their own google tokens"
ON public.google_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own google tokens"
ON public.google_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own google tokens"
ON public.google_tokens FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own google tokens"
ON public.google_tokens FOR DELETE
USING (auth.uid() = user_id);

-- Table to store calendar events linked to leads
CREATE TABLE public.lead_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  google_event_id text,
  title text NOT NULL,
  description text,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  location text,
  meeting_link text,
  synced_to_google boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can manage lead events (same as leads table)
CREATE POLICY "Anyone can view lead events"
ON public.lead_events FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert lead events"
ON public.lead_events FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update lead events"
ON public.lead_events FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete lead events"
ON public.lead_events FOR DELETE
USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_google_tokens_updated_at
BEFORE UPDATE ON public.google_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lead_events_updated_at
BEFORE UPDATE ON public.lead_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();