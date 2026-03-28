-- Add transfer columns to whatsapp_conversations
ALTER TABLE whatsapp_conversations 
  ADD COLUMN IF NOT EXISTS transfer_reason TEXT,
  ADD COLUMN IF NOT EXISTS transfer_summary TEXT,
  ADD COLUMN IF NOT EXISTS transfer_urgency TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_bot_message_at TIMESTAMPTZ;

-- Add product columns to lead_products
ALTER TABLE lead_products
  ADD COLUMN IF NOT EXISTS how_to_use TEXT,
  ADD COLUMN IF NOT EXISTS benefits TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Product FAQs table
CREATE TABLE IF NOT EXISTS product_faqs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES lead_products(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_faqs_product ON product_faqs(product_id);

-- Add kanban_stage and star_rating to leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS kanban_stage TEXT,
  ADD COLUMN IF NOT EXISTS star_rating INTEGER DEFAULT 0;

-- Agent execution logs (in main project for auditability)
CREATE TABLE IF NOT EXISTS agent_execution_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID,
  bot_id UUID,
  organization_id UUID,
  tools_used JSONB DEFAULT '[]',
  iterations INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_conv ON agent_execution_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_org ON agent_execution_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created ON agent_execution_logs(created_at DESC);

-- Lead sale interests (in main project so the edge function can write to it)
CREATE TABLE IF NOT EXISTS lead_sale_interests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID,
  phone_number TEXT NOT NULL,
  organization_id UUID NOT NULL,
  product_id UUID,
  product_name TEXT NOT NULL,
  estimated_value DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'interested',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_interests_phone ON lead_sale_interests(phone_number);
CREATE INDEX IF NOT EXISTS idx_sale_interests_org ON lead_sale_interests(organization_id);
CREATE INDEX IF NOT EXISTS idx_sale_interests_conv ON lead_sale_interests(conversation_id);

-- Agent notifications
CREATE TABLE IF NOT EXISTS agent_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID,
  instance_id UUID,
  type TEXT DEFAULT 'transfer_request',
  urgency TEXT DEFAULT 'medium',
  reason TEXT,
  summary TEXT,
  read BOOLEAN DEFAULT FALSE,
  read_by UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_notif_conv ON agent_notifications(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_notif_read ON agent_notifications(read);

-- Conversation notes
CREATE TABLE IF NOT EXISTS conversation_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID,
  note_type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_notes_conv ON conversation_notes(conversation_id);

-- RLS Policies
ALTER TABLE lead_sale_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_faqs ENABLE ROW LEVEL SECURITY;

-- Service role full access (Edge Functions use service role)
CREATE POLICY "Service role full access on lead_sale_interests" ON lead_sale_interests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on agent_notifications" ON agent_notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on conversation_notes" ON conversation_notes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on agent_execution_logs" ON agent_execution_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on product_faqs" ON product_faqs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can read notifications and logs for their org
CREATE POLICY "Authenticated read agent_notifications" ON agent_notifications
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read agent_execution_logs" ON agent_execution_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read lead_sale_interests" ON lead_sale_interests
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read conversation_notes" ON conversation_notes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read product_faqs" ON product_faqs
  FOR SELECT TO authenticated USING (true);