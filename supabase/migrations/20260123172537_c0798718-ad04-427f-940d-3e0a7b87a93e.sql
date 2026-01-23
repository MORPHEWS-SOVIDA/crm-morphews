-- Adicionar campos de controle de mídia nos produtos
ALTER TABLE lead_products
ADD COLUMN IF NOT EXISTS bot_can_send_image BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bot_can_send_video BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bot_can_send_site_link BOOLEAN DEFAULT false;

-- Adicionar campo de controle global nos robôs
ALTER TABLE ai_bots
ADD COLUMN IF NOT EXISTS send_product_images BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS send_product_videos BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS send_product_links BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS product_media_confidence_threshold NUMERIC(3,2) DEFAULT 0.75;

COMMENT ON COLUMN lead_products.bot_can_send_image IS 'Permite que o robô envie a foto deste produto';
COMMENT ON COLUMN lead_products.bot_can_send_video IS 'Permite que o robô envie o vídeo deste produto';
COMMENT ON COLUMN lead_products.bot_can_send_site_link IS 'Permite que o robô envie o link do site deste produto';
COMMENT ON COLUMN ai_bots.send_product_images IS 'Habilita envio de fotos de produtos identificados';
COMMENT ON COLUMN ai_bots.send_product_videos IS 'Habilita envio de vídeos de produtos identificados';
COMMENT ON COLUMN ai_bots.send_product_links IS 'Habilita envio de links de produtos identificados';
COMMENT ON COLUMN ai_bots.product_media_confidence_threshold IS 'Confiança mínima para enviar mídia (0.0-1.0)';