-- SACRAMENTUM · REFINAMIENTO FINAL BAUTISMO · CORRESPONSALÍA MATRIMONIAL
-- Endurece búsqueda bautismal y evita notas sobre partidas no vigentes.

begin;

create or replace function public.search_baptisms_for_matrimonial_notification(
  p_diocese_id uuid default null,
  p_book text default null,
  p_folio text default null,
  p_number text default null,
  p_first_name text default null,
  p_last_name text default null,
  p_limit integer default 50
)
returns table(
  id uuid,
  parish_id uuid,
  parish_name text,
  diocese_id uuid,
  nombres text,
  apellidos text,
  book_number text,
  folio text,
  number text,
  celebration_date date,
  fecha_nacimiento date,
  lugar_nacimiento text,
  nombre_padre text,
  nombre_madre text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_profiles up
    where up.auth_user_id = auth.uid()
      and lower(coalesce(up.role,'')) = 'parish'
      and up.parish_id is not null
      and coalesce(up.is_active, true) = true
      and coalesce(up.status, 'active') not in ('blocked','disabled','inactive')
  ) then
    raise exception 'Sólo una cuenta parroquial activa puede buscar partidas para notificación matrimonial';
  end if;

  if (nullif(trim(coalesce(p_book,'')), '') is not null
      or nullif(trim(coalesce(p_folio,'')), '') is not null
      or nullif(trim(coalesce(p_number,'')), '') is not null)
     and not (nullif(trim(coalesce(p_book,'')), '') is not null
      and nullif(trim(coalesce(p_folio,'')), '') is not null
      and nullif(trim(coalesce(p_number,'')), '') is not null) then
    raise exception 'La búsqueda por archivo exige Libro, Folio y Número completos';
  end if;

  if nullif(trim(coalesce(p_book,'')), '') is null
     and nullif(trim(coalesce(p_first_name,'')), '') is null
     and nullif(trim(coalesce(p_last_name,'')), '') is null then
    raise exception 'Debe indicar Libro/Folio/Número o nombres/apellidos';
  end if;

  return query
  select
    b.id,
    b.parish_id,
    p.name::text,
    p.diocese_id,
    b.nombres::text,
    b.apellidos::text,
    b.book_number::text,
    b.folio::text,
    b.number::text,
    b.celebration_date,
    b.fecha_nacimiento,
    b.lugar_nacimiento::text,
    b.nombre_padre::text,
    b.nombre_madre::text
  from public.baptisms b
  join public.parishes p on p.id = b.parish_id
  where (p_diocese_id is null or p.diocese_id = p_diocese_id)
    and (nullif(trim(coalesce(p_book,'')), '') is null or b.book_number::text = lpad(trim(p_book),4,'0'))
    and (nullif(trim(coalesce(p_folio,'')), '') is null or b.folio::text = lpad(trim(p_folio),4,'0'))
    and (nullif(trim(coalesce(p_number,'')), '') is null or b.number::text = lpad(trim(p_number),4,'0'))
    and (nullif(trim(coalesce(p_first_name,'')), '') is null or coalesce(b.nombres,'') ilike '%' || trim(p_first_name) || '%')
    and (nullif(trim(coalesce(p_last_name,'')), '') is null or coalesce(b.apellidos,'') ilike '%' || trim(p_last_name) || '%')
    and coalesce(lower(b.status), 'active') not in ('anulada','annulled','deleted','reversed','revertida','replaced')
  order by b.apellidos nulls last, b.nombres nulls last, b.celebration_date desc nulls last
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

create or replace function public.issue_matrimonial_notification(
  p_source_baptism_id uuid,
  p_spouse_baptism_id uuid,
  p_manual_receiver_parish_id uuid,
  p_manual_locator jsonb,
  p_marriage_date date,
  p_marriage_book text,
  p_marriage_folio text,
  p_marriage_number text,
  p_marriage_diocese_id uuid,
  p_marriage_parish_id uuid,
  p_external_marriage_parish_name text,
  p_manual_person_name text,
  p_manual_spouse_name text,
  p_main_note text,
  p_spouse_note text,
  p_payload jsonb
)
returns table(
  notification_id uuid,
  document_number text,
  consecutive bigint,
  recipients_created integer,
  local_notes_applied integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_sender_parish uuid;
  v_sender_diocese uuid;
  v_source_parish uuid;
  v_spouse_parish uuid;
  v_person_name text;
  v_spouse_name text;
  v_doc_id uuid;
  v_sequence bigint;
  v_document_number text;
  v_year integer;
  v_recipients integer := 0;
  v_local_notes integer := 0;
  v_is_manual boolean;
  v_existing_note text;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select lower(coalesce(up.role,'')), up.parish_id, up.diocese_id
    into v_role, v_sender_parish, v_sender_diocese
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true) = true
  limit 1;

  if v_role <> 'parish' or v_sender_parish is null then
    raise exception 'Sólo una cuenta parroquial activa puede emitir notificaciones matrimoniales';
  end if;
  if p_marriage_date is null then raise exception 'La fecha de matrimonio es obligatoria'; end if;
  if nullif(trim(coalesce(p_main_note,'')),'') is null then raise exception 'La nota marginal principal es obligatoria'; end if;

  v_is_manual := p_source_baptism_id is null and p_spouse_baptism_id is null;

  if v_is_manual then
    if p_manual_receiver_parish_id is null then raise exception 'La notificación manual requiere parroquia destinataria'; end if;
    if not exists (select 1 from public.parishes p where p.id = p_manual_receiver_parish_id) then
      raise exception 'La parroquia destinataria no existe';
    end if;
    v_source_parish := p_manual_receiver_parish_id;
    v_person_name := nullif(trim(p_manual_person_name),'');
    v_spouse_name := nullif(trim(p_manual_spouse_name),'');
  else
    if p_source_baptism_id is null or p_spouse_baptism_id is null then
      raise exception 'La notificación digital requiere las dos partidas de Bautismo';
    end if;
    if p_source_baptism_id = p_spouse_baptism_id then
      raise exception 'Las partidas bautismales de los contrayentes no pueden ser la misma';
    end if;

    select b.parish_id, trim(concat_ws(' ',b.nombres,b.apellidos))
      into v_source_parish, v_person_name
    from public.baptisms b
    where b.id = p_source_baptism_id
      and coalesce(lower(b.status),'active') not in ('anulada','annulled','deleted','reversed','revertida','replaced');
    if not found then raise exception 'No se encontró la partida bautismal principal activa'; end if;

    select b.parish_id, trim(concat_ws(' ',b.nombres,b.apellidos))
      into v_spouse_parish, v_spouse_name
    from public.baptisms b
    where b.id = p_spouse_baptism_id
      and coalesce(lower(b.status),'active') not in ('anulada','annulled','deleted','reversed','revertida','replaced');
    if not found then raise exception 'No se encontró la partida bautismal del cónyuge activa'; end if;

    if exists (
      select 1 from public.matrimonial_notifications n
      where n.sender_parish_id = v_sender_parish
        and n.source_baptism_id = p_source_baptism_id
        and n.spouse_baptism_id = p_spouse_baptism_id
        and n.marriage_date = p_marriage_date
        and lower(coalesce(n.status,'sent')) <> 'cancelled'
    ) then
      raise exception 'Ya existe una notificación activa para estas partidas y esta fecha de matrimonio';
    end if;
  end if;

  if nullif(v_person_name,'') is null then raise exception 'El nombre del contrayente principal es obligatorio'; end if;
  if nullif(v_spouse_name,'') is null then raise exception 'El nombre del cónyuge es obligatorio'; end if;

  v_year := extract(year from p_marriage_date)::integer;
  insert into public.document_sequences(scope_id, document_type, current_value)
  values (v_sender_parish, 'matrimonial_notification_' || v_year, 1)
  on conflict(scope_id, document_type)
  do update set current_value = public.document_sequences.current_value + 1,
                updated_at = now()
  returning current_value into v_sequence;
  v_document_number := 'NM-' || v_year || '-' || lpad(v_sequence::text,6,'0');

  insert into public.matrimonial_notifications (
    sender_parish_id, diocese_id, source_baptism_id, spouse_baptism_id,
    consecutive, document_number, person_name, spouse_name,
    marriage_date, marriage_book, marriage_folio, marriage_number,
    marriage_diocese_id, marriage_parish_id, external_marriage_parish_name,
    status, payload, created_by
  ) values (
    v_sender_parish, v_sender_diocese,
    case when v_is_manual then null else p_source_baptism_id end,
    case when v_is_manual then null else p_spouse_baptism_id end,
    v_sequence, v_document_number, v_person_name, v_spouse_name,
    p_marriage_date, nullif(trim(p_marriage_book),''), nullif(trim(p_marriage_folio),''), nullif(trim(p_marriage_number),''),
    p_marriage_diocese_id, p_marriage_parish_id, nullif(trim(p_external_marriage_parish_name),''),
    'sent',
    coalesce(p_payload,'{}'::jsonb)
      || jsonb_build_object(
        'consecutivo',v_document_number,
        'parishId',v_sender_parish,
        'senderParishName',(select p.name from public.parishes p where p.id=v_sender_parish),
        'personName',v_person_name,
        'spouseName',v_spouse_name,
        'isManual',v_is_manual,
        'marriageDate',p_marriage_date
      ),
    auth.uid()
  ) returning id into v_doc_id;

  if v_is_manual then
    insert into public.matrimonial_notification_recipients (
      notification_id, receiver_parish_id, target_baptism_id, status, payload
    ) values (
      v_doc_id, p_manual_receiver_parish_id, null, 'pending',
      jsonb_build_object('partyRole','principal','marginalNote',p_main_note,'manualLocator',coalesce(p_manual_locator,'{}'::jsonb),'receiverParishName',(select p.name from public.parishes p where p.id=p_manual_receiver_parish_id))
    );
    v_recipients := 1;
  else
    -- Contrayente principal: si la partida está en la parroquia emisora, la nota
    -- queda aplicada en esta misma transacción; si no, se crea aviso receptor.
    if v_source_parish = v_sender_parish then
      select b.nota_marginal into v_existing_note from public.baptisms b where b.id = p_source_baptism_id for update;
      update public.baptisms
      set nota_marginal = concat_ws(E'\n\n',nullif(v_existing_note,''),p_main_note),
          raw_data = coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
            'notaMarginal',concat_ws(E'\n\n',nullif(v_existing_note,''),p_main_note),
            'lastMatrimonialNotificationId',v_doc_id
          ), updated_at = now()
      where id = p_source_baptism_id;
      insert into public.marginal_notes (
        sacrament_type,note_type,content,parish_id,sacrament_id,note_date,source_type,source_id,created_by
      ) values ('bautismo','matrimonio',p_main_note,v_sender_parish,p_source_baptism_id,current_date,'matrimonial_notification',v_doc_id,auth.uid());
      v_local_notes := v_local_notes + 1;
    else
      insert into public.matrimonial_notification_recipients (
        notification_id,receiver_parish_id,target_baptism_id,status,payload
      ) values (
        v_doc_id,v_source_parish,p_source_baptism_id,'pending',jsonb_build_object('partyRole','principal','marginalNote',p_main_note,'receiverParishName',(select p.name from public.parishes p where p.id=v_source_parish))
      );
      v_recipients := v_recipients + 1;
    end if;

    if v_spouse_parish = v_sender_parish then
      select b.nota_marginal into v_existing_note from public.baptisms b where b.id = p_spouse_baptism_id for update;
      update public.baptisms
      set nota_marginal = concat_ws(E'\n\n',nullif(v_existing_note,''),p_spouse_note),
          raw_data = coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
            'notaMarginal',concat_ws(E'\n\n',nullif(v_existing_note,''),p_spouse_note),
            'lastMatrimonialNotificationId',v_doc_id
          ), updated_at = now()
      where id = p_spouse_baptism_id;
      insert into public.marginal_notes (
        sacrament_type,note_type,content,parish_id,sacrament_id,note_date,source_type,source_id,created_by
      ) values ('bautismo','matrimonio',p_spouse_note,v_sender_parish,p_spouse_baptism_id,current_date,'matrimonial_notification',v_doc_id,auth.uid());
      v_local_notes := v_local_notes + 1;
    else
      insert into public.matrimonial_notification_recipients (
        notification_id,receiver_parish_id,target_baptism_id,status,payload
      ) values (
        v_doc_id,v_spouse_parish,p_spouse_baptism_id,'pending',jsonb_build_object('partyRole','conyuge','marginalNote',p_spouse_note,'receiverParishName',(select p.name from public.parishes p where p.id=v_spouse_parish))
      );
      v_recipients := v_recipients + 1;
    end if;
  end if;

  if v_recipients = 0 then
    update public.matrimonial_notifications set status='processed',updated_at=now() where id=v_doc_id;
  end if;

  insert into public.registry_audit_log (
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_sender_parish,v_sender_diocese,'matrimonial_notification',v_doc_id,'issue',
    jsonb_build_object('document_number',v_document_number,'person_name',v_person_name,'spouse_name',v_spouse_name),
    jsonb_build_object('mode',case when v_is_manual then 'manual' else 'digital' end,'recipients',v_recipients,'local_notes',v_local_notes)
  );

  return query select v_doc_id,v_document_number,v_sequence,v_recipients,v_local_notes;
end;
$$;

create or replace function public.process_matrimonial_notification_recipient(p_recipient_id uuid)
returns table(recipient_id uuid, notification_id uuid, status text, note_applied boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_parish uuid;
  v_row public.matrimonial_notification_recipients%rowtype;
  v_doc public.matrimonial_notifications%rowtype;
  v_note text;
  v_existing_note text;
  v_applied boolean := false;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select lower(coalesce(up.role,'')),up.parish_id into v_role,v_parish
  from public.user_profiles up
  where up.auth_user_id=auth.uid() and coalesce(up.is_active,true)=true
  limit 1;

  if v_role <> 'parish' or v_parish is null then
    raise exception 'Sólo la parroquia destinataria puede procesar el aviso matrimonial';
  end if;

  select * into v_row
  from public.matrimonial_notification_recipients r
  where r.id=p_recipient_id
  for update;
  if not found then raise exception 'Aviso matrimonial no encontrado'; end if;
  if v_row.receiver_parish_id is distinct from v_parish then raise exception 'El aviso no pertenece a esta parroquia'; end if;

  if lower(coalesce(v_row.status,'pending'))='processed' then
    return query select v_row.id,v_row.notification_id,'processed'::text,v_row.note_applied;
    return;
  end if;
  if lower(coalesce(v_row.status,'pending'))='cancelled' then raise exception 'El aviso está archivado/cancelado'; end if;

  select * into v_doc from public.matrimonial_notifications n where n.id=v_row.notification_id;
  if not found then raise exception 'Documento matrimonial asociado no encontrado'; end if;

  v_note := nullif(v_row.payload->>'marginalNote','');
  if v_note is null then raise exception 'El aviso no contiene la nota marginal requerida'; end if;

  if v_row.target_baptism_id is not null then
    select b.nota_marginal into v_existing_note
    from public.baptisms b
    where b.id=v_row.target_baptism_id and b.parish_id=v_parish
      and coalesce(lower(b.status),'active') not in ('anulada','annulled','deleted','reversed','revertida','replaced')
    for update;
    if not found then raise exception 'La partida bautismal destinataria no pertenece a esta parroquia o ya no está vigente'; end if;

    if not exists (
      select 1 from public.marginal_notes mn
      where mn.sacrament_type='bautismo'
        and mn.sacrament_id=v_row.target_baptism_id
        and mn.source_type='matrimonial_notification'
        and mn.source_id=v_row.notification_id
    ) then
      update public.baptisms
      set nota_marginal=concat_ws(E'\n\n',nullif(v_existing_note,''),v_note),
          raw_data=coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
            'notaMarginal',concat_ws(E'\n\n',nullif(v_existing_note,''),v_note),
            'lastMatrimonialNotificationId',v_row.notification_id
          ), updated_at=now()
      where id=v_row.target_baptism_id;

      insert into public.marginal_notes (
        sacrament_type,note_type,content,parish_id,sacrament_id,note_date,source_type,source_id,created_by
      ) values (
        'bautismo','matrimonio',v_note,v_parish,v_row.target_baptism_id,current_date,'matrimonial_notification',v_row.notification_id,auth.uid()
      );
    end if;
    v_applied := true;
  end if;

  update public.matrimonial_notification_recipients
  set status='processed',note_applied=v_applied,processed_by=auth.uid(),processed_at=now(),read_at=coalesce(read_at,now()),updated_at=now()
  where id=v_row.id;

  if not exists (
    select 1 from public.matrimonial_notification_recipients r
    where r.notification_id=v_row.notification_id
      and lower(coalesce(r.status,'pending')) not in ('processed','cancelled')
  ) then
    update public.matrimonial_notifications set status='processed',updated_at=now() where id=v_row.notification_id;
  end if;

  insert into public.registry_audit_log (
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_parish,(select p.diocese_id from public.parishes p where p.id=v_parish),
    'matrimonial_notification_recipient',v_row.id,'process',
    jsonb_build_object('status','processed','note_applied',v_applied),
    jsonb_build_object('notification_id',v_row.notification_id,'target_baptism_id',v_row.target_baptism_id)
  );

  return query select v_row.id,v_row.notification_id,'processed'::text,v_applied;
end;
$$;

revoke all on function public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer) from public, anon;
grant execute on function public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer) to authenticated;

commit;
