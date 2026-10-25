-- SACRAMENTUM V204 · Align lock order for the two single-seat procedures.
-- No data migrations, no grants changed; only an early shared parish_parameters row lock.

CREATE OR REPLACE FUNCTION public.seat_pending_marriage(p_pending_id uuid)
 RETURNS TABLE(marriage_id uuid, book_number text, folio text, number text, next_book integer, next_folio integer, next_number integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_parish uuid;
  v_diocese uuid;
  v_pending public.pending_marriages%rowtype;
  v_params_row public.parish_parameters%rowtype;
  v_params jsonb;
  v_book_type text;

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
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select lower(coalesce(up.role,'')),up.parish_id,up.diocese_id
    into v_role,v_parish,v_diocese
  from public.user_profiles up
  where up.auth_user_id=auth.uid()
    and up.is_active IS TRUE AND upper(up.status)='ACTIVE' AND up.diocese_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.parishes v178_parish WHERE v178_parish.id=up.parish_id AND v178_parish.diocese_id=up.diocese_id)
  limit 1;

  if v_role <> 'parish' or v_parish is null then
    raise exception 'Sólo una parroquia activa puede asentar matrimonios';
  end if;

  -- V204: acquire the common parish numbering lock before a pending-row lock.
  SELECT * INTO v_params_row
  FROM public.parish_parameters pp
  WHERE pp.parish_id = v_parish
  ORDER BY pp.created_at NULLS LAST
  LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La parroquia no tiene parámetros de Matrimonio configurados';
  END IF;

  select * into v_pending
  from public.pending_marriages pm
  where pm.id=p_pending_id
    and pm.parish_id=v_parish
  for update;

  if not found then
    raise exception 'Expediente matrimonial pendiente no encontrado';
  end if;

  if lower(coalesce(v_pending.status,'pending')) <> 'pending'
     or coalesce(v_pending.reportado,false)=true then
    raise exception 'El expediente matrimonial ya fue procesado';
  end if;

  v_date := v_pending.celebration_date;
  if v_date is null then
    begin
      v_date := coalesce(
        nullif(left(v_pending.raw_data->>'fechaSacramento',10),'')::date,
        nullif(left(v_pending.raw_data->>'fechaMatrimonio',10),'')::date,
        nullif(left(v_pending.raw_data->>'fechaHoraPrevista',10),'')::date
      );
    exception when others then
      v_date := null;
    end;
  end if;

  if v_date is null then
    raise exception 'La fecha del matrimonio es obligatoria';
  end if;

  select * into v_params_row
  from public.parish_parameters pp
  where pp.parish_id=v_parish
  order by pp.created_at nulls last
  limit 1
  for update;

  if not found then
    raise exception 'La parroquia no tiene parámetros de Matrimonio configurados';
  end if;

  v_params := public.sacramentum_default_marriage_params()
              || coalesce(v_params_row.matrimonios_params,'{}'::jsonb);

  v_book_type := lower(coalesce(
    nullif(v_pending.book_type,''),
    nullif(v_pending.raw_data->>'bookType',''),
    nullif(v_pending.raw_data->>'book_type',''),
    'ordinario'
  ));

  if v_book_type not in ('ordinario','suplementario') then
    raise exception 'Tipo de libro matrimonial no válido: %',v_book_type;
  end if;

  if v_book_type='suplementario' then
    v_book := greatest(1,coalesce(nullif(v_params->>'suplementarioLibro','')::integer,1));
    v_folio := greatest(1,coalesce(nullif(v_params->>'suplementarioFolio','')::integer,1));
    v_number := greatest(1,coalesce(nullif(v_params->>'suplementarioNumero','')::integer,1));
    v_limit := greatest(1,coalesce(nullif(v_params->>'suplementarioPartidas','')::integer,1));
    v_restart := coalesce((v_params->>'suplementarioReiniciar')::boolean,false);
  else
    v_book := greatest(1,coalesce(nullif(v_params->>'ordinarioLibro','')::integer,1));
    v_folio := greatest(1,coalesce(nullif(v_params->>'ordinarioFolio','')::integer,1));
    v_number := greatest(1,coalesce(nullif(v_params->>'ordinarioNumero','')::integer,1));
    v_limit := greatest(1,coalesce(nullif(v_params->>'ordinarioPartidas','')::integer,1));
    v_restart := coalesce((v_params->>'ordinarioRestartNumber')::boolean,false);
  end if;

  if exists(
    select 1
    from public.marriages m
    where m.parish_id=v_parish
      and m.book_type=v_book_type
      and m.book_number=lpad(v_book::text,4,'0')
      and m.folio=lpad(v_folio::text,4,'0')
      and m.number=lpad(v_number::text,4,'0')
  ) then
    raise exception 'El consecutivo de Matrimonio % L %, F %, N % ya está ocupado. Recargue los parámetros.',
      upper(v_book_type),v_book,v_folio,v_number;
  end if;

  insert into public.marriages(
    parish_id,celebration_date,book_number,folio,number,
    observations,status,raw_data,book_type
  )
  values(
    v_parish,v_date,
    lpad(v_book::text,4,'0'),
    lpad(v_folio::text,4,'0'),
    lpad(v_number::text,4,'0'),
    coalesce(v_pending.raw_data->>'observations',v_pending.raw_data->>'observaciones'),
    'seated',
    coalesce(v_pending.raw_data,'{}'::jsonb) || jsonb_build_object(
      'book_type',v_book_type,
      'bookType',v_book_type,
      'tipoLibro',v_book_type,
      'book_number',lpad(v_book::text,4,'0'),
      'page_number',lpad(v_folio::text,4,'0'),
      'entry_number',lpad(v_number::text,4,'0'),
      'libro',lpad(v_book::text,4,'0'),
      'folio',lpad(v_folio::text,4,'0'),
      'numero',lpad(v_number::text,4,'0'),
      'status','seated'
    ),
    v_book_type
  )
  returning id into v_marriage_id;

  v_next_book:=v_book;
  v_next_folio:=v_folio;
  v_next_number:=v_number;

  if v_restart then
    if v_next_number >= v_limit then
      v_next_folio:=v_next_folio+1;
      v_next_number:=1;
    else
      v_next_number:=v_next_number+1;
    end if;
  else
    v_next_number:=v_next_number+1;
    if mod(v_next_number-1,v_limit)=0 then
      v_next_folio:=v_next_folio+1;
    end if;
  end if;

  if v_book_type='suplementario' then
    v_params := jsonb_set(
      jsonb_set(
        jsonb_set(v_params,'{suplementarioLibro}',to_jsonb(v_next_book),true),
        '{suplementarioFolio}',to_jsonb(v_next_folio),true
      ),
      '{suplementarioNumero}',to_jsonb(v_next_number),true
    );
  else
    v_params := jsonb_set(
      jsonb_set(
        jsonb_set(v_params,'{ordinarioLibro}',to_jsonb(v_next_book),true),
        '{ordinarioFolio}',to_jsonb(v_next_folio),true
      ),
      '{ordinarioNumero}',to_jsonb(v_next_number),true
    );
  end if;

  update public.parish_parameters pp
  set matrimonios_params=v_params,
      updated_at=now()
  where pp.id=v_params_row.id;

  update public.pending_marriages pm
  set status='seated',
      reportado=true,
      book_type=v_book_type,
      raw_data=coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
        'book_type',v_book_type,
        'bookType',v_book_type,
        'tipoLibro',v_book_type,
        'record_id',v_marriage_id
      ),
      updated_at=now()
  where pm.id=v_pending.id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,after_data,metadata
  )
  values(
    auth.uid(),v_parish,v_diocese,'matrimonio',v_marriage_id,'seat',
    v_pending.raw_data || jsonb_build_object(
      'book_type',v_book_type,
      'book_number',lpad(v_book::text,4,'0'),
      'folio',lpad(v_folio::text,4,'0'),
      'number',lpad(v_number::text,4,'0')
    ),
    jsonb_build_object(
      'pending_id',v_pending.id,
      'book_type',v_book_type
    )
  );

  return query
  select
    v_marriage_id,
    lpad(v_book::text,4,'0'),
    lpad(v_folio::text,4,'0'),
    lpad(v_number::text,4,'0'),
    v_next_book,
    v_next_folio,
    v_next_number;
end;
$function$;

CREATE OR REPLACE FUNCTION public.seat_funeral_record(p_form_data jsonb, p_pending_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(funeral_id uuid, book_number text, folio text, number text, next_book integer, next_folio integer, next_number integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_parish uuid;
  v_diocese uuid;

  v_pending public.pending_funerals%rowtype;
  v_data jsonb;

  v_params_row public.parish_parameters%rowtype;
  v_params jsonb;

  v_book_type text;
  v_book integer;
  v_folio integer;
  v_number integer;
  v_limit integer;
  v_restart boolean;
  v_blocked boolean;

  v_next_book integer;
  v_next_folio integer;
  v_next_number integer;

  v_registry_current bigint;
  v_registry text;

  v_funeral_id uuid;
  v_death_date date;
  v_birth_date date;
  v_funeral_date date;
  v_funeral_time time;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select lower(coalesce(up.role,'')), up.parish_id, up.diocese_id
    into v_role, v_parish, v_diocese
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and up.is_active IS TRUE AND upper(up.status)='ACTIVE' AND up.diocese_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.parishes v178_parish WHERE v178_parish.id=up.parish_id AND v178_parish.diocese_id=up.diocese_id)
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role <> 'parish' or v_parish is null then
    raise exception 'Sólo una cuenta parroquial activa puede asentar Exequias';
  end if;

  perform public.ensure_parish_parameters(v_parish);

  -- V204: acquire the common parish numbering lock before a pending-row lock.
  SELECT * INTO v_params_row
  FROM public.parish_parameters pp
  WHERE pp.parish_id = v_parish
  ORDER BY pp.created_at NULLS LAST
  LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No fue posible cargar los parámetros de Exequias';
  END IF;

  if p_pending_id is not null then
    select *
      into v_pending
    from public.pending_funerals pf
    where pf.id = p_pending_id
      and pf.parish_id = v_parish
    for update;

    if not found then
      raise exception 'El borrador de Exequias no existe o no pertenece a la parroquia';
    end if;

    if lower(coalesce(v_pending.status,'')) <> 'pending'
       or coalesce(v_pending.reportado,false) = true then
      raise exception 'El pendiente de Exequias ya no está disponible';
    end if;

    v_data := coalesce(v_pending.raw_data,'{}'::jsonb)
              || coalesce(p_form_data,'{}'::jsonb);

    v_book_type := lower(coalesce(
      nullif(trim(v_pending.book_type),''),
      nullif(trim(v_data->>'book_type'),''),
      nullif(trim(v_data->>'bookType'),''),
      'ordinario'
    ));

    v_registry := nullif(trim(coalesce(
      v_pending.numero_registro,
      v_data->>'numero_registro',
      v_data->>'numeroRegistro',
      ''
    )), '');
  else
    if p_form_data is null or jsonb_typeof(p_form_data) <> 'object' then
      raise exception 'Datos de Exequias inválidos';
    end if;

    v_data := p_form_data;

    v_book_type := lower(coalesce(
      nullif(trim(v_data->>'book_type'),''),
      nullif(trim(v_data->>'bookType'),''),
      'ordinario'
    ));

    v_registry := nullif(trim(coalesce(
      v_data->>'numero_registro',
      v_data->>'numeroRegistro',
      ''
    )), '');
  end if;

  if v_book_type not in ('ordinario','suplementario') then
    raise exception 'Tipo de libro de Exequias inválido';
  end if;

  if nullif(trim(coalesce(v_data->>'nombres','')), '') is null
     or nullif(trim(coalesce(v_data->>'apellidos','')), '') is null then
    raise exception 'Nombres y apellidos son obligatorios';
  end if;

  if nullif(trim(coalesce(v_data->>'fecha_defuncion','')), '') is null then
    raise exception 'La fecha de defunción es obligatoria';
  end if;

  begin
    v_death_date := (v_data->>'fecha_defuncion')::date;
  exception when others then
    raise exception 'La fecha de defunción no es válida';
  end;

  if nullif(trim(coalesce(v_data->>'fecha_nacimiento','')), '') is not null then
    begin
      v_birth_date := (v_data->>'fecha_nacimiento')::date;
    exception when others then
      raise exception 'La fecha de nacimiento no es válida';
    end;
  end if;

  if v_birth_date is not null and v_birth_date > v_death_date then
    raise exception 'La fecha de nacimiento no puede ser posterior a la fecha de defunción';
  end if;

  if nullif(trim(coalesce(v_data->>'fecha_exequias','')), '') is not null then
    begin
      v_funeral_date := (v_data->>'fecha_exequias')::date;
    exception when others then
      raise exception 'La fecha de Exequias no es válida';
    end;

    if v_funeral_date < v_death_date then
      raise exception 'La fecha de Exequias no puede ser anterior a la fecha de defunción';
    end if;
  end if;

  if nullif(trim(coalesce(v_data->>'hora_exequias','')), '') is not null then
    begin
      v_funeral_time := (v_data->>'hora_exequias')::time;
    exception when others then
      raise exception 'La hora de Exequias no es válida';
    end;
  end if;

  select *
    into v_params_row
  from public.parish_parameters pp
  where pp.parish_id = v_parish
  order by pp.created_at nulls last
  limit 1
  for update;

  if not found then
    raise exception 'No fue posible cargar los parámetros de Exequias';
  end if;

  v_params := public.sacramentum_default_funeral_params()
              || coalesce(v_params_row.exequias_params,'{}'::jsonb);

  if v_book_type = 'suplementario' then
    v_book := greatest(1, coalesce(nullif(v_params->>'suplementarioLibro','')::integer,1));
    v_folio := greatest(1, coalesce(nullif(v_params->>'suplementarioFolio','')::integer,1));
    v_number := greatest(1, coalesce(nullif(v_params->>'suplementarioNumero','')::integer,1));
    v_limit := greatest(1, coalesce(nullif(v_params->>'suplementarioPartidas','')::integer,2));
    v_restart := coalesce((v_params->>'suplementarioReiniciar')::boolean,false);
    v_blocked := coalesce((v_params->>'suplementarioBlocked')::boolean,false);
  else
    v_book := greatest(1, coalesce(
      nullif(v_params->>'ordinarioLibro','')::integer,
      nullif(v_params->>'libro','')::integer,
      1
    ));
    v_folio := greatest(1, coalesce(
      nullif(v_params->>'ordinarioFolio','')::integer,
      nullif(v_params->>'folio','')::integer,
      1
    ));
    v_number := greatest(1, coalesce(
      nullif(v_params->>'ordinarioNumero','')::integer,
      nullif(v_params->>'numero','')::integer,
      1
    ));
    v_limit := greatest(1, coalesce(
      nullif(v_params->>'ordinarioPartidas','')::integer,
      nullif(v_params->>'partidasPorFolio','')::integer,
      2
    ));
    v_restart := coalesce(
      (v_params->>'ordinarioRestartNumber')::boolean,
      (v_params->>'reiniciarNumeroEnFolio')::boolean,
      false
    );
    v_blocked := coalesce((v_params->>'ordinarioBlocked')::boolean,false);
  end if;

  if v_blocked then
    raise exception 'El Libro % de Exequias se encuentra bloqueado',
      case when v_book_type='suplementario' then 'Supletorio' else 'Ordinario' end;
  end if;

  if exists (
    select 1
    from public.funerals f
    where f.parish_id = v_parish
      and f.book_type = v_book_type
      and f.book_number = lpad(v_book::text,4,'0')
      and f.folio = lpad(v_folio::text,4,'0')
      and f.number = lpad(v_number::text,4,'0')
  ) then
    raise exception 'El consecutivo de Exequias % L %, F %, N % ya está ocupado. Recargue los parámetros.',
      upper(v_book_type), v_book, v_folio, v_number;
  end if;

  -- Compatibilidad: si un cliente antiguo llega sin borrador,
  -- se reserva el N.º de Registro en el momento del asiento.
  if v_registry is null then
    v_registry_current := case
      when coalesce(v_params->>'numeroRegistroActual','') ~ '^\d+$'
      then (v_params->>'numeroRegistroActual')::bigint
      else 0
    end;

    v_registry := lpad((v_registry_current + 1)::text, 6, '0');
    v_params := v_params || jsonb_build_object('numeroRegistroActual', v_registry);
  end if;

  if exists (
    select 1
    from public.funerals f
    where f.parish_id = v_parish
      and f.numero_registro = v_registry
  ) then
    raise exception 'El N.º de Registro de Exequias % ya está utilizado', v_registry;
  end if;

  insert into public.funerals(
    parish_id,
    book_number,
    folio,
    number,
    numero_registro,
    book_type,
    status,
    nombres,
    apellidos,
    document_id,
    sexo,
    fecha_nacimiento,
    lugar_nacimiento,
    fecha_defuncion,
    lugar_defuncion,
    fecha_exequias,
    hora_exequias,
    lugar_exequias,
    cementerio,
    causa_muerte,
    nombre_padre,
    nombre_madre,
    conyuge,
    ministro,
    da_fe,
    observations,
    nota_marginal,
    raw_data
  )
  values(
    v_parish,
    lpad(v_book::text,4,'0'),
    lpad(v_folio::text,4,'0'),
    lpad(v_number::text,4,'0'),
    v_registry,
    v_book_type,
    'seated',
    nullif(trim(v_data->>'nombres'),''),
    nullif(trim(v_data->>'apellidos'),''),
    nullif(trim(v_data->>'document_id'),''),
    nullif(trim(v_data->>'sexo'),''),
    v_birth_date,
    nullif(trim(v_data->>'lugar_nacimiento'),''),
    v_death_date,
    nullif(trim(v_data->>'lugar_defuncion'),''),
    v_funeral_date,
    v_funeral_time,
    nullif(trim(v_data->>'lugar_exequias'),''),
    nullif(trim(v_data->>'cementerio'),''),
    nullif(v_data->>'causa_muerte',''),
    nullif(trim(v_data->>'nombre_padre'),''),
    nullif(trim(v_data->>'nombre_madre'),''),
    nullif(trim(v_data->>'conyuge'),''),
    nullif(trim(v_data->>'ministro'),''),
    nullif(trim(v_data->>'da_fe'),''),
    nullif(v_data->>'observations',''),
    nullif(v_data->>'nota_marginal',''),
    coalesce(v_data,'{}'::jsonb)
      || jsonb_build_object(
        'book_number', lpad(v_book::text,4,'0'),
        'folio', lpad(v_folio::text,4,'0'),
        'number', lpad(v_number::text,4,'0'),
        'numero_registro', v_registry,
        'numeroRegistro', v_registry,
        'book_type', v_book_type,
        'bookType', v_book_type,
        'status', 'seated',
        'estado', 'permanente'
      )
  )
  returning id into v_funeral_id;

  v_next_book := v_book;
  v_next_folio := v_folio;
  v_next_number := v_number;

  if v_restart then
    if v_next_number >= v_limit then
      v_next_folio := v_next_folio + 1;
      v_next_number := 1;
    else
      v_next_number := v_next_number + 1;
    end if;
  else
    v_next_number := v_next_number + 1;
    if mod(v_next_number - 1, v_limit) = 0 then
      v_next_folio := v_next_folio + 1;
    end if;
  end if;

  if v_book_type = 'suplementario' then
    v_params := v_params
      || jsonb_build_object(
        'suplementarioLibro', v_next_book,
        'suplementarioFolio', v_next_folio,
        'suplementarioNumero', v_next_number
      );
  else
    v_params := v_params
      || jsonb_build_object(
        'ordinarioLibro', v_next_book,
        'ordinarioFolio', v_next_folio,
        'ordinarioNumero', v_next_number,

        -- compatibilidad con frontend antiguo
        'libro', v_next_book,
        'folio', v_next_folio,
        'numero', v_next_number
      );
  end if;

  update public.parish_parameters
  set exequias_params = v_params,
      updated_at = now()
  where id = v_params_row.id;

  if p_pending_id is not null then
    update public.pending_funerals
    set status = 'seated',
        reportado = true,
        raw_data = coalesce(raw_data,'{}'::jsonb)
          || jsonb_build_object(
            'status','seated',
            'estado','permanente',
            'funeral_id',v_funeral_id,
            'book_number',lpad(v_book::text,4,'0'),
            'folio',lpad(v_folio::text,4,'0'),
            'number',lpad(v_number::text,4,'0'),
            'numero_registro',v_registry,
            'book_type',v_book_type
          ),
        updated_at = now()
    where id = p_pending_id
      and parish_id = v_parish
      and status = 'pending'
      and reportado = false;

    if not found then
      raise exception 'El pendiente de Exequias ya no está disponible';
    end if;
  end if;

  insert into public.registry_audit_log(
    actor_user_id,
    parish_id,
    diocese_id,
    entity_type,
    entity_id,
    action,
    after_data,
    metadata
  )
  values(
    auth.uid(),
    v_parish,
    v_diocese,
    'exequias',
    v_funeral_id,
    'seat',
    v_data
      || jsonb_build_object(
        'book_number',lpad(v_book::text,4,'0'),
        'folio',lpad(v_folio::text,4,'0'),
        'number',lpad(v_number::text,4,'0'),
        'numero_registro',v_registry,
        'book_type',v_book_type
      ),
    jsonb_build_object(
      'pending_id',p_pending_id,
      'numero_registro',v_registry,
      'book_type',v_book_type
    )
  );

  return query
  select
    v_funeral_id,
    lpad(v_book::text,4,'0'),
    lpad(v_folio::text,4,'0'),
    lpad(v_number::text,4,'0'),
    v_next_book,
    v_next_folio,
    v_next_number;
end;
$function$;
