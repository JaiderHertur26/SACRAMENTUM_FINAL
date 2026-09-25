-- SACRAMENTUM · V15
-- Notificaciones Sacramentales: nulidad matrimonial hacia Bautismos remotos.
-- Mantiene compatibilidad con el esquema histórico matrimonial.

begin;

create or replace function public.process_matrimonial_notification_recipient(p_recipient_id uuid)
returns table(recipient_id uuid, notification_id uuid, status text, note_applied boolean)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
  v_parish uuid;
  v_row public.matrimonial_notification_recipients%rowtype;
  v_doc public.matrimonial_notifications%rowtype;
  v_note text;
  v_existing_note text;
  v_applied boolean := false;
  v_notification_type text;
  v_note_type text;
  v_source_type text;
  v_note_date date;
  v_raw_patch jsonb;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select lower(coalesce(up.role,'')),up.parish_id
    into v_role,v_parish
  from public.user_profiles up
  where up.auth_user_id=auth.uid()
    and coalesce(up.is_active,true)=true
  limit 1;

  if v_role <> 'parish' or v_parish is null then
    raise exception 'Sólo la parroquia destinataria puede procesar la notificación sacramental';
  end if;

  select * into v_row
  from public.matrimonial_notification_recipients r
  where r.id=p_recipient_id
  for update;

  if not found then raise exception 'Notificación sacramental no encontrada'; end if;
  if v_row.receiver_parish_id is distinct from v_parish then
    raise exception 'La notificación no pertenece a esta parroquia';
  end if;

  if lower(coalesce(v_row.status,'pending'))='processed' then
    return query select v_row.id,v_row.notification_id,'processed'::text,v_row.note_applied;
    return;
  end if;

  if lower(coalesce(v_row.status,'pending'))='cancelled' then
    raise exception 'La notificación está archivada/cancelada';
  end if;

  select * into v_doc
  from public.matrimonial_notifications n
  where n.id=v_row.notification_id;

  if not found then raise exception 'Documento sacramental asociado no encontrado'; end if;

  v_notification_type := lower(coalesce(nullif(v_doc.notification_type,''),'matrimonio'));
  v_note := nullif(v_row.payload->>'marginalNote','');
  if v_note is null then
    raise exception 'La notificación no contiene la nota marginal requerida';
  end if;

  if v_notification_type='nulidad_matrimonial' then
    v_note_type := 'nulidad_matrimonial';
    v_source_type := 'sacramental_notification';
  elsif v_notification_type='matrimonio' then
    v_note_type := 'matrimonio';
    v_source_type := 'matrimonial_notification';
  else
    v_note_type := v_notification_type;
    v_source_type := 'sacramental_notification';
  end if;

  if coalesce(v_doc.payload->>'decreeDate','') ~ '^\d{4}-\d{2}-\d{2}$' then
    v_note_date := (v_doc.payload->>'decreeDate')::date;
  elsif v_doc.marriage_date is not null then
    v_note_date := v_doc.marriage_date;
  else
    v_note_date := current_date;
  end if;

  if v_row.target_baptism_id is not null then
    select b.nota_marginal into v_existing_note
    from public.baptisms b
    where b.id=v_row.target_baptism_id
      and b.parish_id=v_parish
      and coalesce(lower(b.status),'active') not in
        ('anulada','annulled','deleted','reversed','revertida','replaced')
    for update;

    if not found then
      raise exception 'La partida bautismal destinataria no pertenece a esta parroquia o ya no está vigente';
    end if;

    if not exists (
      select 1
      from public.marginal_notes mn
      where mn.sacrament_type='bautismo'
        and mn.sacrament_id=v_row.target_baptism_id
        and mn.source_type=v_source_type
        and mn.source_id=v_row.notification_id
        and coalesce(lower(mn.status),'active') not in ('reversed','revertida','deleted')
    ) then
      v_raw_patch := jsonb_build_object(
        'notaMarginal',concat_ws(E'\n\n',nullif(v_existing_note,''),v_note),
        'lastSacramentalNotificationId',v_row.notification_id,
        'lastSacramentalNotificationType',v_notification_type
      );

      if v_notification_type='matrimonio' then
        v_raw_patch := v_raw_patch || jsonb_build_object(
          'lastMatrimonialNotificationId',v_row.notification_id
        );
      end if;

      update public.baptisms
      set nota_marginal=concat_ws(E'\n\n',nullif(v_existing_note,''),v_note),
          raw_data=coalesce(raw_data,'{}'::jsonb) || v_raw_patch,
          updated_at=now()
      where id=v_row.target_baptism_id;

      insert into public.marginal_notes(
        sacrament_type,note_type,content,parish_id,sacrament_id,
        note_date,source_type,source_id,created_by,status
      ) values (
        'bautismo',v_note_type,v_note,v_parish,v_row.target_baptism_id,
        v_note_date,v_source_type,v_row.notification_id,auth.uid(),'active'
      );
    end if;

    v_applied := true;
  end if;

  update public.matrimonial_notification_recipients
  set status='processed',
      note_applied=v_applied,
      processed_by=auth.uid(),
      processed_at=now(),
      read_at=coalesce(read_at,now()),
      updated_at=now()
  where id=v_row.id;

  if not exists (
    select 1
    from public.matrimonial_notification_recipients r
    where r.notification_id=v_row.notification_id
      and lower(coalesce(r.status,'pending')) not in ('processed','cancelled')
  ) then
    update public.matrimonial_notifications
    set status='processed',updated_at=now()
    where id=v_row.notification_id;
  end if;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,after_data,metadata
  ) values (
    auth.uid(),v_parish,
    (select p.diocese_id from public.parishes p where p.id=v_parish),
    'sacramental_notification_recipient',v_row.id,'process',
    jsonb_build_object(
      'status','processed',
      'note_applied',v_applied,
      'notification_type',v_notification_type,
      'note_type',v_note_type
    ),
    jsonb_build_object(
      'notification_id',v_row.notification_id,
      'target_baptism_id',v_row.target_baptism_id,
      'source_type',v_source_type
    )
  );

  return query
  select v_row.id,v_row.notification_id,'processed'::text,v_applied;
end;
$$;


create or replace function public.sacramentum_issue_nullity_baptism_notification(
  p_marriage_id uuid,
  p_decree_id uuid,
  p_decree_number text,
  p_decree_date date,
  p_note text,
  p_baptism_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_marriage public.marriages%rowtype;
  v_baptism public.baptisms%rowtype;
  v_sender_diocese uuid;
  v_receiver_name text;
  v_sender_name text;
  v_doc_id uuid;
  v_existing_doc uuid;
  v_sequence bigint;
  v_year integer;
  v_document_number text;
  v_person_name text;
begin
  select * into v_marriage
  from public.marriages
  where id=p_marriage_id;

  if not found then raise exception 'Matrimonio no encontrado para emitir notificación de nulidad'; end if;

  select * into v_baptism
  from public.baptisms
  where id=p_baptism_id
    and coalesce(lower(status),'active') not in
      ('anulada','annulled','deleted','reversed','revertida','replaced');

  if not found then raise exception 'Partida bautismal remota no encontrada o no vigente'; end if;

  if v_baptism.parish_id is null then
    raise exception 'La partida bautismal no tiene parroquia responsable';
  end if;

  if v_baptism.parish_id=v_marriage.parish_id then
    raise exception 'La partida bautismal es local; no corresponde emitir notificación remota';
  end if;

  select n.id into v_existing_doc
  from public.matrimonial_notifications n
  where n.sender_parish_id=v_marriage.parish_id
    and n.source_baptism_id=p_baptism_id
    and lower(coalesce(n.notification_type,''))='nulidad_matrimonial'
    and n.payload->>'decreeId'=p_decree_id::text
    and lower(coalesce(n.status,'sent')) <> 'cancelled'
  order by n.created_at desc
  limit 1;

  if v_existing_doc is not null then
    return v_existing_doc;
  end if;

  select p.diocese_id,p.name
    into v_sender_diocese,v_sender_name
  from public.parishes p
  where p.id=v_marriage.parish_id;

  select p.name into v_receiver_name
  from public.parishes p
  where p.id=v_baptism.parish_id;

  v_person_name := trim(concat_ws(' ',v_baptism.nombres,v_baptism.apellidos));
  if nullif(v_person_name,'') is null then
    v_person_name := 'BAUTIZADO(A) VINCULADO(A)';
  end if;

  v_year := extract(year from coalesce(p_decree_date,current_date))::integer;

  insert into public.document_sequences(scope_id,document_type,current_value)
  values(
    v_marriage.parish_id,
    'sacramental_nullity_notification_'||v_year,
    1
  )
  on conflict(scope_id,document_type)
  do update set
    current_value=public.document_sequences.current_value+1,
    updated_at=now()
  returning current_value into v_sequence;

  v_document_number :=
    'NS-NUL-'||v_year||'-'||lpad(v_sequence::text,6,'0');

  insert into public.matrimonial_notifications(
    sender_parish_id,
    diocese_id,
    source_baptism_id,
    marriage_id,
    consecutive,
    document_number,
    person_name,
    spouse_name,
    marriage_date,
    marriage_book,
    marriage_folio,
    marriage_number,
    marriage_diocese_id,
    marriage_parish_id,
    status,
    notification_type,
    payload,
    created_by
  ) values (
    v_marriage.parish_id,
    v_sender_diocese,
    p_baptism_id,
    p_marriage_id,
    v_sequence,
    v_document_number,
    v_person_name,
    null,
    v_marriage.celebration_date,
    v_marriage.book_number,
    v_marriage.folio,
    v_marriage.number,
    v_sender_diocese,
    v_marriage.parish_id,
    'sent',
    'nulidad_matrimonial',
    jsonb_build_object(
      'notificationType','nulidad_matrimonial',
      'decreeId',p_decree_id,
      'decreeNumber',trim(p_decree_number),
      'decreeDate',p_decree_date,
      'marriageId',p_marriage_id,
      'marriageDate',v_marriage.celebration_date,
      'marriageBook',v_marriage.book_number,
      'marriageFolio',v_marriage.folio,
      'marriageNumber',v_marriage.number,
      'parishId',v_marriage.parish_id,
      'senderParishName',v_sender_name,
      'receiverParishId',v_baptism.parish_id,
      'receiverParishName',v_receiver_name,
      'personName',v_person_name,
      'baptismPartidaId',p_baptism_id,
      'baptismBook',v_baptism.book_number,
      'baptismFolio',v_baptism.folio,
      'baptismNumber',v_baptism.number,
      'marginNoteText',p_note,
      'marginalNote',p_note,
      'issuedBy','cancilleria',
      'requiresAcceptance',true
    ),
    auth.uid()
  )
  returning id into v_doc_id;

  insert into public.matrimonial_notification_recipients(
    notification_id,
    receiver_parish_id,
    target_baptism_id,
    status,
    payload
  ) values (
    v_doc_id,
    v_baptism.parish_id,
    p_baptism_id,
    'pending',
    jsonb_build_object(
      'notificationType','nulidad_matrimonial',
      'marginalNote',p_note,
      'receiverParishName',v_receiver_name,
      'decreeId',p_decree_id,
      'decreeNumber',trim(p_decree_number),
      'decreeDate',p_decree_date,
      'marriageId',p_marriage_id
    )
  );

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,after_data,metadata
  ) values (
    auth.uid(),v_marriage.parish_id,v_sender_diocese,
    'sacramental_notification',v_doc_id,'issue_nullity_baptism_notice',
    jsonb_build_object(
      'document_number',v_document_number,
      'notification_type','nulidad_matrimonial',
      'person_name',v_person_name
    ),
    jsonb_build_object(
      'decree_id',p_decree_id,
      'marriage_id',p_marriage_id,
      'target_baptism_id',p_baptism_id,
      'receiver_parish_id',v_baptism.parish_id
    )
  );

  return v_doc_id;
end;
$$;

revoke all on function public.sacramentum_issue_nullity_baptism_notification(uuid,uuid,text,date,text,uuid) from public;


create or replace function public.apply_marriage_nullity(
  p_marriage_id uuid,
  p_decree_number text,
  p_decree_date date,
  p_reason text,
  p_decree_payload jsonb default '{}'::jsonb,
  p_baptism_ids uuid[] default null::uuid[]
)
returns table(decree_id uuid, marriage_id uuid, decree_number text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
  v_user_diocese uuid;
  v_chancery uuid;
  v_marriage public.marriages%rowtype;
  v_diocese uuid;
  v_decree_id uuid;
  v_payload jsonb;
  v_note text;
  v_baptism_id uuid;
  v_baptism_parish uuid;
  v_existing_note text;
  v_local_baptisms integer := 0;
  v_remote_notifications integer := 0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select lower(coalesce(role,'')),diocese_id,chancery_id
    into v_role,v_user_diocese,v_chancery
  from public.user_profiles
  where auth_user_id=auth.uid()
    and coalesce(is_active,true)=true
  limit 1;

  if v_role not in ('chancery','diocese','admin_general') then
    raise exception 'Sólo Cancillería, Diócesis o Administración General pueden registrar una nulidad matrimonial';
  end if;

  if nullif(trim(p_decree_number),'') is null or p_decree_date is null then
    raise exception 'Número y fecha de sentencia/decreto son obligatorios';
  end if;

  select * into v_marriage
  from public.marriages
  where id=p_marriage_id
  for update;

  if not found then raise exception 'Partida matrimonial no encontrada'; end if;

  select diocese_id into v_diocese
  from public.parishes
  where id=v_marriage.parish_id;

  if v_diocese is null then
    raise exception 'La parroquia del matrimonio no tiene diócesis';
  end if;

  if v_role in ('chancery','diocese')
     and v_user_diocese is distinct from v_diocese then
    raise exception 'El matrimonio está fuera de su jurisdicción';
  end if;

  if lower(coalesce(v_marriage.status,'')) in
      ('nullified','nulo','anulada','annulled') then
    raise exception 'El matrimonio ya consta como declarado nulo';
  end if;

  if exists(
    select 1
    from public.decretos d
    where d.diocese_id=v_diocese
      and lower(trim(coalesce(d.decree_number,'')))=
          lower(trim(p_decree_number))
  ) then
    raise exception 'El número de decreto/sentencia % ya existe en esta diócesis',
      p_decree_number;
  end if;

  v_note :=
    'ESTE MATRIMONIO FUE DECLARADO NULO MEDIANTE SENTENCIA DEL TRIBUNAL ECLESIÁSTICO. DECRETO NO. '||
    upper(trim(p_decree_number))||
    ' DE FECHA '||to_char(p_decree_date,'DD/MM/YYYY')||'.';

  if nullif(trim(coalesce(p_reason,'')),'') is not null then
    v_note := v_note||' '||upper(trim(p_reason));
  end if;

  v_payload :=
    coalesce(p_decree_payload,'{}'::jsonb) ||
    jsonb_build_object(
      'sacramentType','matrimonio',
      'sacramento','matrimonio',
      'decreeType','nulidad_matrimonial',
      'decreeNumber',trim(p_decree_number),
      'decreeDate',p_decree_date,
      'marriageId',p_marriage_id,
      'reason',p_reason,
      'issuedFrom',v_role,
      'baptismIds',coalesce(to_jsonb(p_baptism_ids),'[]'::jsonb)
    );

  update public.marriages
  set status='nullified',
      observations=concat_ws(E'\n\n',nullif(observations,''),v_note),
      raw_data=coalesce(raw_data,'{}'::jsonb) ||
        jsonb_build_object(
          'status','nullified',
          'nullityDecree',trim(p_decree_number),
          'nullityDate',p_decree_date,
          'nullityReason',p_reason,
          'notaMarginal',v_note
        ),
      updated_at=now()
  where id=p_marriage_id;

  insert into public.decretos(
    parish_id,diocese_id,chancery_id,tipo,sacrament_type,
    decree_number,decree_date,original_record_id,status,issued_by,payload
  ) values (
    v_marriage.parish_id,v_diocese,v_chancery,
    'nulidad_matrimonial','matrimonio',
    trim(p_decree_number),p_decree_date,p_marriage_id,
    'active',auth.uid(),v_payload
  )
  returning id into v_decree_id;

  insert into public.marginal_notes(
    sacrament_type,note_type,decree_number,content,parish_id,
    sacrament_id,note_date,source_type,source_id,decree_id,
    created_by,status
  ) values (
    'matrimonio','nulidad_matrimonial',trim(p_decree_number),
    v_note,v_marriage.parish_id,p_marriage_id,p_decree_date,
    'decree',v_decree_id,v_decree_id,auth.uid(),'active'
  );

  if p_baptism_ids is not null then
    foreach v_baptism_id in array p_baptism_ids loop
      select b.parish_id
        into v_baptism_parish
      from public.baptisms b
      where b.id=v_baptism_id
        and coalesce(lower(b.status),'active') not in
          ('anulada','annulled','deleted','reversed','revertida','replaced');

      if v_baptism_parish is null then
        raise exception 'La partida bautismal % no existe, no está vigente o no tiene parroquia',
          v_baptism_id;
      end if;

      if v_role <> 'admin_general'
         and not exists(
           select 1 from public.parishes
           where id=v_baptism_parish
             and diocese_id=v_diocese
         ) then
        raise exception 'La partida bautismal % está fuera de la jurisdicción diocesana',
          v_baptism_id;
      end if;

      if v_baptism_parish=v_marriage.parish_id then
        if not exists(
          select 1
          from public.marginal_notes mn
          where mn.sacrament_type='bautismo'
            and mn.sacrament_id=v_baptism_id
            and mn.note_type='nulidad_matrimonial'
            and mn.decree_id=v_decree_id
            and coalesce(lower(mn.status),'active') not in
              ('reversed','revertida','deleted')
        ) then
          select b.nota_marginal into v_existing_note
          from public.baptisms b
          where b.id=v_baptism_id
          for update;

          update public.baptisms
          set nota_marginal=concat_ws(E'\n\n',nullif(v_existing_note,''),v_note),
              raw_data=coalesce(raw_data,'{}'::jsonb) ||
                jsonb_build_object(
                  'notaMarginal',concat_ws(E'\n\n',nullif(v_existing_note,''),v_note),
                  'lastNullityDecreeId',v_decree_id
                ),
              updated_at=now()
          where id=v_baptism_id;

          insert into public.marginal_notes(
            sacrament_type,note_type,decree_number,content,parish_id,
            sacrament_id,note_date,source_type,source_id,decree_id,
            created_by,status
          ) values (
            'bautismo','nulidad_matrimonial',trim(p_decree_number),
            v_note,v_baptism_parish,v_baptism_id,p_decree_date,
            'decree',v_decree_id,v_decree_id,auth.uid(),'active'
          );
        end if;

        v_local_baptisms := v_local_baptisms+1;
      else
        perform public.sacramentum_issue_nullity_baptism_notification(
          p_marriage_id,
          v_decree_id,
          trim(p_decree_number),
          p_decree_date,
          v_note,
          v_baptism_id
        );
        v_remote_notifications := v_remote_notifications+1;
      end if;
    end loop;
  end if;

  -- La comunicación de Cancillería no se inserta aquí.
  -- V14B (trg_decree_official_notification_guarantee) la garantiza de forma
  -- central al finalizar la transacción, evitando duplicados entre RPCs.

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,before_data,after_data,metadata
  ) values
  (
    auth.uid(),v_marriage.parish_id,v_diocese,
    'marriage',p_marriage_id,'nullify_by_ecclesiastical_sentence',
    to_jsonb(v_marriage),
    jsonb_build_object('status','nullified','note',v_note),
    jsonb_build_object(
      'decree_id',v_decree_id,
      'decree_number',trim(p_decree_number),
      'local_baptism_notes',v_local_baptisms,
      'remote_sacramental_notifications',v_remote_notifications
    )
  ),
  (
    auth.uid(),v_marriage.parish_id,v_diocese,
    'decree',v_decree_id,'issue',null,v_payload,
    jsonb_build_object(
      'sacrament_type','matrimonio',
      'decree_type','nulidad_matrimonial',
      'local_baptism_notes',v_local_baptisms,
      'remote_sacramental_notifications',v_remote_notifications
    )
  );

  return query
  select v_decree_id,p_marriage_id,trim(p_decree_number);
end;
$$;

create or replace function public.sacramentum_prepare_sacramental_receipt()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_doc public.matrimonial_notifications%rowtype;
  v_seq bigint;
  v_year integer;
  v_receiver_name text;
  v_sender_name text;
  v_baptism jsonb;
begin
  if lower(coalesce(new.status,'')) <> 'processed'
     or new.receipt_document_number is not null then
    return new;
  end if;

  select * into v_doc
  from public.matrimonial_notifications
  where id=new.notification_id;

  if not found then
    raise exception 'No existe el documento asociado a la notificación sacramental';
  end if;

  v_year := extract(year from coalesce(new.processed_at,now()))::integer;

  insert into public.document_sequences(scope_id,document_type,current_value)
  values(new.receiver_parish_id,'sacramental_receipt_'||v_year,1)
  on conflict(scope_id,document_type)
  do update set
    current_value=public.document_sequences.current_value+1,
    updated_at=now()
  returning current_value into v_seq;

  select p.name into v_receiver_name
  from public.parishes p
  where p.id=new.receiver_parish_id;

  select p.name into v_sender_name
  from public.parishes p
  where p.id=v_doc.sender_parish_id;

  if new.target_baptism_id is not null then
    select jsonb_build_object(
      'id',b.id,
      'book',b.book_number,
      'folio',b.folio,
      'number',b.number,
      'name',trim(concat_ws(' ',b.nombres,b.apellidos))
    )
    into v_baptism
    from public.baptisms b
    where b.id=new.target_baptism_id;
  else
    v_baptism := coalesce(new.payload->'manualLocator','{}'::jsonb);
  end if;

  new.receipt_document_number :=
    'RNS-'||v_year||'-'||lpad(v_seq::text,6,'0');
  new.receipt_created_at := coalesce(new.processed_at,now());
  new.sender_read_at := null;

  new.receipt_payload := jsonb_build_object(
    'receiptNumber',new.receipt_document_number,
    'notificationId',new.notification_id,
    'notificationDocumentNumber',v_doc.document_number,
    'notificationType',coalesce(v_doc.notification_type,'matrimonio'),
    'senderParishId',v_doc.sender_parish_id,
    'senderParishName',v_sender_name,
    'receiverParishId',new.receiver_parish_id,
    'receiverParishName',v_receiver_name,
    'acceptedAt',new.receipt_created_at,
    'acceptedBy',new.processed_by,
    'personName',v_doc.person_name,
    'spouseName',v_doc.spouse_name,
    'marriageDate',v_doc.marriage_date,
    'marriageId',v_doc.marriage_id,
    'decreeId',v_doc.payload->>'decreeId',
    'decreeNumber',v_doc.payload->>'decreeNumber',
    'decreeDate',v_doc.payload->>'decreeDate',
    'reason',v_doc.payload->>'reason',
    'noteApplied',new.note_applied,
    'targetBaptismId',new.target_baptism_id,
    'baptism',coalesce(v_baptism,'{}'::jsonb)
  );

  new.payload := coalesce(new.payload,'{}'::jsonb)
    || jsonb_build_object(
      'receiptDocumentNumber',new.receipt_document_number,
      'receiptCreatedAt',new.receipt_created_at
    );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seguridad RPC V15
-- ---------------------------------------------------------------------------
revoke all on function public.sacramentum_issue_nullity_baptism_notification(
  uuid,uuid,text,date,text,uuid
) from public, anon, authenticated, service_role;

revoke all on function public.apply_marriage_nullity(
  uuid,text,date,text,jsonb,uuid[]
) from public, anon;
grant execute on function public.apply_marriage_nullity(
  uuid,text,date,text,jsonb,uuid[]
) to authenticated, service_role;

revoke all on function public.process_matrimonial_notification_recipient(uuid)
from public, anon;
grant execute on function public.process_matrimonial_notification_recipient(uuid)
to authenticated, service_role;

commit;
