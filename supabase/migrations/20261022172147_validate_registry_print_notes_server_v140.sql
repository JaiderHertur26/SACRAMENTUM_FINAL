-- V140 · Impresión: cotejo obligatorio de notas, vinculaciones, contenido, política y constancia histórica.
CREATE OR REPLACE FUNCTION public.register_registry_print(p_parish_id uuid, p_sacrament_type text, p_sacrament_id uuid, p_document_kind text DEFAULT 'partida'::text, p_selected_note_keys text[] DEFAULT '{}'::text[], p_included_notes jsonb DEFAULT '[]'::jsonb, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_type text:=lower(trim(coalesce(p_sacrament_type,'')));
  v_book text;
  v_folio text;
  v_number text;
  v_metadata jsonb;
  v_note public.marginal_notes%rowtype;
  v_note_item jsonb;
  v_verified_notes jsonb:='[]'::jsonb;
  v_note_key text;
  v_note_uuid uuid;
  v_seen text[]:='{}'::text[];
  v_selected_key text;
  v_decree_status text;
  v_missing_required text;
  v_legacy_inline_unverified boolean:=false;
  v_record_status text;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if not public.can_access_parish(p_parish_id) then raise exception 'Fuera de jurisdicción'; end if;
  if p_sacrament_id is null then raise exception 'Registro requerido'; end if;

  if v_type in ('bautismo','baptism','bautizo') then
    v_type:='bautismo';
    select book_number,folio,number,status
      into v_book,v_folio,v_number,v_record_status
    from public.baptisms
    where id=p_sacrament_id and parish_id=p_parish_id;
    if not found then raise exception 'Bautismo no encontrado'; end if;

  elsif v_type in ('confirmacion','confirmación','confirmation') then
    v_type:='confirmacion';
    select book_number,folio,number,status
      into v_book,v_folio,v_number,v_record_status
    from public.confirmations
    where id=p_sacrament_id and parish_id=p_parish_id;
    if not found then raise exception 'Confirmación no encontrada'; end if;

  elsif v_type in ('matrimonio','marriage') then
    v_type:='matrimonio';
    select book_number,folio,number,status
      into v_book,v_folio,v_number,v_record_status
    from public.marriages
    where id=p_sacrament_id and parish_id=p_parish_id;
    if not found then raise exception 'Matrimonio no encontrado'; end if;

  elsif v_type in ('exequias','exequia','funeral','funerals') then
    v_type:='exequias';
    select book_number,folio,number,status
      into v_book,v_folio,v_number,v_record_status
    from public.funerals
    where id=p_sacrament_id and parish_id=p_parish_id;
    if not found then raise exception 'Exequias no encontradas'; end if;

  else
    raise exception 'Tipo de registro no admitido';
  end if;


  -- Validate every printed note against the actual parish register. Client-supplied
  -- note contents and selected keys are NOT authoritative.
  if jsonb_typeof(coalesce(p_included_notes,'[]'::jsonb)) <> 'array' then
    raise exception 'Las notas de impresión deben enviarse como lista' using errcode='23514';
  end if;

  for v_note_item in
    select value from jsonb_array_elements(coalesce(p_included_notes,'[]'::jsonb)) value
  loop
    if jsonb_typeof(v_note_item) <> 'object' then
      raise exception 'Nota de impresión mal formada' using errcode='23514';
    end if;
    v_note_key:=nullif(btrim(coalesce(v_note_item->>'id','')),'');
    if v_note_key is null or v_note_key=any(v_seen) then
      raise exception 'Identificador de nota vacío o repetido' using errcode='23514';
    end if;

    if v_note_key='legacy-inline' then
      -- Older inline notes have no note-row identifier and cannot be certified
      -- by the printed-note RPC. Preserve them but explicitly flag provenance.
      if nullif(btrim(coalesce(v_note_item->>'content','')),'') is null
         or length(v_note_item->>'content')>8000
         or coalesce(v_note_item->>'policy','optional')<>'optional' then
        raise exception 'Nota histórica inline inválida: revisión documental requerida'
          using errcode='23514';
      end if;
      v_legacy_inline_unverified:=true;
      v_verified_notes:=v_verified_notes||jsonb_build_array(
        jsonb_build_object('id','legacy-inline','label','Nota histórica sin vinculación digital',
          'content',v_note_item->>'content','policy','optional',
          'provenance','client_supplied_unverified_historical'));
    else
      if v_note_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Identificador de nota no reconocido' using errcode='23514';
      end if;
      v_note_uuid:=v_note_key::uuid;
      select * into v_note from public.marginal_notes n
      where n.id=v_note_uuid and n.parish_id=p_parish_id
        and n.sacrament_id=p_sacrament_id and n.sacrament_type=v_type
      for share;
      if not found then
        raise exception 'Nota marginal no existe en la partida o pertenece a otra parroquia'
          using errcode='23514';
      end if;
      if lower(coalesce(v_note.status,'active')) in ('reversed','revertida','deleted','cancelled','anulada')
        or v_note.print_policy='internal' then
        raise exception 'Nota inactiva o interna no puede imprimirse como vigente'
          using errcode='23514';
      end if;
      if v_note.decree_id is not null then
        select lower(coalesce(status,'active')) into v_decree_status
        from public.decretos where id=v_note.decree_id for share;
        if not found or v_decree_status in ('reversed','cancelled','anulada','annulled')
          and lower(coalesce(v_note.note_type,'')) not like 'reversion%' then
          raise exception 'Nota del decreto revertido no puede presentarse como actuación vigente'
            using errcode='23514';
        end if;
      end if;
      if v_note_item->>'content' is distinct from v_note.content
        or coalesce(v_note_item->>'policy','') is distinct from v_note.print_policy then
        raise exception 'La nota impresa difiere del texto o política registrados'
          using errcode='23514';
      end if;
      v_verified_notes:=v_verified_notes||jsonb_build_array(
        jsonb_build_object('id',v_note.id::text,
          'label',coalesce(v_note.print_label,v_note.note_type),
          'content',v_note.content,'policy',v_note.print_policy,
          'provenance','persisted_verified'));
    end if;
    v_seen:=array_append(v_seen,v_note_key);
  end loop;

  foreach v_selected_key in array coalesce(p_selected_note_keys,'{}'::text[]) loop
    if v_selected_key<>all(v_seen) then
      raise exception 'La selección contiene notas que no se incluyen en la impresión'
        using errcode='23514';
    end if;
  end loop;

  select n.id::text into v_missing_required
  from public.marginal_notes n
  left join public.decretos d on d.id=n.decree_id
  where n.parish_id=p_parish_id and n.sacrament_type=v_type
    and n.sacrament_id=p_sacrament_id
    and n.print_policy='required'
    and lower(coalesce(n.status,'active')) not in ('reversed','revertida','deleted','cancelled','anulada')
    and (n.decree_id is null
         or lower(coalesce(d.status,'active')) not in ('reversed','cancelled','anulada','annulled')
         or lower(coalesce(n.note_type,'')) like 'reversion%')
    and not (n.id::text=any(v_seen))
  limit 1;
  if v_missing_required is not null then
    raise exception 'Falta incorporar una nota marginal obligatoria vigente antes de imprimir'
      using errcode='23514';
  end if;

  v_metadata:=coalesce(p_metadata,'{}'::jsonb)
    || jsonb_build_object(
      'book',coalesce(v_book,''),
      'folio',coalesce(v_folio,''),
      'number',coalesce(v_number,''),
      'coordinates_source','record_snapshot',
      'record_status',coalesce(v_record_status,'unknown'),
      'historical_record',lower(coalesce(v_record_status,'seated')) in
        ('anulada','anulado','annulled','reversed','revertida','replaced','deleted','nullified'),
      'note_provenance_validation','server_persisted_with_explicit_legacy_exception',
      'contains_unverified_legacy_inline',v_legacy_inline_unverified
    );

  insert into public.registry_print_events(
    parish_id,sacrament_type,sacrament_id,document_kind,
    selected_note_keys,included_notes,requested_by,metadata
  )
  values(
    p_parish_id,v_type,p_sacrament_id,
    coalesce(nullif(trim(p_document_kind),''),'partida'),
    coalesce(p_selected_note_keys,'{}'::text[]),
    v_verified_notes,
    auth.uid(),
    v_metadata
  )
  returning id into v_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  )
  values(
    auth.uid(),p_parish_id,public.current_app_diocese_id(),
    'registry_print_event',v_id,'print_requested',
    jsonb_build_object(
      'sacrament_type',v_type,
      'sacrament_id',p_sacrament_id,
      'document_kind',coalesce(nullif(trim(p_document_kind),''),'partida'),
      'book',coalesce(v_book,''),
      'folio',coalesce(v_folio,''),
      'number',coalesce(v_number,'')
    ),
    jsonb_build_object(
      'selected_note_keys',coalesce(p_selected_note_keys,'{}'::text[])
    ) || v_metadata
  );

  return v_id;
end;
$function$;
