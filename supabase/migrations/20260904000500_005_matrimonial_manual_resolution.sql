-- SACRAMENTUM - Fase 2.5
-- Resolución automática y transaccional de avisos matrimoniales manuales.
-- Si el aviso trae Libro/Folio/Número y la partida ya está digitalizada en la
-- parroquia receptora, la enlaza y aplica la nota marginal en el mismo acto.

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
  v_resolved_baptism_id uuid;
  v_locator jsonb;
  v_book text;
  v_folio text;
  v_number text;
  v_match_count integer := 0;
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

  -- Aviso manual: intentar resolver automáticamente la partida digital usando
  -- los datos de libro/folio/número conservados en el expediente.
  if v_row.target_baptism_id is null then
    v_locator := coalesce(v_row.payload->'manualLocator', v_doc.payload->'manualBaptismLocator', '{}'::jsonb);
    v_book := nullif(trim(coalesce(v_locator->>'book','')), '');
    v_folio := nullif(trim(coalesce(v_locator->>'folio','')), '');
    v_number := nullif(trim(coalesce(v_locator->>'number','')), '');

    if v_book is not null and v_folio is not null and v_number is not null then
      select count(*), min(b.id)
        into v_match_count,v_resolved_baptism_id
      from public.baptisms b
      where b.parish_id=v_parish
        and (
          trim(coalesce(b.book_number,'')) = v_book
          or ltrim(trim(coalesce(b.book_number,'')),'0') = ltrim(v_book,'0')
        )
        and (
          trim(coalesce(b.folio,'')) = v_folio
          or ltrim(trim(coalesce(b.folio,'')),'0') = ltrim(v_folio,'0')
        )
        and (
          trim(coalesce(b.number,'')) = v_number
          or ltrim(trim(coalesce(b.number,'')),'0') = ltrim(v_number,'0')
        );

      if v_match_count = 1 and v_resolved_baptism_id is not null then
        update public.matrimonial_notification_recipients
        set target_baptism_id=v_resolved_baptism_id,
            payload=coalesce(payload,'{}'::jsonb) || jsonb_build_object(
              'autoResolved',true,
              'autoResolvedAt',now(),
              'autoResolvedBaptismId',v_resolved_baptism_id
            ),
            updated_at=now()
        where id=v_row.id;
        v_row.target_baptism_id := v_resolved_baptism_id;
      elsif v_match_count > 1 then
        raise exception 'Se encontraron varias partidas digitales con el mismo Libro/Folio/Número. Debe depurarse la numeración antes de procesar el aviso.';
      end if;
    end if;
  end if;

  if v_row.target_baptism_id is not null then
    select b.nota_marginal into v_existing_note
    from public.baptisms b
    where b.id=v_row.target_baptism_id and b.parish_id=v_parish
    for update;
    if not found then raise exception 'La partida bautismal destinataria no pertenece a esta parroquia'; end if;

    if not exists (
      select 1 from public.marginal_notes mn
      where mn.sacrament_type='bautismo'
        and mn.sacrament_id=v_row.target_baptism_id
        and mn.source_type='matrimonial_notification'
        and mn.source_id=v_row.notification_id
        and coalesce(mn.status,'active') <> 'reversed'
    ) then
      update public.baptisms
      set nota_marginal=concat_ws(E'\n\n',nullif(v_existing_note,''),v_note),
          raw_data=coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
            'notaMarginal',concat_ws(E'\n\n',nullif(v_existing_note,''),v_note),
            'lastMatrimonialNotificationId',v_row.notification_id
          ), updated_at=now()
      where id=v_row.target_baptism_id;

      insert into public.marginal_notes (
        sacrament_type,note_type,content,parish_id,sacrament_id,note_date,
        source_type,source_id,created_by,status
      ) values (
        'bautismo','matrimonio',v_note,v_parish,v_row.target_baptism_id,current_date,
        'matrimonial_notification',v_row.notification_id,auth.uid(),'active'
      );
    end if;
    v_applied := true;
  end if;

  update public.matrimonial_notification_recipients
  set status='processed',note_applied=v_applied,processed_by=auth.uid(),processed_at=now(),
      read_at=coalesce(read_at,now()),updated_at=now()
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
    jsonb_build_object(
      'notification_id',v_row.notification_id,
      'target_baptism_id',v_row.target_baptism_id,
      'manual_physical_certification',not v_applied,
      'auto_resolved',v_resolved_baptism_id is not null
    )
  );

  return query select v_row.id,v_row.notification_id,'processed'::text,v_applied;
end;
$$;

revoke all on function public.process_matrimonial_notification_recipient(uuid) from public;
grant execute on function public.process_matrimonial_notification_recipient(uuid) to authenticated;
