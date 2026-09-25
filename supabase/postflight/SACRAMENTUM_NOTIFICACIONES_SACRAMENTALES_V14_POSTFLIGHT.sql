select jsonb_pretty(jsonb_build_object(
  'notification_type_column',exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='matrimonial_notifications' and column_name='notification_type'
  ),
  'receipt_columns',(select count(*) from information_schema.columns
    where table_schema='public' and table_name='matrimonial_notification_recipients'
      and column_name in ('receipt_document_number','receipt_payload','receipt_created_at','sender_read_at')),
  'mark_read_rpc',to_regprocedure('public.mark_sacramental_notification_read(uuid)') is not null,
  'mark_receipt_rpc',to_regprocedure('public.mark_sacramental_receipt_read(uuid)') is not null,
  'receipt_trigger',exists(
    select 1 from pg_trigger
    where tgname='trg_prepare_sacramental_receipt' and not tgisinternal
  ),
  'processed_recipients',(select count(*) from public.matrimonial_notification_recipients where lower(status)='processed'),
  'processed_without_receipt',(select count(*) from public.matrimonial_notification_recipients where lower(status)='processed' and receipt_document_number is null)
)) as v14_postflight;