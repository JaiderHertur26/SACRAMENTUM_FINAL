select p.proname, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in (
    'mark_sacramental_notification_read',
    'process_matrimonial_notification_recipient',
    'mark_sacramental_receipt_read',
    'cancel_matrimonial_notification',
    'issue_matrimonial_notification'
  )
order by p.proname;

select indexname,indexdef
from pg_indexes
where schemaname='public'
  and tablename in ('matrimonial_notifications','matrimonial_notification_recipients','registry_audit_log')
order by tablename,indexname;