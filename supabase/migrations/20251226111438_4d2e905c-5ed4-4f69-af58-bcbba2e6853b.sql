-- 1) Função simples e estável para o FRONT consultar se o usuário atual
--    é ADMIN/OWNER da organização (tenant) atual.
create or replace function public.is_current_user_org_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  org_id := public.get_user_organization_id();

  if org_id is null then
    return false;
  end if;

  return public.is_org_admin(auth.uid(), org_id);
end;
$$;

revoke all on function public.is_current_user_org_admin() from public;
grant execute on function public.is_current_user_org_admin() to authenticated;

-- 2) lead_sources: garantir SELECT para membros, INSERT/UPDATE/DELETE só para admin
drop policy if exists "Org members can manage lead_sources" on public.lead_sources;
drop policy if exists "Users can view lead sources" on public.lead_sources;
drop policy if exists "Admins can manage lead sources" on public.lead_sources;

create policy "Users can view lead sources"
on public.lead_sources
for select
to authenticated
using (organization_id = public.get_user_organization_id());

create policy "Admins can manage lead sources"
on public.lead_sources
for all
to authenticated
using (
  organization_id = public.get_user_organization_id()
  and public.is_org_admin(auth.uid(), organization_id)
)
with check (
  organization_id = public.get_user_organization_id()
  and public.is_org_admin(auth.uid(), organization_id)
);

-- 3) lead_products: garantir SELECT para membros, INSERT/UPDATE/DELETE só para admin
drop policy if exists "Org members can manage lead_products" on public.lead_products;
drop policy if exists "Users can view lead products" on public.lead_products;
drop policy if exists "Admins can manage lead products" on public.lead_products;

create policy "Users can view lead products"
on public.lead_products
for select
to authenticated
using (organization_id = public.get_user_organization_id());

create policy "Admins can manage lead products"
on public.lead_products
for all
to authenticated
using (
  organization_id = public.get_user_organization_id()
  and public.is_org_admin(auth.uid(), organization_id)
)
with check (
  organization_id = public.get_user_organization_id()
  and public.is_org_admin(auth.uid(), organization_id)
);