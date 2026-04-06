ALTER TABLE public.sale_checkpoints
DROP CONSTRAINT IF EXISTS sale_checkpoints_checkpoint_type_check;

ALTER TABLE public.sale_checkpoints
ADD CONSTRAINT sale_checkpoints_checkpoint_type_check
CHECK (checkpoint_type IN ('printed', 'pending_expedition', 'dispatched', 'seller_delivery_confirmed', 'delivered', 'payment_confirmed'));

ALTER TABLE public.sale_checkpoint_history
DROP CONSTRAINT IF EXISTS sale_checkpoint_history_checkpoint_type_check;

ALTER TABLE public.sale_checkpoint_history
ADD CONSTRAINT sale_checkpoint_history_checkpoint_type_check
CHECK (checkpoint_type IN ('printed', 'pending_expedition', 'dispatched', 'seller_delivery_confirmed', 'delivered', 'payment_confirmed'));