-- SACRAMENTUM · V14 · SMOKE ACUSE SACRAMENTAL
begin;

do $$
declare
  v_parish uuid := 'ada2c810-c6eb-4b75-8e3c-4941e3022687';
  v_notification uuid := gen_random_uuid();
  v_recipient uuid := gen_random_uuid();
  v_consecutive bigint;
  v_receipt text;
  v_payload jsonb;
begin
  select coalesce(max(consecutive),0)+1000000
    into v_consecutive
  from public.matrimonial_notifications
  where sender_parish_id=v_parish;

  insert into public.matrimonial_notifications(
    id,sender_parish_id,consecutive,document_number,person_name,
    spouse_name,status,notification_type,payload
  ) values(
    v_notification,v_parish,v_consecutive,
    'SMOKE-V14-'||substr(v_notification::text,1,8),
    'BAUTIZADO SMOKE V14','CONYUGE SMOKE V14',
    'sent','matrimonio',jsonb_build_object('smoke',true)
  );

  insert into public.matrimonial_notification_recipients(
    id,notification_id,receiver_parish_id,status,note_applied,payload
  ) values(
    v_recipient,v_notification,v_parish,'pending',false,
    jsonb_build_object(
      'smoke',true,
      'receiverParishName','PARROQUIA SMOKE',
      'manualLocator',jsonb_build_object('book','1','folio','2','number','3')
    )
  );

  update public.matrimonial_notification_recipients
  set status='processed',
      note_applied=true,
      processed_at=now()
  where id=v_recipient;

  select receipt_document_number,receipt_payload
    into v_receipt,v_payload
  from public.matrimonial_notification_recipients
  where id=v_recipient;

  if v_receipt is null or v_receipt !~ '^RNS-[0-9]{4}-[0-9]{6}$' then
    raise exception 'SMOKE V14: acuse inválido: %',coalesce(v_receipt,'NULL');
  end if;

  if v_payload->>'notificationDocumentNumber' is null then
    raise exception 'SMOKE V14: payload de acuse incompleto';
  end if;

  raise notice 'SMOKE V14 OK · receipt=%',v_receipt;
end $$;

select jsonb_pretty(jsonb_build_object(
  'smoke_notifications',(select count(*) from public.matrimonial_notifications where payload->>'smoke'='true'),
  'smoke_recipients',(select count(*) from public.matrimonial_notification_recipients where payload->>'smoke'='true'),
  'receipt_generated',(select count(*) from public.matrimonial_notification_recipients where payload->>'smoke'='true' and receipt_document_number is not null)
)) as smoke_v14_before_rollback;

rollback;
