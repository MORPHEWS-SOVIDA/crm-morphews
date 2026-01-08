-- 1) Normalize lead whatsapp digits and prevent duplicates per organization

create or replace function public.normalize_phone_digits(p text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(p, ''), '\\D', '', 'g');
$$;

create or replace function public.prevent_duplicate_lead_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_whatsapp text;
  v_existing_id uuid;
begin
  -- Normalize
  v_whatsapp := public.normalize_phone_digits(new.whatsapp);
  new.whatsapp := v_whatsapp;

  if new.organization_id is null then
    return new;
  end if;

  -- Only check when we have a whatsapp to compare
  if v_whatsapp is null or v_whatsapp = '' then
    return new;
  end if;

  select l.id
    into v_existing_id
  from public.leads l
  where l.organization_id = new.organization_id
    and l.whatsapp = v_whatsapp
    and l.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  limit 1;

  if v_existing_id is not null then
    raise exception using
      errcode = '23505',
      message = 'WhatsApp já cadastrado para outro lead nesta organização.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_duplicate_lead_whatsapp on public.leads;
create trigger trg_prevent_duplicate_lead_whatsapp
before insert or update of whatsapp, organization_id
on public.leads
for each row
execute function public.prevent_duplicate_lead_whatsapp();

-- 2) Server-side check for existing lead even when user cannot view it (for "Assumir lead")
create or replace function public.find_lead_by_whatsapp(p_whatsapp text)
returns table (
  lead_id uuid,
  lead_name text,
  lead_whatsapp text,
  owner_user_id uuid,
  owner_name text,
  is_current_user_responsible boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
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

  select
    l.id as lead_id,
    l.name as lead_name,
    l.whatsapp as lead_whatsapp,
    lr.user_id as owner_user_id
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

  lead_id := v_lead.lead_id;
  lead_name := v_lead.lead_name;
  lead_whatsapp := v_lead.lead_whatsapp;
  owner_user_id := v_lead.owner_user_id;

  select trim(concat(p.first_name, ' ', p.last_name))
    into owner_name
  from public.profiles p
  where p.user_id = owner_user_id;

  is_current_user_responsible := exists (
    select 1
    from public.lead_responsibles lr2
    where lr2.lead_id = lead_id
      and lr2.user_id = auth.uid()
  );

  return next;
end;
$$;