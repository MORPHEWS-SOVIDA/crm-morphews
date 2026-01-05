-- Drop the old constraint and create a new one that allows 0 (unclassified)
ALTER TABLE public.leads DROP CONSTRAINT leads_stars_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_stars_check CHECK (stars >= 0 AND stars <= 5);