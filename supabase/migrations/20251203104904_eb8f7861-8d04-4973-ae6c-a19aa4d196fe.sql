-- Add new columns to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS linkedin text,
ADD COLUMN IF NOT EXISTS cpf_cnpj text,
ADD COLUMN IF NOT EXISTS site text,
ADD COLUMN IF NOT EXISTS lead_source text,
ADD COLUMN IF NOT EXISTS products text[];

-- Make specialty optional (allow null)
ALTER TABLE public.leads ALTER COLUMN specialty DROP NOT NULL;

-- Create lead_sources configuration table
CREATE TABLE public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

-- Create products configuration table  
CREATE TABLE public.lead_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_products ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_sources (authenticated users can read, admins can manage)
CREATE POLICY "Authenticated users can view lead sources" ON public.lead_sources FOR SELECT USING (true);
CREATE POLICY "Admins can insert lead sources" ON public.lead_sources FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update lead sources" ON public.lead_sources FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete lead sources" ON public.lead_sources FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- RLS policies for lead_products
CREATE POLICY "Authenticated users can view lead products" ON public.lead_products FOR SELECT USING (true);
CREATE POLICY "Admins can insert lead products" ON public.lead_products FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update lead products" ON public.lead_products FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete lead products" ON public.lead_products FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Insert default lead sources
INSERT INTO public.lead_sources (name) VALUES 
('Indicação'),
('Google Search'),
('Evento'),
('Instagram'),
('Linkedin'),
('TikTok'),
('Anuncio Meta ads'),
('Collab com outros profissionais');

-- Insert default products
INSERT INTO public.lead_products (name) VALUES 
('Liberdade Magistral com Edu'),
('Marcas Especialistas com Stanley'),
('Marca Própria Wellness por Thiago Rocha'),
('Morphews Whatsapp SaaS'),
('Morphews Ligação Saas'),
('Implementação Morphews'),
('MP industrializada'),
('Mentoria Thiago Hight Ticket');