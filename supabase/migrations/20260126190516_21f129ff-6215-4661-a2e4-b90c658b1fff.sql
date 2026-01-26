-- Grant SELECT on organizations to authenticated users
GRANT SELECT ON public.organizations TO authenticated;

-- Also ensure the function is accessible
GRANT EXECUTE ON FUNCTION public.is_master_admin(uuid) TO authenticated;