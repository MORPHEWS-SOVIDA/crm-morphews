-- Add permission flag to control who can UNCHECK expedition checkpoints
ALTER TABLE public.user_permissions
ADD COLUMN IF NOT EXISTS sales_uncheck_checkpoint boolean NOT NULL DEFAULT false;

-- Add comment explaining the permission
COMMENT ON COLUMN public.user_permissions.sales_uncheck_checkpoint IS 'Permission to uncheck expedition checkpoints (Impresso, Pedido Separado, Despachado, Entregue). If false, user cannot uncheck these steps once marked.';

-- Grant this permission to organization owners/admins by default
UPDATE public.user_permissions up
SET sales_uncheck_checkpoint = true
FROM public.organization_members om
WHERE up.user_id = om.user_id
  AND up.organization_id = om.organization_id
  AND om.role IN ('owner', 'admin');