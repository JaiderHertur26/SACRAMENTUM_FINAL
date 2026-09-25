select 'notifications' as metric,count(*)::text as value from public.matrimonial_notifications
union all select 'recipients',count(*)::text from public.matrimonial_notification_recipients
union all select 'pending_recipients',count(*)::text from public.matrimonial_notification_recipients where lower(status)='pending'
union all select 'processed_recipients',count(*)::text from public.matrimonial_notification_recipients where lower(status)='processed'
union all select 'manual_recipients',count(*)::text from public.matrimonial_notification_recipients where target_baptism_id is null
union all select 'matrimonial_docs',count(*)::text from public.matrimonial_notifications where lower(notification_type)='matrimonio'
union all select 'cancelled_docs',count(*)::text from public.matrimonial_notifications where lower(status)='cancelled';

select p.oid::regprocedure as signature
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
'issue_matrimonial_notification','cancel_matrimonial_notification',
'search_baptisms_for_matrimonial_notification',
'resolve_manual_matrimonial_notification_recipient',
'process_matrimonial_notification_recipient'
) order by p.proname,p.oid::regprocedure::text;

select schemaname,tablename,policyname,cmd,qual,with_check
from pg_policies
where schemaname='public' and tablename in ('matrimonial_notifications','matrimonial_notification_recipients')
order by tablename,policyname;

select pubname,schemaname,tablename
from pg_publication_tables
where tablename in ('matrimonial_notifications','matrimonial_notification_recipients')
order by pubname,tablename;