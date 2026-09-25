select tablename,policyname,cmd
from pg_policies
where schemaname='public'
  and tablename in ('matrimonial_notifications','matrimonial_notification_recipients')
order by tablename,policyname;

select pubname,schemaname,tablename
from pg_publication_tables
where tablename in ('matrimonial_notifications','matrimonial_notification_recipients')
order by pubname,tablename;