-- SACRAMENTUM · V16 · SMOKE E2E MATRIMONIAL
begin;

create temporary table v16_smoke_state(
  key text primary key,
  value text
) on commit drop;
grant all on v16_smoke_state to authenticated;

insert into public.parishes(
  id,name,diocese_id,vicary_id,decanate_id,city
)
select
  '40000000-0000-4000-8000-000000000016'::uuid,
  'PARROQUIA TEMPORAL MATRIMONIAL V16',
  p.diocese_id,p.vicary_id,p.decanate_id,'SMOKE V16'
from public.parishes p
where p.id='ada2c810-c6eb-4b75-8e3c-4941e3022687';

insert into public.parishes(
  id,name,diocese_id,vicary_id,decanate_id,city
)
select
  '40000000-0000-4000-8000-000000000017'::uuid,
  'PARROQUIA TERCERA AISLAMIENTO V16',
  p.diocese_id,p.vicary_id,p.decanate_id,'SMOKE V16'
from public.parishes p
where p.id='ada2c810-c6eb-4b75-8e3c-4941e3022687';

insert into v16_smoke_state(key,value)
select 'remote_before',coalesce(b.nota_marginal,'')
from public.baptisms b
where b.id='bd482f25-33d4-4c79-9fc9-e464b32f8867';

update public.baptisms
set parish_id='40000000-0000-4000-8000-000000000016'
where id='bd482f25-33d4-4c79-9fc9-e464b32f8867';select set_config(
  'request.jwt.claim.sub',
  '6eebfea0-5280-4d96-bc38-e9f0021fbb25',
  true
);
select set_config('request.jwt.claim.role','authenticated',true);

set local role authenticated;

insert into v16_smoke_state(key,value)
select 'notification_id',x.notification_id::text
from public.issue_matrimonial_notification(
  'c4570f19-b42c-425c-aaf8-5ca51f4ab58e',
  'bd482f25-33d4-4c79-9fc9-e464b32f8867',
  null,
  null,
  '2026-09-08'::date,
  '0001','0001','0001',
  '452d50bc-ff3e-448e-9b93-1e97f8d321e2',
  'ada2c810-c6eb-4b75-8e3c-4941e3022687',
  null,null,null,
  'SMOKE V16 · NOTA PRINCIPAL MATRIMONIAL',
  'SMOKE V16 · NOTA CÓNYUGE MATRIMONIAL',
  jsonb_build_object('smokeV16',true)
) x;

do $$
declare v_id uuid;
begin
  select value::uuid into v_id from v16_smoke_state where key='notification_id';
  if (select count(*) from public.matrimonial_notifications where id=v_id)<>1 then
    raise exception 'V16 smoke: RLS no permite al emisor leer su documento';
  end if;  if (select count(*) from public.matrimonial_notification_recipients where notification_id=v_id)<>1 then
    raise exception 'V16 smoke: emisor no puede leer destinatario remoto o cantidad inesperada';
  end if;
  if not exists(
    select 1 from public.matrimonial_notifications
    where id=v_id
      and marriage_id='c73f8483-fadd-4919-8045-7ef93871ca83'
      and payload->>'marriageRecordLinked'='true'
      and payload->>'deliveryMode'='mixed'
      and payload->>'mainMarginalNote'='SMOKE V16 · NOTA PRINCIPAL MATRIMONIAL'
      and payload->>'spouseMarginalNote'='SMOKE V16 · NOTA CÓNYUGE MATRIMONIAL'
      and jsonb_typeof(payload->'sourceBaptism')='object'
      and jsonb_typeof(payload->'spouseBaptism')='object'
      and coalesce((payload->>'localNotesApplied')::int,0)=1
      and coalesce((payload->>'recipientsCreated')::int,0)=1
  ) then
    raise exception 'V16 smoke: vínculo matrimonial/snapshot/resumen de entrega incorrecto';
  end if;
end $$;

reset role;

do $$
declare v_before text; v_after text; v_id uuid;
begin
  select value into v_before from v16_smoke_state where key='remote_before';
  select nota_marginal into v_after
  from public.baptisms
  where id='bd482f25-33d4-4c79-9fc9-e464b32f8867';
  if coalesce(v_after,'')<>coalesce(v_before,'') then
    raise exception 'V16 smoke: Bautismo remoto fue modificado antes de aceptar';
  end if;
  select value::uuid into v_id from v16_smoke_state where key='notification_id';
  if not exists(
    select 1 from public.marginal_notes
    where source_type='matrimonial_notification'
      and source_id=v_id
      and sacrament_id='c4570f19-b42c-425c-aaf8-5ca51f4ab58e'
      and content like 'SMOKE V16%'
  ) then
    raise exception 'V16 smoke: nota local no se aplicó en emisión mixta';
  end if;
end $$;update public.user_profiles
set parish_id='40000000-0000-4000-8000-000000000016'
where auth_user_id='6eebfea0-5280-4d96-bc38-e9f0021fbb25';

set local role authenticated;

do $$
declare v_id uuid; v_recipient uuid;
begin
  select value::uuid into v_id from v16_smoke_state where key='notification_id';

  if (select count(*) from public.matrimonial_notifications where id=v_id)<>1 then
    raise exception 'V16 smoke: RLS no permite al receptor leer documento';
  end if;

  select id into v_recipient
  from public.matrimonial_notification_recipients
  where notification_id=v_id
    and receiver_parish_id='40000000-0000-4000-8000-000000000016'
    and target_baptism_id='bd482f25-33d4-4c79-9fc9-e464b32f8867';

  if v_recipient is null then
    raise exception 'V16 smoke: destinatario remoto no visible para receptor';
  end if;

  insert into v16_smoke_state(key,value)
  values('recipient_id',v_recipient::text);

  perform public.mark_sacramental_notification_read(v_recipient);
  perform public.mark_sacramental_notification_read(v_recipient);
  perform public.process_matrimonial_notification_recipient(v_recipient);
end $$;

reset role;

do $$
declare v_recipient uuid;
begin
  select value::uuid into v_recipient from v16_smoke_state where key='recipient_id';
  if (
    select count(*)
    from public.registry_audit_log
    where entity_type='matrimonial_notification_recipient'
      and entity_id=v_recipient
      and action='read_sacramental_notification'
  ) <> 1 then
    raise exception 'V16B smoke: lectura receptora no fue auditada exactamente una vez';
  end if;
end $$;

do $$
declare v_id uuid; v_recipient uuid; v_note text; v_receipt text;
begin
  select value::uuid into v_id from v16_smoke_state where key='notification_id';
  select value::uuid into v_recipient from v16_smoke_state where key='recipient_id';

  select nota_marginal into v_note
  from public.baptisms
  where id='bd482f25-33d4-4c79-9fc9-e464b32f8867';

  if position('SMOKE V16 · NOTA CÓNYUGE MATRIMONIAL' in coalesce(v_note,''))=0 then
    raise exception 'V16 smoke: aceptación no aplicó nota remota';
  end if;

  select receipt_document_number into v_receipt
  from public.matrimonial_notification_recipients
  where id=v_recipient
    and lower(status)='processed'
    and note_applied=true;

  if v_receipt is null or v_receipt !~ '^RNS-[0-9]{4}-[0-9]{6}$' then
    raise exception 'V16 smoke: no se generó acuse RNS';
  end if;

  if not exists(
    select 1 from public.matrimonial_notifications
    where id=v_id and lower(status)='processed'
  ) then
    raise exception 'V16 smoke: expediente no cerró como processed';
  end if;
end $$;

update public.user_profiles
set parish_id='40000000-0000-4000-8000-000000000017'
where auth_user_id='6eebfea0-5280-4d96-bc38-e9f0021fbb25';

set local role authenticated;

do $$
declare v_id uuid; v_recipient uuid;
begin
  select value::uuid into v_id from v16_smoke_state where key='notification_id';
  select value::uuid into v_recipient from v16_smoke_state where key='recipient_id';

  if exists(select 1 from public.matrimonial_notifications where id=v_id) then
    raise exception 'V16 smoke: una tercera parroquia pudo leer el expediente';
  end if;
  if exists(select 1 from public.matrimonial_notification_recipients where id=v_recipient) then
    raise exception 'V16 smoke: una tercera parroquia pudo leer el destinatario';
  end if;
end $$;

reset role;

update public.user_profiles
set parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
where auth_user_id='6eebfea0-5280-4d96-bc38-e9f0021fbb25';

set local role authenticated;

do $$
declare v_origin_blocked boolean:=false;
begin
  begin
    perform *
    from public.issue_matrimonial_notification(
      'c4570f19-b42c-425c-aaf8-5ca51f4ab58e',
      'bd482f25-33d4-4c79-9fc9-e464b32f8867',
      null,null,
      '2026-09-08'::date,
      '0001','0001','0001',
      '452d50bc-ff3e-448e-9b93-1e97f8d321e2',
      '40000000-0000-4000-8000-000000000017',
      null,null,null,
      'SMOKE ORIGEN FALSO A',
      'SMOKE ORIGEN FALSO B',
      jsonb_build_object('smokeV16OriginSpoof',true)
    );
  exception when others then
    v_origin_blocked:=position('parroquia emisora debe ser la parroquia donde consta el matrimonio' in lower(sqlerrm))>0;
  end;

  if not v_origin_blocked then
    raise exception 'V16 smoke: permitió falsificar la parroquia de origen matrimonial';
  end if;
end $$;

do $$
declare v_id uuid; v_recipient uuid; v_blocked boolean:=false;
begin
  select value::uuid into v_id from v16_smoke_state where key='notification_id';
  select value::uuid into v_recipient from v16_smoke_state where key='recipient_id';

  if (select count(*) from public.matrimonial_notification_recipients where id=v_recipient and receipt_document_number is not null)<>1 then
    raise exception 'V16 smoke: emisor no puede leer el acuse vía RLS';
  end if;

  perform public.mark_sacramental_receipt_read(v_recipient);
  perform public.mark_sacramental_receipt_read(v_recipient);

  begin
    perform public.cancel_matrimonial_notification(v_id);
  exception when others then
    v_blocked:=position('no puede cancelarse' in lower(sqlerrm))>0;
  end;

  if not v_blocked then
    raise exception 'V16 smoke: permitió cancelar expediente ya aceptado/con efectos';
  end if;
end $$;

reset role;

do $$
declare v_recipient uuid;
begin
  select value::uuid into v_recipient from v16_smoke_state where key='recipient_id';
  if (
    select count(*)
    from public.registry_audit_log
    where entity_type='matrimonial_notification_recipient'
      and entity_id=v_recipient
      and action='read_sacramental_receipt'
  ) <> 1 then
    raise exception 'V16B smoke: lectura del RNS no fue auditada exactamente una vez';
  end if;
end $$;

set local role authenticated;

do $$
declare v_duplicate_blocked boolean:=false;
begin
  begin
    perform *
    from public.issue_matrimonial_notification(
      'bd482f25-33d4-4c79-9fc9-e464b32f8867',
      'c4570f19-b42c-425c-aaf8-5ca51f4ab58e',
      null,null,
      '2026-09-08'::date,
      '0001','0001','0001',
      '452d50bc-ff3e-448e-9b93-1e97f8d321e2',
      'ada2c810-c6eb-4b75-8e3c-4941e3022687',
      null,null,null,
      'SMOKE DUPLICADO INVERSO A',
      'SMOKE DUPLICADO INVERSO B',
      jsonb_build_object('smokeV16Duplicate',true)
    );
  exception when others then
    v_duplicate_blocked:=
      position('ya existe una notificación activa' in lower(sqlerrm))>0
      or position('duplicate key' in lower(sqlerrm))>0;
  end;

  if not v_duplicate_blocked then
    raise exception 'V16 smoke: no bloqueó duplicado con contrayentes invertidos';
  end if;
end $$;insert into v16_smoke_state(key,value)
select 'manual_notification_id',x.notification_id::text
from public.issue_matrimonial_notification(
  null,null,
  '40000000-0000-4000-8000-000000000016',
  jsonb_build_object('book','0099','folio','0088','number','0077'),
  '2026-09-07'::date,
  '0099','0088','0077',
  '452d50bc-ff3e-448e-9b93-1e97f8d321e2',
  'ada2c810-c6eb-4b75-8e3c-4941e3022687',
  null,
  'BAUTIZADO MANUAL V16',
  'CÓNYUGE MANUAL V16',
  'SMOKE V16 · NOTA MANUAL',
  null,
  jsonb_build_object('smokeV16Manual',true)
) x;

do $$
declare v_manual uuid;
begin
  select value::uuid into v_manual
  from v16_smoke_state
  where key='manual_notification_id';

  if not public.cancel_matrimonial_notification(v_manual) then
    raise exception 'V16 smoke: cancelación previa a aceptación devolvió false';
  end if;

  if not exists(
    select 1
    from public.matrimonial_notifications
    where id=v_manual
      and lower(status)='cancelled'
      and cancelled_at is not null
      and cancelled_by='6eebfea0-5280-4d96-bc38-e9f0021fbb25'
  ) then
    raise exception 'V16 smoke: expediente manual no quedó cancelado/auditado';
  end if;

  if exists(
    select 1
    from public.matrimonial_notification_recipients
    where notification_id=v_manual
      and lower(status)<>'cancelled'
  ) then
    raise exception 'V16 smoke: destinatario manual pendiente no fue cancelado';
  end if;
end $$;

reset role;select jsonb_pretty(jsonb_build_object(
  'rls_sender_visibility',true,
  'rls_receiver_visibility',true,
  'third_party_isolation',true,
  'origin_spoof_blocked',true,
  'snapshot_notes_preserved',exists(
    select 1
    from public.matrimonial_notifications
    where payload->>'smokeV16'='true'
      and payload->>'mainMarginalNote'='SMOKE V16 · NOTA PRINCIPAL MATRIMONIAL'
      and payload->>'spouseMarginalNote'='SMOKE V16 · NOTA CÓNYUGE MATRIMONIAL'
  ),
  'marriage_linked',exists(
    select 1
    from public.matrimonial_notifications
    where payload->>'smokeV16'='true'
      and marriage_id='c73f8483-fadd-4919-8045-7ef93871ca83'
  ),
  'mixed_delivery',exists(
    select 1
    from public.matrimonial_notifications
    where payload->>'smokeV16'='true'
      and payload->>'deliveryMode'='mixed'
  ),
  'remote_untouched_before_accept',true,
  'remote_note_after_accept',exists(
    select 1
    from public.marginal_notes
    where source_type='matrimonial_notification'
      and content='SMOKE V16 · NOTA CÓNYUGE MATRIMONIAL'
  ),
  'receipt_created',exists(
    select 1
    from public.matrimonial_notification_recipients r
    join public.matrimonial_notifications n on n.id=r.notification_id
    where n.payload->>'smokeV16'='true'
      and r.receipt_document_number is not null
      and r.sender_read_at is not null
  ),
  'reverse_duplicate_blocked',not exists(
    select 1
    from public.matrimonial_notifications
    where payload->>'smokeV16Duplicate'='true'
  ),
  'accepted_cancellation_blocked',exists(
    select 1
    from public.matrimonial_notifications
    where payload->>'smokeV16'='true'
      and lower(status)='processed'
  ),
  'pending_manual_cancelled',exists(
    select 1
    from public.matrimonial_notifications
    where payload->>'smokeV16Manual'='true'
      and lower(status)='cancelled'
  )
)) as v16_smoke;

rollback;