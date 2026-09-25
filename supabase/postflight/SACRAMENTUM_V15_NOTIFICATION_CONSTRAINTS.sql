select conrelid::regclass as table_name,conname,pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  'public.matrimonial_notifications'::regclass,
  'public.matrimonial_notification_recipients'::regclass
)
order by conrelid::regclass::text,conname;

select tablename,indexname,indexdef
from pg_indexes
where schemaname='public'
  and tablename in ('matrimonial_notifications','matrimonial_notification_recipients')
order by tablename,indexname;