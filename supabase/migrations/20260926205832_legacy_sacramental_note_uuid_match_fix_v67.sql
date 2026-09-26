-- SACRAMENTUM V67 · Corrección del enlace de notas sacramentales legacy.
-- PostgreSQL no define min(uuid); V43 debe elegir el UUID único sin perder tipado.

do $migration$
declare
  v_oid oid;
  v_def text;
  v_before integer;
  v_after integer;
begin
  select p.oid, pg_get_functiondef(p.oid)
    into v_oid, v_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='materialize_legacy_sacramental_notes_v43'
    and pg_get_function_identity_arguments(p.oid)='p_batch_id uuid, p_limit integer'
  limit 1;

  if v_oid is null or v_def is null then
    raise exception 'No existe materialize_legacy_sacramental_notes_v43(uuid,integer)';
  end if;

  v_before := (
    length(v_def)
    - length(replace(v_def,'select count(*),min(id) into v_matches,v_target',''))
  ) / nullif(length('select count(*),min(id) into v_matches,v_target'),0);

  if v_before < 1 then
    raise exception 'No se encontró el patrón min(uuid) esperado en V43';
  end if;

  v_def := replace(
    v_def,
    'select count(*),min(id) into v_matches,v_target',
    'select count(*),min(id::text)::uuid into v_matches,v_target'
  );

  v_after := (
    length(v_def)
    - length(replace(v_def,'select count(*),min(id::text)::uuid into v_matches,v_target',''))
  ) / nullif(length('select count(*),min(id::text)::uuid into v_matches,v_target'),0);

  if v_after <> v_before then
    raise exception 'No se pudieron corregir todos los selectores UUID de V43';
  end if;

  execute v_def;
end
$migration$;

comment on function public.materialize_legacy_sacramental_notes_v43(uuid,integer) is
'Materializa notas históricas por Libro/Folio/Número; V67 corrige selección UUID única sin usar min(uuid).';
