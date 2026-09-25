begin;

select set_config('request.jwt.claim.sub','c389be71-433d-495d-85ae-f863855d2ebe',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

create temporary table v17_state(
  key text primary key,
  value text
) on commit drop;
grant all on v17_state to authenticated;

insert into v17_state(key,value)
select 'batch_id',public.create_legacy_import_batch(
  'NTMAT002_SMOKE.json',
  'NTMAT002',
  'V17-SMOKE-HASH',
  'NTMAT002.json',
  'ada2c810-c6eb-4b75-8e3c-4941e3022687',
  '452d50bc-ff3e-448e-9b93-1e97f8d321e2',
  jsonb_build_object('smokeV17',true)
)::text;

select public.stage_legacy_import_rows(
  (select value::uuid from v17_state where key='batch_id'),
  jsonb_build_array(
    jsonb_build_object(
      'row_number',1,
      'source_key','0001|0001|0001|SMOKE1',
      'target_entity','legacy_marginal_note',
      'original_data',jsonb_build_object(
        'libro','0001','folio','0001','numero','0001',
        'nota','SMOKE V17 · NOTA MATRIMONIAL EXACTA',
        'dafe','0004','actualizad','2019-01-02T03:04:05'
      ),
      'normalized_data',jsonb_build_object(
        'book_number','0001','folio','0001','number','0001',
        'content','SMOKE V17 · NOTA MATRIMONIAL EXACTA',
        'legacy_dafe_code','0004',
        'legacy_updated_at','2019-01-02T03:04:05',
        'classification','otra'
      ),
      'status','valid',
      'issue_codes',jsonb_build_array(),
      'issue_details',jsonb_build_object()
    ),
    jsonb_build_object(
      'row_number',2,
      'source_key','0099|0099|0099|SMOKE2',
      'target_entity','legacy_marginal_note',
      'original_data',jsonb_build_object(
        'libro','0099','folio','0099','numero','0099',
        'nota','SMOKE V17 · NOTA PENDIENTE HASTA PARTIDA',
        'dafe','0005','actualizad',null
      ),
      'normalized_data',jsonb_build_object(
        'book_number','0099','folio','0099','number','0099',
        'content','SMOKE V17 · NOTA PENDIENTE HASTA PARTIDA',
        'legacy_dafe_code','0005',
        'legacy_updated_at','',
        'classification','otra'
      ),
      'status','valid',
      'issue_codes',jsonb_build_array(),
      'issue_details',jsonb_build_object()
    )
  )
);select *
from public.apply_legacy_marginal_note_batch(
  (select value::uuid from v17_state where key='batch_id'),
  100
);

reset role;

do $$
declare
  v_batch uuid;
  v_existing_queue uuid;
  v_pending_queue uuid;
  v_note uuid;
begin
  select value::uuid into v_batch from v17_state where key='batch_id';

  select id,marginal_note_id
    into v_existing_queue,v_note
  from public.legacy_marginal_note_queue
  where batch_id=v_batch
    and book_number='0001'
    and folio='0001'
    and number='0001'
    and status='matched';

  if v_existing_queue is null or v_note is null then
    raise exception 'V17 smoke: nota con matrimonio existente no se enlazó';
  end if;

  if not exists(
    select 1
    from public.marginal_notes mn
    where mn.id=v_note
      and mn.sacrament_type='matrimonio'
      and mn.sacrament_id='c73f8483-fadd-4919-8045-7ef93871ca83'
      and mn.content='SMOKE V17 · NOTA MATRIMONIAL EXACTA'
      and mn.note_date is null
      and mn.source_type='legacy_matrimonial_note'
      and mn.is_locked=true
      and mn.print_policy='internal'
      and mn.print_default=false
      and mn.legacy_source->>'legacy_dafe_code'='0004'
      and mn.legacy_source->>'historical_note_date_unknown'='true'
  ) then
    raise exception 'V17 smoke: nota enlazada perdió texto/metadatos o inventó fecha';
  end if;

  select id into v_pending_queue
  from public.legacy_marginal_note_queue
  where batch_id=v_batch
    and book_number='0099'
    and folio='0099'
    and number='0099'
    and status='pending'
    and marginal_note_id is null;

  if v_pending_queue is null then
    raise exception 'V17 smoke: nota sin partida no quedó pendiente';
  end if;

  insert into v17_state(key,value)
  values('pending_queue',v_pending_queue::text);
end $$;insert into public.marriages(
  parish_id,celebration_date,book_number,folio,number,status,raw_data
) values (
  'ada2c810-c6eb-4b75-8e3c-4941e3022687',
  '2010-01-01'::date,
  '0099','0099','0099','seated',
  jsonb_build_object('smokeV17',true)
)
returning id;

set local role authenticated;

select public.reconcile_legacy_matrimonial_notes(
  'ada2c810-c6eb-4b75-8e3c-4941e3022687'
);

reset role;

do $$
declare
  v_queue uuid;
begin
  select value::uuid into v_queue
  from v17_state
  where key='pending_queue';

  if not exists(
    select 1
    from public.legacy_marginal_note_queue q
    join public.marginal_notes mn on mn.id=q.marginal_note_id
    join public.marriages m on m.id=q.matched_record_id
    where q.id=v_queue
      and q.status='matched'
      and m.book_number='0099'
      and m.folio='0099'
      and m.number='0099'
      and mn.content='SMOKE V17 · NOTA PENDIENTE HASTA PARTIDA'
      and mn.note_date is null
  ) then
    raise exception 'V17 smoke: nota pendiente no se enlazó cuando apareció la partida';
  end if;

  if (
    select count(*)
    from public.marginal_notes
    where source_type='legacy_matrimonial_note'
      and source_id=v_queue
  )<>1 then
    raise exception 'V17 smoke: conciliación no fue idempotente';
  end if;
end $$;

select jsonb_pretty(jsonb_build_object(
  'profile_registered',exists(
    select 1 from public.legacy_import_profiles
    where profile_key='NTMAT002' and active=true
  ),
  'existing_marriage_note_matched',true,
  'text_preserved_verbatim',true,
  'historical_date_not_invented',true,
  'unmatched_note_queued',true,
  'late_marriage_auto_reconciled',true,
  'reconciliation_idempotent',true
)) as v17_smoke;

rollback;