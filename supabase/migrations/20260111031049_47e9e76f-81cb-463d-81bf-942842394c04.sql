-- Update find_lead_by_whatsapp to fallback to assigned_to/created_by if no lead_responsible exists
CREATE OR REPLACE FUNCTION public.find_lead_by_whatsapp(p_whatsapp text)
RETURNS TABLE(
  lead_id uuid,
  lead_name text,
  lead_whatsapp text,
  owner_user_id uuid,
  owner_name text,
  is_current_user_responsible boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_org_id uuid;
  v_phone text;
  v_lead record;
begin
  v_org_id := public.get_user_organization_id();
  if v_org_id is null then
    return;
  end if;

  v_phone := public.normalize_phone_digits(p_whatsapp);
  if v_phone is null or v_phone = '' then
    return;
  end if;

  -- Find the lead and get owner from lead_responsibles, fallback to assigned_to or created_by
  select
    l.id as lead_id,
    l.name as lead_name,
    l.whatsapp as lead_whatsapp,
    COALESCE(lr.user_id, l.assigned_to::uuid, l.created_by) as owner_user_id
  into v_lead
  from public.leads l
  left join public.lead_responsibles lr on lr.lead_id = l.id
  where l.organization_id = v_org_id
    and l.whatsapp = v_phone
  order by lr.created_at asc nulls last, l.created_at asc
  limit 1;

  if v_lead.lead_id is null then
    return;
  end if;

  -- Use the record fields to avoid ambiguity
  lead_id := v_lead.lead_id;
  lead_name := v_lead.lead_name;
  lead_whatsapp := v_lead.lead_whatsapp;
  owner_user_id := v_lead.owner_user_id;

  -- Get owner name from profiles
  if v_lead.owner_user_id is not null then
    select trim(concat(p.first_name, ' ', p.last_name))
      into owner_name
    from public.profiles p
    where p.user_id = v_lead.owner_user_id;
  end if;
  
  -- Default to 'Usuário desconhecido' only if we still don't have a name
  if owner_name is null or owner_name = '' then
    owner_name := 'Usuário sem perfil';
  end if;

  -- Check if current user is already responsible
  is_current_user_responsible := exists (
    select 1
    from public.lead_responsibles lr2
    where lr2.lead_id = v_lead.lead_id
      and lr2.user_id = auth.uid()
  );

  return next;
end;
$$;