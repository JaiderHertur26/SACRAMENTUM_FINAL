-- SACRAMENTUM · CONFIRMACIÓN · POSTFLIGHT DE CIERRE
-- Verifica integridad, seguridad, legado y no regresión de consecutivos.

select jsonb_pretty(jsonb_build_object(
  'confirmations_total',(select count(*) from public.confirmations),
  'legacy_total',(select count(*) from public.confirmations where raw_data->>'source'='legacy_import'),
  'annulled_total',(select count(*) from public.confirmations where lower(coalesce(status,'')) in ('anulada','annulled')),
  'duplicates_lfn',(
    select count(*) from (
      select parish_id,book_number,folio,number,count(*)
      from public.confirmations group by 1,2,3,4 having count(*)>1
    ) d
  ),
  'incomplete_required',(
    select count(*) from public.confirmations
    where celebration_date is null
       or nullif(trim(coalesce(nombres,'')),'') is null
       or nullif(trim(coalesce(apellidos,'')),'') is null
       or nullif(trim(coalesce(book_number,'')),'') is null
       or nullif(trim(coalesce(folio,'')),'') is null
       or nullif(trim(coalesce(number,'')),'') is null
  ),
  'birth_after_confirmation',(select count(*) from public.confirmations where fecha_nacimiento>celebration_date),
  'baptism_after_confirmation',(select count(*) from public.confirmations where fecha_bautismo>celebration_date),
  'future_confirmation',(select count(*) from public.confirmations where celebration_date>current_date),
  'constraints_validated',(
    select count(*) from pg_constraint where conrelid='public.confirmations'::regclass
      and conname in ('ck_confirmations_birth_before_confirmation','ck_confirmations_identity_complete','ck_confirmations_registry_ref_complete')
      and convalidated
  ),  'unique_registry_index',exists(
    select 1 from pg_indexes where schemaname='public' and tablename='confirmations'
      and indexname='uq_confirmations_registry_number'
  ),
  'authority_trigger_enabled',exists(
    select 1 from pg_trigger where tgrelid='public.decretos'::regclass
      and tgname='trg_sacramentum_guard_decree_authority' and not tgisinternal and tgenabled<>'D'
  ),
  'legacy_link_guard_enabled',exists(
    select 1 from pg_trigger where tgrelid='public.legacy_record_links'::regclass
      and tgname='trg_sacramentum_guard_legacy_record_link_identity' and not tgisinternal and tgenabled<>'D'
  ),
  'anon_pending',has_function_privilege('anon','public.create_pending_confirmation(uuid,jsonb)','EXECUTE'),
  'auth_pending',has_function_privilege('authenticated','public.create_pending_confirmation(uuid,jsonb)','EXECUTE'),
  'anon_seat',has_function_privilege('anon','public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)','EXECUTE'),
  'auth_seat',has_function_privilege('authenticated','public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)','EXECUTE'),
  'anon_parameters',has_function_privilege('anon','public.save_confirmation_parameters(uuid,jsonb,integer,integer,integer)','EXECUTE'),
  'auth_parameters',has_function_privilege('authenticated','public.save_confirmation_parameters(uuid,jsonb,integer,integer,integer)','EXECUTE'),
  'anon_historical',has_function_privilege('anon','public.register_historical_confirmation(uuid,jsonb,uuid,text)','EXECUTE'),
  'auth_historical',has_function_privilege('authenticated','public.register_historical_confirmation(uuid,jsonb,uuid,text)','EXECUTE'),
  'auth_historical_internal',has_function_privilege('authenticated','public.register_historical_confirmation_internal(uuid,jsonb,uuid,text)','EXECUTE'),
  'anon_correction',has_function_privilege('anon','public.apply_confirmation_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)','EXECUTE'),
  'auth_correction',has_function_privilege('authenticated','public.apply_confirmation_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)','EXECUTE'),
  'auth_correction_internal',has_function_privilege('authenticated','public.apply_confirmation_correction_internal(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)','EXECUTE'),
  'anon_replacement',has_function_privilege('anon','public.apply_confirmation_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)','EXECUTE'),
  'auth_replacement',has_function_privilege('authenticated','public.apply_confirmation_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)','EXECUTE'),
  'auth_replacement_internal',has_function_privilege('authenticated','public.apply_confirmation_replacement_internal(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)','EXECUTE'),  'legacy_source_governance',(
    select jsonb_build_object(
      'source_name',source_name,
      'source_parish_name',source_parish_name,
      'mapping_status',mapping_status,
      'sha256',source_sha256
    )
    from public.legacy_source_parishes
    where source_name='CONFIRMA.json' and profile_key='CONFIRMA'
    limit 1
  ),
  'restored_andres',(
    select jsonb_build_object(
      'id',id,'book',book_number,'folio',folio,'number',number,
      'nombres',nombres,'apellidos',apellidos,'date',celebration_date,
      'source_parish',raw_data->>'source_parish_name',
      'mapping_status',raw_data->>'legacy_mapping_status'
    )
    from public.confirmations
    where book_number='0001' and folio='0001' and number='0001'
      and upper(nombres)='ANDRES EDUARDO'
      and upper(apellidos)='VELASQUEZ INSIGNARES'
    limit 1
  ),
  'test_records_active',(
    select count(*) from public.confirmations
    where upper(concat_ws(' ',coalesce(nombres,''),coalesce(apellidos,''))) like '%PRUEBA SACRAMENTUM%'
  ),
  'legacy_source_count',(
    select count(*) from public.confirmations
    where raw_data->>'source'='legacy_import'
      and raw_data->>'source_parish_name'='PARROQUIA SANTA TERESITA DEL NIÑO JESUS'
  ),  'target_parish_snapshot',(
    select jsonb_build_object(
      'parish',p.name,
      'count',(select count(*) from public.confirmations c where c.parish_id=p.id),
      'ordinary',jsonb_build_array(
        pp.confirmaciones_params->>'ordinarioLibro',
        pp.confirmaciones_params->>'ordinarioFolio',
        pp.confirmaciones_params->>'ordinarioNumero'
      ),
      'registro_actual',pp.confirmaciones_params->>'numeroRegistroActual',
      'supplementary',jsonb_build_array(
        pp.confirmaciones_params->>'suplementarioLibro',
        pp.confirmaciones_params->>'suplementarioFolio',
        pp.confirmaciones_params->>'suplementarioNumero'
      )
    )
    from public.parishes p
    join public.parish_parameters pp on pp.parish_id=p.id
    where p.id='ada2c810-c6eb-4b75-8e3c-4941e3022687'::uuid
    limit 1
  )
)) as confirmation_closure_postflight;


do $gate$
declare
  v_parish uuid := 'ada2c810-c6eb-4b75-8e3c-4941e3022687'::uuid;
  v_params jsonb;
  v_source record;
  v_legacy_count integer;
begin
  select confirmaciones_params into v_params
  from public.parish_parameters where parish_id=v_parish;
  if v_params is null then raise exception 'GATE CONFIRMACIÓN: faltan parámetros de la parroquia objetivo'; end if;  if exists(
    select 1 from public.confirmations
    group by parish_id,book_number,folio,number having count(*)>1
  ) then raise exception 'GATE CONFIRMACIÓN: existen duplicados L/F/N'; end if;

  if exists(
    select 1 from public.confirmations
    where celebration_date is null
       or nullif(trim(coalesce(nombres,'')),'') is null
       or nullif(trim(coalesce(apellidos,'')),'') is null
       or nullif(trim(coalesce(book_number,'')),'') is null
       or nullif(trim(coalesce(folio,'')),'') is null
       or nullif(trim(coalesce(number,'')),'') is null
  ) then raise exception 'GATE CONFIRMACIÓN: existen partidas estructuralmente incompletas'; end if;

  if exists(select 1 from public.confirmations where fecha_nacimiento>celebration_date)
  then raise exception 'GATE CONFIRMACIÓN: nacimiento posterior a la Confirmación'; end if;
  if exists(select 1 from public.confirmations where fecha_bautismo>celebration_date)
  then raise exception 'GATE CONFIRMACIÓN: Bautismo posterior a la Confirmación'; end if;
  if exists(select 1 from public.confirmations where celebration_date>current_date)
  then raise exception 'GATE CONFIRMACIÓN: existe fecha de Confirmación futura'; end if;

  if (select count(*) from pg_constraint
      where conrelid='public.confirmations'::regclass
        and conname in ('ck_confirmations_birth_before_confirmation','ck_confirmations_identity_complete','ck_confirmations_registry_ref_complete')
        and convalidated)<>3
  then raise exception 'GATE CONFIRMACIÓN: constraints no validadas'; end if;

  if not exists(select 1 from pg_indexes where schemaname='public' and tablename='confirmations' and indexname='uq_confirmations_registry_number')
  then raise exception 'GATE CONFIRMACIÓN: falta índice único registral'; end if;  if not exists(
    select 1 from pg_trigger where tgrelid='public.decretos'::regclass
      and tgname='trg_sacramentum_guard_decree_authority' and not tgisinternal and tgenabled<>'D'
  ) then raise exception 'GATE CONFIRMACIÓN: trigger de autoridad de Cancillería inactivo'; end if;

  if not exists(
    select 1 from pg_trigger where tgrelid='public.legacy_record_links'::regclass
      and tgname='trg_sacramentum_guard_legacy_record_link_identity' and not tgisinternal and tgenabled<>'D'
  ) then raise exception 'GATE CONFIRMACIÓN: guard de identidad legacy inactivo'; end if;

  if has_function_privilege('anon','public.create_pending_confirmation(uuid,jsonb)','EXECUTE')
  then raise exception 'GATE CONFIRMACIÓN: anon puede crear pendientes'; end if;
  if has_function_privilege('anon','public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)','EXECUTE')
  then raise exception 'GATE CONFIRMACIÓN: anon puede asentar'; end if;
  if has_function_privilege('anon','public.save_confirmation_parameters(uuid,jsonb,integer,integer,integer)','EXECUTE')
  then raise exception 'GATE CONFIRMACIÓN: anon puede modificar parámetros'; end if;
  if has_function_privilege('anon','public.register_historical_confirmation(uuid,jsonb,uuid,text)','EXECUTE')
  then raise exception 'GATE CONFIRMACIÓN: anon puede digitalizar histórico'; end if;
  if has_function_privilege('anon','public.apply_confirmation_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)','EXECUTE')
  then raise exception 'GATE CONFIRMACIÓN: anon puede emitir correcciones'; end if;
  if has_function_privilege('anon','public.apply_confirmation_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)','EXECUTE')
  then raise exception 'GATE CONFIRMACIÓN: anon puede emitir reposiciones'; end if;

  if not has_function_privilege('authenticated','public.create_pending_confirmation(uuid,jsonb)','EXECUTE')
     or not has_function_privilege('authenticated','public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)','EXECUTE')
     or not has_function_privilege('authenticated','public.save_confirmation_parameters(uuid,jsonb,integer,integer,integer)','EXECUTE')
     or not has_function_privilege('authenticated','public.register_historical_confirmation(uuid,jsonb,uuid,text)','EXECUTE')
  then raise exception 'GATE CONFIRMACIÓN: falta acceso autenticado a wrappers parroquiales'; end if;  if not has_function_privilege('authenticated','public.apply_confirmation_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)','EXECUTE')
     or not has_function_privilege('authenticated','public.apply_confirmation_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)','EXECUTE')
  then raise exception 'GATE CONFIRMACIÓN: wrappers jurídicos no disponibles para sesión autenticada'; end if;

  if has_function_privilege('authenticated','public.register_historical_confirmation_internal(uuid,jsonb,uuid,text)','EXECUTE')
  then raise exception 'GATE CONFIRMACIÓN: función histórica interna expuesta'; end if;
  if has_function_privilege('authenticated','public.apply_confirmation_correction_internal(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)','EXECUTE')
  then raise exception 'GATE CONFIRMACIÓN: corrección interna expuesta'; end if;
  if has_function_privilege('authenticated','public.apply_confirmation_replacement_internal(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)','EXECUTE')
  then raise exception 'GATE CONFIRMACIÓN: reposición interna expuesta'; end if;

  select count(*) into v_legacy_count
  from public.confirmations
  where raw_data->>'source'='legacy_import'
    and raw_data->>'source_parish_name'='PARROQUIA SANTA TERESITA DEL NIÑO JESUS';
  if v_legacy_count<>173
  then raise exception 'GATE CONFIRMACIÓN: corpus CONFIRMA esperado 173, actual %',v_legacy_count; end if;

  if exists(
    select 1 from public.confirmations
    where upper(concat_ws(' ',coalesce(nombres,''),coalesce(apellidos,''))) like '%PRUEBA SACRAMENTUM%'
  ) then raise exception 'GATE CONFIRMACIÓN: persiste una partida de prueba activa'; end if;

  if not exists(
    select 1 from public.confirmations
    where book_number='0001' and folio='0001' and number='0001'
      and upper(nombres)='ANDRES EDUARDO'
      and upper(apellidos)='VELASQUEZ INSIGNARES'
      and celebration_date='2000-10-21'::date
      and raw_data->>'source'='legacy_import'
      and raw_data->>'source_parish_name'='PARROQUIA SANTA TERESITA DEL NIÑO JESUS'
  ) then raise exception 'GATE CONFIRMACIÓN: Andrés Eduardo 0001/0001/0001 no está íntegro'; end if;  select source_parish_name,mapping_status,source_sha256
    into v_source
  from public.legacy_source_parishes
  where source_name='CONFIRMA.json' and profile_key='CONFIRMA'
  limit 1;
  if not found then raise exception 'GATE CONFIRMACIÓN: falta gobierno de fuente CONFIRMA.json'; end if;
  if v_source.source_parish_name<>'PARROQUIA SANTA TERESITA DEL NIÑO JESUS'
     or v_source.mapping_status<>'unmapped'
     or v_source.source_sha256<>'6d9a2f5e48137d989805da91398d6cf251058a8f1763383f6b4452b9847fca1e'
  then raise exception 'GATE CONFIRMACIÓN: metadatos de fuente legacy cambiaron'; end if;

  if row(
       greatest(coalesce(nullif(v_params->>'ordinarioLibro','')::integer,1),1),
       greatest(coalesce(nullif(v_params->>'ordinarioFolio','')::integer,1),1),
       greatest(coalesce(nullif(v_params->>'ordinarioNumero','')::integer,1),1)
     ) < row(1,1,2)
  then raise exception 'GATE CONFIRMACIÓN: consecutivo ordinario retrocedió por debajo de 1/1/2'; end if;

  if row(
       greatest(coalesce(nullif(v_params->>'suplementarioLibro','')::integer,1),1),
       greatest(coalesce(nullif(v_params->>'suplementarioFolio','')::integer,1),1),
       greatest(coalesce(nullif(v_params->>'suplementarioNumero','')::integer,1),1)
     ) < row(1,1,1)
  then raise exception 'GATE CONFIRMACIÓN: consecutivo supletorio retrocedió por debajo de 1/1/1'; end if;

  if coalesce(nullif(regexp_replace(coalesce(v_params->>'numeroRegistroActual',''),'[^0-9]','','g'),'')::bigint,0)<1
  then raise exception 'GATE CONFIRMACIÓN: número de registro retrocedió por debajo de 000001'; end if;
end
$gate$;

select 'CONFIRMACIÓN: POSTFLIGHT DE CIERRE APROBADO' as confirmation_gate_status;

do $legacy_dafe$
declare v_bad int; v_missing_minister int; v_resolved int;
begin
  select count(*) into v_missing_minister from public.confirmations
   where raw_data->>'source'='legacy_import'
     and nullif(trim(coalesce(ministro,'')),'') is null;
  if v_missing_minister<>0 then raise exception 'GATE CONFIRMACIÓN: % Ministros legacy vacíos',v_missing_minister; end if;

  select count(*) into v_resolved from public.confirmations
   where raw_data->>'source'='legacy_import'
     and raw_data->>'legacy_dafe_resolution_source'='PARROCOS.json'
     and nullif(trim(coalesce(da_fe,'')),'') is not null
     and da_fe !~ '^[0-9]+$';
  if v_resolved<>173 then raise exception 'GATE CONFIRMACIÓN: Da Fe legacy resueltos %, esperados 173',v_resolved; end if;

  select count(*) into v_bad from public.confirmations c
   join public.legacy_priest_directory p
     on p.source_system='legacy_json' and p.source_name='PARROCOS.json'
    and p.legacy_code=c.raw_data->>'legacy_dafe_code'
  where c.raw_data->>'source'='legacy_import'
    and (c.da_fe is distinct from p.priest_name or c.raw_data->>'dafe' is distinct from c.raw_data->>'legacy_dafe_code');
  if v_bad<>0 then raise exception 'GATE CONFIRMACIÓN: % resoluciones Da Fe legacy inconsistentes',v_bad; end if;
end
$legacy_dafe$;

do $legacy_dafe_counts$
begin
  if (select count(*) from public.confirmations where raw_data->>'source'='legacy_import' and raw_data->>'legacy_dafe_code'='0002')<>12
  then raise exception 'GATE CONFIRMACIÓN: conteo Da Fe 0002 alterado'; end if;
  if (select count(*) from public.confirmations where raw_data->>'source'='legacy_import' and raw_data->>'legacy_dafe_code'='0003')<>157
  then raise exception 'GATE CONFIRMACIÓN: conteo Da Fe 0003 alterado'; end if;
  if (select count(*) from public.confirmations where raw_data->>'source'='legacy_import' and raw_data->>'legacy_dafe_code'='0004')<>4
  then raise exception 'GATE CONFIRMACIÓN: conteo Da Fe 0004 alterado'; end if;
  if (select count(*) from public.legacy_priest_directory where source_name='PARROCOS.json' and source_sha256='4b8503d737777c378cf48dc25ed1d803dbb5848b555246b29e67f40cb3ca04f3')<>4
  then raise exception 'GATE CONFIRMACIÓN: catálogo PARROCOS.json incompleto o hash distinto'; end if;
end
$legacy_dafe_counts$;

select 'CONFIRMACIÓN: DA FE LEGACY RESUELTO Y AUDITABLE' as confirmation_legacy_dafe_status;
