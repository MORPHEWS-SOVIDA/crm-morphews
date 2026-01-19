-- Add exclusivity_hours column to non_purchase_reasons
-- This defines how long the seller has exclusive access to follow up before the lead becomes visible to others
ALTER TABLE public.non_purchase_reasons 
ADD COLUMN IF NOT EXISTS exclusivity_hours integer DEFAULT 0;

-- Add comment explaining the field
COMMENT ON COLUMN public.non_purchase_reasons.exclusivity_hours IS 'Hours the assigned seller has to complete follow-up before lead becomes visible to others';