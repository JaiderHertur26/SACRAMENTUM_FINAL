begin;

create temporary table v16c_state(
  key text primary key,
  value text
) on commit drop;
grant all on v16c_state to authenticated;

insert into public.parishes(id,name,diocese_id,vicary_id,decanate_id,city)
select
  '40000000-0000-4000-8000-000000000026'::uuid,
  'PARROQUIA TEMPORAL MANUAL V16C',
  p.diocese_id,p.vicary_id,p.decanate_id,'SMOKE V16C'
from public.parishes p
where p.id='ada2c810-c6eb-4b75-8e3c-4941e3022687';

insert into v16c_state(key,value)
select 'book',b.book_number from public.baptisms b
where b.id='bd482f25-33d4-4c79-9fc9-e464b32f8867';
insert into v16c_state(key,value)
select 'folio',b.folio from public.baptisms b
where b.id='bd482f25-33d4-4c79-9fc9-e464b32f8867';
insert into v16c_state(key,value)
select 'number',b.number from public.baptisms b
where b.id='bd482f25-33d4-4c79-9fc9-e464b32f8867';
insert into v16c_state(key,value)
select 'before_note',coalesce(b.nota_marginal,'') from public.baptisms b
where b.id='bd482f25-33d4-4c79-9fc9-e464b32f8867';

update public.baptisms
set parish_id='40000000-0000-4000-8000-000000000026'
where id='bd482f25-33d4-4c79-9fc9-e464b32f8867';select set_config('request.jwt.claim.sub','6eebfea0-5280-4d96-bc38-e9f0021fbb25',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

insert into v16c_state(key,value)
select 'digital_doc',x.notification_id::text
from public.issue_matrimonial_notification(
  null,null,
  '40000000-0000-4000-8000-000000000026',
  jsonb_build_object(
    'book',(select value from v16c_state where key='book'),
    'folio',(select value from v16c_state where key='folio'),
    'number',(select value from v16c_state where key='number')
  ),
  '2026-09-06'::date,
  '0101','0101','0101',
  '452d50bc-ff3e-448e-9b93-1e97f8d321e2',
  'ada2c810-c6eb-4b75-8e3c-4941e3022687',
  null,
  'BAUTIZADO MANUAL DIGITAL V16C',
  'CÓNYUGE V16C',
  'SMOKE V16C · NOTA DIGITAL RESUELTA',
  null,
  jsonb_build_object('smokeV16C','digital')
) x;

insert into v16c_state(key,value)
select 'physical_doc',x.notification_id::text
from public.issue_matrimonial_notification(
  null,null,
  '40000000-0000-4000-8000-000000000026',
  jsonb_build_object('book','0999','folio','0888','number','0777'),
  '2026-09-05'::date,
  '0102','0102','0102',
  '452d50bc-ff3e-448e-9b93-1e97f8d321e2',
  'ada2c810-c6eb-4b75-8e3c-4941e3022687',
  null,
  'BAUTIZADO FÍSICO V16C',
  'CÓNYUGE FÍSICO V16C',
  'SMOKE V16C · NOTA FÍSICA CERTIFICADA',
  null,
  jsonb_build_object('smokeV16C','physical')
) x;

reset role;update public.user_profiles
set parish_id='40000000-0000-4000-8000-000000000026'
where auth_user_id='6eebfea0-5280-4d96-bc38-e9f0021fbb25';

set local role authenticated;

insert into v16c_state(key,value)
select 'digital_recipient',r.id::text
from public.matrimonial_notification_recipients r
where r.notification_id=(select value::uuid from v16c_state where key='digital_doc');

insert into v16c_state(key,value)
select 'physical_recipient',r.id::text
from public.matrimonial_notification_recipients r
where r.notification_id=(select value::uuid from v16c_state where key='physical_doc');

select public.mark_sacramental_notification_read(
  (select value::uuid from v16c_state where key='digital_recipient')
);

select public.resolve_manual_matrimonial_notification_recipient(
  (select value::uuid from v16c_state where key='digital_recipient'),
  'bd482f25-33d4-4c79-9fc9-e464b32f8867'
);

select * from public.process_matrimonial_notification_recipient(
  (select value::uuid from v16c_state where key='digital_recipient')
);

select public.mark_sacramental_notification_read(
  (select value::uuid from v16c_state where key='physical_recipient')
);do $$
declare v_blocked boolean:=false;
begin
  begin
    perform *
    from public.process_matrimonial_notification_recipient(
      (select value::uuid from v16c_state where key='physical_recipient')
    );
  exception when others then
    v_blocked:=position('debe vincular una partida digital o certificar el asiento físico' in lower(sqlerrm))>0;
  end;
  if not v_blocked then
    raise exception 'V16C smoke: proceso estándar aceptó manual sin evidencia';
  end if;
end $$;

select * from public.process_manual_matrimonial_notification_physical(
  (select value::uuid from v16c_state where key='physical_recipient')
);

reset role;

do $$
declare
  v_before text;
  v_after text;
  v_digital_recipient uuid;
  v_physical_recipient uuid;
begin
  select value into v_before from v16c_state where key='before_note';
  select nota_marginal into v_after
  from public.baptisms
  where id='bd482f25-33d4-4c79-9fc9-e464b32f8867';

  if position('SMOKE V16C · NOTA DIGITAL RESUELTA' in coalesce(v_after,''))=0 then
    raise exception 'V16C smoke: vinculación digital no aplicó nota';
  end if;

  select value::uuid into v_digital_recipient from v16c_state where key='digital_recipient';
  select value::uuid into v_physical_recipient from v16c_state where key='physical_recipient';

  if not exists(
    select 1 from public.matrimonial_notification_recipients
    where id=v_digital_recipient
      and target_baptism_id='bd482f25-33d4-4c79-9fc9-e464b32f8867'
      and lower(status)='processed'
      and note_applied=true
      and receipt_document_number is not null
      and payload->>'acceptanceMode'='digital_link'
  ) then
    raise exception 'V16C smoke: expediente digital resuelto incompleto';
  end if;

  if not exists(
    select 1 from public.matrimonial_notification_recipients
    where id=v_physical_recipient
      and target_baptism_id is null
      and lower(status)='processed'
      and note_applied=true
      and receipt_document_number is not null
      and payload->>'physicalNoteCertified'='true'
      and payload->>'acceptanceMode'='physical_book'
  ) then
    raise exception 'V16C smoke: certificación física incompleta';
  end if;  if (
    select count(*) from public.registry_audit_log
    where entity_id=v_digital_recipient
      and action='resolve_manual_baptism'
  )<>1 then
    raise exception 'V16C smoke: resolución digital no auditada';
  end if;

  if (
    select count(*) from public.registry_audit_log
    where entity_id=v_physical_recipient
      and action='process_physical_book'
  )<>1 then
    raise exception 'V16C smoke: certificación física no auditada';
  end if;
end $$;

select jsonb_pretty(jsonb_build_object(
  'digital_manual_resolved',true,
  'digital_note_applied',true,
  'digital_receipt_created',true,
  'physical_standard_blocked',true,
  'physical_certified',true,
  'physical_receipt_created',true,
  'resolution_audited',true,
  'physical_acceptance_audited',true
)) as v16c_smoke;

rollback;
