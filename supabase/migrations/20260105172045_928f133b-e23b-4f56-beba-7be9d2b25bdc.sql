-- Função que sincroniza profiles quando organization_member é inserido
-- Isso garante que o profile exista e tenha o organization_id correto
CREATE OR REPLACE FUNCTION public.sync_profile_on_org_member_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inserir ou atualizar o profile para garantir que organization_id está definido
  INSERT INTO public.profiles (user_id, organization_id, first_name, last_name)
  VALUES (
    NEW.user_id,
    NEW.organization_id,
    'Usuário', -- default first name
    ''
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    organization_id = COALESCE(profiles.organization_id, EXCLUDED.organization_id),
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Trigger que dispara após inserção em organization_members
DROP TRIGGER IF EXISTS tr_sync_profile_on_org_member ON public.organization_members;
CREATE TRIGGER tr_sync_profile_on_org_member
  AFTER INSERT ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_on_org_member_insert();

-- Também garantir que existem profiles para todos os members existentes
INSERT INTO public.profiles (user_id, organization_id, first_name, last_name)
SELECT 
  om.user_id,
  om.organization_id,
  'Usuário',
  ''
FROM public.organization_members om
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = om.user_id
)
ON CONFLICT (user_id) DO UPDATE SET
  organization_id = COALESCE(profiles.organization_id, EXCLUDED.organization_id),
  updated_at = now();