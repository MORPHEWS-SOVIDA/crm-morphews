-- Permite checar permissões de equipe via função SECURITY DEFINER (evita recursão de RLS)
CREATE OR REPLACE FUNCTION public.user_has_team_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE _permission
      WHEN 'view' THEN COALESCE(up.team_view, false)
      WHEN 'add_member' THEN COALESCE(up.team_add_member, false)
      WHEN 'edit_member' THEN COALESCE(up.team_edit_member, false)
      WHEN 'delete_member' THEN COALESCE(up.team_delete_member, false)
      WHEN 'change_permissions' THEN COALESCE(up.team_change_permissions, false)
      WHEN 'change_role' THEN COALESCE(up.team_change_role, false)
      WHEN 'change_commission' THEN COALESCE(up.team_change_commission, false)
      WHEN 'toggle_manager' THEN COALESCE(up.team_toggle_manager, false)
      ELSE false
    END
  FROM public.user_permissions up
  WHERE up.user_id = _user_id
    AND up.organization_id = public.get_user_organization_id()
  LIMIT 1;
$$;

-- 1) organization_members: permitir UPDATE para quem tem permissão de editar equipe
CREATE POLICY "Users with team_edit_member can update org members"
ON public.organization_members
FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.user_has_team_permission(auth.uid(), 'edit_member')
  )
);

-- 2) profiles: permitir UPDATE de perfis da mesma org para quem tem permissão de editar equipe
CREATE POLICY "Users with team_edit_member can update org profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.user_has_team_permission(auth.uid(), 'edit_member')
  )
);

-- 3) user_permissions: permitir UPDATE somente para quem pode mudar permissões da equipe
CREATE POLICY "Users with team_change_permissions can update user permissions"
ON public.user_permissions
FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.user_has_team_permission(auth.uid(), 'change_permissions')
  )
)
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.user_has_team_permission(auth.uid(), 'change_permissions')
  )
);

-- 4) sales_manager_team_members: permitir que o gerente gerencie a própria lista de vendedores
CREATE POLICY "Sales managers can manage their own team members"
ON public.sales_manager_team_members
FOR ALL
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND manager_user_id = auth.uid()
)
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND manager_user_id = auth.uid()
);
