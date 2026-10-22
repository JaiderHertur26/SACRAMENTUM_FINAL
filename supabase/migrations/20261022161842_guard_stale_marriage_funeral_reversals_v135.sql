-- V135 · No revertir decretos si las partidas originales o supletorias cambiaron desde su ejecución.
-- reverse_funeral_decree guardia contra reversión tardía e incoherencia registral
CREATE OR REPLACE FUNCTION public.reverse_funeral_decree(p_decree_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS TABLE(decree_id uuid, decree_status text, original_funeral_id uuid, replacement_funeral_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_user_diocese uuid;
  v_decree public.decretos%rowtype;
  v_reason text;
  v_note text;
  v_original_status text;
  v_original public.funerals%rowtype;
  v_replacement public.funerals%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select lower(coalesce(up.role,'')),up.diocese_id
  into v_role,v_user_diocese
  from public.user_profiles up
  where up.auth_user_id=auth.uid()
    and coalesce(up.is_active,true)=true
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role <> 'chancery' then
    raise exception 'Rol no autorizado para revertir decretos de Exequias';
  end if;

  select d.* into v_decree
  from public.decretos d
  where d.id=p_decree_id
    and lower(coalesce(d.sacrament_type,''))='exequias'
  for update;

  if not found then
    raise exception 'Decreto de Exequias no encontrado';
  end if;

  if lower(coalesce(v_decree.status,'active'))='reversed' then
    raise exception 'El decreto ya fue revertido';
  end if;

  if v_user_diocese is distinct from v_decree.diocese_id then
    raise exception 'El decreto está fuera de la jurisdicción del usuario';
  end if;

  v_reason := nullif(trim(coalesce(p_reason,'')),'');
  if v_reason is null then
    raise exception 'El motivo de reversión es obligatorio';
  end if;
  if lower(coalesce(v_decree.status,'')) not in ('active','archived') then
    raise exception 'El decreto no se encuentra en estado reversible' using errcode='23514';
  end if;

  v_note :=
    'REVERSIÓN DEL DECRETO ' || coalesce(v_decree.decree_number,'SIN NÚMERO') ||
    '. MOTIVO: ' || upper(v_reason);

  if lower(coalesce(v_decree.tipo,''))='correccion' then
    if v_decree.original_record_id is null or v_decree.replacement_record_id is null then
      raise exception 'El decreto de corrección no contiene la relación original/nueva requerida';
    end if;

    select * into v_original from public.funerals
    where id=v_decree.original_record_id for update;
    select * into v_replacement from public.funerals
    where id=v_decree.replacement_record_id for update;
    if v_original.id is null or v_replacement.id is null
       or v_original.id = v_replacement.id
       or v_original.parish_id is distinct from v_decree.parish_id
       or v_replacement.parish_id is distinct from v_decree.parish_id
       or lower(coalesce(v_original.status,'')) not in ('anulada','annulled')
       or lower(coalesce(v_replacement.status,'')) <> 'seated'
    then
      raise exception 'Las partidas de Exequias cambiaron desde la corrección: exige conciliación documental antes de revertir'
        using errcode='23514';
    end if;

    v_original_status := coalesce(nullif(v_decree.payload->>'originalStatus',''),'seated');

    update public.funerals
    set
      status = v_original_status,
      nota_marginal = concat_ws(E'\n\n',nullif(nota_marginal,''),v_note),
      raw_data = coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
        'correctionReversed',true,
        'reversedDecree',v_decree.decree_number,
        'reversalReason',v_reason
      ),
      updated_at = now()
    where id=v_decree.original_record_id;

    update public.funerals
    set
      status='reversed',
      nota_marginal=concat_ws(E'\n\n',nullif(nota_marginal,''),v_note),
      raw_data=coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
        'correctionReversed',true,
        'reversedDecree',v_decree.decree_number,
        'reversalReason',v_reason
      ),
      updated_at=now()
    where id=v_decree.replacement_record_id;

    insert into public.marginal_notes(
      sacrament_type,note_type,decree_number,content,parish_id,
      sacrament_id,note_date,source_type,source_id,decree_id,created_by
    ) values
    ('exequias','reversion_correccion_original',v_decree.decree_number,v_note,
      v_decree.parish_id,v_decree.original_record_id,current_date,'decree',v_decree.id,v_decree.id,auth.uid()),
    ('exequias','reversion_correccion_supletoria',v_decree.decree_number,v_note,
      v_decree.parish_id,v_decree.replacement_record_id,current_date,'decree',v_decree.id,v_decree.id,auth.uid());

  elsif lower(coalesce(v_decree.tipo,''))='reposicion' then
    if v_decree.original_record_id is not null then
      raise exception 'Reposición inválida: no debe existir una partida original asociada';
    end if;
    if v_decree.replacement_record_id is null then
      raise exception 'El decreto de reposición no contiene la partida creada';
    end if;
    select * into v_replacement from public.funerals
      where id=v_decree.replacement_record_id for update;
    if v_replacement.id is null
       or v_replacement.parish_id is distinct from v_decree.parish_id
       or lower(coalesce(v_replacement.status,'')) <> 'seated'
    then
      raise exception 'La partida supletoria de Exequias ya no está vigente o pertenece a otra parroquia: requiere revisión manual'
      using errcode='23514';
    end if;

    update public.funerals
    set
      status='reversed',
      nota_marginal=concat_ws(E'\n\n',nullif(nota_marginal,''),v_note),
      raw_data=coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
        'repositionReversed',true,
        'reversedDecree',v_decree.decree_number,
        'reversalReason',v_reason
      ),
      updated_at=now()
    where id=v_decree.replacement_record_id;

    insert into public.marginal_notes(
      sacrament_type,note_type,decree_number,content,parish_id,
      sacrament_id,note_date,source_type,source_id,decree_id,created_by
    ) values (
      'exequias','reversion_reposicion',v_decree.decree_number,v_note,
      v_decree.parish_id,v_decree.replacement_record_id,current_date,
      'decree',v_decree.id,v_decree.id,auth.uid()
    );
  else
    raise exception 'Tipo de decreto de Exequias no soportado para reversión';
  end if;

  update public.decretos
  set
    status='reversed',
    payload=coalesce(payload,'{}'::jsonb) || jsonb_build_object(
      'reversedAt',now(),
      'reversedBy',auth.uid(),
      'reversalReason',v_reason
    )
  where id=p_decree_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,
    before_data,after_data,metadata
  ) values (
    auth.uid(),v_decree.parish_id,v_decree.diocese_id,
    'decree',v_decree.id,'reverse',to_jsonb(v_decree),
    jsonb_build_object('status','reversed','reason',v_reason),
    jsonb_build_object(
      'sacrament_type','exequias','decree_type',v_decree.tipo,
      'original_record_id',v_decree.original_record_id,
      'replacement_record_id',v_decree.replacement_record_id,
      'sequence_reused',false
    )
  );

  return query select
    p_decree_id,'reversed'::text,
    v_decree.original_record_id,v_decree.replacement_record_id;
end;
$function$;

-- reverse_marriage_decree guardia contra reversión tardía e incoherencia registral
CREATE OR REPLACE FUNCTION public.reverse_marriage_decree(p_decree_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS TABLE(decree_id uuid, decree_status text, original_marriage_id uuid, replacement_marriage_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if v_role <> 'chancery' then
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

  if v_user_diocese is distinct from v_decree.diocese_id then
    raise exception 'El decreto está fuera de la jurisdicción del usuario';
  end if;

  v_reason := nullif(trim(coalesce(p_reason,'')),'');
  if v_reason is null then
    raise exception 'El motivo de reversión es obligatorio';
  end if;
  if lower(coalesce(v_decree.status,'')) not in ('active','archived') then
    raise exception 'El decreto no se encuentra en estado reversible' using errcode='23514';
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
    if v_original.parish_id is distinct from v_decree.parish_id
       or v_replacement.parish_id is distinct from v_decree.parish_id
       or v_original.id = v_replacement.id
       or lower(coalesce(v_original.status,'')) not in ('anulada','annulled')
       or lower(coalesce(v_replacement.status,'')) <> 'seated'
    then
      raise exception 'Las partidas de Matrimonio cambiaron desde la corrección: requiere conciliación documental antes de revertir'
        using errcode='23514';
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
    if v_decree.original_record_id is not null
       or v_replacement.parish_id is distinct from v_decree.parish_id
       or lower(coalesce(v_replacement.status,'')) <> 'seated'
    then
      raise exception 'La reposición matrimonial no tiene partida supletoria vigente y única; exige revisión manual'
        using errcode='23514';
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
