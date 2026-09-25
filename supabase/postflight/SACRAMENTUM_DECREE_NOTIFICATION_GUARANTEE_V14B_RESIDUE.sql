select jsonb_pretty(jsonb_build_object(
  'smoke_decrees',(select count(*) from public.decretos where payload->>'smokeV14B'='true'),
  'smoke_notifications',(select count(*) from public.official_notifications where payload->>'smokeV14B'='true')
)) as residue;