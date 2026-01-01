-- Add commission_percentage and extension fields to organization_members
ALTER TABLE public.organization_members 
ADD COLUMN commission_percentage numeric(5,2) DEFAULT 0 CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
ADD COLUMN extension text;