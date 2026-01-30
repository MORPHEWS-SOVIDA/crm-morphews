-- Create storefront_testimonials table for customer reviews/testimonials
CREATE TABLE public.storefront_testimonials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  storefront_id UUID NOT NULL REFERENCES public.tenant_storefronts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  testimonial_text TEXT NOT NULL,
  photo_url TEXT,
  is_verified BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.storefront_testimonials ENABLE ROW LEVEL SECURITY;

-- Policy for organization members to manage their testimonials
CREATE POLICY "Organization members can manage testimonials"
ON public.storefront_testimonials
FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Policy for public to view active testimonials (for storefront display)
CREATE POLICY "Public can view active testimonials"
ON public.storefront_testimonials
FOR SELECT
USING (is_active = true);

-- Add testimonials_enabled column to tenant_storefronts
ALTER TABLE public.tenant_storefronts 
ADD COLUMN IF NOT EXISTS testimonials_enabled BOOLEAN DEFAULT false;

-- Create index for faster queries
CREATE INDEX idx_storefront_testimonials_storefront 
ON public.storefront_testimonials(storefront_id, is_active, display_order);

-- Trigger for updated_at
CREATE TRIGGER update_storefront_testimonials_updated_at
BEFORE UPDATE ON public.storefront_testimonials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();