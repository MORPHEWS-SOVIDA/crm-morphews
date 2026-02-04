-- Criar função auxiliar para verificar super admin baseado em user_roles
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = $1
    AND user_roles.role = 'admin'
  );
$$;

-- Tabela de números telefônicos (pool gerenciado pelo Super Admin)
CREATE TABLE public.voice_phone_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  phone_number_sid TEXT, -- Twilio Phone Number SID
  friendly_name TEXT,
  country_code TEXT DEFAULT 'BR',
  region TEXT, -- Estado/DDD
  locality TEXT, -- Cidade
  capabilities JSONB DEFAULT '{"voice": true, "sms": false}'::jsonb,
  monthly_cost_cents INTEGER NOT NULL DEFAULT 5000, -- R$ 50,00 default
  twilio_monthly_cost_cents INTEGER, -- Custo real do Twilio para controle
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'allocated', 'pending', 'released')),
  allocated_to_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  allocated_at TIMESTAMP WITH TIME ZONE,
  released_at TIMESTAMP WITH TIME ZONE,
  webhook_url TEXT,
  voice_bot_id UUID REFERENCES public.ai_bots(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela de solicitações de números (modelo sob demanda)
CREATE TABLE public.voice_number_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  preferred_region TEXT, -- DDD preferido
  preferred_locality TEXT, -- Cidade preferida
  purpose TEXT, -- Finalidade (receptivo, ativo, ambos)
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled')),
  admin_notes TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  allocated_number_id UUID REFERENCES public.voice_phone_numbers(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de histórico de alocações (para billing e auditoria)
CREATE TABLE public.voice_number_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number_id UUID NOT NULL REFERENCES public.voice_phone_numbers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  monthly_cost_cents INTEGER NOT NULL,
  allocated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  released_at TIMESTAMP WITH TIME ZONE,
  release_reason TEXT,
  billing_status TEXT DEFAULT 'active' CHECK (billing_status IN ('active', 'cancelled', 'suspended')),
  next_billing_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de logs de chamadas
CREATE TABLE public.voice_call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number_id UUID REFERENCES public.voice_phone_numbers(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  call_sid TEXT UNIQUE, -- Twilio Call SID
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  status TEXT, -- queued, ringing, in-progress, completed, busy, failed, no-answer, canceled
  duration_seconds INTEGER,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  answered_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  recording_url TEXT,
  transcription TEXT,
  ai_bot_id UUID REFERENCES public.ai_bots(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  energy_consumed INTEGER DEFAULT 0,
  cost_cents INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voice_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_number_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_number_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_call_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for voice_phone_numbers
-- Super admins podem ver e gerenciar todos
CREATE POLICY "Super admins can manage all phone numbers"
  ON public.voice_phone_numbers
  FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- Orgs podem ver apenas números alocados para elas
CREATE POLICY "Orgs can view their allocated numbers"
  ON public.voice_phone_numbers
  FOR SELECT
  USING (allocated_to_org_id IN (SELECT public.get_user_org_ids()));

-- RLS Policies for voice_number_requests
-- Membros podem criar solicitações para sua org
CREATE POLICY "Members can create requests for their org"
  ON public.voice_number_requests
  FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

-- Membros podem ver solicitações da sua org
CREATE POLICY "Members can view their org requests"
  ON public.voice_number_requests
  FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids()));

-- Super admins podem gerenciar todas solicitações
CREATE POLICY "Super admins can manage all requests"
  ON public.voice_number_requests
  FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- RLS Policies for voice_number_allocations
CREATE POLICY "Orgs can view their allocations"
  ON public.voice_number_allocations
  FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Super admins can manage all allocations"
  ON public.voice_number_allocations
  FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- RLS Policies for voice_call_logs
CREATE POLICY "Orgs can view their call logs"
  ON public.voice_call_logs
  FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Super admins can view all call logs"
  ON public.voice_call_logs
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- Indexes for performance
CREATE INDEX idx_voice_phone_numbers_status ON public.voice_phone_numbers(status);
CREATE INDEX idx_voice_phone_numbers_org ON public.voice_phone_numbers(allocated_to_org_id);
CREATE INDEX idx_voice_number_requests_status ON public.voice_number_requests(status);
CREATE INDEX idx_voice_number_requests_org ON public.voice_number_requests(organization_id);
CREATE INDEX idx_voice_call_logs_org ON public.voice_call_logs(organization_id);
CREATE INDEX idx_voice_call_logs_number ON public.voice_call_logs(phone_number_id);
CREATE INDEX idx_voice_call_logs_started ON public.voice_call_logs(started_at);

-- Enable realtime for call logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_call_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_number_requests;

-- Trigger for updated_at
CREATE TRIGGER update_voice_phone_numbers_updated_at
  BEFORE UPDATE ON public.voice_phone_numbers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_voice_number_requests_updated_at
  BEFORE UPDATE ON public.voice_number_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();