-- Add team_panel_view permission column for Team Manager Dashboard
ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS team_panel_view BOOLEAN NOT NULL DEFAULT FALSE;

-- Grant team_panel_view to users who are sales managers or have team management permissions
UPDATE public.user_permissions up
SET team_panel_view = TRUE
FROM public.organization_members om
WHERE up.user_id = om.user_id 
  AND up.organization_id = om.organization_id
  AND om.is_sales_manager = TRUE;

-- Also update the default permissions function to give team_panel_view to managers
COMMENT ON COLUMN public.user_permissions.team_panel_view IS 'Permission to access Team Manager Dashboard (/time-painel)';