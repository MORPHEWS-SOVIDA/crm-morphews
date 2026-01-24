-- Create landing_page_templates table for official/cloneable templates
CREATE TABLE public.landing_page_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  category TEXT DEFAULT 'geral',
  source_url TEXT, -- URL original scraped
  source_type TEXT DEFAULT 'manual', -- 'manual', 'scraped', 'wordpress'
  
  -- Content structure (same as landing_pages)
  headline TEXT,
  subheadline TEXT,
  video_url TEXT,
  benefits JSONB DEFAULT '[]'::jsonb,
  testimonials JSONB DEFAULT '[]'::jsonb,
  faq JSONB DEFAULT '[]'::jsonb,
  urgency_text TEXT,
  guarantee_text TEXT,
  
  -- Branding
  logo_url TEXT,
  primary_color TEXT DEFAULT '#8B5CF6',
  secondary_color TEXT,
  
  -- Full HTML/CSS for advanced templates
  full_html TEXT,
  custom_css TEXT,
  
  -- Metadata
  settings JSONB DEFAULT '{}'::jsonb,
  branding JSONB DEFAULT '{}'::jsonb, -- Colors, fonts from scraping
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  clone_count INTEGER DEFAULT 0,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.landing_page_templates ENABLE ROW LEVEL SECURITY;

-- Templates are readable by all authenticated users (for cloning)
CREATE POLICY "Anyone can view active templates"
  ON public.landing_page_templates FOR SELECT
  USING (is_active = true);

-- Only super admins can manage templates
CREATE POLICY "Super admins can manage templates"
  ON public.landing_page_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.email = 'thiago.morphews@gmail.com'
    )
  );

-- Index for faster queries
CREATE INDEX idx_landing_page_templates_category ON public.landing_page_templates(category);
CREATE INDEX idx_landing_page_templates_featured ON public.landing_page_templates(is_featured) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER update_landing_page_templates_updated_at
  BEFORE UPDATE ON public.landing_page_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();