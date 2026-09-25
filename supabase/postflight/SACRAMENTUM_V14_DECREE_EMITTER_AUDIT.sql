select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  position('official_notifications' in pg_get_functiondef(p.oid)) > 0 as emits_official_notification,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in (
    'apply_baptism_correction',
    'apply_baptism_replacement',
    'apply_confirmation_correction',
    'apply_confirmation_replacement',
    'apply_funeral_correction',
    'apply_marriage_correction',
    'apply_marriage_replacement',
    'apply_marriage_nullity'
  )
order by p.proname, args;