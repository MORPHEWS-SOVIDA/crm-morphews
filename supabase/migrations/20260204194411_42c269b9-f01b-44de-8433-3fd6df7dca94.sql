-- =============================================================================
-- CONECTA TIME - Sistema de Comunicação Interna Contextual
-- =============================================================================

-- Tabela de conversas/canais
CREATE TABLE public.team_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Tipo de conversa
  conversation_type TEXT NOT NULL DEFAULT 'direct' CHECK (conversation_type IN ('direct', 'group', 'contextual')),
  
  -- Para grupos/canais
  name TEXT, -- Nome do grupo/canal (null para direct)
  description TEXT,
  avatar_url TEXT,
  
  -- Para conversas contextuais (vinculadas a entidades)
  context_type TEXT CHECK (context_type IN ('lead', 'demand', 'sac', 'product', 'sale')),
  context_id UUID, -- ID da entidade vinculada
  context_name TEXT, -- Cache do nome para display rápido
  
  -- Metadados
  created_by UUID REFERENCES auth.users(id),
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_team_conversations_org ON public.team_conversations(organization_id);
CREATE INDEX idx_team_conversations_context ON public.team_conversations(context_type, context_id) WHERE context_type IS NOT NULL;
CREATE INDEX idx_team_conversations_last_message ON public.team_conversations(last_message_at DESC NULLS LAST);

-- Membros das conversas
CREATE TABLE public.team_conversation_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.team_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Permissões
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  can_send_messages BOOLEAN DEFAULT TRUE,
  
  -- Status
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  is_muted BOOLEAN DEFAULT FALSE,
  
  -- Constraint única
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_team_conversation_members_user ON public.team_conversation_members(user_id);
CREATE INDEX idx_team_conversation_members_conv ON public.team_conversation_members(conversation_id);

-- Mensagens
CREATE TABLE public.team_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.team_conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Conteúdo
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'file', 'audio', 'system')),
  
  -- Anexos (JSON array)
  attachments JSONB DEFAULT '[]'::jsonb,
  
  -- Menções (JSON array com {type, id, display_name})
  mentions JSONB DEFAULT '[]'::jsonb,
  
  -- Reply/thread
  reply_to_id UUID REFERENCES public.team_messages(id),
  
  -- Status
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_messages_conversation ON public.team_messages(conversation_id, created_at DESC);
CREATE INDEX idx_team_messages_sender ON public.team_messages(sender_id);
CREATE INDEX idx_team_messages_mentions ON public.team_messages USING GIN (mentions);

-- Menções (para notificações e busca)
CREATE TABLE public.team_mentions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.team_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.team_conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Quem mencionou
  mentioned_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Tipo de menção
  mention_type TEXT NOT NULL CHECK (mention_type IN ('user', 'lead', 'demand', 'product', 'sac', 'sale')),
  
  -- Para menções de usuários
  mentioned_user_id UUID REFERENCES auth.users(id),
  
  -- Para menções de entidades
  entity_id UUID,
  entity_name TEXT,
  
  -- Status de leitura (para usuários)
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_mentions_user ON public.team_mentions(mentioned_user_id, is_read) WHERE mentioned_user_id IS NOT NULL;
CREATE INDEX idx_team_mentions_entity ON public.team_mentions(mention_type, entity_id) WHERE entity_id IS NOT NULL;

-- Contadores de não lidas (view materializada para performance)
CREATE TABLE public.team_unread_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.team_conversations(id) ON DELETE CASCADE,
  
  unread_count INTEGER NOT NULL DEFAULT 0,
  unread_mentions INTEGER NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, conversation_id)
);

CREATE INDEX idx_team_unread_counts_user ON public.team_unread_counts(user_id, organization_id);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE public.team_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_unread_counts ENABLE ROW LEVEL SECURITY;

-- Conversas: usuário vê apenas conversas onde é membro
CREATE POLICY "Users can view their conversations"
  ON public.team_conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_conversation_members
      WHERE conversation_id = team_conversations.id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create conversations in their org"
  ON public.team_conversations FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Conversation admins can update"
  ON public.team_conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_conversation_members
      WHERE conversation_id = team_conversations.id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Membros: usuário vê membros de conversas onde participa
CREATE POLICY "Users can view members of their conversations"
  ON public.team_conversation_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_conversation_members AS my_membership
      WHERE my_membership.conversation_id = team_conversation_members.conversation_id
      AND my_membership.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join/add to conversations"
  ON public.team_conversation_members FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can leave conversations"
  ON public.team_conversation_members FOR DELETE
  USING (user_id = auth.uid());

-- Mensagens: usuário vê mensagens de conversas onde participa
CREATE POLICY "Users can view messages in their conversations"
  ON public.team_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_conversation_members
      WHERE conversation_id = team_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their conversations"
  ON public.team_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.team_conversation_members
      WHERE conversation_id = team_messages.conversation_id
      AND user_id = auth.uid()
      AND can_send_messages = TRUE
    )
  );

CREATE POLICY "Users can edit their own messages"
  ON public.team_messages FOR UPDATE
  USING (sender_id = auth.uid());

-- Menções: usuário vê suas menções
CREATE POLICY "Users can view their mentions"
  ON public.team_mentions FOR SELECT
  USING (
    mentioned_user_id = auth.uid()
    OR mentioned_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.team_conversation_members
      WHERE conversation_id = team_mentions.conversation_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create mentions"
  ON public.team_mentions FOR INSERT
  WITH CHECK (mentioned_by = auth.uid());

CREATE POLICY "Users can mark their mentions as read"
  ON public.team_mentions FOR UPDATE
  USING (mentioned_user_id = auth.uid());

-- Contadores: usuário vê apenas seus contadores
CREATE POLICY "Users can view their unread counts"
  ON public.team_unread_counts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can manage unread counts"
  ON public.team_unread_counts FOR ALL
  USING (user_id = auth.uid());

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Trigger para atualizar last_message_at na conversa
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.team_conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON public.team_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_last_message();

-- Trigger para incrementar contadores de não lidas
CREATE OR REPLACE FUNCTION public.increment_unread_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Incrementar contador para todos os membros exceto o remetente
  INSERT INTO public.team_unread_counts (user_id, organization_id, conversation_id, unread_count, last_updated_at)
  SELECT 
    m.user_id,
    m.organization_id,
    NEW.conversation_id,
    1,
    now()
  FROM public.team_conversation_members m
  WHERE m.conversation_id = NEW.conversation_id
    AND m.user_id != NEW.sender_id
  ON CONFLICT (user_id, conversation_id)
  DO UPDATE SET 
    unread_count = team_unread_counts.unread_count + 1,
    last_updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_increment_unread_counts
  AFTER INSERT ON public.team_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_unread_counts();

-- Trigger para incrementar menções não lidas
CREATE OR REPLACE FUNCTION public.increment_unread_mentions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mentioned_user_id IS NOT NULL THEN
    UPDATE public.team_unread_counts
    SET 
      unread_mentions = unread_mentions + 1,
      last_updated_at = now()
    WHERE user_id = NEW.mentioned_user_id
      AND conversation_id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_increment_unread_mentions
  AFTER INSERT ON public.team_mentions
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_unread_mentions();

-- Enable realtime para mensagens
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_unread_counts;