
-- =============================================
-- SOCIAL SELLING MODULE: Tables & Funnel Stages
-- =============================================

-- 1. Make leads.whatsapp nullable (to allow Instagram-only leads)
ALTER TABLE public.leads ALTER COLUMN whatsapp DROP NOT NULL;

-- 2. Social Sellers table
CREATE TABLE public.social_sellers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.social_sellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view social sellers" ON public.social_sellers FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Org members can manage social sellers" ON public.social_sellers FOR ALL USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);

-- 3. Instagram Profiles for Social Selling
CREATE TABLE public.social_selling_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  instagram_username TEXT NOT NULL,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.social_selling_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view profiles" ON public.social_selling_profiles FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Org members can manage profiles" ON public.social_selling_profiles FOR ALL USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);

-- 4. Screenshot Imports (batch of prints uploaded)
CREATE TABLE public.social_selling_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  seller_id UUID NOT NULL REFERENCES public.social_sellers(id),
  profile_id UUID NOT NULL REFERENCES public.social_selling_profiles(id),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  screenshot_urls TEXT[] NOT NULL DEFAULT '{}',
  extracted_usernames TEXT[] DEFAULT '{}',
  leads_created_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
ALTER TABLE public.social_selling_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view imports" ON public.social_selling_imports FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Org members can create imports" ON public.social_selling_imports FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Org members can update imports" ON public.social_selling_imports FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);

-- 5. Activity tracking per lead (which seller, which profile, what action)
CREATE TABLE public.social_selling_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  lead_id UUID REFERENCES public.leads(id),
  seller_id UUID NOT NULL REFERENCES public.social_sellers(id),
  profile_id UUID NOT NULL REFERENCES public.social_selling_profiles(id),
  import_id UUID REFERENCES public.social_selling_imports(id),
  activity_type TEXT NOT NULL DEFAULT 'message_sent' CHECK (activity_type IN ('message_sent', 'reply_received', 'whatsapp_shared', 'call_scheduled', 'call_done', 'no_show', 'proposal_sent')),
  instagram_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.social_selling_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view activities" ON public.social_selling_activities FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Org members can manage activities" ON public.social_selling_activities FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);

-- 6. Reorganize funnel stages for Marca Própria (2d272c40-22e9-40e2-8cdc-3be142f61717)
-- Delete existing stages
DELETE FROM public.organization_funnel_stages WHERE organization_id = '2d272c40-22e9-40e2-8cdc-3be142f61717';

-- Insert new stages
INSERT INTO public.organization_funnel_stages (organization_id, name, position, color, text_color, stage_type, is_default, enum_value, requires_contact) VALUES
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Mensagem Enviada Ativamente', 0, 'bg-blue-200', 'text-blue-900', 'funnel', true, 'no_contact', false),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Cliente nos Chamou por Anúncio', 1, 'bg-cyan-200', 'text-cyan-900', 'funnel', false, 'unclassified', false),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Cliente Veio de Indicação', 2, 'bg-teal-200', 'text-teal-900', 'funnel', false, 'unclassified', false),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Mensagem com Alguma Resposta', 3, 'bg-green-200', 'text-green-900', 'funnel', false, 'prospect', false),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Lead Enviou seu WhatsApp', 4, 'bg-lime-200', 'text-lime-900', 'funnel', false, 'prospect', false),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Lead Agendou Call com Antony', 5, 'bg-purple-200', 'text-purple-900', 'funnel', false, 'scheduled', false),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Lead Fez Call com Antony', 6, 'bg-purple-400', 'text-white', 'funnel', false, 'scheduled', false),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Lead No Show com Antony', 7, 'bg-red-200', 'text-red-900', 'funnel', false, 'no_show', false),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Lead Fez Call com Lincoln', 8, 'bg-indigo-300', 'text-indigo-900', 'funnel', false, 'scheduled', false),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Lead No Show com Lincoln', 9, 'bg-red-300', 'text-red-900', 'funnel', false, 'no_show', false),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Lead Fez Call com Aline', 10, 'bg-pink-300', 'text-pink-900', 'funnel', false, 'scheduled', false),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Lead No Show com Aline', 11, 'bg-red-200', 'text-red-900', 'funnel', false, 'no_show', false),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Lead Fez Call com Thiago', 12, 'bg-amber-300', 'text-amber-900', 'funnel', false, 'scheduled', false),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Lead No Show com Thiago', 13, 'bg-red-300', 'text-red-900', 'funnel', false, 'no_show', false),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Proposta Enviada', 14, 'bg-orange-300', 'text-orange-900', 'funnel', false, 'formulating_proposal', false),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Venda Realizada', 15, 'bg-green-500', 'text-white', 'funnel', false, 'paid', false),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Não Comprou', 99, 'bg-slate-200', 'text-slate-700', 'trash', false, 'trash', false);

-- 7. Insert initial social sellers for Marca Própria
INSERT INTO public.social_sellers (organization_id, name) VALUES
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Antony'),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Clatinho'),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'Marcelinho');

-- 8. Insert Instagram profiles for Marca Própria
INSERT INTO public.social_selling_profiles (organization_id, instagram_username, display_name) VALUES
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'thiagorocha.oficial', 'Thiago Rocha'),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'dra.alinedalmazo', 'Dra. Aline Dalmazo'),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'lincolnn', 'Lincoln'),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'juliagodoyc', 'Julia Godoy'),
('2d272c40-22e9-40e2-8cdc-3be142f61717', 'tonypessi', 'Tony Pessi');

-- 9. Create storage bucket for social selling screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('social-selling-prints', 'social-selling-prints', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Org members can upload prints" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'social-selling-prints' AND auth.uid() IS NOT NULL
);
CREATE POLICY "Org members can view prints" ON storage.objects FOR SELECT USING (
  bucket_id = 'social-selling-prints' AND auth.uid() IS NOT NULL
);
