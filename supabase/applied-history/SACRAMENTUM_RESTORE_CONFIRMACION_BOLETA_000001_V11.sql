-- SACRAMENTUM · V11 · RESTAURAR BOLETA MANUAL CONFIRMACIÓN #000001
begin;

do $$
declare
  v_create public.registry_audit_log%rowtype;
  v_seat public.registry_audit_log%rowtype;
  v_raw jsonb;
  v_current_lfn uuid;
begin
  select * into v_create
  from public.registry_audit_log
  where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
    and action='create_pending'
    and entity_type='pending_confirmation'
    and entity_id='571f5358-1a32-4a06-b438-64298c5156a2'
  order by created_at desc
  limit 1;

  select * into v_seat
  from public.registry_audit_log
  where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
    and action='seat'
    and entity_type='confirmation'
    and entity_id='67ca9e4f-5cfe-406b-be70-61c574f9f8ef'
    and metadata->>'pending_id'='571f5358-1a32-4a06-b438-64298c5156a2'
  order by created_at desc
  limit 1;

  if v_create.id is null or v_seat.id is null then
    raise exception 'V11: auditoría insuficiente para restaurar la boleta #000001';
  end if;

  if exists(select 1 from public.pending_confirmations
      where id='571f5358-1a32-4a06-b438-64298c5156a2') then
    raise exception 'V11: la boleta #000001 ya existe';
  end if;

  select id into v_current_lfn
  from public.confirmations
  where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
    and book_number='0001' and folio='0001' and number='0001'
  limit 1;
  v_raw:=coalesce(v_create.after_data,'{}'::jsonb)
    ||jsonb_build_object(
      'Libro','0001',
      'folio','0001',
      'numero','0001',
      'book_number','0001',
      'status','seated',
      'estado','seated',
      'reportado',true,
      'source','current_parish_registration',
      'seated_confirmation_id','67ca9e4f-5cfe-406b-be70-61c574f9f8ef',
      'seated_record_available',false,
      'historical_seat_confirmed',true,
      'seated_book','0001',
      'seated_folio','0001',
      'seated_number','0001',
      'boleta_archived',true,
      'restored_from_audit',true,
      'lfn_now_occupied_by',v_current_lfn
    );

  insert into public.pending_confirmations(
    id,parish_id,status,reportado,hora,raw_data,created_at
  ) values(
    '571f5358-1a32-4a06-b438-64298c5156a2',
    'ada2c810-c6eb-4b75-8e3c-4941e3022687',
    'seated',
    true,
    nullif(v_create.after_data->>'hora','')::time,
    v_raw,
    v_create.created_at
  );

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values(
    v_seat.actor_user_id,
    v_seat.parish_id,
    v_seat.diocese_id,
    'pending_confirmation',
    '571f5358-1a32-4a06-b438-64298c5156a2',
    'restore_seated_boleta',
    v_raw,
    jsonb_build_object(
      'numero_registro','000001',
      'historical_confirmation_id','67ca9e4f-5cfe-406b-be70-61c574f9f8ef',
      'book','0001','folio','0001','number','0001',
      'current_lfn_owner',v_current_lfn,
      'reason','Boleta manual válida restaurada desde auditoría sin duplicar la partida histórica actual'
    )
  );
end;
$$;

commit;
