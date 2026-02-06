-- ============================================================================
-- CONECTA TIME - SLACK-LIKE FEATURES
-- Threads, Reações, Canais Públicos/Privados, Status Online, Typing Indicators
-- ============================================================================

-- 1. ADICIONAR SUPORTE A THREADS (parent_message_id para respostas em linha)
ALTER TABLE public.team_messages 
ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES public.team_messages(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS thread_reply_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS thread_last_reply_at timestamptz;

-- Criar índice para performance de threads
CREATE INDEX IF NOT EXISTS idx_team_messages_thread_id ON public.team_messages(thread_id) WHERE thread_id IS NOT NULL;

-- 2. TABELA DE REAÇÕES EM MENSAGENS
CREATE TABLE IF NOT EXISTS public.team_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.team_messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.team_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions in their org"
ON public.team_message_reactions FOR SELECT
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can add reactions"
ON public.team_message_reactions FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can remove their reactions"
ON public.team_message_reactions FOR DELETE
USING (user_id = auth.uid());

-- Índice para buscar reações por mensagem
CREATE INDEX IF NOT EXISTS idx_team_message_reactions_message ON public.team_message_reactions(message_id);

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_message_reactions;

-- 3. ADICIONAR CAMPOS PARA CANAIS (público/privado)
ALTER TABLE public.team_conversations
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS channel_slug text,
ADD COLUMN IF NOT EXISTS channel_topic text;

-- Índice para canais públicos
CREATE INDEX IF NOT EXISTS idx_team_conversations_public ON public.team_conversations(organization_id, is_public) 
WHERE is_public = true AND conversation_type = 'group';

-- Unique slug por organização
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_conversations_slug 
ON public.team_conversations(organization_id, channel_slug) 
WHERE channel_slug IS NOT NULL;

-- 4. TABELA DE PRESENÇA/STATUS ONLINE
CREATE TABLE IF NOT EXISTS public.team_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'online' CHECK (status IN ('online', 'away', 'busy', 'offline')),
  status_message text,
  last_seen_at timestamptz DEFAULT now() NOT NULL,
  is_typing_in uuid REFERENCES public.team_conversations(id) ON DELETE SET NULL,
  typing_started_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, organization_id)
);

ALTER TABLE public.team_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view presence in their org"
ON public.team_presence FOR SELECT
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own presence"
ON public.team_presence FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their presence"
ON public.team_presence FOR UPDATE
USING (user_id = auth.uid());

-- Índice para buscar presença por organização
CREATE INDEX IF NOT EXISTS idx_team_presence_org ON public.team_presence(organization_id, status);

-- Enable realtime for presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_presence;

-- 5. TABELA DE ARQUIVOS/ANEXOS
CREATE TABLE IF NOT EXISTS public.team_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  conversation_id uuid REFERENCES public.team_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.team_messages(id) ON DELETE SET NULL,
  uploaded_by uuid NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  file_url text NOT NULL,
  thumbnail_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.team_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view files in their org"
ON public.team_files FOR SELECT
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can upload files"
ON public.team_files FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid() AND
  organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete their files"
ON public.team_files FOR DELETE
USING (uploaded_by = auth.uid());

-- Índice para arquivos por conversa
CREATE INDEX IF NOT EXISTS idx_team_files_conversation ON public.team_files(conversation_id);

-- 6. TABELA DE PINS (mensagens fixadas)
CREATE TABLE IF NOT EXISTS public.team_pinned_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.team_messages(id) ON DELETE CASCADE NOT NULL,
  conversation_id uuid REFERENCES public.team_conversations(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  pinned_by uuid NOT NULL,
  pinned_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(message_id)
);

ALTER TABLE public.team_pinned_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pins in their org"
ON public.team_pinned_messages FOR SELECT
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can pin messages"
ON public.team_pinned_messages FOR INSERT
WITH CHECK (
  pinned_by = auth.uid() AND
  organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can unpin messages"
ON public.team_pinned_messages FOR DELETE
USING (pinned_by = auth.uid());

-- 7. FUNÇÃO PARA ATUALIZAR THREAD STATS
CREATE OR REPLACE FUNCTION public.update_thread_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.thread_id IS NOT NULL THEN
    UPDATE public.team_messages
    SET 
      thread_reply_count = (
        SELECT COUNT(*) FROM public.team_messages 
        WHERE thread_id = NEW.thread_id
      ),
      thread_last_reply_at = now()
    WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger para atualizar stats de thread
DROP TRIGGER IF EXISTS trg_update_thread_stats ON public.team_messages;
CREATE TRIGGER trg_update_thread_stats
AFTER INSERT ON public.team_messages
FOR EACH ROW
WHEN (NEW.thread_id IS NOT NULL)
EXECUTE FUNCTION public.update_thread_stats();

-- 8. FUNÇÃO PARA ATUALIZAR PRESENÇA
CREATE OR REPLACE FUNCTION public.update_user_presence(
  p_organization_id uuid,
  p_status text DEFAULT 'online',
  p_status_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.team_presence (user_id, organization_id, status, status_message, last_seen_at, updated_at)
  VALUES (auth.uid(), p_organization_id, p_status, p_status_message, now(), now())
  ON CONFLICT (user_id, organization_id)
  DO UPDATE SET
    status = p_status,
    status_message = COALESCE(p_status_message, team_presence.status_message),
    last_seen_at = now(),
    updated_at = now();
END;
$$;

-- 9. FUNÇÃO PARA INDICADOR DE DIGITAÇÃO
CREATE OR REPLACE FUNCTION public.set_typing_indicator(
  p_organization_id uuid,
  p_conversation_id uuid,
  p_is_typing boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.team_presence (user_id, organization_id, is_typing_in, typing_started_at, last_seen_at, updated_at)
  VALUES (
    auth.uid(), 
    p_organization_id, 
    CASE WHEN p_is_typing THEN p_conversation_id ELSE NULL END,
    CASE WHEN p_is_typing THEN now() ELSE NULL END,
    now(), 
    now()
  )
  ON CONFLICT (user_id, organization_id)
  DO UPDATE SET
    is_typing_in = CASE WHEN p_is_typing THEN p_conversation_id ELSE NULL END,
    typing_started_at = CASE WHEN p_is_typing THEN now() ELSE NULL END,
    last_seen_at = now(),
    updated_at = now();
END;
$$;

-- 10. CRIAR BUCKET PARA ARQUIVOS DO TEAM CHAT
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-files', 'team-files', false)
ON CONFLICT (id) DO NOTHING;

-- Policies para storage
CREATE POLICY "Team members can view files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'team-files' AND
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE user_id = auth.uid() 
    AND organization_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Team members can upload files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'team-files' AND
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE user_id = auth.uid() 
    AND organization_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can delete their uploads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'team-files' AND
  auth.uid()::text = (storage.foldername(name))[2]
);