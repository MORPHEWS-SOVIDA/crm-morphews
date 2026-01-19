-- Add Wavoip configuration fields to whatsapp_instances
ALTER TABLE public.whatsapp_instances
ADD COLUMN IF NOT EXISTS wavoip_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS wavoip_server_url text,
ADD COLUMN IF NOT EXISTS wavoip_api_key text;

-- Create table for call queue and distribution
CREATE TABLE IF NOT EXISTS public.whatsapp_call_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  last_call_at timestamp with time zone,
  calls_received integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(instance_id, user_id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_call_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for call queue
CREATE POLICY "Users can view call queue of their organization" 
ON public.whatsapp_call_queue 
FOR SELECT 
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Admins can manage call queue" 
ON public.whatsapp_call_queue 
FOR ALL 
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Create table for call logs
CREATE TABLE IF NOT EXISTS public.whatsapp_call_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  user_id uuid,
  contact_phone text NOT NULL,
  contact_name text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  call_direction text NOT NULL CHECK (call_direction IN ('inbound', 'outbound')),
  call_status text NOT NULL DEFAULT 'initiated',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  answered_at timestamp with time zone,
  ended_at timestamp with time zone,
  duration_seconds integer,
  is_video boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_call_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for call logs
CREATE POLICY "Users can view call logs of their organization" 
ON public.whatsapp_call_logs 
FOR SELECT 
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert call logs for their organization" 
ON public.whatsapp_call_logs 
FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_call_queue_instance ON public.whatsapp_call_queue(instance_id, is_available, position);
CREATE INDEX IF NOT EXISTS idx_call_logs_org_date ON public.whatsapp_call_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_user ON public.whatsapp_call_logs(user_id, created_at DESC);

-- Add comment
COMMENT ON TABLE public.whatsapp_call_queue IS 'Queue for round-robin call distribution among users';
COMMENT ON TABLE public.whatsapp_call_logs IS 'Log of all WhatsApp calls made or received';