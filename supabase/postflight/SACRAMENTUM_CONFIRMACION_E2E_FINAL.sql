-- SACRAMENTUM · CONFIRMACIÓN · E2E FINAL
-- Sólo aprueba cuando existe al menos una digitalización real de libro físico.

do $e2e$
declare
  v_parish uuid := 'ada2c810-c6eb-4b75-8e3c-4941e3022687'::uuid;
  v_historical integer;
  v_audits integer;
  v_params jsonb;
begin
  select confirmaciones_params into v_params
  from public.parish_parameters where parish_id=v_parish;
  if v_params is null then raise exception 'E2E CONFIRMACIÓN: parroquia objetivo sin parámetros'; end if;

  select count(*) into v_historical
  from public.confirmations
  where parish_id=v_parish
    and coalesce(raw_data->>'source','')='historical_book_digitization';

  select count(*) into v_audits
  from public.registry_audit_log
  where parish_id=v_parish
    and entity_type='confirmation'
    and action='historical_digitization';

  if v_historical<1 then
    raise exception 'E2E CONFIRMACIÓN: falta digitalizar una Confirmación real del libro físico';
  end if;
  if v_audits<1 then
    raise exception 'E2E CONFIRMACIÓN: falta auditoría historical_digitization';
  end if;  if not exists(
    select 1
    from public.registry_audit_log a
    join public.confirmations c on c.id=a.entity_id
    where a.parish_id=v_parish
      and a.entity_type='confirmation'
      and a.action='historical_digitization'
      and coalesce(a.metadata->'changes_live_sequence','true'::jsonb)='false'::jsonb
      and c.parish_id=v_parish
      and coalesce(c.raw_data->>'source','')='historical_book_digitization'
      and lower(coalesce(c.status,''))='seated'
  ) then raise exception 'E2E CONFIRMACIÓN: auditoría y partida histórica no están enlazadas correctamente'; end if;

  if row(
       greatest(coalesce(nullif(v_params->>'ordinarioLibro','')::integer,1),1),
       greatest(coalesce(nullif(v_params->>'ordinarioFolio','')::integer,1),1),
       greatest(coalesce(nullif(v_params->>'ordinarioNumero','')::integer,1),1)
     ) < row(1,1,2)
  then raise exception 'E2E CONFIRMACIÓN: el consecutivo ordinario retrocedió'; end if;

  if coalesce(nullif(regexp_replace(coalesce(v_params->>'numeroRegistroActual',''),'[^0-9]','','g'),'')::bigint,0)<1
  then raise exception 'E2E CONFIRMACIÓN: el número de registro retrocedió'; end if;
end
$e2e$;
select jsonb_pretty(jsonb_build_object(
  'e2e_status','OK',
  'historical_count',(
    select count(*) from public.confirmations
    where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'::uuid
      and coalesce(raw_data->>'source','')='historical_book_digitization'
  ),
  'record',(
    select jsonb_build_object(
      'id',c.id,'book',c.book_number,'folio',c.folio,'number',c.number,
      'nombres',c.nombres,'apellidos',c.apellidos,'source',c.raw_data->>'source','status',c.status
    )
    from public.confirmations c
    where c.parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'::uuid
      and coalesce(c.raw_data->>'source','')='historical_book_digitization'
    order by c.created_at desc limit 1
  ),
  'audit',(
    select jsonb_build_object(
      'action',a.action,
      'changes_live_sequence',a.metadata->'changes_live_sequence',
      'entity_id',a.entity_id
    )
    from public.registry_audit_log a
    where a.parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'::uuid
      and a.entity_type='confirmation'
      and a.action='historical_digitization'
    order by a.created_at desc limit 1
  )
)) as confirmation_e2e_final;
