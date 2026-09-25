-- ============================================================================
-- SACRAMENTUM · Flujos atómicos de asiento y archivo
-- 2026-09-04
-- Requiere 20260904_001_registry_core.sql
-- Migración ADITIVA. No borra registros históricos.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. ASIENTO ATÓMICO DE EXEQUIAS
--    Lee y bloquea parámetros, crea la partida, avanza el consecutivo,
--    cierra el pendiente (si existe) y escribe auditoría en una transacción.
-- --------------------------------------------------------------------------
create or replace function public.seat_funeral_record(
  p_form_data jsonb,
  p_pending_id uuid default null
)
returns table(
  funeral_id uuid,
  book_number text,
  folio text,
  number text,
  next_book integer,
  next_folio integer,
  next_number integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_parish uuid;
  v_diocese uuid;
  v_params_row public.parish_parameters%rowtype;
  v_params jsonb;
  v_book integer;
  v_folio integer;
  v_number integer;
  v_limit integer;
  v_restart boolean;
  v_next_book integer;
  v_next_folio integer;
  v_next_number integer;
  v_funeral_id uuid;
  v_death_date date;
  v_funeral_date date;
  v_funeral_time time;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select lower(coalesce(up.role,'')), up.parish_id, up.diocese_id
    into v_role, v_parish, v_diocese
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true) = true
  limit 1;

  if v_role <> 'parish' or v_parish is null then
    raise exception 'Sólo una cuenta parroquial activa puede asentar Exequias';
  end if;

  if nullif(trim(coalesce(p_form_data->>'nombres','')), '') is null
     or nullif(trim(coalesce(p_form_data->>'apellidos','')), '') is null then
    raise exception 'Nombres y apellidos son obligatorios';
  end if;

  if nullif(trim(coalesce(p_form_data->>'fecha_defuncion','')), '') is null then
    raise exception 'La fecha de defunción es obligatoria';
  end if;

  begin
    v_death_date := (p_form_data->>'fecha_defuncion')::date;
  exception when others then
    raise exception 'La fecha de defunción no es válida';
  end;

  if nullif(trim(coalesce(p_form_data->>'fecha_exequias','')), '') is not null then
    begin v_funeral_date := (p_form_data->>'fecha_exequias')::date;
    exception when others then raise exception 'La fecha de Exequias no es válida'; end;
  end if;
  if nullif(trim(coalesce(p_form_data->>'hora_exequias','')), '') is not null then
    begin v_funeral_time := (p_form_data->>'hora_exequias')::time;
    exception when others then raise exception 'La hora de Exequias no es válida'; end;
  end if;

  select * into v_params_row
  from public.parish_parameters pp
  where pp.parish_id = v_parish
  order by pp.created_at nulls last
  limit 1
  for update;

  if not found then
    insert into public.parish_parameters(
      id, parish_id, bautizos_params, confirmaciones_params, matrimonios_params, exequias_params
    ) values (
      gen_random_uuid(), v_parish,
      '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
      '{"libro":1,"folio":1,"numero":1,"partidasPorFolio":2,"reiniciarNumeroEnFolio":false}'::jsonb
    )
    returning * into v_params_row;
  end if;

  v_params := coalesce(v_params_row.exequias_params, '{}'::jsonb);
  v_book := greatest(1, coalesce(nullif(v_params->>'libro','')::integer,1));
  v_folio := greatest(1, coalesce(nullif(v_params->>'folio','')::integer,1));
  v_number := greatest(1, coalesce(nullif(v_params->>'numero','')::integer,1));
  v_limit := greatest(1, coalesce(nullif(v_params->>'partidasPorFolio','')::integer,2));
  v_restart := coalesce((v_params->>'reiniciarNumeroEnFolio')::boolean,false);

  if exists (
    select 1 from public.funerals f
    where f.parish_id=v_parish
      and f.book_number=lpad(v_book::text,4,'0')
      and f.folio=lpad(v_folio::text,4,'0')
      and f.number=lpad(v_number::text,4,'0')
  ) then
    raise exception 'El consecutivo de Exequias L %, F %, N % ya está ocupado. Recargue los parámetros.', v_book, v_folio, v_number;
  end if;

  insert into public.funerals(
    parish_id, book_number, folio, number, status,
    nombres, apellidos, document_id, sexo, fecha_nacimiento, lugar_nacimiento,
    fecha_defuncion, lugar_defuncion, fecha_exequias, hora_exequias, lugar_exequias,
    cementerio, causa_muerte, nombre_padre, nombre_madre, conyuge, ministro, da_fe,
    observations, nota_marginal, raw_data
  ) values (
    v_parish, lpad(v_book::text,4,'0'), lpad(v_folio::text,4,'0'), lpad(v_number::text,4,'0'), 'seated',
    nullif(trim(p_form_data->>'nombres'),''), nullif(trim(p_form_data->>'apellidos'),''),
    nullif(trim(p_form_data->>'document_id'),''), nullif(trim(p_form_data->>'sexo'),''),
    case when nullif(p_form_data->>'fecha_nacimiento','') is null then null else (p_form_data->>'fecha_nacimiento')::date end,
    nullif(trim(p_form_data->>'lugar_nacimiento'),''),
    v_death_date, nullif(trim(p_form_data->>'lugar_defuncion'),''), v_funeral_date, v_funeral_time,
    nullif(trim(p_form_data->>'lugar_exequias'),''), nullif(trim(p_form_data->>'cementerio'),''),
    nullif(p_form_data->>'causa_muerte',''), nullif(trim(p_form_data->>'nombre_padre'),''),
    nullif(trim(p_form_data->>'nombre_madre'),''), nullif(trim(p_form_data->>'conyuge'),''),
    nullif(trim(p_form_data->>'ministro'),''), nullif(trim(p_form_data->>'da_fe'),''),
    nullif(p_form_data->>'observations',''), nullif(p_form_data->>'nota_marginal',''),
    coalesce(p_form_data,'{}'::jsonb) || jsonb_build_object(
      'book_number',lpad(v_book::text,4,'0'),'folio',lpad(v_folio::text,4,'0'),'number',lpad(v_number::text,4,'0'),
      'status','seated','estado','permanente'
    )
  ) returning id into v_funeral_id;

  v_next_book := v_book;
  v_next_folio := v_folio;
  v_next_number := v_number;
  if v_restart then
    if v_next_number >= v_limit then
      v_next_folio := v_next_folio + 1; v_next_number := 1;
    else
      v_next_number := v_next_number + 1;
    end if;
  else
    v_next_number := v_next_number + 1;
    if mod(v_next_number - 1, v_limit) = 0 then v_next_folio := v_next_folio + 1; end if;
  end if;

  update public.parish_parameters
  set exequias_params = jsonb_set(
      jsonb_set(
        jsonb_set(v_params,'{libro}',to_jsonb(v_next_book),true),
        '{folio}',to_jsonb(v_next_folio),true
      ),
      '{numero}',to_jsonb(v_next_number),true
    ),
    updated_at=now()
  where id=v_params_row.id;

  if p_pending_id is not null then
    update public.pending_funerals
    set status='seated', updated_at=now()
    where id=p_pending_id and parish_id=v_parish and status='pending';
    if not found then raise exception 'El pendiente de Exequias ya no está disponible'; end if;
  end if;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_parish,v_diocese,'exequias',v_funeral_id,'seat',
    p_form_data || jsonb_build_object('book_number',lpad(v_book::text,4,'0'),'folio',lpad(v_folio::text,4,'0'),'number',lpad(v_number::text,4,'0')),
    jsonb_build_object('pending_id',p_pending_id)
  );

  return query select v_funeral_id,lpad(v_book::text,4,'0'),lpad(v_folio::text,4,'0'),lpad(v_number::text,4,'0'),v_next_book,v_next_folio,v_next_number;
end;
$$;

revoke all on function public.seat_funeral_record(jsonb,uuid) from public;
grant execute on function public.seat_funeral_record(jsonb,uuid) to authenticated;

-- --------------------------------------------------------------------------
-- 2. ASIENTO ATÓMICO DE MATRIMONIO PENDIENTE
-- --------------------------------------------------------------------------
create or replace function public.seat_pending_marriage(p_pending_id uuid)
returns table(
  marriage_id uuid,
  book_number text,
  folio text,
  number text,
  next_book integer,
  next_folio integer,
  next_number integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_parish uuid;
  v_diocese uuid;
  v_pending public.pending_marriages%rowtype;
  v_params_row public.parish_parameters%rowtype;
  v_params jsonb;
  v_book integer;
  v_folio integer;
  v_number integer;
  v_limit integer;
  v_restart boolean;
  v_next_book integer;
  v_next_folio integer;
  v_next_number integer;
  v_marriage_id uuid;
  v_date date;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select lower(coalesce(up.role,'')),up.parish_id,up.diocese_id
    into v_role,v_parish,v_diocese
  from public.user_profiles up
  where up.auth_user_id=auth.uid() and coalesce(up.is_active,true)=true
  limit 1;
  if v_role <> 'parish' or v_parish is null then raise exception 'Sólo una parroquia activa puede asentar matrimonios'; end if;

  select * into v_pending
  from public.pending_marriages pm
  where pm.id=p_pending_id and pm.parish_id=v_parish
  for update;
  if not found then raise exception 'Expediente matrimonial pendiente no encontrado'; end if;
  if lower(coalesce(v_pending.status,'pending')) <> 'pending' then raise exception 'El expediente matrimonial ya fue procesado'; end if;

  v_date := v_pending.celebration_date;
  if v_date is null then
    begin
      v_date := coalesce(
        nullif(v_pending.raw_data->>'fechaSacramento','')::date,
        nullif(v_pending.raw_data->>'fechaMatrimonio','')::date
      );
    exception when others then v_date := null;
    end;
  end if;
  if v_date is null then raise exception 'La fecha del matrimonio es obligatoria'; end if;

  select * into v_params_row
  from public.parish_parameters pp
  where pp.parish_id=v_parish
  order by pp.created_at nulls last
  limit 1
  for update;
  if not found then raise exception 'La parroquia no tiene parámetros de Matrimonio configurados'; end if;

  v_params := coalesce(v_params_row.matrimonios_params,'{}'::jsonb);
  v_book := greatest(1,coalesce(nullif(v_params->>'ordinarioLibro','')::integer,1));
  v_folio := greatest(1,coalesce(nullif(v_params->>'ordinarioFolio','')::integer,1));
  v_number := greatest(1,coalesce(nullif(v_params->>'ordinarioNumero','')::integer,1));
  v_limit := greatest(1,coalesce(nullif(v_params->>'ordinarioPartidas','')::integer,1));
  v_restart := coalesce((v_params->>'ordinarioRestartNumber')::boolean,false);

  if exists (
    select 1 from public.marriages m
    where m.parish_id=v_parish and m.book_number=lpad(v_book::text,4,'0')
      and m.folio=lpad(v_folio::text,4,'0') and m.number=lpad(v_number::text,4,'0')
  ) then
    raise exception 'El consecutivo de Matrimonio L %, F %, N % ya está ocupado. Recargue los parámetros.',v_book,v_folio,v_number;
  end if;

  insert into public.marriages(
    parish_id,celebration_date,book_number,folio,number,observations,status,raw_data
  ) values (
    v_parish,v_date,lpad(v_book::text,4,'0'),lpad(v_folio::text,4,'0'),lpad(v_number::text,4,'0'),
    coalesce(v_pending.raw_data->>'observations',v_pending.raw_data->>'observaciones'),
    'seated',coalesce(v_pending.raw_data,'{}'::jsonb) || jsonb_build_object(
      'book_number',lpad(v_book::text,4,'0'),'page_number',lpad(v_folio::text,4,'0'),'entry_number',lpad(v_number::text,4,'0'),
      'libro',lpad(v_book::text,4,'0'),'folio',lpad(v_folio::text,4,'0'),'numero',lpad(v_number::text,4,'0'),'status','seated'
    )
  ) returning id into v_marriage_id;

  v_next_book:=v_book; v_next_folio:=v_folio; v_next_number:=v_number;
  if v_restart then
    if v_next_number >= v_limit then v_next_folio:=v_next_folio+1; v_next_number:=1;
    else v_next_number:=v_next_number+1; end if;
  else
    v_next_number:=v_next_number+1;
    if mod(v_next_number-1,v_limit)=0 then v_next_folio:=v_next_folio+1; end if;
  end if;

  update public.parish_parameters
  set matrimonios_params = jsonb_set(
      jsonb_set(
        jsonb_set(v_params,'{ordinarioLibro}',to_jsonb(v_next_book),true),
        '{ordinarioFolio}',to_jsonb(v_next_folio),true
      ),
      '{ordinarioNumero}',to_jsonb(v_next_number),true
    ),
    updated_at=now()
  where id=v_params_row.id;

  update public.pending_marriages set status='seated',updated_at=now() where id=v_pending.id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_parish,v_diocese,'matrimonio',v_marriage_id,'seat',
    v_pending.raw_data || jsonb_build_object('book_number',lpad(v_book::text,4,'0'),'folio',lpad(v_folio::text,4,'0'),'number',lpad(v_number::text,4,'0')),
    jsonb_build_object('pending_id',v_pending.id)
  );

  return query select v_marriage_id,lpad(v_book::text,4,'0'),lpad(v_folio::text,4,'0'),lpad(v_number::text,4,'0'),v_next_book,v_next_folio,v_next_number;
end;
$$;

revoke all on function public.seat_pending_marriage(uuid) from public;
grant execute on function public.seat_pending_marriage(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- 3. ARCHIVO SEGURO DE AVISO MATRIMONIAL RECIBIDO
-- --------------------------------------------------------------------------
create or replace function public.archive_matrimonial_notification_recipient(p_recipient_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parish uuid;
  v_row public.matrimonial_notification_recipients%rowtype;
begin
  select up.parish_id into v_parish
  from public.user_profiles up
  where up.auth_user_id=auth.uid() and lower(coalesce(up.role,''))='parish' and coalesce(up.is_active,true)=true
  limit 1;
  if v_parish is null then raise exception 'Cuenta parroquial no autorizada'; end if;

  select * into v_row from public.matrimonial_notification_recipients r where r.id=p_recipient_id for update;
  if not found then raise exception 'Aviso matrimonial no encontrado'; end if;
  if v_row.receiver_parish_id is distinct from v_parish then raise exception 'El aviso no pertenece a esta parroquia'; end if;

  update public.matrimonial_notification_recipients
  set status='cancelled',processed_by=auth.uid(),processed_at=coalesce(processed_at,now()),updated_at=now()
  where id=p_recipient_id;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values(auth.uid(),v_parish,(select p.diocese_id from public.parishes p where p.id=v_parish),
    'matrimonial_notification_recipient',p_recipient_id,'archive',jsonb_build_object('status','cancelled'),
    jsonb_build_object('notification_id',v_row.notification_id,'note_applied',v_row.note_applied));
  return true;
end;
$$;

revoke all on function public.archive_matrimonial_notification_recipient(uuid) from public;
grant execute on function public.archive_matrimonial_notification_recipient(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- 4. SALUD DEL ESQUEMA: diagnóstico no destructivo para despliegue
-- --------------------------------------------------------------------------
create or replace function public.sacramentum_registry_health()
returns table(check_name text, ok boolean, detail text)
language sql
security definer
set search_path = public
as $$
  select 'baptism_duplicate_numbers', not exists(
    select 1 from public.baptisms where parish_id is not null and book_number is not null and folio is not null and number is not null
    group by parish_id,book_number,folio,number having count(*)>1
  ), 'Consecutivos duplicados en Bautismo'
  union all
  select 'confirmation_duplicate_numbers', not exists(
    select 1 from public.confirmations where parish_id is not null and book_number is not null and folio is not null and number is not null
    group by parish_id,book_number,folio,number having count(*)>1
  ), 'Consecutivos duplicados en Confirmación'
  union all
  select 'marriage_duplicate_numbers', not exists(
    select 1 from public.marriages where parish_id is not null and book_number is not null and folio is not null and number is not null
    group by parish_id,book_number,folio,number having count(*)>1
  ), 'Consecutivos duplicados en Matrimonio'
  union all
  select 'orphan_profiles', not exists(
    select 1 from public.user_profiles up where lower(coalesce(up.role,''))='parish' and up.parish_id is null
  ), 'Perfiles parroquiales sin parroquia'
  union all
  select 'orphan_decrees', not exists(
    select 1 from public.decretos d where d.parish_id is null
  ), 'Decretos sin parroquia de referencia';
$$;

revoke all on function public.sacramentum_registry_health() from public;
grant execute on function public.sacramentum_registry_health() to authenticated;
