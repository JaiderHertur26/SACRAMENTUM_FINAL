-- SACRAMENTUM · BAUTISMO · DIGITALIZACIÓN HISTÓRICA INMUTABLE
-- Garantiza en PostgreSQL que transcribir un libro físico nunca consume
-- ni modifica el consecutivo ordinario vivo de Bautismo.

begin;

do $$
begin
  if to_regprocedure('public.register_historical_baptism_internal(uuid,jsonb)') is null then
    if to_regprocedure('public.register_historical_baptism(uuid,jsonb)') is null then
      raise exception 'Falta register_historical_baptism canónica';
    end if;
    execute 'alter function public.register_historical_baptism(uuid,jsonb) rename to register_historical_baptism_internal';
  end if;
end;
$$;

create or replace function public.register_historical_baptism(
  p_parish_id uuid,
  p_record jsonb
)
returns table(record_id uuid, book_number text, folio text, number text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_before_params jsonb;
  v_after_params jsonb;
  v_celebration date;
  v_birth date;
  v_id uuid;
  v_book text;
  v_folio text;
  v_number text;
begin
  if p_record is null or jsonb_typeof(p_record) <> 'object' then
    raise exception 'Registro histórico de Bautismo inválido';
  end if;
  if nullif(trim(coalesce(p_record->>'Libro',p_record->>'book_number',p_record->>'libro','')),'') is null
     or nullif(trim(coalesce(p_record->>'folio',p_record->>'page_number','')),'') is null
     or nullif(trim(coalesce(p_record->>'numero',p_record->>'entry_number',p_record->>'number','')),'') is null then
    raise exception 'Libro, Folio y Número físicos son obligatorios';
  end if;
  if nullif(trim(coalesce(p_record->>'nombres','')),'') is null
     or nullif(trim(coalesce(p_record->>'apellidos','')),'') is null then
    raise exception 'Nombres y apellidos son obligatorios';
  end if;
  begin
    v_celebration := nullif(trim(coalesce(p_record->>'fechaSacramento',p_record->>'celebration_date','')),'')::date;
  exception when others then
    raise exception 'Fecha de Bautismo inválida';
  end;
  if v_celebration is null then
    raise exception 'La fecha de Bautismo es obligatoria';
  end if;
  if v_celebration > current_date then
    raise exception 'Una partida histórica no puede tener fecha de Bautismo futura';
  end if;

  begin
    v_birth := nullif(trim(coalesce(p_record->>'fechaNacimiento',p_record->>'fecha_nacimiento','')),'')::date;
  exception when others then
    raise exception 'Fecha de nacimiento inválida';
  end;
  if v_birth is not null and v_birth > v_celebration then
    raise exception 'La fecha de nacimiento no puede ser posterior al Bautismo';
  end if;

  select bautizos_params into v_before_params
  from public.parish_parameters
  where parish_id=p_parish_id
  for update;
  if not found then
    raise exception 'La parroquia no tiene parámetros de Bautismo configurados';
  end if;

  select r.record_id,r.book_number,r.folio,r.number
    into v_id,v_book,v_folio,v_number
  from public.register_historical_baptism_internal(p_parish_id,p_record) r;

  if v_id is null then
    raise exception 'La digitalización histórica no devolvió identificador de partida';
  end if;

  select bautizos_params into v_after_params
  from public.parish_parameters
  where parish_id=p_parish_id;

  if v_after_params is distinct from v_before_params then
    raise exception 'Invariante violada: la digitalización histórica intentó modificar parámetros/consecutivos de Bautismo';
  end if;

  return query select v_id,v_book,v_folio,v_number;
end;
$$;

revoke all on function public.register_historical_baptism_internal(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.register_historical_baptism_internal(uuid,jsonb) to service_role;
revoke all on function public.register_historical_baptism(uuid,jsonb) from public,anon;
grant execute on function public.register_historical_baptism(uuid,jsonb) to authenticated,service_role;

comment on function public.register_historical_baptism(uuid,jsonb)
is 'Digitaliza una partida bautismal física y aborta toda la transacción si cualquier parámetro/consecutivo de Bautismo cambia.';

commit;

select jsonb_pretty(jsonb_build_object(
  'historical_wrapper',to_regprocedure('public.register_historical_baptism(uuid,jsonb)') is not null,
  'historical_internal',to_regprocedure('public.register_historical_baptism_internal(uuid,jsonb)') is not null,
  'anon_historical',has_function_privilege('anon','public.register_historical_baptism(uuid,jsonb)','EXECUTE'),
  'auth_historical',has_function_privilege('authenticated','public.register_historical_baptism(uuid,jsonb)','EXECUTE'),
  'auth_historical_internal',has_function_privilege('authenticated','public.register_historical_baptism_internal(uuid,jsonb)','EXECUTE')
)) as historical_immutability_postcheck;
