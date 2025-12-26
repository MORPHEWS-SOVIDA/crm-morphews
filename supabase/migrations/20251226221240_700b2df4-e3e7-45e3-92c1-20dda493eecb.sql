-- Create junction table for multiple delivery users per region
CREATE TABLE IF NOT EXISTS public.delivery_region_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  region_id UUID NOT NULL REFERENCES public.delivery_regions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(region_id, user_id)
);

-- Enable RLS
ALTER TABLE public.delivery_region_users ENABLE ROW LEVEL SECURITY;

-- Create policies for delivery_region_users
CREATE POLICY "Admins can manage region users" 
ON public.delivery_region_users 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM delivery_regions dr 
    WHERE dr.id = delivery_region_users.region_id 
    AND dr.organization_id = get_user_organization_id() 
    AND is_org_admin(auth.uid(), dr.organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM delivery_regions dr 
    WHERE dr.id = delivery_region_users.region_id 
    AND dr.organization_id = get_user_organization_id() 
    AND is_org_admin(auth.uid(), dr.organization_id)
  )
);

CREATE POLICY "Users can view region users of their org" 
ON public.delivery_region_users 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM delivery_regions dr 
    WHERE dr.id = delivery_region_users.region_id 
    AND dr.organization_id = get_user_organization_id()
  )
);

-- Migrate existing assigned_user_id data to the new table
INSERT INTO public.delivery_region_users (region_id, user_id)
SELECT id, assigned_user_id 
FROM public.delivery_regions 
WHERE assigned_user_id IS NOT NULL
ON CONFLICT (region_id, user_id) DO NOTHING;