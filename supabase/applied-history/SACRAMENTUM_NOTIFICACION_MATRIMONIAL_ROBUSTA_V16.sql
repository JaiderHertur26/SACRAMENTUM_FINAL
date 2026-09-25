-- SACRAMENTUM · V16 · NOTIFICACIÓN MATRIMONIAL ROBUSTA
-- Seguridad RLS, Realtime, deduplicación, origen institucional,
-- vínculo con matrimonio, cancelación segura y snapshots documentales.
begin;

alter table public.matrimonial_notifications
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid;

create or replace function public.can_read_matrimonial_notification(p_notification_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.matrimonial_notifications n
    where n.id=p_notification_id
      and (
        public.is_app_admin()
        or (
          public.current_app_role()='parish'
          and (
            n.sender_parish_id=public.current_app_parish_id()
            or exists (
              select 1
              from public.matrimonial_notification_recipients r              where r.notification_id=n.id
                and r.receiver_parish_id=public.current_app_parish_id()
            )
          )
        )
        or (
          public.current_app_role() in ('diocese','chancery')
          and (
            public.can_access_parish(n.sender_parish_id)
            or exists (
              select 1
              from public.matrimonial_notification_recipients r
              where r.notification_id=n.id
                and public.can_access_parish(r.receiver_parish_id)
            )
          )
        )
      )
  );
$$;

create or replace function public.can_read_matrimonial_recipient(p_recipient_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.matrimonial_notification_recipients r    join public.matrimonial_notifications n on n.id=r.notification_id
    where r.id=p_recipient_id
      and (
        public.is_app_admin()
        or (
          public.current_app_role()='parish'
          and (
            r.receiver_parish_id=public.current_app_parish_id()
            or n.sender_parish_id=public.current_app_parish_id()
          )
        )
        or (
          public.current_app_role() in ('diocese','chancery')
          and (
            public.can_access_parish(r.receiver_parish_id)
            or public.can_access_parish(n.sender_parish_id)
          )
        )
      )
  );
$$;

revoke all on function public.can_read_matrimonial_notification(uuid) from public,anon;
revoke all on function public.can_read_matrimonial_recipient(uuid) from public,anon;
grant execute on function public.can_read_matrimonial_notification(uuid) to authenticated,service_role;
grant execute on function public.can_read_matrimonial_recipient(uuid) to authenticated,service_role;

drop policy if exists matrimonial_notifications_select_scoped on public.matrimonial_notifications;
create policy matrimonial_notifications_select_scoped
on public.matrimonial_notifications
for select to authenticated
using (public.can_read_matrimonial_notification(id));drop policy if exists matrimonial_recipients_select_scoped on public.matrimonial_notification_recipients;
create policy matrimonial_recipients_select_scoped
on public.matrimonial_notification_recipients
for select to authenticated
using (public.can_read_matrimonial_recipient(id));

grant select on public.matrimonial_notifications to authenticated;
grant select on public.matrimonial_notification_recipients to authenticated;
revoke insert,update,delete on public.matrimonial_notifications from anon,authenticated;
revoke insert,update,delete on public.matrimonial_notification_recipients from anon,authenticated;
revoke select on public.matrimonial_notifications from anon;
revoke select on public.matrimonial_notification_recipients from anon;

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(
      select 1 from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public'
        and tablename='matrimonial_notifications'
    ) then
      execute 'alter publication supabase_realtime add table public.matrimonial_notifications';
    end if;
    if not exists(
      select 1 from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public'
        and tablename='matrimonial_notification_recipients'
    ) then
      execute 'alter publication supabase_realtime add table public.matrimonial_notification_recipients';
    end if;
  end if;
end $$;create unique index if not exists uq_active_matrimonial_digital_case_v16
on public.matrimonial_notifications(
  sender_parish_id,
  least(source_baptism_id,spouse_baptism_id),
  greatest(source_baptism_id,spouse_baptism_id),
  marriage_date,
  coalesce(marriage_book,''),
  coalesce(marriage_folio,''),
  coalesce(marriage_number,'')
)
where lower(coalesce(notification_type,'matrimonio'))='matrimonio'
  and source_baptism_id is not null
  and spouse_baptism_id is not null
  and lower(coalesce(status,'sent')) <> 'cancelled';

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
)returns table(
  notification_id uuid,
  document_number text,
  consecutive bigint,
  recipients_created integer,
  local_notes_applied integer
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
  v_sender_parish uuid;
  v_sender_diocese uuid;
  v_sender_parish_name text;
  v_sender_diocese_name text;
  v_source_parish uuid;
  v_spouse_parish uuid;
  v_source_parish_name text;
  v_spouse_parish_name text;
  v_person_name text;
  v_spouse_name text;
  v_source_snapshot jsonb;
  v_spouse_snapshot jsonb;
  v_issuer_authority jsonb;
  v_marriage_id uuid;
  v_doc_id uuid;
  v_sequence bigint;
  v_document_number text;
  v_year integer;
  v_recipients integer:=0;
  v_local_notes integer:=0;
  v_is_manual boolean;
  v_existing_note text;
  v_delivery_mode text;
begin  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select lower(coalesce(up.role,'')),up.parish_id
    into v_role,v_sender_parish
  from public.user_profiles up
  where up.auth_user_id=auth.uid()
    and coalesce(up.is_active,true)=true
    and upper(coalesce(up.status,'ACTIVE'))='ACTIVE'
  limit 1;

  if v_role<>'parish' or v_sender_parish is null then
    raise exception 'Sólo una cuenta parroquial activa puede emitir notificaciones matrimoniales';
  end if;

  select p.diocese_id,p.name,d.name
    into v_sender_diocese,v_sender_parish_name,v_sender_diocese_name
  from public.parishes p
  left join public.dioceses d on d.id=p.diocese_id
  where p.id=v_sender_parish;

  if v_sender_diocese is null then
    raise exception 'La parroquia emisora no tiene diócesis operativa';
  end if;

  if p_marriage_date is null then raise exception 'La fecha de matrimonio es obligatoria'; end if;
  if p_marriage_date>current_date then raise exception 'La fecha de matrimonio no puede estar en el futuro'; end if;
  if nullif(trim(coalesce(p_marriage_book,'')),'') is null then raise exception 'El libro matrimonial es obligatorio'; end if;
  if nullif(trim(coalesce(p_marriage_folio,'')),'') is null then raise exception 'El folio matrimonial es obligatorio'; end if;
  if nullif(trim(coalesce(p_marriage_number,'')),'') is null then raise exception 'El número matrimonial es obligatorio'; end if;  if nullif(trim(coalesce(p_main_note,'')),'') is null then
    raise exception 'La nota marginal principal es obligatoria';
  end if;

  if p_marriage_parish_id is not null and p_marriage_parish_id<>v_sender_parish then
    raise exception 'La parroquia emisora debe ser la parroquia donde consta el matrimonio';
  end if;
  if p_marriage_diocese_id is not null and p_marriage_diocese_id<>v_sender_diocese then
    raise exception 'La diócesis matrimonial debe coincidir con la diócesis de la parroquia emisora';
  end if;

  v_is_manual:=p_source_baptism_id is null and p_spouse_baptism_id is null;

  if v_is_manual then
    if p_manual_receiver_parish_id is null then
      raise exception 'La notificación manual requiere parroquia destinataria';
    end if;

    select p.name into v_source_parish_name
    from public.parishes p
    where p.id=p_manual_receiver_parish_id
      and p.diocese_id=v_sender_diocese;

    if not found then
      raise exception 'La parroquia destinataria no existe o está fuera de la diócesis autorizada';
    end if;

    if nullif(trim(coalesce(p_manual_locator->>'book','')),'') is null
       or nullif(trim(coalesce(p_manual_locator->>'folio','')),'') is null
       or nullif(trim(coalesce(p_manual_locator->>'number','')),'') is null then
      raise exception 'Libro, folio y número de Bautismo son obligatorios en notificación manual';
    end if;    v_source_parish:=p_manual_receiver_parish_id;
    v_person_name:=nullif(trim(p_manual_person_name),'');
    v_spouse_name:=nullif(trim(p_manual_spouse_name),'');
    v_source_snapshot:=jsonb_build_object(
      'mode','physical',
      'parishId',p_manual_receiver_parish_id,
      'parishName',v_source_parish_name,
      'book',p_manual_locator->>'book',
      'folio',p_manual_locator->>'folio',
      'number',p_manual_locator->>'number',
      'name',v_person_name
    );

    if exists(
      select 1
      from public.matrimonial_notifications n
      join public.matrimonial_notification_recipients r on r.notification_id=n.id
      where n.sender_parish_id=v_sender_parish
        and lower(coalesce(n.notification_type,'matrimonio'))='matrimonio'
        and n.source_baptism_id is null
        and n.spouse_baptism_id is null
        and lower(trim(n.person_name))=lower(trim(coalesce(v_person_name,'')))
        and lower(trim(coalesce(n.spouse_name,'')))=lower(trim(coalesce(v_spouse_name,'')))
        and n.marriage_date=p_marriage_date
        and coalesce(n.marriage_book,'')=trim(p_marriage_book)
        and coalesce(n.marriage_folio,'')=trim(p_marriage_folio)
        and coalesce(n.marriage_number,'')=trim(p_marriage_number)
        and r.receiver_parish_id=p_manual_receiver_parish_id
        and lower(coalesce(n.status,'sent'))<>'cancelled'
    ) then      raise exception 'Ya existe una notificación manual activa para este expediente matrimonial';
    end if;
  else
    if p_source_baptism_id is null or p_spouse_baptism_id is null then
      raise exception 'La notificación digital requiere las dos partidas de Bautismo';
    end if;
    if p_source_baptism_id=p_spouse_baptism_id then
      raise exception 'Las partidas bautismales de los contrayentes no pueden ser la misma';
    end if;
    if nullif(trim(coalesce(p_spouse_note,'')),'') is null then
      raise exception 'La nota marginal del cónyuge es obligatoria';
    end if;

    select b.parish_id,p.name,trim(concat_ws(' ',b.nombres,b.apellidos)),
      jsonb_build_object(
        'id',b.id,'parishId',b.parish_id,'parishName',p.name,
        'book',b.book_number,'folio',b.folio,'number',b.number,
        'celebrationDate',b.celebration_date,
        'name',trim(concat_ws(' ',b.nombres,b.apellidos)),
        'fatherName',b.nombre_padre,'motherName',b.nombre_madre
      )
      into v_source_parish,v_source_parish_name,v_person_name,v_source_snapshot
    from public.baptisms b
    join public.parishes p on p.id=b.parish_id
    where b.id=p_source_baptism_id
      and p.diocese_id=v_sender_diocese
      and coalesce(lower(b.status),'active') not in
        ('anulada','annulled','deleted','reversed','revertida','replaced');    if not found then
      raise exception 'La partida bautismal principal no existe, no está vigente o está fuera de la diócesis autorizada';
    end if;

    select b.parish_id,p.name,trim(concat_ws(' ',b.nombres,b.apellidos)),
      jsonb_build_object(
        'id',b.id,'parishId',b.parish_id,'parishName',p.name,
        'book',b.book_number,'folio',b.folio,'number',b.number,
        'celebrationDate',b.celebration_date,
        'name',trim(concat_ws(' ',b.nombres,b.apellidos)),
        'fatherName',b.nombre_padre,'motherName',b.nombre_madre
      )
      into v_spouse_parish,v_spouse_parish_name,v_spouse_name,v_spouse_snapshot
    from public.baptisms b
    join public.parishes p on p.id=b.parish_id
    where b.id=p_spouse_baptism_id
      and p.diocese_id=v_sender_diocese
      and coalesce(lower(b.status),'active') not in
        ('anulada','annulled','deleted','reversed','revertida','replaced');

    if not found then
      raise exception 'La partida bautismal del cónyuge no existe, no está vigente o está fuera de la diócesis autorizada';
    end if;

    if exists(
      select 1
      from public.matrimonial_notifications n
      where n.sender_parish_id=v_sender_parish
        and lower(coalesce(n.notification_type,'matrimonio'))='matrimonio'        and (
          (n.source_baptism_id=p_source_baptism_id and n.spouse_baptism_id=p_spouse_baptism_id)
          or
          (n.source_baptism_id=p_spouse_baptism_id and n.spouse_baptism_id=p_source_baptism_id)
        )
        and n.marriage_date=p_marriage_date
        and coalesce(n.marriage_book,'')=trim(p_marriage_book)
        and coalesce(n.marriage_folio,'')=trim(p_marriage_folio)
        and coalesce(n.marriage_number,'')=trim(p_marriage_number)
        and lower(coalesce(n.status,'sent'))<>'cancelled'
    ) then
      raise exception 'Ya existe una notificación activa para este mismo matrimonio y estas partidas';
    end if;
  end if;

  if nullif(v_person_name,'') is null then raise exception 'El nombre del contrayente principal es obligatorio'; end if;
  if nullif(v_spouse_name,'') is null then raise exception 'El nombre del cónyuge es obligatorio'; end if;

  select m.id into v_marriage_id
  from public.marriages m
  where m.parish_id=v_sender_parish
    and m.celebration_date=p_marriage_date
    and coalesce(nullif(ltrim(trim(coalesce(m.book_number,'')),'0'),''),'0')
        =coalesce(nullif(ltrim(trim(p_marriage_book),'0'),''),'0')
    and coalesce(nullif(ltrim(trim(coalesce(m.folio,'')),'0'),''),'0')
        =coalesce(nullif(ltrim(trim(p_marriage_folio),'0'),''),'0')
    and coalesce(nullif(ltrim(trim(coalesce(m.number,'')),'0'),''),'0')
        =coalesce(nullif(ltrim(trim(p_marriage_number),'0'),''),'0')
    and lower(coalesce(m.status,'seated')) not in ('anulada','annulled','reversed','revertida','deleted')
  order by m.created_at desc nulls last
  limit 1;  select public.sacramentum_priest_at_date(v_sender_parish,current_date)
    into v_issuer_authority;

  v_year:=extract(year from p_marriage_date)::integer;
  insert into public.document_sequences(scope_id,document_type,current_value)
  values(v_sender_parish,'matrimonial_notification_'||v_year,1)
  on conflict(scope_id,document_type)
  do update set
    current_value=public.document_sequences.current_value+1,
    updated_at=now()
  returning current_value into v_sequence;

  v_document_number:='NM-'||v_year||'-'||lpad(v_sequence::text,6,'0');

  insert into public.matrimonial_notifications(
    sender_parish_id,diocese_id,source_baptism_id,spouse_baptism_id,marriage_id,
    consecutive,document_number,person_name,spouse_name,
    marriage_date,marriage_book,marriage_folio,marriage_number,
    marriage_diocese_id,marriage_parish_id,external_marriage_parish_name,
    status,notification_type,payload,created_by
  ) values (
    v_sender_parish,v_sender_diocese,
    case when v_is_manual then null else p_source_baptism_id end,
    case when v_is_manual then null else p_spouse_baptism_id end,
    v_marriage_id,
    v_sequence,v_document_number,v_person_name,v_spouse_name,
    p_marriage_date,trim(p_marriage_book),trim(p_marriage_folio),trim(p_marriage_number),
    v_sender_diocese,v_sender_parish,null,
    'sent','matrimonio',    coalesce(p_payload,'{}'::jsonb) || jsonb_build_object(
      'notificationType','matrimonio',
      'consecutivo',v_document_number,
      'issuedAt',now(),
      'parishId',v_sender_parish,
      'senderParishName',v_sender_parish_name,
      'senderDioceseId',v_sender_diocese,
      'senderDioceseName',v_sender_diocese_name,
      'issuerAuthority',v_issuer_authority,
      'personName',v_person_name,
      'spouseName',v_spouse_name,
      'isManual',v_is_manual,
      'marriageDate',p_marriage_date,
      'marriageBook',trim(p_marriage_book),
      'marriageFolio',trim(p_marriage_folio),
      'marriageNumber',trim(p_marriage_number),
      'marriageParish',v_sender_parish,
      'marriageParishName',v_sender_parish_name,
      'marriageDiocese',v_sender_diocese,
      'marriageDioceseName',v_sender_diocese_name,
      'marriageId',v_marriage_id,
      'marriageRecordLinked',(v_marriage_id is not null),
      'marriageSource',case when v_marriage_id is null then 'physical_reference' else 'digital_registry' end,
      'mainMarginalNote',p_main_note,
      'spouseMarginalNote',p_spouse_note,
      'sourceBaptism',coalesce(v_source_snapshot,'{}'::jsonb),
      'spouseBaptism',coalesce(v_spouse_snapshot,'{}'::jsonb)
    ),
    auth.uid()
  ) returning id into v_doc_id;  if v_is_manual then
    insert into public.matrimonial_notification_recipients(
      notification_id,receiver_parish_id,target_baptism_id,status,payload
    ) values (
      v_doc_id,p_manual_receiver_parish_id,null,'pending',
      jsonb_build_object(
        'partyRole','principal',
        'notificationType','matrimonio',
        'marginalNote',p_main_note,
        'manualLocator',coalesce(p_manual_locator,'{}'::jsonb),
        'baptismSnapshot',coalesce(v_source_snapshot,'{}'::jsonb),
        'receiverParishName',v_source_parish_name
      )
    );
    v_recipients:=1;
  else
    if v_source_parish=v_sender_parish then
      select b.nota_marginal into v_existing_note
      from public.baptisms b where b.id=p_source_baptism_id for update;

      update public.baptisms
      set nota_marginal=concat_ws(E'\n\n',nullif(v_existing_note,''),p_main_note),
          raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object(
            'notaMarginal',concat_ws(E'\n\n',nullif(v_existing_note,''),p_main_note),
            'lastMatrimonialNotificationId',v_doc_id
          ),
          updated_at=now()
      where id=p_source_baptism_id;

      insert into public.marginal_notes(
        sacrament_type,note_type,content,parish_id,sacrament_id,note_date,
        source_type,source_id,created_by,status      ) values (
        'bautismo','matrimonio',p_main_note,v_sender_parish,p_source_baptism_id,current_date,
        'matrimonial_notification',v_doc_id,auth.uid(),'active'
      );
      v_local_notes:=v_local_notes+1;
    else
      insert into public.matrimonial_notification_recipients(
        notification_id,receiver_parish_id,target_baptism_id,status,payload
      ) values (
        v_doc_id,v_source_parish,p_source_baptism_id,'pending',
        jsonb_build_object(
          'partyRole','principal','notificationType','matrimonio',
          'marginalNote',p_main_note,
          'baptismSnapshot',v_source_snapshot,
          'receiverParishName',v_source_parish_name
        )
      );
      v_recipients:=v_recipients+1;
    end if;

    if v_spouse_parish=v_sender_parish then
      select b.nota_marginal into v_existing_note
      from public.baptisms b where b.id=p_spouse_baptism_id for update;

      update public.baptisms
      set nota_marginal=concat_ws(E'\n\n',nullif(v_existing_note,''),p_spouse_note),
          raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object(
            'notaMarginal',concat_ws(E'\n\n',nullif(v_existing_note,''),p_spouse_note),
            'lastMatrimonialNotificationId',v_doc_id
          ),
          updated_at=now()      where id=p_spouse_baptism_id;

      insert into public.marginal_notes(
        sacrament_type,note_type,content,parish_id,sacrament_id,note_date,
        source_type,source_id,created_by,status
      ) values (
        'bautismo','matrimonio',p_spouse_note,v_sender_parish,p_spouse_baptism_id,current_date,
        'matrimonial_notification',v_doc_id,auth.uid(),'active'
      );
      v_local_notes:=v_local_notes+1;
    else
      insert into public.matrimonial_notification_recipients(
        notification_id,receiver_parish_id,target_baptism_id,status,payload
      ) values (
        v_doc_id,v_spouse_parish,p_spouse_baptism_id,'pending',
        jsonb_build_object(
          'partyRole','conyuge','notificationType','matrimonio',
          'marginalNote',p_spouse_note,
          'baptismSnapshot',v_spouse_snapshot,
          'receiverParishName',v_spouse_parish_name
        )
      );
      v_recipients:=v_recipients+1;
    end if;
  end if;

  v_delivery_mode:=case
    when v_recipients=0 then 'local'
    when v_local_notes=0 then 'remote'
    else 'mixed'
  end;  update public.matrimonial_notifications
  set status=case when v_recipients=0 then 'processed' else 'sent' end,
      payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object(
        'recipientsCreated',v_recipients,
        'localNotesApplied',v_local_notes,
        'deliveryMode',v_delivery_mode
      ),
      updated_at=now()
  where id=v_doc_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,after_data,metadata
  ) values (
    auth.uid(),v_sender_parish,v_sender_diocese,
    'matrimonial_notification',v_doc_id,'issue',
    jsonb_build_object(
      'document_number',v_document_number,
      'person_name',v_person_name,
      'spouse_name',v_spouse_name,
      'marriage_id',v_marriage_id
    ),
    jsonb_build_object(
      'mode',case when v_is_manual then 'manual' else 'digital' end,
      'delivery_mode',v_delivery_mode,
      'recipients',v_recipients,
      'local_notes',v_local_notes
    )
  );

  return query
  select v_doc_id,v_document_number,v_sequence,v_recipients,v_local_notes;
end;
$$;create or replace function public.cancel_matrimonial_notification(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_parish uuid;
  v_doc public.matrimonial_notifications%rowtype;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select up.parish_id into v_parish
  from public.user_profiles up
  where up.auth_user_id=auth.uid()
    and lower(coalesce(up.role,''))='parish'
    and coalesce(up.is_active,true)=true
    and upper(coalesce(up.status,'ACTIVE'))='ACTIVE'
  limit 1;

  if v_parish is null then raise exception 'Cuenta parroquial no autorizada'; end if;

  select * into v_doc
  from public.matrimonial_notifications n
  where n.id=p_notification_id
    and n.sender_parish_id=v_parish
  for update;

  if not found then raise exception 'La notificación no pertenece a esta parroquia'; end if;

  if lower(coalesce(v_doc.status,''))='cancelled' then
    return true;
  end if;  if lower(coalesce(v_doc.status,''))='processed'
     or exists(
       select 1
       from public.matrimonial_notification_recipients r
       where r.notification_id=p_notification_id
         and (
           lower(coalesce(r.status,''))='processed'
           or r.note_applied=true
           or r.receipt_document_number is not null
         )
     )
     or exists(
       select 1
       from public.marginal_notes mn
       where mn.source_type='matrimonial_notification'
         and mn.source_id=p_notification_id
         and coalesce(lower(mn.status),'active') not in ('reversed','revertida','deleted')
     ) then
    raise exception 'La notificación ya produjo efectos sacramentales o fue aceptada; no puede cancelarse. Debe tramitarse la corrección correspondiente.';
  end if;

  update public.matrimonial_notifications
  set status='cancelled',
      cancelled_at=now(),
      cancelled_by=auth.uid(),
      updated_at=now()
  where id=p_notification_id;

  update public.matrimonial_notification_recipients
  set status='cancelled',updated_at=now()
  where notification_id=p_notification_id
    and lower(coalesce(status,'pending')) in ('pending','read');

  insert into public.registry_audit_log(
    actor_user_id,parish_id,entity_type,entity_id,action,before_data,after_data,metadata
  ) values (
    auth.uid(),v_parish,'matrimonial_notification',p_notification_id,'cancel',
    to_jsonb(v_doc),    jsonb_build_object('status','cancelled','cancelled_at',now()),
    jsonb_build_object('reason','sender_cancelled_before_acceptance')
  );

  return true;
end;
$$;

revoke all on function public.issue_matrimonial_notification(
  uuid,uuid,uuid,jsonb,date,text,text,text,uuid,uuid,text,text,text,text,text,jsonb
) from public,anon;
grant execute on function public.issue_matrimonial_notification(
  uuid,uuid,uuid,jsonb,date,text,text,text,uuid,uuid,text,text,text,text,text,jsonb
) to authenticated,service_role;

revoke all on function public.cancel_matrimonial_notification(uuid) from public,anon;
grant execute on function public.cancel_matrimonial_notification(uuid) to authenticated,service_role;

commit;
