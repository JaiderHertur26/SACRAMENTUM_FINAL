-- SACRAMENTUM · CONFIRMACIÓN HISTÓRICA · INMUTABILIDAD
-- Garantiza que digitalizar libro físico jamás mueva consecutivos vivos.
begin;

do $$
begin
  if to_regprocedure('public.register_historical_confirmation_internal(uuid,jsonb,uuid,text)') is null
     and to_regprocedure('public.register_historical_confirmation(uuid,jsonb,uuid,text)') is not null then
    alter function public.register_historical_confirmation(uuid,jsonb,uuid,text)
      rename to register_historical_confirmation_internal;
  end if;
end $$;

create or replace function public.register_historical_confirmation(
  p_parish_id uuid,
  p_record jsonb,
  p_cross_baptism_id uuid default null,
  p_cross_note text default null
)
returns table(record_id uuid, book_number text, folio text, number text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_celebration date;
  v_birth date;
  v_baptism date;
  v_role text;
  v_user_parish uuid;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select lower(coalesce(up.role,'')),up.parish_id
    into v_role,v_user_parish
  from public.user_profiles up
  where up.auth_user_id=auth.uid()
    and coalesce(up.is_active,true)=true
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;
  if v_role<>'parish' or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede digitalizar su libro de Confirmaciones';
  end if;

  if p_record is null or jsonb_typeof(p_record)<>'object' then
    raise exception 'Registro histórico de Confirmación no válido';
  end if;
  if nullif(trim(coalesce(p_record->>'nombres','')),'') is null
     or nullif(trim(coalesce(p_record->>'apellidos','')),'') is null then
    raise exception 'Nombres y apellidos son obligatorios';
  end if;

  begin
    v_celebration := nullif(coalesce(p_record->>'fechaSacramento',p_record->>'celebration_date'),'')::date;
    v_birth := nullif(coalesce(p_record->>'fechaNacimiento',p_record->>'fecha_nacimiento'),'')::date;
    v_baptism := nullif(coalesce(p_record->>'fechaBautismo',p_record->>'fecha_bautismo'),'')::date;
  exception when others then
    raise exception 'Una de las fechas suministradas no es válida';
  end;

  if v_celebration is null then raise exception 'La fecha de Confirmación es obligatoria'; end if;
  if v_celebration > current_date then raise exception 'Una Confirmación histórica no puede tener fecha futura'; end if;
  if v_birth is not null and v_birth > v_celebration then raise exception 'La fecha de nacimiento no puede ser posterior a la Confirmación'; end if;
  if v_baptism is not null and v_baptism > v_celebration then raise exception 'La fecha de Bautismo no puede ser posterior a la Confirmación'; end if;

  if p_cross_baptism_id is not null and not exists (
    select 1 from public.baptisms b
    where b.id=p_cross_baptism_id and b.parish_id=p_parish_id
      and coalesce(lower(b.status),'active') not in ('anulada','annulled','reversed','revertida','replaced','deleted')
  ) then
    raise exception 'La partida bautismal enlazada no está vigente o no pertenece a esta parroquia';
  end if;  select pp.confirmaciones_params into v_before
  from public.parish_parameters pp
  where pp.parish_id=p_parish_id
  for update;
  if not found then raise exception 'La parroquia no tiene parámetros de Confirmación'; end if;

  return query
  select * from public.register_historical_confirmation_internal(
    p_parish_id,p_record,p_cross_baptism_id,p_cross_note
  );

  select pp.confirmaciones_params into v_after
  from public.parish_parameters pp
  where pp.parish_id=p_parish_id;

  if v_after is distinct from v_before then
    raise exception 'Invariante violada: la digitalización histórica intentó modificar consecutivos de Confirmación';
  end if;
end;
$$;

revoke all on function public.register_historical_confirmation_internal(uuid,jsonb,uuid,text) from public, anon, authenticated;
grant execute on function public.register_historical_confirmation_internal(uuid,jsonb,uuid,text) to service_role;
revoke all on function public.register_historical_confirmation(uuid,jsonb,uuid,text) from public, anon;
grant execute on function public.register_historical_confirmation(uuid,jsonb,uuid,text) to authenticated, service_role;

commit;