select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid='public.legacy_pre_sacrament_registrations'::regclass
  and contype='c';
