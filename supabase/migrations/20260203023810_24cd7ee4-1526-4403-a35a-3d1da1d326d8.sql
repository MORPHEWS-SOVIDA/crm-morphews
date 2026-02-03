-- Adicionar suporte a múltiplos canais (Instagram, Facebook, etc.)
-- A tabela whatsapp_instances vai servir como tabela de canais unificada

-- 1. Criar ENUM para tipo de canal (se não existir)
DO $$ BEGIN
  CREATE TYPE public.channel_type AS ENUM ('whatsapp', 'instagram', 'facebook', 'email');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Adicionar coluna channel_type à tabela whatsapp_instances
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS channel_type public.channel_type DEFAULT 'whatsapp';

-- 3. Adicionar campos específicos para Instagram/Facebook (Meta)
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS meta_page_id TEXT,
ADD COLUMN IF NOT EXISTS meta_account_id TEXT,
ADD COLUMN IF NOT EXISTS meta_access_token TEXT,
ADD COLUMN IF NOT EXISTS instagram_username TEXT;

-- 4. Adicionar channel_type à tabela whatsapp_conversations para facilitar consultas
ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS channel_type public.channel_type DEFAULT 'whatsapp';

-- 5. Dropar view antiga e recriar com estrutura atualizada
DROP VIEW IF EXISTS public.channels;

CREATE VIEW public.channels AS
SELECT 
  id,
  organization_id,
  name,
  phone_number,
  channel_type,
  provider,
  status,
  is_connected,
  qr_code_base64,
  evolution_instance_id,
  evolution_api_token,
  meta_page_id,
  meta_account_id,
  instagram_username,
  created_at,
  updated_at,
  deleted_at
FROM public.whatsapp_instances;

-- 6. Criar índice para performance de queries por canal
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_channel_type 
ON public.whatsapp_instances(channel_type);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_channel_type 
ON public.whatsapp_conversations(channel_type);

-- 7. Comentários para documentação
COMMENT ON COLUMN public.whatsapp_instances.channel_type IS 'Tipo de canal: whatsapp, instagram, facebook, email';
COMMENT ON COLUMN public.whatsapp_instances.meta_page_id IS 'ID da página do Facebook (para Instagram/Messenger)';
COMMENT ON COLUMN public.whatsapp_instances.meta_account_id IS 'ID da conta Instagram Business';
COMMENT ON COLUMN public.whatsapp_instances.instagram_username IS 'Username do Instagram (@usuario)';