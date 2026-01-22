-- 1) View to simplify listing and avoid PostgREST nested-join edge cases
create or replace view public.manipulated_sale_items_view
with (security_invoker = on)
as
select
  si.id,
  si.sale_id,
  si.product_id,
  si.product_name,
  si.quantity,
  si.unit_price_cents,
  si.total_cents,
  si.requisition_number,
  si.cost_cents,
  si.created_at,
  s.organization_id,
  s.created_at as sale_created_at,
  s.status as sale_status,
  coalesce(l.name, 'Cliente não identificado') as client_name,
  case
    when p.user_id is not null then concat_ws(' ', p.first_name, p.last_name)
    else 'Vendedor não identificado'
  end as seller_name
from public.sale_items si
join public.sales s on s.id = si.sale_id
left join public.leads l on l.id = s.lead_id
left join public.profiles p on p.user_id = s.seller_user_id
where si.requisition_number is not null;

-- 2) Make feature flag disabled by default on all plans
insert into public.plan_features (plan_id, feature_key, is_enabled)
select sp.id, 'manipulated_costs', false
from public.subscription_plans sp
on conflict (plan_id, feature_key)
do update set is_enabled = excluded.is_enabled;