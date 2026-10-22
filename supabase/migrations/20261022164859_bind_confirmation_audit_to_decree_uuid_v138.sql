-- V138: la reversión restaurará únicamente la instantánea inmutable identificada por decreto UUID y parroquia.
-- V138 - apply_confirmation_correction_internal
CREATE OR REPLACE FUNCTION public.apply_confirmation_correction_internal(p_parish_id uuid, p_original_confirmation_id uuid, p_decree_number text, p_decree_date date, p_concept_id uuid, p_corrected_data jsonb, p_decree_payload jsonb, p_annulled_note text, p_replacement_note text, p_expected_book integer, p_expected_folio integer, p_expected_number integer)
 RETURNS TABLE(decree_id uuid, replacement_confirmation_id uuid, book_number text, folio text, number text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_user_parish uuid;
  v_user_diocese uuid;
  v_chancery uuid;
  v_parish_diocese uuid;
  v_original public.confirmations%rowtype;
  v_params jsonb;
  v_book integer;
  v_folio integer;
  v_number integer;
  v_limit integer;
  v_restart boolean;
  v_next_number integer;
  v_next_folio integer;
  v_next_book integer;
  v_next_params jsonb;
  v_new_id uuid;
  v_decree_id uuid;
  v_created_payload jsonb;
  v_birth_date date;
  v_celebration_date date;
  v_baptism_date date;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select lower(coalesce(up.role,'')), up.parish_id, up.diocese_id, up.chancery_id
    into v_role, v_user_parish, v_user_diocese, v_chancery
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active, true) = true
  limit 1;

  if v_role not in ('chancery','diocese','admin_general') then
    raise exception 'Sólo Cancillería, Diócesis o Administración General pueden emitir este decreto';
  end if;

  select p.diocese_id into v_parish_diocese
  from public.parishes p
  where p.id = p_parish_id;

  if v_parish_diocese is null then
    raise exception 'Parroquia no encontrada o sin diócesis';
  end if;

  if v_role <> 'admin_general' and v_user_diocese is distinct from v_parish_diocese then
    raise exception 'La parroquia no pertenece a la jurisdicción del usuario';
  end if;

  if nullif(trim(p_decree_number), '') is null or p_decree_date is null then
    raise exception 'Número y fecha de decreto son obligatorios';
  end if;

  if exists (
    select 1 from public.decretos d
    where d.diocese_id = v_parish_diocese
      and lower(coalesce(d.status,'active')) <> 'reversed'
      and lower(trim(coalesce(d.decree_number,''))) = lower(trim(p_decree_number))
  ) then
    raise exception 'El número de decreto % ya existe en esta diócesis', p_decree_number;
  end if;

  select * into v_original
  from public.confirmations c
  where c.id = p_original_confirmation_id
    and c.parish_id = p_parish_id
  for update;

  if not found then
    raise exception 'La partida original de Confirmación no existe en la parroquia seleccionada';
  end if;

  if lower(coalesce(v_original.status,'')) in ('anulada','annulled','reversed') then
    raise exception 'La partida original ya está anulada o revertida';
  end if;

  select pp.confirmaciones_params into v_params
  from public.parish_parameters pp
  where pp.parish_id = p_parish_id
  for update;

  if not found then
    raise exception 'La parroquia no tiene parámetros de Confirmación configurados';
  end if;

  v_book := greatest(coalesce(nullif(v_params->>'suplementarioLibro','')::integer, 1), 1);
  v_folio := greatest(coalesce(nullif(v_params->>'suplementarioFolio','')::integer, 1), 1);
  v_number := greatest(coalesce(nullif(v_params->>'suplementarioNumero','')::integer, 1), 1);
  v_limit := greatest(coalesce(nullif(v_params->>'suplementarioPartidas','')::integer, 2), 1);
  v_restart := coalesce((v_params->>'suplementarioReiniciar')::boolean, false);

  if v_book <> p_expected_book or v_folio <> p_expected_folio or v_number <> p_expected_number then
    raise exception 'El consecutivo supletorio cambió. Recargue la parroquia antes de emitir el decreto.';
  end if;

  if exists (
    select 1 from public.confirmations c
    where c.parish_id = p_parish_id
      and c.book_number = lpad(v_book::text, 4, '0')
      and c.folio = lpad(v_folio::text, 4, '0')
      and c.number = lpad(v_number::text, 4, '0')
  ) then
    raise exception 'El consecutivo supletorio Libro %, Folio %, Número % ya está ocupado', v_book, v_folio, v_number;
  end if;

  v_celebration_date := case
    when coalesce(p_corrected_data->>'fechaSacramento','') ~ '^\d{4}-\d{2}-\d{2}$'
      then (p_corrected_data->>'fechaSacramento')::date
    else null
  end;
  v_birth_date := case
    when coalesce(p_corrected_data->>'fechaNacimiento','') ~ '^\d{4}-\d{2}-\d{2}$'
      then (p_corrected_data->>'fechaNacimiento')::date
    else null
  end;
  v_baptism_date := case
    when coalesce(p_corrected_data->>'fechaBautismo','') ~ '^\d{4}-\d{2}-\d{2}$'
      then (p_corrected_data->>'fechaBautismo')::date
    else null
  end;

  if v_celebration_date is null then
    raise exception 'La fecha de Confirmación corregida es obligatoria';
  end if;

  insert into public.confirmations (
    parish_id, book_number, folio, number,
    celebration_date, nombres, apellidos, sexo,
    fecha_nacimiento, lugar_nacimiento, fecha_bautismo, lugar_bautismo,
    nuip, direccion, numero_registro, hora_sacramento,
    nombre_padre, cedula_padre, nombre_madre, cedula_madre,
    abuelos_paternos, abuelos_maternos, tipo_union_padres,
    padrinos, ministro, da_fe, observations,
    status, nota_marginal, raw_data
  ) values (
    p_parish_id,
    lpad(v_book::text, 4, '0'), lpad(v_folio::text, 4, '0'), lpad(v_number::text, 4, '0'),
    v_celebration_date,
    nullif(trim(p_corrected_data->>'nombres'), ''),
    nullif(trim(p_corrected_data->>'apellidos'), ''),
    nullif(trim(p_corrected_data->>'sexo'), ''),
    v_birth_date,
    nullif(trim(p_corrected_data->>'lugarNacimiento'), ''),
    v_baptism_date,
    nullif(trim(p_corrected_data->>'lugarBautismo'), ''),
    nullif(trim(p_corrected_data->>'nuip'), ''),
    nullif(trim(p_corrected_data->>'direccion'), ''),
    nullif(trim(p_corrected_data->>'numeroRegistro'), ''),
    nullif(trim(p_corrected_data->>'horaSacramento'), ''),
    nullif(trim(p_corrected_data->>'nombrePadre'), ''),
    nullif(trim(p_corrected_data->>'cedulaPadre'), ''),
    nullif(trim(p_corrected_data->>'nombreMadre'), ''),
    nullif(trim(p_corrected_data->>'cedulaMadre'), ''),
    nullif(p_corrected_data->>'abuelosPaternos', ''),
    nullif(p_corrected_data->>'abuelosMaternos', ''),
    nullif(trim(p_corrected_data->>'tipoUnionPadres'), ''),
    nullif(trim(p_corrected_data->>'padrinos'), ''),
    nullif(trim(p_corrected_data->>'ministro'), ''),
    nullif(trim(p_corrected_data->>'daFe'), ''),
    nullif(p_corrected_data->>'observaciones', ''),
    'seated', p_replacement_note,
    coalesce(p_corrected_data, '{}'::jsonb)
      || jsonb_build_object(
        'Libro', lpad(v_book::text, 4, '0'),
        'folio', lpad(v_folio::text, 4, '0'),
        'numero', lpad(v_number::text, 4, '0'),
        'book_number', lpad(v_book::text, 4, '0'),
        'notaMarginal', p_replacement_note,
        'estado', 'permanente',
        'status', 'seated'
      )
  ) returning id into v_new_id;

  update public.confirmations
  set status = 'anulada',
      nota_marginal = concat_ws(E'\n\n', nullif(v_original.nota_marginal,''), p_annulled_note),
      raw_data = coalesce(raw_data, '{}'::jsonb)
        || jsonb_build_object(
          'anulado', true,
          'status', 'anulada',
          'notaMarginal', concat_ws(E'\n\n', nullif(v_original.nota_marginal,''), p_annulled_note),
          'annulmentDecree', p_decree_number,
          'annulmentDate', p_decree_date
        ),
      updated_at = now()
  where id = p_original_confirmation_id;

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

  v_next_params := jsonb_set(
    jsonb_set(
      jsonb_set(v_params, '{suplementarioLibro}', to_jsonb(v_next_book), true),
      '{suplementarioFolio}', to_jsonb(v_next_folio), true
    ),
    '{suplementarioNumero}', to_jsonb(v_next_number), true
  );

  update public.parish_parameters
  set confirmaciones_params = v_next_params,
      updated_at = now()
  where parish_id = p_parish_id;

  v_created_payload := coalesce(p_decree_payload, '{}'::jsonb)
    || jsonb_build_object(
      'sacramentType', 'confirmacion',
      'sacramento', 'confirmacion',
      'decreeNumber', p_decree_number,
      'decreeDate', p_decree_date,
      'conceptoAnulacionId', p_concept_id,
      'originalPartidaId', p_original_confirmation_id,
      'newPartidaId', v_new_id,
      'targetParishId', p_parish_id,
      'issuedFrom', 'chancery',
      'newPartidaSummary', coalesce(p_decree_payload->'newPartidaSummary','{}'::jsonb)
        || jsonb_build_object('book',v_book,'page',v_folio,'entry',v_number)
    );

  insert into public.decretos (
    parish_id, diocese_id, chancery_id, tipo, sacrament_type,
    decree_number, decree_date, original_record_id, replacement_record_id,
    status, issued_by, payload
  ) values (
    p_parish_id, v_parish_diocese, v_chancery, 'correccion', 'confirmacion',
    trim(p_decree_number), p_decree_date, p_original_confirmation_id, v_new_id,
    'active', auth.uid(), v_created_payload
  ) returning id into v_decree_id;

  insert into public.marginal_notes (
    sacrament_type, note_type, decree_number, content, parish_id,
    sacrament_id, note_date, source_type, source_id, decree_id, created_by
  ) values
    ('confirmacion','correccion_anulacion',trim(p_decree_number),p_annulled_note,p_parish_id,
      p_original_confirmation_id,p_decree_date,'decree',v_decree_id,v_decree_id,auth.uid()),
    ('confirmacion','correccion_supletoria',trim(p_decree_number),p_replacement_note,p_parish_id,
      v_new_id,p_decree_date,'decree',v_decree_id,v_decree_id,auth.uid());

  insert into public.official_notifications (
    diocese_id, sender_chancery_id, receiver_parish_id, decree_id,
    category, subject, message, status, payload, created_by
  ) values (
    v_parish_diocese, v_chancery, p_parish_id, v_decree_id,
    'decree',
    'Decreto de corrección de Confirmación ' || trim(p_decree_number),
    'Cancillería ha emitido un decreto de corrección que afecta una partida de Confirmación de esta parroquia.',
    'pending',
    jsonb_build_object(
      'sacramentType','confirmacion',
      'decreeType','correccion',
      'decreeNumber',trim(p_decree_number),
      'originalRecordId',p_original_confirmation_id,
      'replacementRecordId',v_new_id
    ),
    auth.uid()
  );

  insert into public.registry_audit_log (
    actor_user_id, parish_id, diocese_id, entity_type, entity_id, action,
    before_data, after_data, metadata
  ) values
    (auth.uid(),p_parish_id,v_parish_diocese,'confirmation',p_original_confirmation_id,'annul_by_decree',
      to_jsonb(v_original),
      jsonb_build_object('status','anulada','nota_marginal',p_annulled_note),
      jsonb_build_object('decree_number',trim(p_decree_number),'decree_id',v_decree_id)),
    (auth.uid(),p_parish_id,v_parish_diocese,'confirmation',v_new_id,'create_supplementary_by_decree',
      null,
      p_corrected_data || jsonb_build_object('book',v_book,'folio',v_folio,'number',v_number),
      jsonb_build_object('decree_number',trim(p_decree_number),'decree_id',v_decree_id)),
    (auth.uid(),p_parish_id,v_parish_diocese,'decree',v_decree_id,'issue',
      null,v_created_payload,
      jsonb_build_object('sacrament_type','confirmacion','decree_type','correccion'));

  return query
  select v_decree_id, v_new_id,
         lpad(v_book::text,4,'0'), lpad(v_folio::text,4,'0'), lpad(v_number::text,4,'0');
end;
$function$;

-- V138 - reverse_correction_decree
CREATE OR REPLACE FUNCTION public.reverse_correction_decree(p_decree_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_user_diocese uuid;
  v_decree public.decretos%rowtype;
  v_before jsonb;
  v_snapshot_count integer;
  v_entity_type text;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select lower(coalesce(up.role,'')),up.diocese_id into v_role,v_user_diocese
  from public.user_profiles up where up.auth_user_id=auth.uid() and coalesce(up.is_active,true)=true limit 1;
  if v_role not in ('chancery','diocese','admin_general') then raise exception 'Rol no autorizado para revertir decretos'; end if;

  select * into v_decree from public.decretos d where d.id=p_decree_id for update;
  if not found then raise exception 'Decreto no encontrado'; end if;
  if lower(coalesce(v_decree.tipo,''))<>'correccion' then raise exception 'Este procedimiento sólo revierte decretos de corrección'; end if;
  if lower(coalesce(v_decree.status,'active'))='reversed' then return true; end if;
  if lower(coalesce(v_decree.status,'active')) not in ('active','archived') then raise exception 'El decreto no está en estado reversible'; end if;
  if v_role<>'admin_general' and v_user_diocese is distinct from v_decree.diocese_id then raise exception 'El decreto no pertenece a la jurisdicción del usuario'; end if;
  if v_decree.original_record_id is null then raise exception 'Decreto legado sin vínculo estructurado: requiere revisión manual antes de revertir'; end if;

  -- La reversión histórica no puede volver a habilitar un original modificado
  -- ni invalidar una supletoria que ya recibió una actuación registral posterior.
  if v_decree.sacrament_type in ('bautismo','confirmacion') then
    if v_decree.replacement_record_id is null
       or v_decree.replacement_record_id=v_decree.original_record_id then
      raise exception 'Corrección sin pareja original/supletoria inequívoca: exige conciliación manual'
      using errcode='23514';
    end if;
    if exists (
       select 1 from public.decretos later
       where later.id<>v_decree.id
         and lower(coalesce(later.status,'')) in ('active','archived')
         and (later.original_record_id in (v_decree.original_record_id,v_decree.replacement_record_id)
           or later.replacement_record_id in (v_decree.original_record_id,v_decree.replacement_record_id))
    ) then
      raise exception 'Hay un decreto posterior o concurrente vigente sobre una de las partidas: conciliación obligatoria'
      using errcode='23514';
    end if;
    if v_decree.sacrament_type='bautismo' then
      perform 1 from public.baptisms b
        where b.id=v_decree.original_record_id and b.parish_id=v_decree.parish_id
          and lower(coalesce(b.status,'')) in ('anulada','annulled') for update;
      if not found then raise exception 'Original de Bautismo ya no se encuentra anulado; reversión tardía bloqueada'
        using errcode='23514'; end if;
      perform 1 from public.baptisms b
        where b.id=v_decree.replacement_record_id and b.parish_id=v_decree.parish_id
          and lower(coalesce(b.status,''))='seated' for update;
      if not found then raise exception 'Supletoria de Bautismo ya no está vigente; reversión tardía bloqueada'
        using errcode='23514'; end if;
    else
      perform 1 from public.confirmations c
        where c.id=v_decree.original_record_id and c.parish_id=v_decree.parish_id
          and lower(coalesce(c.status,'')) in ('anulada','annulled') for update;
      if not found then raise exception 'Original de Confirmación ya no se encuentra anulado; reversión tardía bloqueada'
        using errcode='23514'; end if;
      perform 1 from public.confirmations c
        where c.id=v_decree.replacement_record_id and c.parish_id=v_decree.parish_id
          and lower(coalesce(c.status,''))='seated' for update;
      if not found then raise exception 'Supletoria de Confirmación ya no está vigente; reversión tardía bloqueada'
        using errcode='23514'; end if;
    end if;
  end if;

  if v_decree.sacrament_type='bautismo' then
    v_entity_type:='baptism';
    select count(*) into v_snapshot_count from public.registry_audit_log a
      where a.entity_type='baptism' and a.entity_id=v_decree.original_record_id
        and a.action='annul_by_decree' and a.parish_id=v_decree.parish_id
        and a.metadata->>'decree_id'=v_decree.id::text;
    if v_snapshot_count<>1 then
      raise exception 'Auditoría de Bautismo sin instantánea única asociada al UUID exacto del decreto: requiere conciliación'
        using errcode='23514';
    end if;
    select a.before_data into v_before from public.registry_audit_log a
      where a.entity_type='baptism' and a.entity_id=v_decree.original_record_id
        and a.action='annul_by_decree' and a.parish_id=v_decree.parish_id
        and a.metadata->>'decree_id'=v_decree.id::text;
    if v_before is null or v_before->>'status' is null
       or jsonb_typeof(v_before->'raw_data')<>'object' then
      raise exception 'Instantánea de Bautismo incompleta: conciliación documental obligatoria'
        using errcode='23514';
    end if;

    update public.baptisms set
      status=coalesce(v_before->>'status','seated'),
      nota_marginal=nullif(v_before->>'nota_marginal',''),
      raw_data=coalesce(v_before->'raw_data','{}'::jsonb),
      updated_at=now()
    where id=v_decree.original_record_id and parish_id=v_decree.parish_id;
    if not found then raise exception 'Partida original de Bautismo no encontrada'; end if;

    if v_decree.replacement_record_id is not null then
      update public.baptisms set status='reversed',
        raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('status','reversed','estado','revertida','reversedByDecree',v_decree.id),updated_at=now()
      where id=v_decree.replacement_record_id and parish_id=v_decree.parish_id;
    end if;

  elsif v_decree.sacrament_type='confirmacion' then
    v_entity_type:='confirmation';
    select count(*) into v_snapshot_count from public.registry_audit_log a
      where a.entity_type='confirmation' and a.entity_id=v_decree.original_record_id
        and a.action='annul_by_decree' and a.parish_id=v_decree.parish_id
        and a.metadata->>'decree_id'=v_decree.id::text;
    if v_snapshot_count<>1 then
      raise exception 'Auditoría de Confirmación sin instantánea única asociada al UUID exacto del decreto: requiere conciliación'
        using errcode='23514';
    end if;
    select a.before_data into v_before from public.registry_audit_log a
      where a.entity_type='confirmation' and a.entity_id=v_decree.original_record_id
        and a.action='annul_by_decree' and a.parish_id=v_decree.parish_id
        and a.metadata->>'decree_id'=v_decree.id::text;
    if v_before is null or v_before->>'status' is null
       or jsonb_typeof(v_before->'raw_data')<>'object' then
      raise exception 'Instantánea de Confirmación incompleta: conciliación documental obligatoria'
        using errcode='23514';
    end if;

    update public.confirmations set
      status=coalesce(v_before->>'status','seated'),
      nota_marginal=nullif(v_before->>'nota_marginal',''),
      raw_data=coalesce(v_before->'raw_data','{}'::jsonb),
      updated_at=now()
    where id=v_decree.original_record_id and parish_id=v_decree.parish_id;
    if not found then raise exception 'Partida original de Confirmación no encontrada'; end if;

    if v_decree.replacement_record_id is not null then
      update public.confirmations set status='reversed',
        raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('status','reversed','estado','revertida','reversedByDecree',v_decree.id),updated_at=now()
      where id=v_decree.replacement_record_id and parish_id=v_decree.parish_id;
    end if;

  elsif v_decree.sacrament_type='exequias' then
    v_entity_type:='funeral';
    select a.before_data into v_before from public.registry_audit_log a
      where a.entity_type='funeral' and a.entity_id=v_decree.original_record_id and a.action='correct_by_decree'
        and (a.metadata->>'decree_id')::text=v_decree.id::text
      order by a.created_at desc limit 1;
    if v_before is null then raise exception 'No existe instantánea de auditoría para restaurar Exequias'; end if;

    update public.funerals set
      nombres=v_before->>'nombres',apellidos=v_before->>'apellidos',
      fecha_defuncion=case when nullif(v_before->>'fecha_defuncion','') is null then fecha_defuncion else (v_before->>'fecha_defuncion')::date end,
      lugar_defuncion=nullif(v_before->>'lugar_defuncion',''),
      fecha_exequias=case when nullif(v_before->>'fecha_exequias','') is null then null else (v_before->>'fecha_exequias')::date end,
      lugar_exequias=nullif(v_before->>'lugar_exequias',''),cementerio=nullif(v_before->>'cementerio',''),
      ministro=nullif(v_before->>'ministro',''),da_fe=nullif(v_before->>'da_fe',''),
      nota_marginal=nullif(v_before->>'nota_marginal',''),raw_data=coalesce(v_before->'raw_data','{}'::jsonb),updated_at=now()
    where id=v_decree.original_record_id and parish_id=v_decree.parish_id;
    if not found then raise exception 'Registro original de Exequias no encontrado'; end if;
  else
    raise exception 'El sacramento % aún no tiene reversión automática',v_decree.sacrament_type;
  end if;

  update public.marginal_notes set status='reversed',updated_at=now()
    where decree_id=v_decree.id or (source_type='decree' and source_id=v_decree.id);
  update public.official_notifications set status='cancelled',processed_at=coalesce(processed_at,now()),updated_at=now()
    where decree_id=v_decree.id and status<>'cancelled';
  update public.decretos set status='reversed',updated_at=now() where id=v_decree.id;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,before_data,after_data,metadata)
  values(auth.uid(),v_decree.parish_id,v_decree.diocese_id,'decree',v_decree.id,'reverse',to_jsonb(v_decree),jsonb_build_object('status','reversed'),jsonb_build_object('sacrament_type',v_decree.sacrament_type,'entity_type',v_entity_type,'replacement_record_id',v_decree.replacement_record_id));

  return true;
end;
$function$;
