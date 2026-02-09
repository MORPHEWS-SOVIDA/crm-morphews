
-- 1. Fix is_org_admin to include 'manager' role
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
    AND organization_id = _org_id
    AND role IN ('owner', 'admin', 'manager')
  )
$$;

-- 2. Create trigger to auto-add new org members to all active (non-deleted) instances
CREATE OR REPLACE FUNCTION public.auto_add_member_to_instances()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.whatsapp_instance_users (instance_id, user_id, can_view, can_send)
  SELECT wi.id, NEW.user_id, true, true
  FROM public.whatsapp_instances wi
  WHERE wi.organization_id = NEW.organization_id
    AND wi.deleted_at IS NULL
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_add_member_to_instances ON public.organization_members;
CREATE TRIGGER trg_auto_add_member_to_instances
  AFTER INSERT ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_member_to_instances();

-- 3. Also auto-add all org members when a NEW instance is created
CREATE OR REPLACE FUNCTION public.auto_add_members_to_new_instance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.whatsapp_instance_users (instance_id, user_id, can_view, can_send)
  SELECT NEW.id, om.user_id, true, true
  FROM public.organization_members om
  WHERE om.organization_id = NEW.organization_id
    AND om.is_active = true
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_add_members_to_new_instance ON public.whatsapp_instances;
CREATE TRIGGER trg_auto_add_members_to_new_instance
  AFTER INSERT ON public.whatsapp_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_members_to_new_instance();

-- 4. Backfill: Add Mariana to ALL Só Vida instances she's not already in
INSERT INTO public.whatsapp_instance_users (instance_id, user_id, can_view, can_send)
SELECT wi.id, '9deeb402-03bf-44e7-b880-d0c162c83bee', true, true
FROM public.whatsapp_instances wi
WHERE wi.organization_id = '650b1667-e345-498e-9d41-b963faf824a7'
  AND wi.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.whatsapp_instance_users wiu
    WHERE wiu.instance_id = wi.id AND wiu.user_id = '9deeb402-03bf-44e7-b880-d0c162c83bee'
  )
ON CONFLICT DO NOTHING;
