select set_config('request.jwt.claim.sub','6eebfea0-5280-4d96-bc38-e9f0021fbb25',false);
select set_config('request.jwt.claim.role','authenticated',false);
set role authenticated;

select jsonb_pretty(jsonb_build_object(
  'parrocos',(select count(*) from public.parrocos where parish_id=public.current_app_parish_id()),
  'iglesias',(select count(*) from public.iglesias where parish_id=public.current_app_parish_id()),
  'ciudades',(select count(*) from public.ciudades where context_id=public.current_app_parish_id()),
  'obispos',(select count(*) from public.obispos where parish_id=public.current_app_parish_id()),
  'diocesis_aux',(select count(*) from public.diocesis where parish_id=public.current_app_parish_id()),
  'mis_datos',(select count(*) from public.mis_datos where entity_id=public.current_app_parish_id())
)) as visible_auxiliary_catalogs;