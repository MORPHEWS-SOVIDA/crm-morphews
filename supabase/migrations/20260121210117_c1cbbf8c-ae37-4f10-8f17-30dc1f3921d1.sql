-- ============================================================================
-- Tabela de mensagens programadas da Secretária Morphews
-- ============================================================================

-- Tipos de destinatário
CREATE TYPE public.secretary_recipient_type AS ENUM ('owners', 'users');

-- Tipos de evento/trigger
CREATE TYPE public.secretary_message_type AS ENUM (
  'scheduled',      -- Mensagem agendada por dia/hora
  'followup',       -- Follow-up após X dias sem contato
  'birthday',       -- Aniversário do usuário
  'welcome',        -- Primeira mensagem de boas-vindas
  'reactivation'    -- Reativação de usuário inativo
);

-- Tabela principal de templates de mensagens
CREATE TABLE public.secretary_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tipo de destinatário
  recipient_type secretary_recipient_type NOT NULL,
  
  -- Tipo de mensagem
  message_type secretary_message_type NOT NULL DEFAULT 'scheduled',
  
  -- Para mensagens agendadas por dia
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Domingo, 1=Segunda...
  scheduled_time TIME NOT NULL DEFAULT '09:00:00',
  
  -- Para mensagens de follow-up (dias sem contato)
  days_without_contact INTEGER,
  
  -- Conteúdo
  message_title VARCHAR(100) NOT NULL,
  message_content TEXT NOT NULL,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_secretary_templates_active ON secretary_message_templates(is_active, message_type);
CREATE INDEX idx_secretary_templates_day ON secretary_message_templates(day_of_week) WHERE day_of_week IS NOT NULL;

-- Histórico de mensagens enviadas (para evitar duplicatas e tracking)
CREATE TABLE public.secretary_sent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  template_id UUID REFERENCES secretary_message_templates(id) ON DELETE SET NULL,
  
  -- Destinatário
  recipient_phone VARCHAR(20) NOT NULL,
  recipient_user_id UUID,
  recipient_org_id UUID,
  recipient_name VARCHAR(255),
  
  -- Mensagem enviada (com variáveis substituídas)
  message_content TEXT NOT NULL,
  
  -- Status de envio
  status VARCHAR(20) NOT NULL DEFAULT 'sent',
  error_message TEXT,
  
  -- Data do envio (para controle de duplicatas)
  sent_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para evitar duplicatas no mesmo dia (usando coluna simples)
CREATE UNIQUE INDEX idx_secretary_sent_unique_daily ON secretary_sent_messages(
  template_id, 
  recipient_phone, 
  sent_date
) WHERE template_id IS NOT NULL;

CREATE INDEX idx_secretary_sent_phone ON secretary_sent_messages(recipient_phone, sent_at DESC);

-- Tabela para armazenar contexto de conversas da Secretária (melhorar IA)
CREATE TABLE public.secretary_conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  phone VARCHAR(20) NOT NULL,
  
  -- Direção
  direction VARCHAR(10) NOT NULL, -- 'inbound' ou 'outbound'
  
  -- Conteúdo
  message_content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text',
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_secretary_history_phone ON secretary_conversation_history(phone, created_at DESC);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_secretary_templates_updated_at
BEFORE UPDATE ON secretary_message_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE secretary_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE secretary_sent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE secretary_conversation_history ENABLE ROW LEVEL SECURITY;

-- Políticas: acesso total via service role
CREATE POLICY "Service role full access templates"
ON secretary_message_templates
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access sent"
ON secretary_sent_messages
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access history"
ON secretary_conversation_history
FOR ALL
USING (true)
WITH CHECK (true);