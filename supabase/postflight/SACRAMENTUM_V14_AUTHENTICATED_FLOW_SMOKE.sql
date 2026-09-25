begin;

do $$
declare
  v_parish uuid := 'ada2c810-c6eb-4b75-8e3c-4941e3022687';
  v_diocese uuid := '452d50bc-ff3e-448e-9b93-1e97f8d321e2';
  v_chancery uuid := '63998cd4-eb8b-404c-9594-4dc90a930245';
  v_parish_user uuid;
  v_chancery_user uuid;
  v_decree uuid := '20000000-0000-4000-8000-000000000001';
  v_official uuid;
  v_doc uuid := '20000000-0000-4000-8000-000000000002';
  v_recipient uuid := '20000000-0000-4000-8000-000000000003';
  v_seq bigint;
  v_read_at timestamptz;
  v_status text;
  v_receipt text;
  v_sender_read timestamptz;
begin
  select up.auth_user_id
    into v_parish_user
  from public.user_profiles up
  where up.parish_id=v_parish
    and lower(coalesce(up.role,''))='parish'
    and coalesce(up.is_active,true)=true
    and up.auth_user_id is not null
  order by up.created_at
  limit 1;

  select up.auth_user_id
    into v_chancery_user
  from public.user_profiles up
  where up.diocese_id=v_diocese
    and lower(coalesce(up.role,''))='chancery'
    and coalesce(up.is_active,true)=true
    and up.auth_user_id is not null
  order by up.created_at
  limit 1;

  if v_parish_user is null then
    raise exception 'SMOKE autenticado V14: no existe usuario parroquial activo';
  end if;
  if v_chancery_user is null then
    raise exception 'SMOKE autenticado V14: no existe usuario de Cancillería activo';
  end if;

  -- Emisión: identidad real de Cancillería.
  perform set_config('request.jwt.claim.sub',v_chancery_user::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  insert into public.decretos(
    id,parish_id,diocese_id,chancery_id,tipo,sacrament_type,
    decree_number,decree_date,status,payload
  ) values(
    v_decree,v_parish,v_diocese,v_chancery,
    'correccion','bautismo','SMOKE-AUTH-V14',current_date,'active',
    jsonb_build_object('smokeAuthV14',true,'sacramento','bautismo')
  );

  set constraints trg_decree_official_notification_guarantee immediate;

  -- Recepción: identidad real de Parroquia.
  perform set_config('request.jwt.claim.sub',v_parish_user::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  select n.id into v_official
  from public.official_notifications n
  where n.decree_id=v_decree
    and n.receiver_parish_id=v_parish;

  if v_official is null then
    raise exception 'SMOKE autenticado V14: no se generó notificación de Cancillería';
  end if;

  perform public.mark_official_notification_read(v_official);

  select read_at into v_read_at
  from public.official_notifications
  where id=v_official;

  if v_read_at is null then
    raise exception 'SMOKE autenticado V14: la notificación de Cancillería no quedó leída';
  end if;

  select coalesce(max(consecutive),0)+2000000
    into v_seq
  from public.matrimonial_notifications
  where sender_parish_id=v_parish;

  insert into public.matrimonial_notifications(
    id,sender_parish_id,diocese_id,consecutive,document_number,
    person_name,spouse_name,status,notification_type,payload
  ) values(
    v_doc,v_parish,v_diocese,v_seq,
    'SMOKE-AUTH-NM-V14','BAUTIZADO SMOKE AUTENTICADO',
    'CONYUGE SMOKE AUTENTICADO','sent','matrimonio',
    jsonb_build_object('smokeAuthV14',true,'senderParishName','PARROQUIA EMISORA SMOKE')
  );

  insert into public.matrimonial_notification_recipients(
    id,notification_id,receiver_parish_id,status,note_applied,payload
  ) values(
    v_recipient,v_doc,v_parish,'pending',false,
    jsonb_build_object(
      'smokeAuthV14',true,
      'partyRole','principal',
      'receiverParishName','PARROQUIA RECEPTORA SMOKE',
      'marginalNote','NOTA MARGINAL DE PRUEBA V14',
      'manualLocator',jsonb_build_object('book','9999','folio','9999','number','9999')
    )
  );

  perform public.mark_sacramental_notification_read(v_recipient);

  select read_at into v_read_at
  from public.matrimonial_notification_recipients
  where id=v_recipient;

  if v_read_at is null then
    raise exception 'SMOKE autenticado V14: notificación sacramental no quedó leída';
  end if;

  perform public.process_matrimonial_notification_recipient(v_recipient);

  select status,receipt_document_number
    into v_status,v_receipt
  from public.matrimonial_notification_recipients
  where id=v_recipient;

  if lower(coalesce(v_status,'')) <> 'processed' then
    raise exception 'SMOKE autenticado V14: aceptación no procesó la notificación: %',v_status;
  end if;

  if v_receipt is null or v_receipt !~ '^RNS-[0-9]{4}-[0-9]{6}$' then
    raise exception 'SMOKE autenticado V14: no se generó acuse válido: %',coalesce(v_receipt,'NULL');
  end if;

  perform public.mark_sacramental_receipt_read(v_recipient);

  select sender_read_at into v_sender_read
  from public.matrimonial_notification_recipients
  where id=v_recipient;

  if v_sender_read is null then
    raise exception 'SMOKE autenticado V14: el emisor no pudo marcar leído el acuse';
  end if;
end $$;

select jsonb_pretty(jsonb_build_object(
  'chancery_read_ok',exists(
    select 1 from public.official_notifications
    where payload->>'smokeAuthV14'='true' and read_at is not null
  ),
  'sacramental_read_ok',exists(
    select 1 from public.matrimonial_notification_recipients
    where payload->>'smokeAuthV14'='true' and read_at is not null
  ),
  'acceptance_ok',exists(
    select 1 from public.matrimonial_notification_recipients
    where payload->>'smokeAuthV14'='true' and lower(status)='processed'
  ),
  'receipt_ok',exists(
    select 1 from public.matrimonial_notification_recipients
    where payload->>'smokeAuthV14'='true'
      and receipt_document_number is not null
      and sender_read_at is not null
  )
)) as authenticated_flow;

rollback;