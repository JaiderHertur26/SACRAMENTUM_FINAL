select jsonb_pretty(jsonb_build_object(
  'temp_parish',(select count(*) from public.parishes where id='30000000-0000-4000-8000-000000000001'),
  'baptisms_in_temp_parish',(select count(*) from public.baptisms where parish_id='30000000-0000-4000-8000-000000000001'),
  'smoke_decrees',(select count(*) from public.decretos where decree_number='SMOKE-NUL-V15'),
  'smoke_documents',(select count(*) from public.matrimonial_notifications where payload->>'decreeNumber'='SMOKE-NUL-V15'),
  'smoke_recipients',(
    select count(*)
    from public.matrimonial_notification_recipients r
    join public.matrimonial_notifications n on n.id=r.notification_id
    where n.payload->>'decreeNumber'='SMOKE-NUL-V15'
  ),
  'smoke_notes',(select count(*) from public.marginal_notes where content like '%SMOKE-NUL-V15%'),
  'real_marriage_still_seated',exists(
    select 1 from public.marriages
    where id='c73f8483-fadd-4919-8045-7ef93871ca83'
      and lower(coalesce(status,''))='seated'
  ),
  'active_parish_user_back_home',exists(
    select 1 from public.user_profiles
    where lower(coalesce(role,''))='parish'
      and coalesce(is_active,true)=true
      and parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
  )
)) as v15_residue;