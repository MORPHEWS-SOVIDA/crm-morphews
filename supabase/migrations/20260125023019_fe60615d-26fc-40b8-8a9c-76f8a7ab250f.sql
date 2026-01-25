-- =====================================================
-- SISTEMA DE E-MAILS POR STOREFRONT / LANDING PAGE
-- =====================================================

-- 1. Adicionar vínculo de storefront/landing às sequências existentes
ALTER TABLE public.email_sequences 
ADD COLUMN IF NOT EXISTS storefront_id UUID REFERENCES public.tenant_storefronts(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS landing_page_id UUID REFERENCES public.landing_pages(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS energy_cost_generation INT DEFAULT 0;

-- 2. Adicionar custo de energia aos envios
ALTER TABLE public.email_sends 
ADD COLUMN IF NOT EXISTS energy_cost INT DEFAULT 10;

-- 3. Criar tabela para presets de sequências padrão
CREATE TABLE IF NOT EXISTS public.email_sequence_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  preset_type VARCHAR(50) NOT NULL, -- abandoned_cart, post_purchase, recompra, welcome_lead
  step_number INT NOT NULL,
  delay_minutes INT NOT NULL DEFAULT 0,
  default_subject VARCHAR(200) NOT NULL,
  default_html_template TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Inserir presets padrão de Carrinho Abandonado
INSERT INTO public.email_sequence_presets (preset_type, step_number, delay_minutes, default_subject, default_html_template, variables) VALUES
-- Carrinho Abandonado
('abandoned_cart', 1, 0, '🛒 {{nome}}, você esqueceu algo!', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #333;">Ei {{nome}}, seu carrinho está esperando!</h1>
<p>Você deixou alguns itens incríveis no seu carrinho:</p>
<p style="background: #f5f5f5; padding: 15px; border-radius: 8px;"><strong>{{produtos}}</strong></p>
<p style="font-size: 18px; color: #e74c3c;"><strong>Total: {{valor}}</strong></p>
<a href="{{link_carrinho}}" style="display: inline-block; background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">Finalizar Compra</a>
<p style="color: #666; font-size: 14px;">Seu carrinho expira em 24 horas. Não perca!</p>
</div>', '["nome", "produtos", "valor", "link_carrinho"]'),

('abandoned_cart', 2, 60, '⏰ {{nome}}, última chance! Seu carrinho vai expirar', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #e74c3c;">🕐 Seu tempo está acabando, {{nome}}!</h1>
<p>Os itens no seu carrinho estão quase esgotando:</p>
<p style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;"><strong>{{produtos}}</strong></p>
<p>Total: <strong style="color: #e74c3c;">{{valor}}</strong></p>
<a href="{{link_carrinho}}" style="display: inline-block; background: #e74c3c; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-size: 16px;">GARANTIR MINHA COMPRA →</a>
</div>', '["nome", "produtos", "valor", "link_carrinho"]'),

('abandoned_cart', 3, 180, '😢 {{nome}}, sentimos sua falta', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #333;">Aconteceu algum problema, {{nome}}?</h1>
<p>Notamos que você não finalizou sua compra. Se tiver alguma dúvida, estamos aqui para ajudar!</p>
<p>Seu carrinho ainda está salvo:</p>
<p style="background: #f8f9fa; padding: 15px; border-radius: 8px;"><strong>{{produtos}}</strong> - {{valor}}</p>
<a href="{{link_carrinho}}" style="display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">Voltar ao Carrinho</a>
<p style="color: #666;">Responda este email se precisar de ajuda!</p>
</div>', '["nome", "produtos", "valor", "link_carrinho"]'),

('abandoned_cart', 4, 1440, '🎁 {{nome}}, uma surpresa especial para você!', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #9b59b6;">Uma última chance, {{nome}}! 🎁</h1>
<p>Sabemos que você estava interessado(a) em:</p>
<p style="background: #f5f0ff; padding: 15px; border-radius: 8px;"><strong>{{produtos}}</strong></p>
<p style="font-size: 20px; color: #9b59b6;"><strong>Seu carrinho ainda está disponível!</strong></p>
<a href="{{link_carrinho}}" style="display: inline-block; background: #9b59b6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; margin: 20px 0;">FINALIZAR AGORA</a>
<p style="color: #999; font-size: 12px;">Se não quiser mais receber, responda PARAR.</p>
</div>', '["nome", "produtos", "valor", "link_carrinho"]'),

-- Pós-Compra
('post_purchase', 1, 0, '✅ {{nome}}, pedido confirmado! #{{pedido_id}}', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #28a745;">🎉 Parabéns pela compra, {{nome}}!</h1>
<p>Seu pedido foi confirmado com sucesso.</p>
<div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
<p><strong>Pedido:</strong> #{{pedido_id}}</p>
<p><strong>Produtos:</strong> {{produtos}}</p>
<p><strong>Total:</strong> {{valor}}</p>
</div>
<p>Você receberá o código de rastreio assim que o pedido for despachado.</p>
<p>Obrigado por comprar na {{loja_nome}}! 💚</p>
</div>', '["nome", "pedido_id", "produtos", "valor", "loja_nome"]'),

('post_purchase', 2, 5, '💡 {{nome}}, aproveite essa oferta exclusiva!', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #f39c12;">🔥 Oferta Especial para Você, {{nome}}!</h1>
<p>Que tal garantir mais unidades com desconto especial?</p>
<div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px dashed #f39c12;">
<h2 style="margin: 0;">Leve MAIS e pague MENOS!</h2>
<p>Aproveite condições exclusivas para quem já é cliente.</p>
</div>
<a href="{{link_loja}}" style="display: inline-block; background: #f39c12; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px;">VER OFERTAS →</a>
</div>', '["nome", "link_loja"]'),

('post_purchase', 3, 1440, '📦 {{nome}}, acompanhe seu pedido pelo WhatsApp!', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #25D366;">📱 Acompanhe seu Pedido!</h1>
<p>Olá {{nome}}, quer receber atualizações do seu pedido direto no WhatsApp?</p>
<p>É simples e rápido! Basta enviar "MEU PEDIDO" para o nosso número:</p>
<div style="background: #25D366; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
<p style="color: white; font-size: 24px; margin: 0;"><strong>{{whatsapp_loja}}</strong></p>
</div>
<p>Você receberá atualizações sobre preparação, envio e entrega!</p>
</div>', '["nome", "whatsapp_loja"]'),

-- Recompra
('recompra', 1, 43200, '🔄 {{nome}}, está na hora de reabastecer?', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #3498db;">Hora de Reabastecer, {{nome}}? 🔄</h1>
<p>Faz 30 dias desde sua última compra de:</p>
<p style="background: #e3f2fd; padding: 15px; border-radius: 8px;"><strong>{{ultimo_produto}}</strong></p>
<p>Não deixe acabar! Garanta já a reposição com as melhores condições.</p>
<a href="{{link_loja}}" style="display: inline-block; background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">COMPRAR NOVAMENTE</a>
</div>', '["nome", "ultimo_produto", "link_loja"]'),

('recompra', 2, 129600, '💊 {{nome}}, seus produtos favoritos estão esperando!', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #9b59b6;">Sentimos sua falta, {{nome}}!</h1>
<p>Já se passaram 90 dias desde sua última compra.</p>
<p>Volte e confira as novidades da {{loja_nome}}!</p>
<a href="{{link_loja}}" style="display: inline-block; background: #9b59b6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; margin: 20px 0;">VER NOVIDADES →</a>
</div>', '["nome", "loja_nome", "link_loja"]'),

-- Boas-vindas Lead
('welcome_lead', 1, 0, '👋 Bem-vindo(a), {{nome}}!', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #3498db;">Bem-vindo(a) à {{loja_nome}}! 🎉</h1>
<p>Olá {{nome}}, é um prazer ter você por aqui!</p>
<p>Preparamos ofertas especiais para novos visitantes. Confira:</p>
<a href="{{link_loja}}" style="display: inline-block; background: #3498db; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; margin: 20px 0;">CONHECER A LOJA →</a>
<p style="color: #666;">Qualquer dúvida, estamos à disposição!</p>
</div>', '["nome", "loja_nome", "link_loja"]'),

('welcome_lead', 2, 1440, '🎁 {{nome}}, temos algo especial para você!', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #e74c3c;">Uma surpresa para você, {{nome}}! 🎁</h1>
<p>Vimos que você visitou nossa loja mas ainda não finalizou a compra.</p>
<p>Confira nossos produtos mais vendidos:</p>
<a href="{{link_loja}}" style="display: inline-block; background: #e74c3c; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; margin: 20px 0;">VER MAIS VENDIDOS</a>
</div>', '["nome", "link_loja"]');

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_email_sequences_storefront ON public.email_sequences(storefront_id) WHERE storefront_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_sequences_landing ON public.email_sequences(landing_page_id) WHERE landing_page_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_presets_type ON public.email_sequence_presets(preset_type);

-- 6. RLS para presets (somente leitura para todos)
ALTER TABLE public.email_sequence_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read email presets" 
ON public.email_sequence_presets 
FOR SELECT 
USING (true);

-- 7. Comentários
COMMENT ON COLUMN public.email_sequences.storefront_id IS 'Se vinculada a uma loja específica';
COMMENT ON COLUMN public.email_sequences.landing_page_id IS 'Se vinculada a uma landing page específica';
COMMENT ON COLUMN public.email_sequences.ai_generated IS 'Se foi gerada automaticamente por IA';
COMMENT ON COLUMN public.email_sends.energy_cost IS 'Custo de energia para envio (padrão 10)';