-- PHASE 1: WhatsApp Multi-Instance Tables

-- Discount coupons for WhatsApp instances
CREATE TABLE public.discount_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_value_cents INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  valid_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- WhatsApp instances per organization
CREATE TABLE public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_number TEXT,
  z_api_instance_id TEXT,
  z_api_token TEXT,
  z_api_client_token TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disconnected', 'canceled')),
  qr_code_base64 TEXT,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  monthly_price_cents INTEGER NOT NULL DEFAULT 19700,
  payment_source TEXT NOT NULL DEFAULT 'stripe' CHECK (payment_source IN ('stripe', 'admin_grant')),
  stripe_subscription_item_id TEXT,
  applied_coupon_id UUID REFERENCES public.discount_coupons(id),
  discount_applied_cents INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User permissions per instance
CREATE TABLE public.whatsapp_instance_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_send BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(instance_id, user_id)
);

-- Conversations (each phone number = one conversation)
CREATE TABLE public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  contact_profile_pic TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(instance_id, phone_number)
);

-- Messages
CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  z_api_message_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'audio', 'image', 'video', 'document', 'sticker', 'location')),
  media_url TEXT,
  media_caption TEXT,
  is_from_bot BOOLEAN NOT NULL DEFAULT false,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bot configuration per instance (Phase 2 but create table now)
CREATE TABLE public.whatsapp_bot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL UNIQUE REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  bot_name TEXT,
  bot_gender TEXT CHECK (bot_gender IN ('male', 'female', 'neutral')),
  is_human_like BOOLEAN NOT NULL DEFAULT true,
  company_name TEXT,
  company_website TEXT,
  main_objective TEXT,
  products_prices TEXT,
  forbidden_words TEXT[],
  supervisor_mode BOOLEAN NOT NULL DEFAULT true,
  tokens_used_month INTEGER NOT NULL DEFAULT 0,
  tokens_limit_month INTEGER NOT NULL DEFAULT 300000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Organization WhatsApp credits (free instances granted by super admin)
CREATE TABLE public.organization_whatsapp_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  free_instances_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.discount_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_instance_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_bot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_whatsapp_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Discount coupons: Only master admin can manage, anyone can read active coupons
CREATE POLICY "Master admin can manage coupons"
ON public.discount_coupons FOR ALL
USING (is_master_admin(auth.uid()));

CREATE POLICY "Anyone can view active coupons"
ON public.discount_coupons FOR SELECT
USING (is_active = true AND (valid_until IS NULL OR valid_until > now()));

-- WhatsApp instances: Org members can view/manage their org's instances
CREATE POLICY "Users can view their org instances"
ON public.whatsapp_instances FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Org admins can insert instances"
ON public.whatsapp_instances FOR INSERT
WITH CHECK (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org admins can update instances"
ON public.whatsapp_instances FOR UPDATE
USING (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org admins can delete instances"
ON public.whatsapp_instances FOR DELETE
USING (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Master admin can manage all instances"
ON public.whatsapp_instances FOR ALL
USING (is_master_admin(auth.uid()));

-- Instance users: Users can see permissions for their org's instances
CREATE POLICY "Users can view instance permissions"
ON public.whatsapp_instance_users FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.whatsapp_instances wi 
  WHERE wi.id = instance_id AND wi.organization_id = get_user_organization_id()
));

CREATE POLICY "Org admins can manage instance permissions"
ON public.whatsapp_instance_users FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.whatsapp_instances wi 
  WHERE wi.id = instance_id 
  AND wi.organization_id = get_user_organization_id()
  AND is_org_admin(auth.uid(), wi.organization_id)
));

-- Conversations: Users can only see conversations from instances they have access to
CREATE POLICY "Users can view conversations they have access to"
ON public.whatsapp_conversations FOR SELECT
USING (
  organization_id = get_user_organization_id()
  AND EXISTS (
    SELECT 1 FROM public.whatsapp_instance_users wiu 
    WHERE wiu.instance_id = whatsapp_conversations.instance_id 
    AND wiu.user_id = auth.uid() 
    AND wiu.can_view = true
  )
);

CREATE POLICY "Users can insert conversations"
ON public.whatsapp_conversations FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update conversations they have access to"
ON public.whatsapp_conversations FOR UPDATE
USING (
  organization_id = get_user_organization_id()
  AND EXISTS (
    SELECT 1 FROM public.whatsapp_instance_users wiu 
    WHERE wiu.instance_id = whatsapp_conversations.instance_id 
    AND wiu.user_id = auth.uid()
  )
);

-- Messages: Users can view/send messages in conversations they have access to
CREATE POLICY "Users can view messages"
ON public.whatsapp_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.whatsapp_conversations wc
  JOIN public.whatsapp_instance_users wiu ON wiu.instance_id = wc.instance_id
  WHERE wc.id = conversation_id 
  AND wiu.user_id = auth.uid() 
  AND wiu.can_view = true
));

CREATE POLICY "Users can insert messages"
ON public.whatsapp_messages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.whatsapp_conversations wc
  JOIN public.whatsapp_instance_users wiu ON wiu.instance_id = wc.instance_id
  WHERE wc.id = conversation_id 
  AND wiu.user_id = auth.uid() 
  AND wiu.can_send = true
));

-- Bot configs: Org admins can manage
CREATE POLICY "Users can view bot configs"
ON public.whatsapp_bot_configs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.whatsapp_instances wi 
  WHERE wi.id = instance_id AND wi.organization_id = get_user_organization_id()
));

CREATE POLICY "Org admins can manage bot configs"
ON public.whatsapp_bot_configs FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.whatsapp_instances wi 
  WHERE wi.id = instance_id 
  AND wi.organization_id = get_user_organization_id()
  AND is_org_admin(auth.uid(), wi.organization_id)
));

-- Organization WhatsApp credits: Only master admin can manage
CREATE POLICY "Master admin can manage org credits"
ON public.organization_whatsapp_credits FOR ALL
USING (is_master_admin(auth.uid()));

CREATE POLICY "Users can view their org credits"
ON public.organization_whatsapp_credits FOR SELECT
USING (organization_id = get_user_organization_id());

-- Indexes for performance
CREATE INDEX idx_whatsapp_instances_org ON public.whatsapp_instances(organization_id);
CREATE INDEX idx_whatsapp_conversations_instance ON public.whatsapp_conversations(instance_id);
CREATE INDEX idx_whatsapp_conversations_lead ON public.whatsapp_conversations(lead_id);
CREATE INDEX idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);
CREATE INDEX idx_whatsapp_messages_created ON public.whatsapp_messages(created_at DESC);

-- Triggers for updated_at
CREATE TRIGGER update_whatsapp_instances_updated_at
BEFORE UPDATE ON public.whatsapp_instances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_conversations_updated_at
BEFORE UPDATE ON public.whatsapp_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_bot_configs_updated_at
BEFORE UPDATE ON public.whatsapp_bot_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_org_whatsapp_credits_updated_at
BEFORE UPDATE ON public.organization_whatsapp_credits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();