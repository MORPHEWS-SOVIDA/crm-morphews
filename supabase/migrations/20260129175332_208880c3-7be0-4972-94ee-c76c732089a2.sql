-- Add column to mark which funnel stage receives leads after Add Receptivo sales
ALTER TABLE public.organization_funnel_stages 
ADD COLUMN is_receptivo_destination BOOLEAN DEFAULT FALSE;

-- Create a function to ensure only one stage per organization can be marked as receptivo destination
CREATE OR REPLACE FUNCTION public.enforce_single_receptivo_destination()
RETURNS TRIGGER AS $$
BEGIN
  -- If we're setting this stage as receptivo destination
  IF NEW.is_receptivo_destination = TRUE THEN
    -- Clear the flag from all other stages in the same organization
    UPDATE public.organization_funnel_stages
    SET is_receptivo_destination = FALSE
    WHERE organization_id = NEW.organization_id
      AND id != NEW.id
      AND is_receptivo_destination = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to enforce single receptivo destination
CREATE TRIGGER enforce_single_receptivo_destination_trigger
BEFORE INSERT OR UPDATE ON public.organization_funnel_stages
FOR EACH ROW
EXECUTE FUNCTION public.enforce_single_receptivo_destination();

-- Add comment for documentation
COMMENT ON COLUMN public.organization_funnel_stages.is_receptivo_destination IS 'When true, leads are automatically moved to this stage after a sale is created via Add Receptivo';