-- SACRAMENTUM · V16C · cierre del flujo manual matrimonial
begin;

create or replace function public.sacramentum_guard_manual_recipient_processing()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if lower(coalesce(new.status,''))='processed'
     and lower(coalesce(old.status,''))<>'processed'
     and new.target_baptism_id is null
     and lower(coalesce(new.payload->>'physicalNoteCertified','false'))<>'true' then
    raise exception 'La notificación manual debe vincular una partida digital o certificar el asiento físico antes de aceptar';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_manual_recipient_processing
on public.matrimonial_notification_recipients;

create trigger trg_guard_manual_recipient_processing
before update of status
on public.matrimonial_notification_recipients
for each row
execute function public.sacramentum_guard_manual_recipient_processing();create or replace function public.resolve_manual_matrimonial_notification_recipient(
  p_recipient_id uuid,
  p_baptism_id uuid
)
returns public.matrimonial_notification_recipients
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row public.matrimonial_notification_recipients%rowtype;
  v_doc public.matrimonial_notifications%rowtype;
  v_parish uuid;
  v_diocese uuid;
  v_baptism public.baptisms%rowtype;
  v_snapshot jsonb;
  v_book text;
  v_folio text;
  v_number text;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select up.parish_id,up.diocese_id
    into v_parish,v_diocese
  from public.user_profiles up
  where up.auth_user_id=auth.uid()
    and lower(coalesce(up.role,''))='parish'
    and coalesce(up.is_active,true)=true
    and upper(coalesce(up.status,'ACTIVE'))='ACTIVE'
  limit 1;  if v_parish is null then
    raise exception 'Cuenta parroquial activa requerida';
  end if;

  select * into v_row
  from public.matrimonial_notification_recipients
  where id=p_recipient_id
  for update;

  if not found then
    raise exception 'Notificación sacramental no encontrada';
  end if;

  if v_row.receiver_parish_id is distinct from v_parish then
    raise exception 'La notificación no pertenece a esta parroquia';
  end if;

  if lower(coalesce(v_row.status,'pending')) in ('processed','cancelled') then
    raise exception 'La notificación ya no admite vinculación de partida';
  end if;

  if v_row.target_baptism_id is not null then
    if v_row.target_baptism_id=p_baptism_id then return v_row; end if;
    raise exception 'La notificación ya está vinculada a otra partida de Bautismo';
  end if;

  select * into v_doc
  from public.matrimonial_notifications
  where id=v_row.notification_id;

  if not found then
    raise exception 'Documento matrimonial asociado no encontrado';
  end if;  if lower(coalesce(v_doc.notification_type,'matrimonio'))<>'matrimonio' then
    raise exception 'La resolución manual sólo aplica a notificaciones matrimoniales';
  end if;

  v_book:=nullif(trim(v_row.payload->'manualLocator'->>'book'),'');
  v_folio:=nullif(trim(v_row.payload->'manualLocator'->>'folio'),'');
  v_number:=nullif(trim(v_row.payload->'manualLocator'->>'number'),'');

  if v_book is null or v_folio is null or v_number is null then
    raise exception 'La notificación manual no contiene Libro/Folio/Número completos';
  end if;

  select * into v_baptism
  from public.baptisms b
  where b.id=p_baptism_id
    and b.parish_id=v_parish
    and coalesce(lower(b.status),'active') not in
      ('anulada','annulled','deleted','reversed','revertida','replaced')
    and coalesce(nullif(ltrim(trim(coalesce(b.book_number,'')),'0'),''),'0')
        =coalesce(nullif(ltrim(trim(v_book),'0'),''),'0')
    and coalesce(nullif(ltrim(trim(coalesce(b.folio,'')),'0'),''),'0')
        =coalesce(nullif(ltrim(trim(v_folio),'0'),''),'0')
    and coalesce(nullif(ltrim(trim(coalesce(b.number,'')),'0'),''),'0')
        =coalesce(nullif(ltrim(trim(v_number),'0'),''),'0')
  for update;

  if not found then
    raise exception 'La partida seleccionada no coincide con Libro/Folio/Número de la notificación o no pertenece a esta parroquia';
  end if;  v_snapshot:=jsonb_build_object(
    'id',v_baptism.id,
    'parishId',v_baptism.parish_id,
    'book',v_baptism.book_number,
    'folio',v_baptism.folio,
    'number',v_baptism.number,
    'celebrationDate',v_baptism.celebration_date,
    'name',trim(concat_ws(' ',v_baptism.nombres,v_baptism.apellidos)),
    'fatherName',v_baptism.nombre_padre,
    'motherName',v_baptism.nombre_madre
  );

  update public.matrimonial_notification_recipients
  set target_baptism_id=v_baptism.id,
      payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object(
        'baptismSnapshot',v_snapshot,
        'manualResolvedAt',now(),
        'manualResolvedBy',auth.uid(),
        'acceptanceMode','digital_link'
      ),
      updated_at=now()
  where id=v_row.id
  returning * into v_row;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,after_data,metadata
  ) values (
    auth.uid(),v_parish,v_diocese,
    'matrimonial_notification_recipient',v_row.id,
    'resolve_manual_baptism',
    jsonb_build_object(
      'target_baptism_id',v_baptism.id,
      'book',v_baptism.book_number,
      'folio',v_baptism.folio,
      'number',v_baptism.number
    ),
    jsonb_build_object(
      'notification_id',v_row.notification_id,
      'document_number',v_doc.document_number,
      'manual_locator',v_row.payload->'manualLocator'
    )
  );

  return v_row;
end;
$$;create or replace function public.process_manual_matrimonial_notification_physical(
  p_recipient_id uuid
)
returns table(
  recipient_id uuid,
  notification_id uuid,
  status text,
  note_applied boolean
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row public.matrimonial_notification_recipients%rowtype;
  v_doc public.matrimonial_notifications%rowtype;
  v_parish uuid;
  v_diocese uuid;
  v_note text;
  v_locator jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select up.parish_id,up.diocese_id
    into v_parish,v_diocese
  from public.user_profiles up
  where up.auth_user_id=auth.uid()
    and lower(coalesce(up.role,''))='parish'
    and coalesce(up.is_active,true)=true
    and upper(coalesce(up.status,'ACTIVE'))='ACTIVE'
  limit 1;

  if v_parish is null then
    raise exception 'Cuenta parroquial activa requerida';
  end if;  select * into v_row
  from public.matrimonial_notification_recipients
  where id=p_recipient_id
  for update;

  if not found then
    raise exception 'Notificación sacramental no encontrada';
  end if;

  if v_row.receiver_parish_id is distinct from v_parish then
    raise exception 'La notificación no pertenece a esta parroquia';
  end if;

  if lower(coalesce(v_row.status,'pending'))='processed' then
    return query select v_row.id,v_row.notification_id,'processed'::text,v_row.note_applied;
    return;
  end if;

  if lower(coalesce(v_row.status,'pending'))='cancelled' then
    raise exception 'La notificación está cancelada';
  end if;

  if v_row.target_baptism_id is not null then
    raise exception 'La notificación ya está vinculada digitalmente; utilice la aceptación normal';
  end if;

  select * into v_doc
  from public.matrimonial_notifications
  where id=v_row.notification_id;

  if not found then
    raise exception 'Documento matrimonial asociado no encontrado';
  end if;

  if lower(coalesce(v_doc.notification_type,'matrimonio'))<>'matrimonio' then
    raise exception 'La certificación física sólo aplica a notificaciones matrimoniales manuales';
  end if;  v_note:=nullif(v_row.payload->>'marginalNote','');
  v_locator:=coalesce(v_row.payload->'manualLocator','{}'::jsonb);

  if v_note is null then
    raise exception 'La notificación no contiene nota marginal';
  end if;

  if nullif(trim(v_locator->>'book'),'') is null
     or nullif(trim(v_locator->>'folio'),'') is null
     or nullif(trim(v_locator->>'number'),'') is null then
    raise exception 'Libro/Folio/Número de Bautismo incompletos';
  end if;

  update public.matrimonial_notification_recipients
  set status='processed',
      note_applied=true,
      processed_by=auth.uid(),
      processed_at=now(),
      read_at=coalesce(read_at,now()),
      read_by=coalesce(read_by,auth.uid()),
      payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object(
        'physicalNoteCertified',true,
        'physicalCertifiedAt',now(),
        'physicalCertifiedBy',auth.uid(),
        'acceptanceMode','physical_book'
      ),
      updated_at=now()
  where id=v_row.id
  returning * into v_row;  if not exists(
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
    auth.uid(),v_parish,v_diocese,
    'matrimonial_notification_recipient',v_row.id,
    'process_physical_book',
    jsonb_build_object(
      'status','processed',
      'note_applied',true,
      'physical_note_certified',true,
      'manual_locator',v_locator
    ),
    jsonb_build_object(
      'notification_id',v_row.notification_id,
      'document_number',v_doc.document_number,
      'notification_type',v_doc.notification_type
    )
  );

  return query
  select v_row.id,v_row.notification_id,'processed'::text,true;
end;
$$;

revoke all on function public.resolve_manual_matrimonial_notification_recipient(uuid,uuid)
from public,anon;
grant execute on function public.resolve_manual_matrimonial_notification_recipient(uuid,uuid)
to authenticated,service_role;

revoke all on function public.process_manual_matrimonial_notification_physical(uuid)
from public,anon;
grant execute on function public.process_manual_matrimonial_notification_physical(uuid)
to authenticated,service_role;

commit;