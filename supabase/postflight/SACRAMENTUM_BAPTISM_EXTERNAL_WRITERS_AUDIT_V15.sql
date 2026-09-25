select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  case
    when pg_get_functiondef(p.oid) ilike '%matrimonial_notification%' then 'matrimonial_notification'
    when pg_get_functiondef(p.oid) ilike '%nulidad_matrimonial%' then 'nulidad_matrimonial'
    when pg_get_functiondef(p.oid) ilike '%confirmation%' or pg_get_functiondef(p.oid) ilike '%confirmacion%' then 'confirmation'
    when pg_get_functiondef(p.oid) ilike '%decree%' or pg_get_functiondef(p.oid) ilike '%decreto%' then 'decree'
    else 'other'
  end as detected_origin,
  pg_get_functiondef(p.oid) ilike '%update public.baptisms%' as updates_baptisms,
  pg_get_functiondef(p.oid) ilike '%insert into public.marginal_notes%' as writes_marginal_notes,
  pg_get_functiondef(p.oid) ilike '%sacramentum_issue_nullity_baptism_notification%' as uses_remote_notification_helper
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.prokind='f'
  and pg_get_functiondef(p.oid) ilike '%update public.baptisms%'
order by p.proname, args;