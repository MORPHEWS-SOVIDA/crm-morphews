-- Add delivery_position column for route ordering
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS delivery_position integer DEFAULT 0;

-- Create index for efficient ordering
CREATE INDEX IF NOT EXISTS idx_sales_delivery_ordering 
ON public.sales (assigned_delivery_user_id, scheduled_delivery_date, scheduled_delivery_shift, delivery_position)
WHERE status IN ('dispatched', 'pending_expedition');