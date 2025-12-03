-- Create enum for funnel stages
CREATE TYPE public.funnel_stage AS ENUM (
  'prospect',
  'contacted',
  'convincing',
  'scheduled',
  'positive',
  'waiting_payment',
  'success',
  'trash',
  'cloud'
);

-- Create leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  instagram TEXT NOT NULL,
  followers INTEGER DEFAULT 0,
  whatsapp TEXT NOT NULL,
  email TEXT,
  stage funnel_stage NOT NULL DEFAULT 'prospect',
  stars INTEGER NOT NULL DEFAULT 3 CHECK (stars >= 1 AND stars <= 5),
  assigned_to TEXT NOT NULL,
  whatsapp_group TEXT,
  desired_products TEXT,
  negotiated_value NUMERIC(10,2),
  paid_value NUMERIC(10,2),
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- For now, create public access policies (no auth required)
-- This allows anyone to read/write leads - good for testing
CREATE POLICY "Anyone can view leads"
  ON public.leads FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert leads"
  ON public.leads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update leads"
  ON public.leads FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete leads"
  ON public.leads FOR DELETE
  USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data
INSERT INTO public.leads (name, specialty, instagram, followers, whatsapp, email, stage, stars, assigned_to, whatsapp_group, desired_products, negotiated_value, paid_value, observations)
VALUES
  ('Dr. Ana Silva', 'Dermatologista', '@draanasilva', 250000, '5511999998888', 'ana.silva@email.com', 'success', 5, 'Maria', 'Grupo Ana Silva - Curso', 'Curso online de skincare para iniciantes', 45000, 45000, 'Fechou rápido, muito interessada em expandir audiência'),
  ('Prof. Carlos Santos', 'Personal Trainer', '@carlossantosfitness', 180000, '5521988887777', 'carlos@fitness.com', 'waiting_payment', 5, 'João', 'Grupo Carlos - Negociação', 'Programa de treino online + Ebook', 35000, NULL, 'Pediu para parcelar em 3x'),
  ('Dra. Beatriz Lima', 'Nutricionista', '@nutribialima', 95000, '5531977776666', 'bia.lima@nutri.com', 'positive', 4, 'Maria', NULL, 'E-book de receitas saudáveis', 25000, NULL, 'Muito animada após a call, vai confirmar semana que vem'),
  ('Roberto Almeida', 'Coach Financeiro', '@robertofinancas', 320000, '5511966665555', 'roberto@financas.com', 'scheduled', 5, 'Pedro', NULL, NULL, NULL, NULL, 'Call agendada para sexta às 15h'),
  ('Fernanda Costa', 'Maquiadora', '@fernandamakeup', 45000, '5541955554444', 'fernanda@makeup.com', 'convincing', 3, 'Maria', NULL, NULL, NULL, NULL, 'Interessada mas com dúvidas sobre o processo'),
  ('Lucas Mendes', 'Fotógrafo', '@lucasmendesfoto', 28000, '5551944443333', 'lucas@foto.com', 'contacted', 2, 'João', NULL, NULL, NULL, NULL, 'Nos mandou mensagem pelo Instagram'),
  ('Juliana Reis', 'Psicóloga', '@psicologa.juliana', 120000, '5561933332222', 'juliana@psi.com', 'prospect', 4, 'Pedro', NULL, NULL, NULL, NULL, 'Enviamos proposta, aguardando resposta'),
  ('Marcos Oliveira', 'Advogado', '@marcosadvogado', 15000, '5571922221111', 'marcos@adv.com', 'trash', 1, 'Maria', NULL, NULL, NULL, NULL, 'Disse que não tem interesse em produtos digitais'),
  ('Patricia Souza', 'Designer', '@patriciasouzadesign', 67000, '5581911110000', 'patricia@design.com', 'cloud', 3, 'João', NULL, NULL, NULL, NULL, 'Disse que quer retomar conversa em 3 meses'),
  ('Dr. Henrique Campos', 'Cardiologista', '@drhenriquecardio', 450000, '5511900001111', 'henrique@cardio.com', 'prospect', 5, 'Pedro', NULL, NULL, NULL, NULL, 'Lead muito quente, referência na área');