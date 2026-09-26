create or replace function public.create_pending_baptism_with_confirmation_flow(
  p_parish_id uuid,
  p_baptism_record jsonb,
  p_confirmation_record jsonb default null
)
returns table(
  baptism_pending_id uuid,
  baptism_numero_registro text,
  confirmation_pending_id uuid,
  confirmation_numero_registro text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_user_parish uuid;
  v_diocese uuid;
  v_birth_date date;
  v_baptism_date date;
  v_confirmation_date date;
  v_age integer;
  v_file_signed boolean;
  v_will_confirm boolean := false;
  v_baptism_payload jsonb;
  v_confirmation_payload jsonb;
  v_baptism_id uuid;
  v_baptism_reg text;
  v_confirmation_id uuid;
  v_confirmation_reg text;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;
  if p_parish_id is null then
    raise exception 'No se pudo determinar la parroquia';
  end if;
  if p_baptism_record is null or jsonb_typeof(p_baptism_record) <> 'object' then
    raise exception 'El registro de Bautismo no es válido';
  end if;

  select lower(coalesce(up.role,'')), up.parish_id, up.diocese_id
    into v_role, v_user_parish, v_diocese
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true) = true
    and coalesce(lower(up.status),'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role <> 'parish' or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede crear este registro conjunto';
  end if;

  begin
    v_birth_date := nullif(coalesce(
      p_baptism_record->>'fechaNacimiento',
      p_baptism_record->>'fecha_nacimiento'
    ), '')::date;
    v_baptism_date := nullif(coalesce(
      p_baptism_record->>'fechaSacramento',
      p_baptism_record->>'celebration_date'
    ), '')::date;
  exception when others then
    raise exception 'Las fechas del Bautismo no son válidas';
  end;

  if v_birth_date is null or v_baptism_date is null then
    raise exception 'Fecha de nacimiento y fecha de Bautismo son obligatorias';
  end if;
  if v_birth_date > v_baptism_date then
    raise exception 'La fecha de nacimiento no puede ser posterior al Bautismo';
  end if;

  v_age := public.sacramentum_age_years(v_birth_date, v_baptism_date);

  if v_age >= 8 then
    if not (p_baptism_record ? 'over8FileSigned')
       or jsonb_typeof(p_baptism_record->'over8FileSigned') <> 'boolean' then
      raise exception 'Debe indicar si el expediente para mayores de 8 años está firmado';
    end if;
    v_file_signed := (p_baptism_record->>'over8FileSigned')::boolean;
  else
    v_file_signed := null;
  end if;

  if v_age >= 12 then
    if not (p_baptism_record ? 'willReceiveConfirmation')
       or jsonb_typeof(p_baptism_record->'willReceiveConfirmation') <> 'boolean' then
      raise exception 'Debe indicar si el candidato de 12 años o más recibirá también la Confirmación';
    end if;
    v_will_confirm := (p_baptism_record->>'willReceiveConfirmation')::boolean;
  end if;

  v_baptism_payload := p_baptism_record || jsonb_build_object(
    'ageAtBaptism', v_age,
    'requiresOver8File', v_age >= 8,
    'over8FileSigned', to_jsonb(v_file_signed),
    'requiresConfirmationQuestion', v_age >= 12,
    'willReceiveConfirmation', v_will_confirm,
    'catechumenPreparationStatus',
      case
        when v_age < 8 then 'not_applicable'
        when v_file_signed then 'prepared'
        else 'not_prepared'
      end,
    'sourceFlow', 'baptism_registration_v42'
  );

  select c.pending_id, c.numero_registro
    into v_baptism_id, v_baptism_reg
  from public.create_pending_baptism(p_parish_id, v_baptism_payload) c;

  if v_will_confirm then
    if p_confirmation_record is null
       or jsonb_typeof(p_confirmation_record) <> 'object' then
      raise exception 'Faltan los datos complementarios de la Confirmación';
    end if;

    begin
      v_confirmation_date := nullif(coalesce(
        p_confirmation_record->>'fechaSacramento',
        p_confirmation_record->>'fechaConfirmacion',
        p_confirmation_record->>'celebration_date'
      ), '')::date;
    exception when others then
      raise exception 'La fecha de Confirmación no es válida';
    end;

    if v_confirmation_date is null then
      raise exception 'La fecha de Confirmación es obligatoria';
    end if;
    if v_confirmation_date < v_baptism_date then
      raise exception 'La Confirmación no puede programarse antes del Bautismo';
    end if;

    v_confirmation_payload := coalesce(p_confirmation_record,'{}'::jsonb)
      || jsonb_build_object(
        'nombres', coalesce(p_baptism_record->>'nombres',''),
        'apellidos', coalesce(p_baptism_record->>'apellidos',''),
        'sexo', coalesce(p_baptism_record->>'sexo',''),
        'fechaNacimiento', v_birth_date::text,
        'lugarNacimiento', coalesce(p_baptism_record->>'lugarNacimiento',''),
        'direccion', coalesce(p_baptism_record->>'direccion',''),
        'nombrePadre', coalesce(p_baptism_record->>'nombrePadre',''),
        'nombreMadre', coalesce(p_baptism_record->>'nombreMadre',''),
        'tipoUnionPadres', coalesce(p_baptism_record->>'tipoUnionPadres',''),
        'abuelosPaternos', coalesce(p_baptism_record->>'abuelosPaternos',''),
        'abuelosMaternos', coalesce(p_baptism_record->>'abuelosMaternos',''),
        'fechaBautismo', v_baptism_date::text,
        'lugarBautismo', coalesce(p_baptism_record->>'lugarBautismo',''),
        'libroBautismo', '',
        'folioBautismo', '',
        'numeroBautismo', '',
        'baptismReferencePending', true,
        'linkedBaptismPendingId', v_baptism_id,
        'sourceFlow', 'baptism_registration_v42'
      );

    select c.pending_id, c.numero_registro
      into v_confirmation_id, v_confirmation_reg
    from public.create_pending_confirmation(p_parish_id, v_confirmation_payload) c;

    update public.pending_baptisms
    set raw_data = coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
      'linkedConfirmationPendingId', v_confirmation_id,
      'linkedConfirmationNumeroRegistro', v_confirmation_reg
    )
    where id = v_baptism_id and parish_id = p_parish_id;

    update public.pending_confirmations
    set raw_data = coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
      'linkedBaptismPendingId', v_baptism_id,
      'linkedBaptismNumeroRegistro', v_baptism_reg
    )
    where id = v_confirmation_id and parish_id = p_parish_id;

    insert into public.registry_audit_log(
      actor_user_id, parish_id, diocese_id, entity_type, entity_id,
      action, after_data, metadata
    ) values (
      auth.uid(), p_parish_id, v_diocese, 'pending_baptism', v_baptism_id,
      'link_pending_confirmation',
      jsonb_build_object(
        'baptism_pending_id', v_baptism_id,
        'confirmation_pending_id', v_confirmation_id
      ),
      jsonb_build_object(
        'baptism_numero_registro', v_baptism_reg,
        'confirmation_numero_registro', v_confirmation_reg,
        'age_at_baptism', v_age
      )
    );
  end if;

  return query
  select v_baptism_id, v_baptism_reg, v_confirmation_id, v_confirmation_reg;
end;
$$;

revoke all on function public.create_pending_baptism_with_confirmation_flow(uuid,jsonb,jsonb) from public;
revoke all on function public.create_pending_baptism_with_confirmation_flow(uuid,jsonb,jsonb) from anon;
grant execute on function public.create_pending_baptism_with_confirmation_flow(uuid,jsonb,jsonb) to authenticated;

comment on function public.create_pending_baptism_with_confirmation_flow(uuid,jsonb,jsonb)
is 'Crea atómicamente el Bautismo por celebrar y, desde 12 años cuando corresponda, la Confirmación vinculada.';
create or replace function public.sync_linked_confirmation_after_baptism_seat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_confirmation_id uuid;
begin
  if nullif(new.raw_data->>'linkedConfirmationPendingId','') is null then
    return new;
  end if;

  v_confirmation_id := (new.raw_data->>'linkedConfirmationPendingId')::uuid;

  update public.pending_confirmations
  set raw_data = coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
    'linkedBaptismRecordId', new.id,
    'fechaBautismo', new.celebration_date::text,
    'lugarBautismo', coalesce(new.lugar_bautismo,''),
    'libroBautismo', coalesce(new.book_number,''),
    'folioBautismo', coalesce(new.folio,''),
    'numeroBautismo', coalesce(new.number,''),
    'baptismReferencePending', false
  )
  where id = v_confirmation_id
    and parish_id = new.parish_id
    and coalesce(reportado,false) = false
    and lower(coalesce(status,'pending')) = 'pending';

  return new;
end;
$$;

drop trigger if exists trg_sync_linked_confirmation_after_baptism_seat
  on public.baptisms;

create trigger trg_sync_linked_confirmation_after_baptism_seat
after insert on public.baptisms
for each row
execute function public.sync_linked_confirmation_after_baptism_seat();

revoke all on function public.sync_linked_confirmation_after_baptism_seat() from public;
revoke all on function public.sync_linked_confirmation_after_baptism_seat() from anon;
revoke all on function public.sync_linked_confirmation_after_baptism_seat() from authenticated;

create or replace function public.enforce_linked_baptism_before_confirmation_seat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_baptism_id uuid;
begin
  if nullif(new.raw_data->>'linkedBaptismPendingId','') is null then
    return new;
  end if;

  if nullif(new.raw_data->>'linkedBaptismRecordId','') is null then
    raise exception 'Debe asentar primero el Bautismo vinculado antes de asentar esta Confirmación';
  end if;

  v_baptism_id := (new.raw_data->>'linkedBaptismRecordId')::uuid;

  if not exists (
    select 1
    from public.baptisms b
    where b.id = v_baptism_id
      and b.parish_id = new.parish_id
      and lower(coalesce(b.status,'seated')) not in
        ('anulada','anulado','annulled','reverted','cancelled','deleted')
  ) then
    raise exception 'La partida de Bautismo vinculada no está vigente en esta parroquia';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_linked_baptism_before_confirmation_seat
  on public.confirmations;

create trigger trg_enforce_linked_baptism_before_confirmation_seat
before insert on public.confirmations
for each row
execute function public.enforce_linked_baptism_before_confirmation_seat();
revoke all on function public.enforce_linked_baptism_before_confirmation_seat() from public;
revoke all on function public.enforce_linked_baptism_before_confirmation_seat() from anon;
revoke all on function public.enforce_linked_baptism_before_confirmation_seat() from authenticated;
