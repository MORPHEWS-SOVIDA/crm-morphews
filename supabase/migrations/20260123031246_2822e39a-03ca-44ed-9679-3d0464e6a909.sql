-- =====================================================
-- EMAIL MARKETING MODULE - Sequências Automatizadas
-- =====================================================

-- 1. Templates de Email por Organização
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  category VARCHAR(50) DEFAULT 'general', -- abandoned_cart, upsell, crosssell, recompra, welcome, etc.
  variables JSONB DEFAULT '[]'::jsonb, -- Available variables like {{nome}}, {{produto}}, etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Sequências de Email (Fluxos Automatizados)
CREATE TABLE public.email_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(50) NOT NULL, -- abandoned_cart, post_purchase, lead_created, no_purchase_30d, birthday, etc.
  trigger_conditions JSONB DEFAULT '{}'::jsonb, -- Conditions like product_id, min_value, etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Etapas da Sequência (Cada email da sequência)
CREATE TABLE public.email_sequence_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id UUID NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  step_order INT NOT NULL DEFAULT 1,
  delay_minutes INT NOT NULL DEFAULT 0, -- Delay after trigger or previous step
  subject_override VARCHAR(200), -- Override template subject
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Inscrições em Sequências (Leads em fluxo)
CREATE TABLE public.email_sequence_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id UUID NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  current_step INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active', -- active, paused, completed, unsubscribed
  triggered_by VARCHAR(100), -- cart_id, sale_id, etc.
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_send_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Log de Emails Enviados
CREATE TABLE public.email_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.email_sequence_enrollments(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, delivered, opened, clicked, bounced, failed
  resend_id VARCHAR(100), -- ID from Resend API
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- 6. Configurações de Email por Organização
CREATE TABLE public.email_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  from_name VARCHAR(100) DEFAULT 'Loja',
  from_email VARCHAR(255), -- Custom verified domain email
  reply_to VARCHAR(255),
  footer_html TEXT,
  unsubscribe_url VARCHAR(500),
  is_enabled BOOLEAN DEFAULT true,
  daily_limit INT DEFAULT 500,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_email_templates_org ON public.email_templates(organization_id, category);
CREATE INDEX idx_email_sequences_org ON public.email_sequences(organization_id, trigger_type);
CREATE INDEX idx_email_enrollments_next ON public.email_sequence_enrollments(next_send_at) WHERE status = 'active';
CREATE INDEX idx_email_sends_org ON public.email_sends(organization_id, created_at DESC);

-- RLS Policies
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

-- Policies for email_templates
CREATE POLICY "Users can view org email templates" ON public.email_templates
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage org email templates" ON public.email_templates
  FOR ALL USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Policies for email_sequences
CREATE POLICY "Users can view org email sequences" ON public.email_sequences
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage org email sequences" ON public.email_sequences
  FOR ALL USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Policies for email_sequence_steps
CREATE POLICY "Users can view org sequence steps" ON public.email_sequence_steps
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage org sequence steps" ON public.email_sequence_steps
  FOR ALL USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Policies for email_sequence_enrollments
CREATE POLICY "Users can view org enrollments" ON public.email_sequence_enrollments
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage org enrollments" ON public.email_sequence_enrollments
  FOR ALL USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Policies for email_sends
CREATE POLICY "Users can view org email sends" ON public.email_sends
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Policies for email_settings
CREATE POLICY "Users can view org email settings" ON public.email_settings
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage org email settings" ON public.email_settings
  FOR ALL USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));