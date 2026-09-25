select
  to_regprocedure('public.resolve_manual_matrimonial_notification_recipient(uuid,uuid)') is not null as resolve_manual_rpc,
  to_regprocedure('public.process_manual_matrimonial_notification_physical(uuid)') is not null as physical_process_rpc,
  to_regprocedure('public.mark_sacramental_notification_read(uuid)') is not null as mark_read_rpc,
  to_regprocedure('public.mark_sacramental_receipt_read(uuid)') is not null as mark_receipt_rpc,
  has_function_privilege('authenticated','public.resolve_manual_matrimonial_notification_recipient(uuid,uuid)','EXECUTE') as authenticated_can_resolve,
  has_function_privilege('authenticated','public.process_manual_matrimonial_notification_physical(uuid)','EXECUTE') as authenticated_can_process_physical,
  exists(select 1 from pg_trigger where tgname='trg_guard_manual_recipient_processing' and not tgisinternal) as manual_guard_trigger,
  exists(select 1 from pg_trigger where tgname='trg_prepare_sacramental_receipt' and not tgisinternal) as receipt_trigger,
  position('registry_audit_log' in pg_get_functiondef('public.mark_sacramental_notification_read(uuid)'::regprocedure))>0 as receiver_read_audited,
  position('registry_audit_log' in pg_get_functiondef('public.mark_sacramental_receipt_read(uuid)'::regprocedure))>0 as receipt_read_audited,
  (select count(*) from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='matrimonial_notifications')=1 as documents_realtime,
  (select count(*) from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='matrimonial_notification_recipients')=1 as recipients_realtime;