-- SACRAMENTUM · V13 · SMOKE DATOS AUXILIARES
-- Toda la prueba se revierte al final.
begin;

do $$
declare
  v_parish uuid := 'ada2c810-c6eb-4b75-8e3c-4941e3022687';
  v_name text;
begin
  insert into public.parrocos(
    parish_id,nombre,apellido,fecha_ingreso,fecha_salida,estado,payload
  ) values(
    v_parish,'SMOKE','PARROCO MANUAL V13',current_date,null,'HISTORICO',
    jsonb_build_object('source','smoke_v13')
  );
  perform public.sacramentum_recalculate_current_priest(v_parish);
  v_name := public.sacramentum_priest_at_date(v_parish,current_date)->>'nombreCompleto';
  if v_name <> 'SMOKE PARROCO MANUAL V13' then
    raise exception 'SMOKE manual falló: %',coalesce(v_name,'NULL');
  end if;
end $$;
do $$
declare
  v_parish uuid := 'ada2c810-c6eb-4b75-8e3c-4941e3022687';
  v_name text;
begin
  insert into public.bishop_tenures(
    parish_id,bishop_name,start_date,end_date,notes
  ) values(
    v_parish,'SMOKE OBISPO TITULAR V13',current_date - 30,null,'smoke rollback'
  );
  v_name := public.sacramentum_bishop_at_date(v_parish,current_date)->>'nombreCompleto';
  if v_name <> 'SMOKE OBISPO TITULAR V13' then
    raise exception 'SMOKE obispo falló: %',coalesce(v_name,'NULL');
  end if;
end $$;
do $$
declare
  v_batch uuid := gen_random_uuid();
  v_parish uuid := 'ada2c810-c6eb-4b75-8e3c-4941e3022687';
  v_diocese uuid;
  v_result jsonb;
  v_name text;
begin
  select diocese_id into v_diocese
  from public.parishes where id=v_parish;

  insert into public.legacy_import_batches(
    id,source_system,source_name,original_filename,profile_key,sha256,
    parish_id,diocese_id,status,metadata
  ) values(
    v_batch,'SMOKE','V13','SMOKE_PARROCOS_V13.json','PARROCOS',
    repeat('a',64),v_parish,v_diocese,'completed',
    jsonb_build_object('smoke',true)
  );
  insert into public.legacy_import_rows(
    batch_id,row_number,source_key,target_entity,
    original_data,normalized_data,status
  ) values(
    v_batch,1,'SMOKE-P13','priest_directory',
    '{}'::jsonb,
    jsonb_build_object(
      'legacy_code','SMOKE-P13',
      'priest_name','SMOKE PARROCO IMPORTADO V13',
      'service_start',current_date::text,
      'service_end',''
    ),
    'imported'
  );

  v_result := public.materialize_auxiliary_catalog_batch(v_batch);
  if coalesce((v_result->>'materialized')::integer,0) <> 1 then
    raise exception 'SMOKE materialización falló: %',v_result;
  end if;
  perform public.sacramentum_recalculate_current_priest(v_parish);
  v_name := public.sacramentum_priest_at_date(v_parish,current_date)->>'nombreCompleto';
  if v_name <> 'SMOKE PARROCO IMPORTADO V13' then
    raise exception 'SMOKE importado falló: %',coalesce(v_name,'NULL');
  end if;
end $$;
select jsonb_pretty(jsonb_build_object(
  'manual_priest_smoke','OK',
  'bishop_tenure_smoke','OK',
  'imported_priest_materialization_smoke','OK'
)) as smoke_result;

rollback;
