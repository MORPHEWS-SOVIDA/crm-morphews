-- Add fiscal_invoices_view permission column
ALTER TABLE public.user_permissions
ADD COLUMN IF NOT EXISTS fiscal_invoices_view BOOLEAN DEFAULT FALSE;

-- Update existing admins and owners to have this permission enabled
UPDATE public.user_permissions up
SET fiscal_invoices_view = TRUE
FROM public.organization_members om
WHERE up.user_id = om.user_id
  AND up.organization_id = om.organization_id
  AND om.role IN ('owner', 'admin');

COMMENT ON COLUMN public.user_permissions.fiscal_invoices_view IS 'Permission to view and manage fiscal invoices (NF-e/NFS-e)';