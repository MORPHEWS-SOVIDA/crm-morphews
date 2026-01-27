-- Add is_active field to organization_members for user deactivation
ALTER TABLE public.organization_members 
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add deactivated_at and deactivated_by for audit trail
ALTER TABLE public.organization_members 
ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES auth.users(id);

-- Create index for active members queries
CREATE INDEX IF NOT EXISTS idx_organization_members_active 
ON public.organization_members(organization_id, is_active) 
WHERE is_active = true;

-- Comment for documentation
COMMENT ON COLUMN public.organization_members.is_active IS 'Whether the user is active in the organization. Inactive users cannot login.';
COMMENT ON COLUMN public.organization_members.deactivated_at IS 'When the user was deactivated';
COMMENT ON COLUMN public.organization_members.deactivated_by IS 'Who deactivated the user';