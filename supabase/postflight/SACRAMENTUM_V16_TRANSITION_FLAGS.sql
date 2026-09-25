select
  p.proname,
  position('registry_audit_log' in pg_get_functiondef(p.oid)) > 0 as writes_audit,
  position('notification_type' in pg_get_functiondef(p.oid)) > 0 as sees_notification_type,
  position('processed' in pg_get_functiondef(p.oid)) > 0 as handles_processed,
  position('read_at' in pg_get_functiondef(p.oid)) > 0 as handles_read,
  position('sender_read_at' in pg_get_functiondef(p.oid)) > 0 as handles_sender_read
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