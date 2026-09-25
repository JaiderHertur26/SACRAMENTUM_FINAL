do $e2e$
declare
  v_parish uuid;
  v_total integer;
  v_historical integer;
  v_audits integer;
  v_params jsonb;
begin
  select p.id, pp.bautizos_params
    into v_parish, v_params
  from public.parishes p
  join public.parish_parameters pp on pp.parish_id=p.id
  where p.name='PARROQUIA MARÍA AUXILIO DE LOS CRISTIANOS'
  limit 1;

  if v_parish is null then raise exception 'E2E BAUTISMO: parroquia objetivo no encontrada'; end if;
  select count(*) into v_total from public.baptisms where parish_id=v_parish;
  select count(*) into v_historical from public.baptisms
    where parish_id=v_parish and coalesce(raw_data->>'source','')='historical_book_digitization';
  select count(*) into v_audits from public.registry_audit_log
    where parish_id=v_parish and entity_type='baptism' and action='historical_digitization';

  if v_total <> 48 then raise exception 'E2E BAUTISMO: se esperaban 48 partidas y existen %',v_total; end if;
  if v_historical <> 1 then raise exception 'E2E BAUTISMO: se esperaba 1 digitalización histórica y existen %',v_historical; end if;
  if v_audits <> 1 then raise exception 'E2E BAUTISMO: se esperaba 1 auditoría histórica y existen %',v_audits; end if;
  if not exists (
    select 1
    from public.registry_audit_log a
    join public.baptisms b on b.id=a.entity_id
    where a.parish_id=v_parish
      and a.entity_type='baptism'
      and a.action='historical_digitization'
      and coalesce(a.metadata->'changes_live_sequence','true'::jsonb)='false'::jsonb
      and b.parish_id=v_parish
      and coalesce(b.raw_data->>'source','')='historical_book_digitization'
      and lower(coalesce(b.status,''))='seated'
  ) then raise exception 'E2E BAUTISMO: auditoría/partida histórica no están enlazadas correctamente'; end if;

  if coalesce(v_params->>'ordinarioLibro','') <> '1'
     or coalesce(v_params->>'ordinarioFolio','') <> '1'
     or coalesce(v_params->>'ordinarioNumero','') <> '2'
     or coalesce(v_params->>'numeroRegistroActual','') <> '000001'
  then raise exception 'E2E BAUTISMO: la digitalización alteró el consecutivo ordinario'; end if;
end
$e2e$;

select jsonb_pretty(jsonb_build_object(
  'e2e_status','OK',
  'record',(
    select jsonb_build_object(
      'id',b.id,'book',b.book_number,'folio',b.folio,'number',b.number,
      'source',b.raw_data->>'source','status',b.status
    )
    from public.baptisms b
    join public.parishes p on p.id=b.parish_id
    where p.name='PARROQUIA MARÍA AUXILIO DE LOS CRISTIANOS'
      and coalesce(b.raw_data->>'source','')='historical_book_digitization'
    order by b.created_at desc limit 1
  ),
  'audit',(
    select jsonb_build_object('action',a.action,'changes_live_sequence',a.metadata->'changes_live_sequence')
    from public.registry_audit_log a
    join public.parishes p on p.id=a.parish_id
    where p.name='PARROQUIA MARÍA AUXILIO DE LOS CRISTIANOS'
      and a.entity_type='baptism' and a.action='historical_digitization'
    order by a.created_at desc limit 1
  )
)) as baptism_e2e_final;
