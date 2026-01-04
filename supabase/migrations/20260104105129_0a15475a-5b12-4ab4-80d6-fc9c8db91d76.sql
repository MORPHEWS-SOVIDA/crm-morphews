-- Create lead_addresses table for multiple addresses per lead
CREATE TABLE public.lead_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Principal',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  cep TEXT,
  street TEXT,
  street_number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  google_maps_link TEXT,
  delivery_notes TEXT,
  delivery_region_id UUID REFERENCES public.delivery_regions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_addresses ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view addresses of their org"
  ON public.lead_addresses FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert addresses in their org"
  ON public.lead_addresses FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update addresses of their org"
  ON public.lead_addresses FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete addresses of their org"
  ON public.lead_addresses FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Create index for faster queries
CREATE INDEX idx_lead_addresses_lead_id ON public.lead_addresses(lead_id);
CREATE INDEX idx_lead_addresses_organization_id ON public.lead_addresses(organization_id);

-- Add shipping_address_id to sales table
ALTER TABLE public.sales ADD COLUMN shipping_address_id UUID REFERENCES public.lead_addresses(id) ON DELETE SET NULL;

-- Migrate existing addresses from leads to lead_addresses
INSERT INTO public.lead_addresses (lead_id, organization_id, label, is_primary, cep, street, street_number, complement, neighborhood, city, state, google_maps_link, delivery_notes, delivery_region_id)
SELECT 
  id,
  organization_id,
  'Principal',
  true,
  cep,
  street,
  street_number,
  complement,
  neighborhood,
  city,
  state,
  google_maps_link,
  delivery_notes,
  delivery_region_id
FROM public.leads
WHERE organization_id IS NOT NULL 
  AND (cep IS NOT NULL OR street IS NOT NULL OR city IS NOT NULL);