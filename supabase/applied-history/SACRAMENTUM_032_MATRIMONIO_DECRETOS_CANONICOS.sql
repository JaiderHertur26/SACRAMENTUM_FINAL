-- SACRAMENTUM · 032
-- MATRIMONIO · DECRETOS CANÓNICOS
-- Corrección = ANULA partida existente + CREA nueva partida SUPLETORIA.
-- Reposición = NO parte de una partida existente; CREA partida SUPLETORIA
--              cuando hay evidencia suficiente de que el Matrimonio sí se celebró.
-- Reversión = conserva trazabilidad y NO reutiliza consecutivos consumidos.
-- Nulidad matrimonial = fuera de Cancillería; RPC histórica queda congelada para authenticated.
-- Fecha: 2026-09-13
--
-- PRECONDICIONES VERIFICADAS:
-- - public.marriages / public.pending_marriages existen y tienen RLS.
-- - matrimonios_params existe.
-- - book_type admite ordinario / suplementario.
-- - No existen decretos de Matrimonio actualmente.
-- - N.º Registro matrimonial vive en raw_data (8 dígitos).
--
-- ESTA MIGRACIÓN NO CREA DECRETOS NI CONSUME CONSECUTIVOS POR SÍ SOLA.

begin;

-- ============================================================================
-- 0. BLOQUEO DE SEGURIDAD
--    No se cambia la semántica si ya aparecieron decretos matrimoniales activos.
-- ============================================================================

do $$
begin
  if exists (
    select 1
    from public.decretos d
    where lower(coalesce(d.sacrament_type,'')) = 'matrimonio'
      and lower(coalesce(d.status,'active')) <> 'reversed'
  ) then
    raise exception
      '032 abortada: ya existen decretos activos de Matrimonio. Revise esos expedientes antes de aplicar la arquitectura canónica.';
  end if;
end;
$$;

-- ============================================================================
-- 1. CORREGIR ÍNDICE LEGACY QUE IMPIDE INDEPENDENCIA ORDINARIO/SUPLETORIO
--    El índice correcto ya existente incluye book_type.
-- ============================================================================

drop index if exists public.uq_marriages_registry_number;

-- ============================================================================
-- 2. ASIGNADOR INTERNO ATÓMICO
--    Consume:
--      - Libro/Folio/Número SUPLETORIO
--      - N.º Registro matrimonial global por parroquia
--    El N.º Registro continúa en 8 dígitos, como en Fase 5C.
-- ============================================================================

create or replace function public.sacramentum_allocate_marriage_supplementary(
  p_parish_id uuid
)
returns table(
  book_number text,
  folio text,
  number text,
  numero_registro text
)
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_params_row public.parish_parameters%rowtype;
  v_params jsonb;

  v_book integer;
  v_folio integer;
  v_number integer;
  v_limit integer;
  v_restart boolean;
  v_blocked boolean;

  v_next_book integer;
  v_next_folio integer;
  v_next_number integer;

  v_current_registry bigint := 0;
  v_max_registry bigint := 0;
  v_registry bigint;
  v_registry_text text;
begin
  if p_parish_id is null then
    raise exception 'Parroquia no válida';
  end if;

  perform public.sacramentum_ensure_parish_parameters(p_parish_id);

  select *
  into v_params_row
  from public.parish_parameters pp
  where pp.parish_id = p_parish_id
  order by pp.created_at nulls last
  limit 1
  for update;

  if not found then
    raise exception 'No fue posible obtener los parámetros parroquiales de Matrimonio';
  end if;

  v_params :=
    public.sacramentum_default_marriage_params()
    || coalesce(v_params_row.matrimonios_params,'{}'::jsonb);

  begin
    v_book :=
      greatest(1,coalesce(nullif(v_params->>'suplementarioLibro','')::integer,1));
    v_folio :=
      greatest(1,coalesce(nullif(v_params->>'suplementarioFolio','')::integer,1));
    v_number :=
      greatest(1,coalesce(nullif(v_params->>'suplementarioNumero','')::integer,1));
    v_limit :=
      greatest(1,coalesce(nullif(v_params->>'suplementarioPartidas','')::integer,1));
    v_restart :=
      coalesce(nullif(v_params->>'suplementarioReiniciar','')::boolean,false);
    v_blocked :=
      coalesce(nullif(v_params->>'suplementarioBlocked','')::boolean,false);
  exception when others then
    raise exception 'Los parámetros supletorios de Matrimonio contienen valores inválidos';
  end;

  if v_blocked then
    raise exception 'El Libro Supletorio de Matrimonio está bloqueado';
  end if;

  if exists (
    select 1
    from public.marriages m
    where m.parish_id = p_parish_id
      and m.book_type = 'suplementario'
      and m.book_number = lpad(v_book::text,4,'0')
      and m.folio = lpad(v_folio::text,4,'0')
      and m.number = lpad(v_number::text,4,'0')
  ) then
    raise exception
      'El consecutivo supletorio matrimonial L-%, F-%, N-% ya está ocupado. Revise los parámetros.',
      lpad(v_book::text,4,'0'),
      lpad(v_folio::text,4,'0'),
      lpad(v_number::text,4,'0');
  end if;

  -- Máximo N.º Registro observado en permanentes y pendientes.
  select greatest(
    coalesce((
      select max((m.raw_data->>'numeroRegistro')::bigint)
      from public.marriages m
      where m.parish_id = p_parish_id
        and coalesce(m.raw_data->>'numeroRegistro','') ~ '^[0-9]+$'
    ),0),
    coalesce((
      select max((m.raw_data->>'numero_registro')::bigint)
      from public.marriages m
      where m.parish_id = p_parish_id
        and coalesce(m.raw_data->>'numero_registro','') ~ '^[0-9]+$'
    ),0),
    coalesce((
      select max((pm.raw_data->>'numeroRegistro')::bigint)
      from public.pending_marriages pm
      where pm.parish_id = p_parish_id
        and coalesce(pm.raw_data->>'numeroRegistro','') ~ '^[0-9]+$'
    ),0),
    coalesce((
      select max((pm.raw_data->>'numero_registro')::bigint)
      from public.pending_marriages pm
      where pm.parish_id = p_parish_id
        and coalesce(pm.raw_data->>'numero_registro','') ~ '^[0-9]+$'
    ),0)
  )
  into v_max_registry;

  begin
    v_current_registry :=
      coalesce(
        nullif(
          regexp_replace(
            coalesce(v_params->>'numeroRegistroActual',''),
            '[^0-9]','','g'
          ),
          ''
        )::bigint,
        0
      );
  exception when others then
    v_current_registry := 0;
  end;

  v_registry := greatest(v_current_registry,v_max_registry) + 1;
  v_registry_text := lpad(v_registry::text,8,'0');

  if exists (
    select 1
    from public.marriages m
    where m.parish_id = p_parish_id
      and (
        m.raw_data->>'numeroRegistro' = v_registry_text
        or m.raw_data->>'numero_registro' = v_registry_text
      )
  )
  or exists (
    select 1
    from public.pending_marriages pm
    where pm.parish_id = p_parish_id
      and (
        pm.raw_data->>'numeroRegistro' = v_registry_text
        or pm.raw_data->>'numero_registro' = v_registry_text
      )
  ) then
    raise exception
      'El N.º de Registro matrimonial % ya está ocupado. Recargue los parámetros.',
      v_registry_text;
  end if;

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

    if mod(v_next_number - 1,v_limit) = 0 then
      v_next_folio := v_next_folio + 1;
    end if;
  end if;

  update public.parish_parameters pp
  set
    matrimonios_params =
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              v_params,
              '{numeroRegistroActual}',
              to_jsonb(v_registry_text),
              true
            ),
            '{suplementarioLibro}',
            to_jsonb(v_next_book),
            true
          ),
          '{suplementarioFolio}',
          to_jsonb(v_next_folio),
          true
        ),
        '{suplementarioNumero}',
        to_jsonb(v_next_number),
        true
      ),
    updated_at = now()
  where pp.id = v_params_row.id;

  return query
  select
    lpad(v_book::text,4,'0'),
    lpad(v_folio::text,4,'0'),
    lpad(v_number::text,4,'0'),
    v_registry_text;
end;
$function$;

revoke all on function public.sacramentum_allocate_marriage_supplementary(uuid)
  from public;
revoke all on function public.sacramentum_allocate_marriage_supplementary(uuid)
  from anon;
revoke all on function public.sacramentum_allocate_marriage_supplementary(uuid)
  from authenticated;
grant execute on function public.sacramentum_allocate_marriage_supplementary(uuid)
  to service_role;

-- ============================================================================
-- 3. CORRECCIÓN CANÓNICA DE MATRIMONIO
--    EXISTE partida -> ANULAR original -> CREAR nueva SUPLETORIA.
-- ============================================================================

drop function if exists public.apply_marriage_correction(
  uuid,date,text,jsonb,text
);

create function public.apply_marriage_correction(
  p_marriage_id uuid,
  p_decree_date date,
  p_reason text,
  p_changes jsonb,
  p_decree_number text default null
)
returns table(
  decree_id uuid,
  original_marriage_id uuid,
  replacement_marriage_id uuid,
  decree_number text,
  book_number text,
  folio text,
  number text,
  numero_registro text,
  original_note text,
  replacement_note text
)
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_role text;
  v_user_diocese uuid;
  v_chancery uuid;

  v_original public.marriages%rowtype;
  v_diocese uuid;
  v_parish_name text;

  v_decree_number text;
  v_sequence bigint;
  v_decree_id uuid;
  v_new_id uuid;
  v_loc record;

  v_merged jsonb;
  v_new_raw jsonb;
  v_date_text text;
  v_date date;
  v_original_note text;
  v_new_note text;
  v_target_name text;
  v_payload jsonb;

  v_groom text;
  v_bride text;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select
    lower(coalesce(up.role,'')),
    up.diocese_id,
    up.chancery_id
  into
    v_role,
    v_user_diocese,
    v_chancery
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true) = true
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role not in ('chancery','diocese','admin_general') then
    raise exception
      'Sólo Cancillería, Diócesis o Administración General pueden corregir Matrimonios por decreto';
  end if;

  select m.*
  into v_original
  from public.marriages m
  where m.id = p_marriage_id
  for update;

  if not found then
    raise exception 'Partida original de Matrimonio no encontrada';
  end if;

  if lower(coalesce(v_original.status,'seated'))
     in ('anulada','annulled','replaced','reversed') then
    raise exception
      'La partida original ya no está disponible para una nueva corrección';
  end if;

  select p.diocese_id,p.name
  into v_diocese,v_parish_name
  from public.parishes p
  where p.id = v_original.parish_id;

  if v_diocese is null then
    raise exception 'La partida matrimonial no tiene una parroquia con diócesis válida';
  end if;

  if v_role <> 'admin_general'
     and v_user_diocese is distinct from v_diocese then
    raise exception 'La partida matrimonial está fuera de la jurisdicción del usuario';
  end if;

  if v_chancery is null then
    select c.id
    into v_chancery
    from public.chancelleries c
    where c.diocese_id = v_diocese
    order by c.created_at nulls last
    limit 1;
  end if;

  if p_decree_date is null
     or nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'Fecha y fundamento del decreto son obligatorios';
  end if;

  if p_changes is null
     or jsonb_typeof(p_changes) <> 'object'
     or not exists(select 1 from jsonb_object_keys(p_changes)) then
    raise exception 'La corrección debe contener al menos un dato modificado';
  end if;

  -- Campos estructurales están bajo control exclusivo del servidor.
  if exists (
    select 1
    from jsonb_object_keys(p_changes) k(key)
    where k.key in (
      'id','parishId','parish_id',
      'book_number','page_number','entry_number',
      'libro','folio','numero',
      'numeroRegistro','numero_registro',
      'book_type','status','estado',
      'annulledByDecree','annulmentDecree',
      'replacementMarriageId','originalMarriageId'
    )
  ) then
    raise exception
      'La corrección contiene campos estructurales reservados para el servidor';
  end if;

  v_merged := coalesce(v_original.raw_data,'{}'::jsonb) || p_changes;

  v_date_text := coalesce(
    nullif(v_merged->>'celebration_date',''),
    nullif(v_merged->>'fechaSacramento',''),
    nullif(v_merged->>'fechaMatrimonio',''),
    nullif(v_merged->>'fechaHoraPrevista',''),
    v_original.celebration_date::text
  );

  begin
    v_date := left(v_date_text,10)::date;
  exception when others then
    raise exception 'La fecha del Matrimonio corregido no es válida';
  end;

  if v_date is null then
    raise exception 'La fecha del Matrimonio es obligatoria';
  end if;

  v_decree_number :=
    nullif(upper(trim(coalesce(p_decree_number,''))),'');

  if v_decree_number is null then
    insert into public.document_sequences(
      scope_id,document_type,current_value
    )
    values(
      v_diocese,
      'decreto_matrimonio_' || extract(year from p_decree_date)::integer,
      1
    )
    on conflict(scope_id,document_type)
    do update
       set current_value = public.document_sequences.current_value + 1,
           updated_at = now()
    returning current_value into v_sequence;

    v_decree_number :=
      'DMAT-' ||
      extract(year from p_decree_date)::integer ||
      '-' ||
      lpad(v_sequence::text,6,'0');
  end if;

  if exists (
    select 1
    from public.decretos d
    where d.diocese_id = v_diocese
      and lower(coalesce(d.status,'active')) <> 'reversed'
      and lower(trim(coalesce(d.decree_number,''))) =
          lower(v_decree_number)
  ) then
    raise exception
      'El número de decreto % ya existe en esta diócesis',
      v_decree_number;
  end if;

  select *
  into v_loc
  from public.sacramentum_allocate_marriage_supplementary(
    v_original.parish_id
  );

  v_groom := trim(concat_ws(
    ' ',
    nullif(trim(coalesce(
      v_merged->>'novioNombres',
      v_merged->>'groomName',
      v_merged->>'husbandName',
      v_merged->>'nombres_esposo'
    )), ''),
    nullif(trim(coalesce(
      v_merged->>'novioApellidos',
      v_merged->>'groomLastName',
      v_merged->>'husbandLastName',
      v_merged->>'apellidos_esposo'
    )), '')
  ));

  v_bride := trim(concat_ws(
    ' ',
    nullif(trim(coalesce(
      v_merged->>'noviaNombres',
      v_merged->>'brideName',
      v_merged->>'wifeName',
      v_merged->>'nombres_esposa'
    )), ''),
    nullif(trim(coalesce(
      v_merged->>'noviaApellidos',
      v_merged->>'brideLastName',
      v_merged->>'wifeLastName',
      v_merged->>'apellidos_esposa'
    )), '')
  ));

  v_target_name :=
    nullif(trim(concat_ws(' & ',nullif(v_groom,''),nullif(v_bride,''))),'');
  if v_target_name is null then
    v_target_name := 'Partida matrimonial';
  end if;

  v_original_note :=
    'PARTIDA ANULADA MEDIANTE DECRETO ' ||
    v_decree_number ||
    ' DE FECHA ' ||
    p_decree_date::text ||
    '. SE CREA NUEVA PARTIDA EN LIBRO SUPLETORIO: LIBRO ' ||
    v_loc.book_number ||
    ', FOLIO ' ||
    v_loc.folio ||
    ', NÚMERO ' ||
    v_loc.number ||
    '. ' ||
    upper(trim(p_reason));

  v_new_note :=
    'PARTIDA SUPLETORIA CREADA POR CORRECCIÓN MEDIANTE DECRETO ' ||
    v_decree_number ||
    ' DE FECHA ' ||
    p_decree_date::text ||
    '. REEMPLAZA LA PARTIDA ANULADA: LIBRO ' ||
    coalesce(v_original.book_number,'—') ||
    ', FOLIO ' ||
    coalesce(v_original.folio,'—') ||
    ', NÚMERO ' ||
    coalesce(v_original.number,'—') ||
    '.';

  v_new_raw :=
    v_merged
    || jsonb_build_object(
      'source','decree_correction',
      'book_type','suplementario',
      'book_number',v_loc.book_number,
      'page_number',v_loc.folio,
      'entry_number',v_loc.number,
      'libro',v_loc.book_number,
      'folio',v_loc.folio,
      'numero',v_loc.number,
      'numeroRegistro',v_loc.numero_registro,
      'numero_registro',v_loc.numero_registro,
      'status','seated',
      'estado','seated',
      'correctionDecree',v_decree_number,
      'correctionDecreeDate',p_decree_date,
      'correctionReason',trim(p_reason),
      'originalMarriageId',p_marriage_id,
      'notaMarginal',v_new_note
    );

  insert into public.marriages(
    wife_id,
    godfather_id,
    book_id,
    husband_id,
    celebrant_id,
    number,
    folio,
    observations,
    celebration_date,
    parish_id,
    godmother_id,
    book_number,
    status,
    raw_data,
    book_type
  )
  values(
    v_original.wife_id,
    v_original.godfather_id,
    v_original.book_id,
    v_original.husband_id,
    v_original.celebrant_id,
    v_loc.number,
    v_loc.folio,
    coalesce(
      nullif(v_new_raw->>'observations',''),
      nullif(v_new_raw->>'observaciones',''),
      v_original.observations
    ),
    v_date,
    v_original.parish_id,
    v_original.godmother_id,
    v_loc.book_number,
    'seated',
    v_new_raw,
    'suplementario'
  )
  returning id into v_new_id;

  update public.marriages
  set
    status = 'anulada',
    raw_data =
      coalesce(raw_data,'{}'::jsonb)
      || jsonb_build_object(
        'status','anulada',
        'estado','anulada',
        'annulledByDecree',v_decree_number,
        'annulmentDate',p_decree_date,
        'annulmentReason',trim(p_reason),
        'replacementMarriageId',v_new_id,
        'notaMarginal',
          concat_ws(
            E'\n\n',
            nullif(raw_data->>'notaMarginal',''),
            v_original_note
          )
      ),
    updated_at = now()
  where id = p_marriage_id;

  v_payload := jsonb_build_object(
    'decreeNumber',v_decree_number,
    'decreeDate',p_decree_date,
    'sacramentType','matrimonio',
    'sacramento','matrimonio',
    'decreeType','correccion',
    'targetName',v_target_name,
    'parishName',v_parish_name,
    'reason',trim(p_reason),
    'changes',p_changes,
    'before',to_jsonb(v_original),
    'originalRecordId',p_marriage_id,
    'replacementRecordId',v_new_id,
    'originalLocation',jsonb_build_object(
      'bookType',v_original.book_type,
      'book',v_original.book_number,
      'folio',v_original.folio,
      'number',v_original.number,
      'numeroRegistro',coalesce(
        v_original.raw_data->>'numeroRegistro',
        v_original.raw_data->>'numero_registro'
      )
    ),
    'replacementLocation',jsonb_build_object(
      'bookType','suplementario',
      'book',v_loc.book_number,
      'folio',v_loc.folio,
      'number',v_loc.number,
      'numeroRegistro',v_loc.numero_registro
    ),
    'originalNote',v_original_note,
    'replacementNote',v_new_note,
    'issuedFrom','chancery'
  );

  insert into public.decretos(
    parish_id,
    diocese_id,
    chancery_id,
    tipo,
    sacrament_type,
    decree_number,
    decree_date,
    original_record_id,
    replacement_record_id,
    status,
    issued_by,
    payload
  )
  values(
    v_original.parish_id,
    v_diocese,
    v_chancery,
    'correccion',
    'matrimonio',
    v_decree_number,
    p_decree_date,
    p_marriage_id,
    v_new_id,
    'active',
    auth.uid(),
    v_payload
  )
  returning id into v_decree_id;

  insert into public.marginal_notes(
    sacrament_type,
    note_type,
    decree_number,
    content,
    parish_id,
    sacrament_id,
    note_date,
    source_type,
    source_id,
    decree_id,
    created_by
  )
  values
  (
    'matrimonio',
    'correccion_original',
    v_decree_number,
    v_original_note,
    v_original.parish_id,
    p_marriage_id,
    p_decree_date,
    'decree',
    v_decree_id,
    v_decree_id,
    auth.uid()
  ),
  (
    'matrimonio',
    'correccion_nueva',
    v_decree_number,
    v_new_note,
    v_original.parish_id,
    v_new_id,
    p_decree_date,
    'decree',
    v_decree_id,
    v_decree_id,
    auth.uid()
  );

  insert into public.official_notifications(
    diocese_id,
    sender_chancery_id,
    receiver_parish_id,
    decree_id,
    category,
    subject,
    message,
    status,
    payload,
    created_by
  )
  values(
    v_diocese,
    v_chancery,
    v_original.parish_id,
    v_decree_id,
    'decree',
    'Decreto de corrección de Matrimonio ' || v_decree_number,
    'Cancillería anuló una partida matrimonial y creó una nueva partida en el Libro Supletorio.',
    'pending',
    jsonb_build_object(
      'sacramentType','matrimonio',
      'decreeType','correccion',
      'decreeNumber',v_decree_number,
      'originalRecordId',p_marriage_id,
      'replacementRecordId',v_new_id
    ),
    auth.uid()
  );

  insert into public.registry_audit_log(
    actor_user_id,
    parish_id,
    diocese_id,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data,
    metadata
  )
  values
  (
    auth.uid(),
    v_original.parish_id,
    v_diocese,
    'matrimonio',
    p_marriage_id,
    'annul_by_decree',
    to_jsonb(v_original),
    jsonb_build_object(
      'status','anulada',
      'replacement_record_id',v_new_id,
      'nota_marginal',v_original_note
    ),
    jsonb_build_object(
      'decree_id',v_decree_id,
      'decree_number',v_decree_number
    )
  ),
  (
    auth.uid(),
    v_original.parish_id,
    v_diocese,
    'matrimonio',
    v_new_id,
    'create_supplementary_by_correction',
    null,
    v_new_raw,
    jsonb_build_object(
      'decree_id',v_decree_id,
      'decree_number',v_decree_number,
      'original_record_id',p_marriage_id
    )
  );

  return query
  select
    v_decree_id,
    p_marriage_id,
    v_new_id,
    v_decree_number,
    v_loc.book_number,
    v_loc.folio,
    v_loc.number,
    v_loc.numero_registro,
    v_original_note,
    v_new_note;
end;
$function$;

-- ============================================================================
-- 4. REPOSICIÓN CANÓNICA DE MATRIMONIO
--    NO existe partida original utilizable.
--    Se exige evidencia de que el Matrimonio sí se celebró.
-- ============================================================================

drop function if exists public.create_marriage_reposition_by_decree(
  uuid,date,text,jsonb,jsonb,text
);

create function public.create_marriage_reposition_by_decree(
  p_parish_id uuid,
  p_decree_date date,
  p_reason text,
  p_record jsonb,
  p_evidence jsonb,
  p_decree_number text default null
)
returns table(
  decree_id uuid,
  marriage_id uuid,
  decree_number text,
  book_number text,
  folio text,
  number text,
  numero_registro text,
  note_text text
)
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_role text;
  v_user_diocese uuid;
  v_chancery uuid;

  v_diocese uuid;
  v_parish_name text;

  v_decree_number text;
  v_sequence bigint;
  v_decree_id uuid;
  v_marriage_id uuid;
  v_loc record;

  v_raw jsonb;
  v_payload jsonb;
  v_note text;

  v_date_text text;
  v_date date;
  v_groom text;
  v_bride text;
  v_target_name text;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select
    lower(coalesce(up.role,'')),
    up.diocese_id,
    up.chancery_id
  into
    v_role,
    v_user_diocese,
    v_chancery
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true) = true
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role not in ('chancery','diocese','admin_general') then
    raise exception
      'Sólo Cancillería, Diócesis o Administración General pueden reponer Matrimonios por decreto';
  end if;

  select p.diocese_id,p.name
  into v_diocese,v_parish_name
  from public.parishes p
  where p.id = p_parish_id;

  if v_diocese is null then
    raise exception 'Parroquia no encontrada o sin diócesis';
  end if;

  if v_role <> 'admin_general'
     and v_user_diocese is distinct from v_diocese then
    raise exception 'La parroquia está fuera de la jurisdicción del usuario';
  end if;

  if v_chancery is null then
    select c.id
    into v_chancery
    from public.chancelleries c
    where c.diocese_id = v_diocese
    order by c.created_at nulls last
    limit 1;
  end if;

  if p_decree_date is null
     or nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'Fecha y fundamento del decreto son obligatorios';
  end if;

  if p_record is null or jsonb_typeof(p_record) <> 'object' then
    raise exception 'Los datos de la partida matrimonial a reponer son obligatorios';
  end if;

  if p_evidence is null
     or jsonb_typeof(p_evidence) <> 'object'
     or not exists(select 1 from jsonb_object_keys(p_evidence)) then
    raise exception
      'La reposición exige registrar evidencia de que el Matrimonio sí se celebró';
  end if;

  -- En reposición tampoco se aceptan campos estructurales.
  if exists (
    select 1
    from jsonb_object_keys(p_record) k(key)
    where k.key in (
      'id','parishId','parish_id',
      'book_number','page_number','entry_number',
      'libro','folio','numero',
      'numeroRegistro','numero_registro',
      'book_type','status','estado'
    )
  ) then
    raise exception
      'La reposición contiene campos estructurales reservados para el servidor';
  end if;

  v_groom := trim(concat_ws(
    ' ',
    nullif(trim(coalesce(
      p_record->>'novioNombres',
      p_record->>'groomName',
      p_record->>'husbandName',
      p_record->>'nombres_esposo'
    )), ''),
    nullif(trim(coalesce(
      p_record->>'novioApellidos',
      p_record->>'groomLastName',
      p_record->>'husbandLastName',
      p_record->>'apellidos_esposo'
    )), '')
  ));

  v_bride := trim(concat_ws(
    ' ',
    nullif(trim(coalesce(
      p_record->>'noviaNombres',
      p_record->>'brideName',
      p_record->>'wifeName',
      p_record->>'nombres_esposa'
    )), ''),
    nullif(trim(coalesce(
      p_record->>'noviaApellidos',
      p_record->>'brideLastName',
      p_record->>'wifeLastName',
      p_record->>'apellidos_esposa'
    )), '')
  ));

  if v_groom = '' or v_bride = '' then
    raise exception
      'Nombres y apellidos de ambos contrayentes son obligatorios para una reposición';
  end if;

  v_date_text := coalesce(
    nullif(p_record->>'celebration_date',''),
    nullif(p_record->>'fechaSacramento',''),
    nullif(p_record->>'fechaMatrimonio',''),
    nullif(p_record->>'fechaHoraPrevista','')
  );

  if v_date_text is null then
    raise exception 'La fecha del Matrimonio es obligatoria';
  end if;

  begin
    v_date := left(v_date_text,10)::date;
  exception when others then
    raise exception 'La fecha del Matrimonio no es válida';
  end;

  v_target_name :=
    trim(concat_ws(' & ',v_groom,v_bride));

  v_decree_number :=
    nullif(upper(trim(coalesce(p_decree_number,''))),'');

  if v_decree_number is null then
    insert into public.document_sequences(
      scope_id,document_type,current_value
    )
    values(
      v_diocese,
      'decreto_matrimonio_' || extract(year from p_decree_date)::integer,
      1
    )
    on conflict(scope_id,document_type)
    do update
       set current_value = public.document_sequences.current_value + 1,
           updated_at = now()
    returning current_value into v_sequence;

    v_decree_number :=
      'DMAT-' ||
      extract(year from p_decree_date)::integer ||
      '-' ||
      lpad(v_sequence::text,6,'0');
  end if;

  if exists (
    select 1
    from public.decretos d
    where d.diocese_id = v_diocese
      and lower(coalesce(d.status,'active')) <> 'reversed'
      and lower(trim(coalesce(d.decree_number,''))) =
          lower(v_decree_number)
  ) then
    raise exception
      'El número de decreto % ya existe en esta diócesis',
      v_decree_number;
  end if;

  select *
  into v_loc
  from public.sacramentum_allocate_marriage_supplementary(
    p_parish_id
  );

  v_note :=
    'PARTIDA MATRIMONIAL DE REPOSICIÓN CREADA MEDIANTE DECRETO ' ||
    v_decree_number ||
    ' DE FECHA ' ||
    p_decree_date::text ||
    '. SE ASIENTA EN LIBRO SUPLETORIO POR EXISTIR EVIDENCIA SUFICIENTE DE QUE EL MATRIMONIO SÍ FUE CELEBRADO. ' ||
    upper(trim(p_reason));

  v_raw :=
    coalesce(p_record,'{}'::jsonb)
    || jsonb_build_object(
      'source','decree_reposition',
      'book_type','suplementario',
      'book_number',v_loc.book_number,
      'page_number',v_loc.folio,
      'entry_number',v_loc.number,
      'libro',v_loc.book_number,
      'folio',v_loc.folio,
      'numero',v_loc.number,
      'numeroRegistro',v_loc.numero_registro,
      'numero_registro',v_loc.numero_registro,
      'status','seated',
      'estado','seated',
      'repositionDecree',v_decree_number,
      'repositionDecreeDate',p_decree_date,
      'repositionReason',trim(p_reason),
      'evidence',p_evidence,
      'notaMarginal',v_note
    );

  insert into public.marriages(
    parish_id,
    celebration_date,
    book_number,
    folio,
    number,
    observations,
    status,
    raw_data,
    book_type
  )
  values(
    p_parish_id,
    v_date,
    v_loc.book_number,
    v_loc.folio,
    v_loc.number,
    coalesce(
      nullif(v_raw->>'observations',''),
      nullif(v_raw->>'observaciones','')
    ),
    'seated',
    v_raw,
    'suplementario'
  )
  returning id into v_marriage_id;

  v_payload := jsonb_build_object(
    'decreeNumber',v_decree_number,
    'decreeDate',p_decree_date,
    'sacramentType','matrimonio',
    'sacramento','matrimonio',
    'decreeType','reposicion',
    'targetName',v_target_name,
    'parishName',v_parish_name,
    'reason',trim(p_reason),
    'evidence',p_evidence,
    'recordData',p_record,
    'originalRecordId',null,
    'replacementRecordId',v_marriage_id,
    'replacementLocation',jsonb_build_object(
      'bookType','suplementario',
      'book',v_loc.book_number,
      'folio',v_loc.folio,
      'number',v_loc.number,
      'numeroRegistro',v_loc.numero_registro
    ),
    'replacementNote',v_note,
    'issuedFrom','chancery'
  );

  insert into public.decretos(
    parish_id,
    diocese_id,
    chancery_id,
    tipo,
    sacrament_type,
    decree_number,
    decree_date,
    original_record_id,
    replacement_record_id,
    status,
    issued_by,
    payload
  )
  values(
    p_parish_id,
    v_diocese,
    v_chancery,
    'reposicion',
    'matrimonio',
    v_decree_number,
    p_decree_date,
    null,
    v_marriage_id,
    'active',
    auth.uid(),
    v_payload
  )
  returning id into v_decree_id;

  insert into public.marginal_notes(
    sacrament_type,
    note_type,
    decree_number,
    content,
    parish_id,
    sacrament_id,
    note_date,
    source_type,
    source_id,
    decree_id,
    created_by
  )
  values(
    'matrimonio',
    'reposicion',
    v_decree_number,
    v_note,
    p_parish_id,
    v_marriage_id,
    p_decree_date,
    'decree',
    v_decree_id,
    v_decree_id,
    auth.uid()
  );

  insert into public.official_notifications(
    diocese_id,
    sender_chancery_id,
    receiver_parish_id,
    decree_id,
    category,
    subject,
    message,
    status,
    payload,
    created_by
  )
  values(
    v_diocese,
    v_chancery,
    p_parish_id,
    v_decree_id,
    'decree',
    'Decreto de reposición de Matrimonio ' || v_decree_number,
    'Cancillería creó una nueva partida matrimonial en el Libro Supletorio con fundamento en evidencia documental.',
    'pending',
    jsonb_build_object(
      'sacramentType','matrimonio',
      'decreeType','reposicion',
      'decreeNumber',v_decree_number,
      'recordId',v_marriage_id
    ),
    auth.uid()
  );

  insert into public.registry_audit_log(
    actor_user_id,
    parish_id,
    diocese_id,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data,
    metadata
  )
  values
  (
    auth.uid(),
    p_parish_id,
    v_diocese,
    'matrimonio',
    v_marriage_id,
    'create_reposition_by_decree',
    null,
    v_raw,
    jsonb_build_object(
      'decree_id',v_decree_id,
      'decree_number',v_decree_number,
      'evidence',p_evidence
    )
  ),
  (
    auth.uid(),
    p_parish_id,
    v_diocese,
    'decree',
    v_decree_id,
    'issue',
    null,
    v_payload,
    jsonb_build_object(
      'sacrament_type','matrimonio',
      'decree_type','reposicion'
    )
  );

  return query
  select
    v_decree_id,
    v_marriage_id,
    v_decree_number,
    v_loc.book_number,
    v_loc.folio,
    v_loc.number,
    v_loc.numero_registro,
    v_note;
end;
$function$;

-- ============================================================================
-- 5. REVERSIÓN CANÓNICA DE DECRETOS MATRIMONIALES DE CORRECCIÓN/REPOSICIÓN
-- ============================================================================

drop function if exists public.reverse_marriage_decree(uuid,text);

create function public.reverse_marriage_decree(
  p_decree_id uuid,
  p_reason text default null
)
returns table(
  decree_id uuid,
  decree_status text,
  original_marriage_id uuid,
  replacement_marriage_id uuid
)
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_role text;
  v_user_diocese uuid;
  v_decree public.decretos%rowtype;
  v_original public.marriages%rowtype;
  v_replacement public.marriages%rowtype;

  v_reason text;
  v_original_note text;
  v_replacement_note text;
  v_original_status text;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select
    lower(coalesce(up.role,'')),
    up.diocese_id
  into
    v_role,
    v_user_diocese
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true) = true
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role not in ('chancery','diocese','admin_general') then
    raise exception 'Rol no autorizado para revertir decretos matrimoniales';
  end if;

  select d.*
  into v_decree
  from public.decretos d
  where d.id = p_decree_id
    and lower(coalesce(d.sacrament_type,'')) = 'matrimonio'
    and lower(coalesce(d.tipo,'')) in ('correccion','reposicion')
  for update;

  if not found then
    raise exception
      'Decreto matrimonial de corrección/reposición no encontrado';
  end if;

  if lower(coalesce(v_decree.status,'active')) = 'reversed' then
    raise exception 'El decreto ya fue revertido';
  end if;

  if v_role <> 'admin_general'
     and v_user_diocese is distinct from v_decree.diocese_id then
    raise exception 'El decreto está fuera de la jurisdicción del usuario';
  end if;

  v_reason := nullif(trim(coalesce(p_reason,'')),'');
  if v_reason is null then
    raise exception 'El motivo de reversión es obligatorio';
  end if;

  if lower(v_decree.tipo) = 'correccion' then
    select *
    into v_original
    from public.marriages m
    where m.id = v_decree.original_record_id
    for update;

    select *
    into v_replacement
    from public.marriages m
    where m.id = v_decree.replacement_record_id
    for update;

    if v_original.id is null or v_replacement.id is null then
      raise exception
        'No fue posible resolver las dos partidas vinculadas a la corrección';
    end if;

    v_original_status :=
      coalesce(
        nullif(v_decree.payload#>>'{before,status}',''),
        'seated'
      );

    v_original_note :=
      'SE REVIERTE EL DECRETO DE CORRECCIÓN ' ||
      coalesce(v_decree.decree_number,'SIN NÚMERO') ||
      '. LA PARTIDA ORIGINAL RECUPERA VIGENCIA. MOTIVO: ' ||
      upper(v_reason);

    v_replacement_note :=
      'SE REVIERTE EL DECRETO DE CORRECCIÓN ' ||
      coalesce(v_decree.decree_number,'SIN NÚMERO') ||
      '. ESTA PARTIDA SUPLETORIA QUEDA SIN EFECTO. MOTIVO: ' ||
      upper(v_reason);

    update public.marriages
    set
      status = v_original_status,
      raw_data =
        coalesce(raw_data,'{}'::jsonb)
        || jsonb_build_object(
          'status',v_original_status,
          'estado',v_original_status,
          'correctionReversed',true,
          'reversedDecree',v_decree.decree_number,
          'reversalReason',v_reason,
          'notaMarginal',
            concat_ws(
              E'\n\n',
              nullif(raw_data->>'notaMarginal',''),
              v_original_note
            )
        ),
      updated_at = now()
    where id = v_original.id;

    update public.marriages
    set
      status = 'reversed',
      raw_data =
        coalesce(raw_data,'{}'::jsonb)
        || jsonb_build_object(
          'status','reversed',
          'estado','reversed',
          'correctionReversed',true,
          'reversedDecree',v_decree.decree_number,
          'reversalReason',v_reason,
          'notaMarginal',
            concat_ws(
              E'\n\n',
              nullif(raw_data->>'notaMarginal',''),
              v_replacement_note
            )
        ),
      updated_at = now()
    where id = v_replacement.id;

    insert into public.marginal_notes(
      sacrament_type,note_type,decree_number,content,
      parish_id,sacrament_id,note_date,
      source_type,source_id,decree_id,created_by
    )
    values
    (
      'matrimonio',
      'reversion_correccion_original',
      v_decree.decree_number,
      v_original_note,
      v_decree.parish_id,
      v_original.id,
      current_date,
      'decree',
      v_decree.id,
      v_decree.id,
      auth.uid()
    ),
    (
      'matrimonio',
      'reversion_correccion_supletoria',
      v_decree.decree_number,
      v_replacement_note,
      v_decree.parish_id,
      v_replacement.id,
      current_date,
      'decree',
      v_decree.id,
      v_decree.id,
      auth.uid()
    );

  elsif lower(v_decree.tipo) = 'reposicion' then
    select *
    into v_replacement
    from public.marriages m
    where m.id = v_decree.replacement_record_id
    for update;

    if v_replacement.id is null then
      raise exception
        'No fue posible resolver la partida creada por la reposición';
    end if;

    v_replacement_note :=
      'SE REVIERTE EL DECRETO DE REPOSICIÓN ' ||
      coalesce(v_decree.decree_number,'SIN NÚMERO') ||
      '. ESTA PARTIDA SUPLETORIA QUEDA SIN EFECTO. NO EXISTE PARTIDA ORIGINAL QUE REACTIVAR. MOTIVO: ' ||
      upper(v_reason);

    update public.marriages
    set
      status = 'reversed',
      raw_data =
        coalesce(raw_data,'{}'::jsonb)
        || jsonb_build_object(
          'status','reversed',
          'estado','reversed',
          'repositionReversed',true,
          'reversedDecree',v_decree.decree_number,
          'reversalReason',v_reason,
          'notaMarginal',
            concat_ws(
              E'\n\n',
              nullif(raw_data->>'notaMarginal',''),
              v_replacement_note
            )
        ),
      updated_at = now()
    where id = v_replacement.id;

    insert into public.marginal_notes(
      sacrament_type,note_type,decree_number,content,
      parish_id,sacrament_id,note_date,
      source_type,source_id,decree_id,created_by
    )
    values(
      'matrimonio',
      'reversion_reposicion',
      v_decree.decree_number,
      v_replacement_note,
      v_decree.parish_id,
      v_replacement.id,
      current_date,
      'decree',
      v_decree.id,
      v_decree.id,
      auth.uid()
    );
  end if;

  update public.decretos
  set
    status = 'reversed',
    payload =
      coalesce(payload,'{}'::jsonb)
      || jsonb_build_object(
        'reversedAt',now(),
        'reversedBy',auth.uid(),
        'reversalReason',v_reason
      )
  where id = v_decree.id;

  insert into public.registry_audit_log(
    actor_user_id,
    parish_id,
    diocese_id,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data,
    metadata
  )
  values(
    auth.uid(),
    v_decree.parish_id,
    v_decree.diocese_id,
    'decree',
    v_decree.id,
    'reverse',
    to_jsonb(v_decree),
    jsonb_build_object(
      'status','reversed',
      'reason',v_reason
    ),
    jsonb_build_object(
      'sacrament_type','matrimonio',
      'decree_type',v_decree.tipo,
      'original_record_id',v_decree.original_record_id,
      'replacement_record_id',v_decree.replacement_record_id
    )
  );

  return query
  select
    v_decree.id,
    'reversed'::text,
    v_decree.original_record_id,
    v_decree.replacement_record_id;
end;
$function$;

-- ============================================================================
-- 6. SEGURIDAD RPC CANÓNICAS
-- ============================================================================

revoke all on function public.apply_marriage_correction(
  uuid,date,text,jsonb,text
) from public;
revoke all on function public.apply_marriage_correction(
  uuid,date,text,jsonb,text
) from anon;
grant execute on function public.apply_marriage_correction(
  uuid,date,text,jsonb,text
) to authenticated;
grant execute on function public.apply_marriage_correction(
  uuid,date,text,jsonb,text
) to service_role;

revoke all on function public.create_marriage_reposition_by_decree(
  uuid,date,text,jsonb,jsonb,text
) from public;
revoke all on function public.create_marriage_reposition_by_decree(
  uuid,date,text,jsonb,jsonb,text
) from anon;
grant execute on function public.create_marriage_reposition_by_decree(
  uuid,date,text,jsonb,jsonb,text
) to authenticated;
grant execute on function public.create_marriage_reposition_by_decree(
  uuid,date,text,jsonb,jsonb,text
) to service_role;

revoke all on function public.reverse_marriage_decree(
  uuid,text
) from public;
revoke all on function public.reverse_marriage_decree(
  uuid,text
) from anon;
grant execute on function public.reverse_marriage_decree(
  uuid,text
) to authenticated;
grant execute on function public.reverse_marriage_decree(
  uuid,text
) to service_role;

-- ============================================================================
-- 7. NULIDAD MATRIMONIAL FUERA DE CANCILLERÍA
--    Se conserva la función histórica para no destruir trazabilidad/código,
--    pero la aplicación autenticada ya NO puede ejecutarla.
--    El futuro Tribunal Eclesiástico tendrá su propio flujo.
-- ============================================================================

do $$
begin
  if to_regprocedure(
    'public.apply_marriage_nullity(uuid,text,date,text,jsonb,uuid[])'
  ) is not null then
    revoke all on function public.apply_marriage_nullity(
      uuid,text,date,text,jsonb,uuid[]
    ) from public;

    revoke all on function public.apply_marriage_nullity(
      uuid,text,date,text,jsonb,uuid[]
    ) from anon;

    revoke all on function public.apply_marriage_nullity(
      uuid,text,date,text,jsonb,uuid[]
    ) from authenticated;

    grant execute on function public.apply_marriage_nullity(
      uuid,text,date,text,jsonb,uuid[]
    ) to service_role;
  end if;
end;
$$;

commit;

-- ============================================================================
-- POSTCHECK SOLO LECTURA
-- ============================================================================

select jsonb_pretty(
  jsonb_build_object(
    'marriages_count',
      (select count(*) from public.marriages),

    'active_marriage_decrees',
      (
        select count(*)
        from public.decretos
        where lower(coalesce(sacrament_type,''))='matrimonio'
          and lower(coalesce(status,'active'))='active'
      ),

    'allocator_ok',
      to_regprocedure(
        'public.sacramentum_allocate_marriage_supplementary(uuid)'
      ) is not null,

    'canonical_correction_ok',
      to_regprocedure(
        'public.apply_marriage_correction(uuid,date,text,jsonb,text)'
      ) is not null,

    'canonical_reposition_ok',
      to_regprocedure(
        'public.create_marriage_reposition_by_decree(uuid,date,text,jsonb,jsonb,text)'
      ) is not null,

    'canonical_reverse_ok',
      to_regprocedure(
        'public.reverse_marriage_decree(uuid,text)'
      ) is not null,

    'correction_security_definer',
      coalesce((
        select p.prosecdef
        from pg_proc p
        where p.oid = to_regprocedure(
          'public.apply_marriage_correction(uuid,date,text,jsonb,text)'
        )
      ),false),

    'reposition_security_definer',
      coalesce((
        select p.prosecdef
        from pg_proc p
        where p.oid = to_regprocedure(
          'public.create_marriage_reposition_by_decree(uuid,date,text,jsonb,jsonb,text)'
        )
      ),false),

    'reverse_security_definer',
      coalesce((
        select p.prosecdef
        from pg_proc p
        where p.oid = to_regprocedure(
          'public.reverse_marriage_decree(uuid,text)'
        )
      ),false),

    'anon_correction_execute',
      has_function_privilege(
        'anon',
        'public.apply_marriage_correction(uuid,date,text,jsonb,text)',
        'EXECUTE'
      ),

    'anon_reposition_execute',
      has_function_privilege(
        'anon',
        'public.create_marriage_reposition_by_decree(uuid,date,text,jsonb,jsonb,text)',
        'EXECUTE'
      ),

    'anon_reverse_execute',
      has_function_privilege(
        'anon',
        'public.reverse_marriage_decree(uuid,text)',
        'EXECUTE'
      ),

    'authenticated_correction_execute',
      has_function_privilege(
        'authenticated',
        'public.apply_marriage_correction(uuid,date,text,jsonb,text)',
        'EXECUTE'
      ),

    'authenticated_reposition_execute',
      has_function_privilege(
        'authenticated',
        'public.create_marriage_reposition_by_decree(uuid,date,text,jsonb,jsonb,text)',
        'EXECUTE'
      ),

    'authenticated_reverse_execute',
      has_function_privilege(
        'authenticated',
        'public.reverse_marriage_decree(uuid,text)',
        'EXECUTE'
      ),

    'conflicting_legacy_index_removed',
      not exists (
        select 1
        from pg_indexes
        where schemaname='public'
          and tablename='marriages'
          and indexname='uq_marriages_registry_number'
      ),

    'correct_booktype_unique_index_ok',
      exists (
        select 1
        from pg_indexes
        where schemaname='public'
          and tablename='marriages'
          and indexname='uq_marriages_parish_booktype_location'
      ),

    'nullity_rpc_preserved',
      to_regprocedure(
        'public.apply_marriage_nullity(uuid,text,date,text,jsonb,uuid[])'
      ) is not null,

    'authenticated_nullity_execute',
      case
        when to_regprocedure(
          'public.apply_marriage_nullity(uuid,text,date,text,jsonb,uuid[])'
        ) is null then false
        else has_function_privilege(
          'authenticated',
          'public.apply_marriage_nullity(uuid,text,date,text,jsonb,uuid[])',
          'EXECUTE'
        )
      end,

    'service_role_nullity_execute',
      case
        when to_regprocedure(
          'public.apply_marriage_nullity(uuid,text,date,text,jsonb,uuid[])'
        ) is null then false
        else has_function_privilege(
          'service_role',
          'public.apply_marriage_nullity(uuid,text,date,text,jsonb,uuid[])',
          'EXECUTE'
        )
      end,

    'current_marriage_params',
      (
        select pp.matrimonios_params
        from public.parish_parameters pp
        where pp.parish_id = 'ada2c810-c6eb-4b75-8e3c-4941e3022687'::uuid
        limit 1
      )
  )
) as matrimonio_032_postcheck;
