-- =============================================================================
-- DISTRIBUIÇÃO DE LEADS WHATSAPP 1.0
-- =============================================================================

-- 1. Adicionar campos de configuração nas instâncias
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS distribution_mode text NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS auto_close_hours integer DEFAULT 24,
ADD COLUMN IF NOT EXISTS last_assigned_user_id uuid;

-- Comentário: distribution_mode pode ser 'manual' ou 'auto'

-- 2. Adicionar campos no whatsapp_instance_users para permissões expandidas
ALTER TABLE public.whatsapp_instance_users
ADD COLUMN IF NOT EXISTS is_instance_admin boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS participates_in_distribution boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS available_from time DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS available_until time DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS is_always_available boolean NOT NULL DEFAULT true;

-- 3. Adicionar campos de controle nas conversas
ALTER TABLE public.whatsapp_conversations
ADD COLUMN IF NOT EXISTS assigned_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_customer_message_at timestamp with time zone;

-- 4. Criar tabela de histórico de atribuições
CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_assignments (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    from_user_id uuid,
    to_user_id uuid,
    action text NOT NULL, -- 'assigned', 'transferred', 'closed', 'reopened'
    assigned_by uuid,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_status ON public.whatsapp_conversations(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_assigned_user ON public.whatsapp_conversations(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_org_status ON public.whatsapp_conversations(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_conversation_assignments_conversation ON public.whatsapp_conversation_assignments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_assignments_to_user ON public.whatsapp_conversation_assignments(to_user_id);

-- 5. RLS para a nova tabela
ALTER TABLE public.whatsapp_conversation_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assignment history for their org"
ON public.whatsapp_conversation_assignments
FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert assignment records for their org"
ON public.whatsapp_conversation_assignments
FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
);

-- 6. Função para auto-distribuição round-robin
CREATE OR REPLACE FUNCTION public.get_next_available_user_for_distribution(
    p_instance_id uuid,
    p_organization_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_next_user_id uuid;
    v_last_assigned_user_id uuid;
    v_current_time time;
BEGIN
    v_current_time := CURRENT_TIME;
    
    -- Pegar o último usuário atribuído
    SELECT last_assigned_user_id INTO v_last_assigned_user_id
    FROM whatsapp_instances
    WHERE id = p_instance_id;
    
    -- Buscar próximo usuário elegível (round-robin)
    SELECT wiu.user_id INTO v_next_user_id
    FROM whatsapp_instance_users wiu
    WHERE wiu.instance_id = p_instance_id
      AND wiu.participates_in_distribution = true
      AND wiu.can_view = true
      AND (
          wiu.is_always_available = true
          OR (v_current_time >= wiu.available_from AND v_current_time <= wiu.available_until)
      )
    ORDER BY 
        CASE 
            WHEN v_last_assigned_user_id IS NULL THEN 0
            WHEN wiu.user_id = v_last_assigned_user_id THEN 1
            ELSE 0
        END,
        wiu.created_at
    LIMIT 1;
    
    -- Se não encontrou nenhum, buscar usuário admin da instância como fallback
    IF v_next_user_id IS NULL THEN
        SELECT wiu.user_id INTO v_next_user_id
        FROM whatsapp_instance_users wiu
        WHERE wiu.instance_id = p_instance_id
          AND wiu.is_instance_admin = true
          AND wiu.can_view = true
        LIMIT 1;
    END IF;
    
    -- Se encontrou, atualizar o último atribuído
    IF v_next_user_id IS NOT NULL THEN
        UPDATE whatsapp_instances
        SET last_assigned_user_id = v_next_user_id
        WHERE id = p_instance_id;
    END IF;
    
    RETURN v_next_user_id;
END;
$$;

-- 7. Função para assumir lead (com lock de concorrência)
CREATE OR REPLACE FUNCTION public.claim_whatsapp_conversation(
    p_conversation_id uuid,
    p_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_status text;
    v_current_assigned uuid;
    v_org_id uuid;
BEGIN
    -- Lock a row para evitar race condition
    SELECT status, assigned_user_id, organization_id 
    INTO v_current_status, v_current_assigned, v_org_id
    FROM whatsapp_conversations
    WHERE id = p_conversation_id
    FOR UPDATE;
    
    -- Verificar se já está atribuído a outro usuário
    IF v_current_status = 'assigned' AND v_current_assigned IS NOT NULL AND v_current_assigned != p_user_id THEN
        RETURN json_build_object('success', false, 'error', 'Conversa já foi assumida por outro usuário');
    END IF;
    
    -- Atualizar a conversa
    UPDATE whatsapp_conversations
    SET status = 'assigned',
        assigned_user_id = p_user_id,
        assigned_at = now(),
        updated_at = now()
    WHERE id = p_conversation_id;
    
    -- Registrar no histórico
    INSERT INTO whatsapp_conversation_assignments (
        conversation_id, organization_id, from_user_id, to_user_id, action, assigned_by
    ) VALUES (
        p_conversation_id, v_org_id, v_current_assigned, p_user_id, 'assigned', p_user_id
    );
    
    RETURN json_build_object('success', true);
END;
$$;

-- 8. Função para transferir conversa
CREATE OR REPLACE FUNCTION public.transfer_whatsapp_conversation(
    p_conversation_id uuid,
    p_to_user_id uuid,
    p_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_from_user_id uuid;
    v_org_id uuid;
BEGIN
    SELECT assigned_user_id, organization_id 
    INTO v_from_user_id, v_org_id
    FROM whatsapp_conversations
    WHERE id = p_conversation_id
    FOR UPDATE;
    
    -- Atualizar a conversa
    UPDATE whatsapp_conversations
    SET assigned_user_id = p_to_user_id,
        assigned_at = now(),
        updated_at = now()
    WHERE id = p_conversation_id;
    
    -- Registrar no histórico
    INSERT INTO whatsapp_conversation_assignments (
        conversation_id, organization_id, from_user_id, to_user_id, action, assigned_by, notes
    ) VALUES (
        p_conversation_id, v_org_id, v_from_user_id, p_to_user_id, 'transferred', auth.uid(), p_notes
    );
    
    RETURN json_build_object('success', true);
END;
$$;

-- 9. Função para encerrar conversa
CREATE OR REPLACE FUNCTION public.close_whatsapp_conversation(
    p_conversation_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_assigned_user_id uuid;
    v_org_id uuid;
BEGIN
    SELECT assigned_user_id, organization_id 
    INTO v_assigned_user_id, v_org_id
    FROM whatsapp_conversations
    WHERE id = p_conversation_id
    FOR UPDATE;
    
    -- Atualizar a conversa
    UPDATE whatsapp_conversations
    SET status = 'closed',
        closed_at = now(),
        updated_at = now()
    WHERE id = p_conversation_id;
    
    -- Registrar no histórico
    INSERT INTO whatsapp_conversation_assignments (
        conversation_id, organization_id, from_user_id, to_user_id, action, assigned_by
    ) VALUES (
        p_conversation_id, v_org_id, v_assigned_user_id, NULL, 'closed', auth.uid()
    );
    
    RETURN json_build_object('success', true);
END;
$$;

-- 10. Função para reabrir conversa (quando cliente manda mensagem em conversa fechada)
CREATE OR REPLACE FUNCTION public.reopen_whatsapp_conversation(
    p_conversation_id uuid,
    p_instance_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_distribution_mode text;
    v_org_id uuid;
    v_next_user uuid;
BEGIN
    -- Buscar modo de distribuição
    SELECT distribution_mode, organization_id 
    INTO v_distribution_mode, v_org_id
    FROM whatsapp_instances
    WHERE id = p_instance_id;
    
    IF v_distribution_mode = 'auto' THEN
        -- Auto-distribuição: atribuir ao próximo usuário
        v_next_user := get_next_available_user_for_distribution(p_instance_id, v_org_id);
        
        UPDATE whatsapp_conversations
        SET status = CASE WHEN v_next_user IS NOT NULL THEN 'assigned' ELSE 'pending' END,
            assigned_user_id = v_next_user,
            assigned_at = CASE WHEN v_next_user IS NOT NULL THEN now() ELSE NULL END,
            closed_at = NULL,
            last_customer_message_at = now(),
            updated_at = now()
        WHERE id = p_conversation_id;
        
        IF v_next_user IS NOT NULL THEN
            INSERT INTO whatsapp_conversation_assignments (
                conversation_id, organization_id, to_user_id, action
            ) VALUES (
                p_conversation_id, v_org_id, v_next_user, 'assigned'
            );
        END IF;
    ELSE
        -- Manual: vai para pendente
        UPDATE whatsapp_conversations
        SET status = 'pending',
            assigned_user_id = NULL,
            assigned_at = NULL,
            closed_at = NULL,
            last_customer_message_at = now(),
            updated_at = now()
        WHERE id = p_conversation_id;
        
        INSERT INTO whatsapp_conversation_assignments (
            conversation_id, organization_id, action
        ) VALUES (
            p_conversation_id, v_org_id, 'reopened'
        );
    END IF;
    
    RETURN json_build_object('success', true, 'distribution_mode', v_distribution_mode);
END;
$$;

-- 11. Adicionar realtime para a tabela de conversas (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'whatsapp_conversations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
    END IF;
END $$;