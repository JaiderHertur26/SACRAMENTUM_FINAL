-- SACRAMENTUM · V15 · SMOKE INTERPARROQUIAL DE NULIDAD
begin;

do $$
declare
  v_origin_parish uuid := 'ada2c810-c6eb-4b75-8e3c-4941e3022687';
  v_temp_parish uuid := '30000000-0000-4000-8000-000000000001';
  v_diocese uuid;
  v_marriage uuid;
  v_baptism uuid;
  v_chancery_user uuid;
  v_parish_user uuid;
  v_original_profile_parish uuid;
  v_before_note text;
  v_after_issue_note text;
  v_after_accept_note text;
  v_decree uuid;
  v_doc uuid;
  v_recipient uuid;
  v_receipt text;
  v_receipt_payload jsonb;
  v_doc_type text;
  v_note_type text;
  v_source_type text;
begin
  select p.diocese_id into v_diocese
  from public.parishes p
  where p.id=v_origin_parish;

  select m.id into v_marriage
  from public.marriages m
  where m.parish_id=v_origin_parish
    and lower(coalesce(m.status,'seated')) not in ('nullified','nulo','anulada','annulled')
  order by m.created_at
  limit 1;

  select b.id,b.nota_marginal into v_baptism,v_before_note
  from public.baptisms b
  where b.parish_id=v_origin_parish
    and coalesce(lower(b.status),'active') not in
      ('anulada','annulled','deleted','reversed','revertida','replaced')
  order by b.created_at
  limit 1;

  select up.auth_user_id into v_chancery_user
  from public.user_profiles up
  where lower(coalesce(up.role,''))='chancery'
    and up.diocese_id=v_diocese
    and coalesce(up.is_active,true)=true
    and up.auth_user_id is not null
  order by up.created_at
  limit 1;

  select up.auth_user_id,up.parish_id
    into v_parish_user,v_original_profile_parish
  from public.user_profiles up
  where lower(coalesce(up.role,''))='parish'
    and up.parish_id=v_origin_parish
    and coalesce(up.is_active,true)=true
    and up.auth_user_id is not null
  order by up.created_at
  limit 1;

  if v_diocese is null or v_marriage is null or v_baptism is null
     or v_chancery_user is null or v_parish_user is null then
    raise exception 'V15 smoke: faltan datos reales mínimos para la prueba';
  end if;

  insert into public.parishes(
    id,name,diocese_id,vicary_id,decanate_id,city
  )
  select
    v_temp_parish,
    'PARROQUIA TEMPORAL V15',
    p.diocese_id,
    p.vicary_id,
    p.decanate_id,
    'SMOKE V15'
  from public.parishes p
  where p.id=v_origin_parish;

  update public.baptisms
  set parish_id=v_temp_parish
  where id=v_baptism;

  perform set_config('request.jwt.claim.sub',v_chancery_user::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  select x.decree_id
    into v_decree
  from public.apply_marriage_nullity(
    v_marriage,
    'SMOKE-NUL-V15',
    current_date,
    'PRUEBA TRANSACCIONAL DE NOTIFICACIÓN SACRAMENTAL INTERPARROQUIAL',
    jsonb_build_object('smokeV15',true),
    array[v_baptism]
  ) x;

  if v_decree is null then
    raise exception 'V15 smoke: no se creó decreto de nulidad';
  end if;

  select b.nota_marginal into v_after_issue_note
  from public.baptisms b
  where b.id=v_baptism;

  if v_after_issue_note is distinct from v_before_note then
    raise exception 'V15 smoke: el Bautismo remoto fue modificado ANTES de la aceptación';
  end if;

  select n.id,n.notification_type
    into v_doc,v_doc_type
  from public.matrimonial_notifications n
  where n.payload->>'decreeId'=v_decree::text
    and n.source_baptism_id=v_baptism
  order by n.created_at desc
  limit 1;

  if v_doc is null or v_doc_type <> 'nulidad_matrimonial' then
    raise exception 'V15 smoke: no se creó documento sacramental de nulidad';
  end if;

  select r.id into v_recipient
  from public.matrimonial_notification_recipients r
  where r.notification_id=v_doc
    and r.receiver_parish_id=v_temp_parish
    and r.target_baptism_id=v_baptism
    and lower(r.status)='pending'
  limit 1;

  if v_recipient is null then
    raise exception 'V15 smoke: no se creó destinatario pendiente para el Bautismo remoto';
  end if;

  -- La misma identidad parroquial se sitúa temporalmente en la parroquia receptora.
  update public.user_profiles
  set parish_id=v_temp_parish
  where auth_user_id=v_parish_user;

  perform set_config('request.jwt.claim.sub',v_parish_user::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  perform public.mark_sacramental_notification_read(v_recipient);
  perform public.process_matrimonial_notification_recipient(v_recipient);

  select b.nota_marginal into v_after_accept_note
  from public.baptisms b
  where b.id=v_baptism;

  if v_after_accept_note is not distinct from v_before_note
     or position('SMOKE-NUL-V15' in coalesce(v_after_accept_note,''))=0 then
    raise exception 'V15 smoke: la aceptación no aplicó la nota de nulidad';
  end if;

  select mn.note_type,mn.source_type
    into v_note_type,v_source_type
  from public.marginal_notes mn
  where mn.sacrament_type='bautismo'
    and mn.sacrament_id=v_baptism
    and mn.source_id=v_doc
  order by mn.created_at desc
  limit 1;

  if v_note_type <> 'nulidad_matrimonial'
     or v_source_type <> 'sacramental_notification' then
    raise exception 'V15 smoke: trazabilidad marginal incorrecta type=%, source=%',
      v_note_type,v_source_type;
  end if;

  select r.receipt_document_number,r.receipt_payload
    into v_receipt,v_receipt_payload
  from public.matrimonial_notification_recipients r
  where r.id=v_recipient;

  if v_receipt is null or v_receipt !~ '^RNS-[0-9]{4}-[0-9]{6}$' then
    raise exception 'V15 smoke: acuse RNS no generado';
  end if;

  if v_receipt_payload->>'decreeNumber' <> 'SMOKE-NUL-V15'
     or nullif(v_receipt_payload->>'decreeDate','') is null then
    raise exception 'V15 smoke: el acuse no conserva decreto/fecha: %',v_receipt_payload;
  end if;

  -- Emisor: vuelve a la parroquia de origen y lee el acuse.
  update public.user_profiles
  set parish_id=v_original_profile_parish
  where auth_user_id=v_parish_user;

  perform public.mark_sacramental_receipt_read(v_recipient);

  if not exists(
    select 1
    from public.matrimonial_notification_recipients
    where id=v_recipient
      and sender_read_at is not null
      and lower(status)='processed'
  ) then
    raise exception 'V15 smoke: el emisor no pudo confirmar lectura del acuse';
  end if;
end $$;

select jsonb_pretty(jsonb_build_object(
  'remote_baptism_untouched_before_accept',true,
  'nullity_notification_created',exists(
    select 1 from public.matrimonial_notifications
    where notification_type='nulidad_matrimonial'
      and payload->>'decreeNumber'='SMOKE-NUL-V15'
  ),
  'nullity_note_after_accept',exists(
    select 1
    from public.marginal_notes
    where note_type='nulidad_matrimonial'
      and source_type='sacramental_notification'
      and content like '%SMOKE-NUL-V15%'
  ),
  'receipt_created_and_read',exists(
    select 1
    from public.matrimonial_notification_recipients r
    join public.matrimonial_notifications n on n.id=r.notification_id
    where n.notification_type='nulidad_matrimonial'
      and n.payload->>'decreeNumber'='SMOKE-NUL-V15'
      and r.receipt_document_number is not null
      and r.sender_read_at is not null
  )
)) as v15_smoke;

rollback;