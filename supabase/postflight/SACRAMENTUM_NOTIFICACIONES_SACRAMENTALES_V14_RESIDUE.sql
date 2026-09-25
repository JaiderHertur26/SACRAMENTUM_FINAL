select jsonb_pretty(jsonb_build_object(
  'smoke_notifications',(select count(*) from public.matrimonial_notifications where payload->>'smoke'='true'),
  'smoke_recipients',(select count(*) from public.matrimonial_notification_recipients where payload->>'smoke'='true')
)) as v14_residue;