-- Create unified communication logs table
CREATE TABLE public.system_communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- When
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Channel type
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  
  -- Source/Origin of the message
  source VARCHAR(50) NOT NULL, -- 'partner_notification', 'secretary', 'onboarding', 'ecommerce', 'cart_recovery', etc.
  
  -- Recipient info
  recipient_phone VARCHAR(30),
  recipient_email VARCHAR(255),
  recipient_name VARCHAR(255),
  
  -- Organization context (optional - for platform-wide messages like secretary)
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  organization_name VARCHAR(255),
  
  -- Related entities (optional)
  sale_id UUID,
  lead_id UUID,
  user_id UUID,
  
  -- Message content
  subject VARCHAR(500), -- For emails
  message_content TEXT NOT NULL,
  
  -- Status and errors
  status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
  error_message TEXT,
  
  -- Extra metadata (for flexibility)
  metadata JSONB DEFAULT '{}'
);

-- Indexes for efficient querying
CREATE INDEX idx_comm_logs_created_at ON public.system_communication_logs(created_at DESC);
CREATE INDEX idx_comm_logs_channel ON public.system_communication_logs(channel);
CREATE INDEX idx_comm_logs_source ON public.system_communication_logs(source);
CREATE INDEX idx_comm_logs_recipient_phone ON public.system_communication_logs(recipient_phone);
CREATE INDEX idx_comm_logs_recipient_email ON public.system_communication_logs(recipient_email);
CREATE INDEX idx_comm_logs_organization_id ON public.system_communication_logs(organization_id);
CREATE INDEX idx_comm_logs_status ON public.system_communication_logs(status);

-- Enable RLS
ALTER TABLE public.system_communication_logs ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view logs
CREATE POLICY "Platform admins can view communication logs"
  ON public.system_communication_logs
  FOR SELECT
  USING (public.has_admin_role(auth.uid()));

-- Service role can insert (edge functions)
CREATE POLICY "Service role can insert communication logs"
  ON public.system_communication_logs
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE public.system_communication_logs IS 'Unified log of all WhatsApp and Email communications sent by the platform';