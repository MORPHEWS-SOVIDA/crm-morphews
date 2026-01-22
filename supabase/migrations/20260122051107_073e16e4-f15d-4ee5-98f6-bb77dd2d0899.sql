
-- =====================================================
-- HELPER DONNA - Sistema de Assistente IA
-- =====================================================

-- Tabela de conversas do helper
CREATE TABLE public.helper_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'human_requested')),
  human_requested_at TIMESTAMPTZ,
  human_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de mensagens do helper
CREATE TABLE public.helper_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.helper_conversations(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'human')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de dicas por módulo/categoria
CREATE TABLE public.helper_tips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module TEXT NOT NULL,
  category TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  video_url TEXT,
  icon TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_helper_conversations_org ON public.helper_conversations(organization_id);
CREATE INDEX idx_helper_conversations_status ON public.helper_conversations(status);
CREATE INDEX idx_helper_messages_conversation ON public.helper_messages(conversation_id);
CREATE INDEX idx_helper_tips_module ON public.helper_tips(module);

-- Enable RLS
ALTER TABLE public.helper_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helper_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helper_tips ENABLE ROW LEVEL SECURITY;

-- Função helper para verificar master admin
CREATE OR REPLACE FUNCTION public.is_helper_master_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) OR (auth.jwt() ->> 'email') = 'thiago.morphews@gmail.com'
$$;

-- Policies para helper_conversations
CREATE POLICY "Users can view own org helper conversations" 
  ON public.helper_conversations FOR SELECT 
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
    OR public.is_helper_master_admin()
  );

CREATE POLICY "Users can create helper conversations" 
  ON public.helper_conversations FOR INSERT 
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own org helper conversations" 
  ON public.helper_conversations FOR UPDATE 
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
    OR public.is_helper_master_admin()
  );

-- Policies para helper_messages
CREATE POLICY "Users can view own org helper messages" 
  ON public.helper_messages FOR SELECT 
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
    OR public.is_helper_master_admin()
  );

CREATE POLICY "Users can create helper messages" 
  ON public.helper_messages FOR INSERT 
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
    OR public.is_helper_master_admin()
  );

-- Policies para helper_tips (público para leitura de dicas ativas)
CREATE POLICY "Anyone can view active tips" 
  ON public.helper_tips FOR SELECT 
  USING (is_active = true OR public.is_helper_master_admin());

CREATE POLICY "Master admins can manage tips" 
  ON public.helper_tips FOR ALL 
  USING (public.is_helper_master_admin());

-- Trigger para updated_at
CREATE TRIGGER update_helper_conversations_updated_at
  BEFORE UPDATE ON public.helper_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_helper_tips_updated_at
  BEFORE UPDATE ON public.helper_tips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime para conversas (Super Admin ver em tempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE public.helper_messages;
