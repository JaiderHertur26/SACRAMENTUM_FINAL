select jsonb_pretty(jsonb_build_object(
  'generic_processor',to_regprocedure('public.process_matrimonial_notification_recipient(uuid)') is not null,
  'nullity_helper',to_regprocedure('public.sacramentum_issue_nullity_baptism_notification(uuid,uuid,text,date,text,uuid)') is not null,
  'nullity_rpc',to_regprocedure('public.apply_marriage_nullity(uuid,text,date,text,jsonb,uuid[])') is not null,
  'receipt_trigger_function',to_regprocedure('public.sacramentum_prepare_sacramental_receipt()') is not null,
  'authenticated_can_process',has_function_privilege('authenticated','public.process_matrimonial_notification_recipient(uuid)','EXECUTE'),
  'authenticated_can_apply_nullity',has_function_privilege('authenticated','public.apply_marriage_nullity(uuid,text,date,text,jsonb,uuid[])','EXECUTE'),
  'authenticated_cannot_call_internal_nullity_helper',not has_function_privilege('authenticated','public.sacramentum_issue_nullity_baptism_notification(uuid,uuid,text,date,text,uuid)','EXECUTE'),
  'anon_cannot_call_internal_nullity_helper',not has_function_privilege('anon','public.sacramentum_issue_nullity_baptism_notification(uuid,uuid,text,date,text,uuid)','EXECUTE'),
  'decree_guarantee_still_active',exists(
    select 1 from pg_trigger
    where tgname='trg_decree_official_notification_guarantee'
      and not tgisinternal
  ),
  'receipt_trigger_still_active',exists(
    select 1 from pg_trigger
    where tgname='trg_prepare_sacramental_receipt'
      and not tgisinternal
  )
)) as v15_postflight;