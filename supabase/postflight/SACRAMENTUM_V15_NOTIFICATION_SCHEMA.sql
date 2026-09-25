select 'matrimonial_notifications' as table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name='matrimonial_notifications'
union all
select 'matrimonial_notification_recipients',column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name='matrimonial_notification_recipients'
order by table_name,column_name;

select pg_get_functiondef(
  to_regprocedure('public.process_matrimonial_notification_recipient(uuid)')
) as process_function;