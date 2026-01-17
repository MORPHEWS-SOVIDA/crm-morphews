-- Add new motoboy tracking status 'with_motoboy' (Pedido já com motoboy)
ALTER TYPE public.motoboy_tracking_status ADD VALUE IF NOT EXISTS 'with_motoboy' AFTER 'handed_to_motoboy';

-- Insert the new status for all organizations that have motoboy tracking configured
INSERT INTO public.motoboy_tracking_statuses (organization_id, status_key, label, position, is_active)
SELECT DISTINCT 
  organization_id, 
  'with_motoboy',
  'Pedido já com motoboy',
  4, -- After handed_to_motoboy (position 3)
  true
FROM public.motoboy_tracking_statuses
WHERE NOT EXISTS (
  SELECT 1 FROM public.motoboy_tracking_statuses mts2 
  WHERE mts2.organization_id = motoboy_tracking_statuses.organization_id 
  AND mts2.status_key = 'with_motoboy'
);

-- Update positions for existing statuses to make room for the new one
UPDATE public.motoboy_tracking_statuses 
SET position = position + 1 
WHERE status_key IN ('next_delivery', 'special_delay', 'call_motoboy', 'delivered', 'returned')
AND position >= 4;