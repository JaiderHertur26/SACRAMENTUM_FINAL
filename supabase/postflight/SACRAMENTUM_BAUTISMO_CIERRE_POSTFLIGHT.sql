select jsonb_pretty(jsonb_build_object(
  'baptisms_total', (select count(*) from public.baptisms),
  'annulled_total', (select count(*) from public.baptisms where lower(coalesce(status,'')) in ('anulada','annulled')),
  'duplicates_lfn', (
    select count(*) from (
      select parish_id,book_number,folio,number,count(*)
      from public.baptisms
      group by 1,2,3,4
      having count(*) > 1
    ) d
  ),
  'incomplete_required', (
    select count(*) from public.baptisms
    where celebration_date is null
       or nullif(trim(coalesce(apellidos,'')),'') is null
       or nullif(trim(coalesce(nombres,'')),'') is null
       or nullif(trim(coalesce(book_number,'')),'') is null
       or nullif(trim(coalesce(folio,'')),'') is null
       or nullif(trim(coalesce(number,'')),'') is null
  ),
  'birth_after_baptism', (
    select count(*) from public.baptisms
    where fecha_nacimiento > celebration_date
  ),
  'constraints_validated', (
    select count(*) from pg_constraint
    where conrelid='public.baptisms'::regclass
      and conname in (
        'ck_baptisms_birth_before_baptism',
        'ck_baptisms_identity_complete',
        'ck_baptisms_registry_ref_complete'
      ) and convalidated
  ),
  'guard_trigger_enabled', exists (
    select 1 from pg_trigger
    where tgrelid='public.decretos'::regclass
      and tgname='trg_sacramentum_guard_decree_authority'
      and not tgisinternal
      and tgenabled <> 'D'
  ),
  'anon_historical', has_function_privilege('anon','public.register_historical_baptism(uuid,jsonb)','EXECUTE'),
  'auth_historical', has_function_privilege('authenticated','public.register_historical_baptism(uuid,jsonb)','EXECUTE'),
  'auth_historical_internal', case
    when to_regprocedure('public.register_historical_baptism_internal(uuid,jsonb)') is null then null
    else has_function_privilege('authenticated','public.register_historical_baptism_internal(uuid,jsonb)','EXECUTE')
  end,
  'anon_matrimonial_search', has_function_privilege(
    'anon','public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer)','EXECUTE'
  ),
  'auth_matrimonial_search', has_function_privilege(
    'authenticated','public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer)','EXECUTE'
  ),
  'reversed_inline_collisions', (
    select count(*)
    from public.baptisms b
    join public.marginal_notes mn
      on mn.sacrament_id=b.id
     and lower(coalesce(mn.sacrament_type,''))='bautismo'
    where lower(coalesce(mn.status,'')) in ('reversed','revertida','deleted')
      and nullif(trim(coalesce(b.nota_marginal,'')),'') is not null
      and trim(coalesce(mn.content,''))=trim(coalesce(b.nota_marginal,''))
  ),
  'target_parish_snapshot', (
    select jsonb_build_object(
      'parish',p.name,
      'count',(select count(*) from public.baptisms b where b.parish_id=p.id),
      'ordinary',jsonb_build_array(pp.bautizos_params->>'ordinarioLibro',pp.bautizos_params->>'ordinarioFolio',pp.bautizos_params->>'ordinarioNumero'),
      'registro_actual',pp.bautizos_params->>'numeroRegistroActual',
      'supplementary',jsonb_build_array(pp.bautizos_params->>'suplementarioLibro',pp.bautizos_params->>'suplementarioFolio',pp.bautizos_params->>'suplementarioNumero')
    )
    from public.parishes p
    join public.parish_parameters pp on pp.parish_id=p.id
    where p.name='PARROQUIA MARÍA AUXILIO DE LOS CRISTIANOS'
    limit 1
  )
)) as baptism_closure_postflight;


do $gate$
declare
  v_parish uuid;
  v_params jsonb;
begin
  select p.id, pp.bautizos_params
    into v_parish, v_params
  from public.parishes p
  join public.parish_parameters pp on pp.parish_id=p.id
  where p.name='PARROQUIA MARÍA AUXILIO DE LOS CRISTIANOS'
  limit 1;

  if v_parish is null then raise exception 'GATE BAUTISMO: parroquia objetivo no encontrada'; end if;
  if exists (
    select 1 from public.baptisms
    group by parish_id,book_number,folio,number having count(*)>1
  ) then raise exception 'GATE BAUTISMO: existen duplicados L/F/N'; end if;
  if exists (
    select 1 from public.baptisms
    where celebration_date is null
       or nullif(trim(coalesce(apellidos,'')),'') is null
       or nullif(trim(coalesce(nombres,'')),'') is null
       or nullif(trim(coalesce(book_number,'')),'') is null
       or nullif(trim(coalesce(folio,'')),'') is null
       or nullif(trim(coalesce(number,'')),'') is null
  ) then raise exception 'GATE BAUTISMO: existen partidas incompletas'; end if;
  if exists (
    select 1 from public.baptisms where fecha_nacimiento > celebration_date
  ) then raise exception 'GATE BAUTISMO: existe nacimiento posterior al Bautismo'; end if;
  if (select count(*) from pg_constraint
      where conrelid='public.baptisms'::regclass
        and conname in ('ck_baptisms_birth_before_baptism','ck_baptisms_identity_complete','ck_baptisms_registry_ref_complete')
        and convalidated) <> 3
  then raise exception 'GATE BAUTISMO: constraints no validadas'; end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.decretos'::regclass
      and tgname='trg_sacramentum_guard_decree_authority'
      and not tgisinternal and tgenabled<>'D'
  ) then raise exception 'GATE BAUTISMO: trigger de autoridad de Cancillería inactivo'; end if;
  if has_function_privilege('anon','public.register_historical_baptism(uuid,jsonb)','EXECUTE')
  then raise exception 'GATE BAUTISMO: anon puede digitalizar Bautismos'; end if;
  if not has_function_privilege('authenticated','public.register_historical_baptism(uuid,jsonb)','EXECUTE')
  then raise exception 'GATE BAUTISMO: authenticated no puede usar wrapper histórico'; end if;
  if has_function_privilege('authenticated','public.register_historical_baptism_internal(uuid,jsonb)','EXECUTE')
  then raise exception 'GATE BAUTISMO: función histórica interna expuesta'; end if;
  if has_function_privilege('anon','public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer)','EXECUTE')
  then raise exception 'GATE BAUTISMO: anon puede usar búsqueda matrimonial'; end if;
  if not has_function_privilege('authenticated','public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer)','EXECUTE')
  then raise exception 'GATE BAUTISMO: authenticated no puede usar búsqueda matrimonial protegida'; end if;
  if exists (
    select 1 from public.baptisms b
    join public.marginal_notes mn on mn.sacrament_id=b.id and lower(coalesce(mn.sacrament_type,''))='bautismo'
    where lower(coalesce(mn.status,'')) in ('reversed','revertida','deleted')
      and nullif(trim(coalesce(b.nota_marginal,'')),'') is not null
      and trim(coalesce(mn.content,''))=trim(coalesce(b.nota_marginal,''))
  ) then raise exception 'GATE BAUTISMO: nota revertida coincide con fallback inline'; end if;

  if coalesce(v_params->>'ordinarioLibro','') <> '1'
     or coalesce(v_params->>'ordinarioFolio','') <> '1'
     or coalesce(v_params->>'ordinarioNumero','') <> '2'
     or coalesce(v_params->>'numeroRegistroActual','') <> '000001'
  then raise exception 'GATE BAUTISMO: consecutivo ordinario crítico cambió'; end if;
  if coalesce(v_params->>'suplementarioLibro','') <> '1'
     or coalesce(v_params->>'suplementarioFolio','') <> '1'
     or coalesce(v_params->>'suplementarioNumero','') <> '1'
  then raise exception 'GATE BAUTISMO: consecutivo supletorio crítico cambió'; end if;
end
$gate$;
