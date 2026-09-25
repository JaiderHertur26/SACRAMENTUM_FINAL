select jsonb_pretty(jsonb_build_object(
  'decree_notification_function',to_regprocedure('public.sacramentum_emit_decree_notification()') is not null,
  'decree_notification_trigger',exists(
    select 1 from pg_trigger
    where tgname='trg_decree_official_notification_guarantee'
      and not tgisinternal
  ),
  'trigger_is_deferrable',exists(
    select 1 from pg_trigger
    where tgname='trg_decree_official_notification_guarantee'
      and tgdeferrable=true
      and tginitdeferred=true
      and not tgisinternal
  ),
  'mark_official_read_rpc',to_regprocedure('public.mark_official_notification_read(uuid)') is not null,
  'mark_sacramental_read_rpc',to_regprocedure('public.mark_sacramental_notification_read(uuid)') is not null,
  'mark_receipt_read_rpc',to_regprocedure('public.mark_sacramental_receipt_read(uuid)') is not null,
  'smoke_auth_decrees',(select count(*) from public.decretos where payload->>'smokeAuthV14'='true'),
  'smoke_auth_official',(select count(*) from public.official_notifications where payload->>'smokeAuthV14'='true'),
  'smoke_auth_docs',(select count(*) from public.matrimonial_notifications where payload->>'smokeAuthV14'='true'),
  'smoke_auth_recipients',(select count(*) from public.matrimonial_notification_recipients where payload->>'smokeAuthV14'='true')
)) as final_v14;