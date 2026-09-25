-- SACRAMENTUM · V4 · Parroquia opcional de custodia/conciliación para boletas legacy
begin;

do $$
declare v_ddl text;
begin
  select pg_get_functiondef('public.reconcile_legacy_pre_registrations_v2_internal(text)'::regprocedure) into v_ddl;
  v_ddl:=replace(v_ddl,
    'v_count integer; v_target uuid; v_mapped_parish uuid;',
    'v_count integer; v_target uuid; v_mapped_parish uuid; v_batch_parish uuid;');
  v_ddl:=replace(v_ddl,
    'd:=r.normalized_data; v_target:=null; v_count:=0; v_mapped_parish:=null;',
    'd:=r.normalized_data; v_target:=null; v_count:=0; v_mapped_parish:=null; v_batch_parish:=null; select parish_id into v_batch_parish from public.legacy_import_batches where id=r.batch_id;');
  v_ddl:=replace(v_ddl,
    'limit 1;\n    if r.celebration_date is null',
    'limit 1;\n    v_mapped_parish:=coalesce(v_batch_parish,v_mapped_parish);\n    if r.celebration_date is null');
  if v_ddl not like '%v_batch_parish%' or v_ddl not like '%coalesce(v_batch_parish,v_mapped_parish)%' then
    raise exception 'No se pudo incorporar parroquia preferente en conciliación legacy';
  end if;
  execute v_ddl;
end;
$$;

commit;