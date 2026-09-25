begin;

select set_config(
  'request.jwt.claim.sub',
  (select auth_user_id::text
   from public.user_profiles
   where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
     and lower(role)='parish'
     and coalesce(is_active,true)=true
   limit 1),
  true
);

do $$
declare
  v_pending uuid;
  v_reg text;
  v_book integer;
  v_folio integer;
  v_number integer;
  v_seated uuid;
begin
  select pending_id,numero_registro into v_pending,v_reg
  from public.create_pending_confirmation(
    'ada2c810-c6eb-4b75-8e3c-4941e3022687',
    jsonb_build_object(
      'nombres','PRUEBA CONFIRMACIÓN BOLETA',
      'apellidos','ROLLBACK V10',
      'fechaSacramento',current_date::text,
      'fechaNacimiento',(current_date-interval '10 years')::date::text,
      'sexo','MASCULINO',
      'lugarSacramento','PRUEBA V10'
    )
  );

  select
    greatest(coalesce(nullif(confirmaciones_params->>'ordinarioLibro','')::integer,1),1),
    greatest(coalesce(nullif(confirmaciones_params->>'ordinarioFolio','')::integer,1),1),
    greatest(coalesce(nullif(confirmaciones_params->>'ordinarioNumero','')::integer,1),1)
  into v_book,v_folio,v_number
  from public.parish_parameters
  where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687';
  perform *
  from public.seat_confirmation_records(
    'ada2c810-c6eb-4b75-8e3c-4941e3022687',
    jsonb_build_array(jsonb_build_object(
      'pending_id',v_pending,
      'assigned_book',v_book,
      'assigned_folio',v_folio,
      'assigned_number',v_number
    )),
    v_book,v_folio,v_number
  );

  select (raw_data->>'seated_confirmation_id')::uuid
  into v_seated
  from public.pending_confirmations
  where id=v_pending
    and parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
    and reportado=true
    and status='seated'
    and raw_data->>'boleta_archived'='true';

  if v_seated is null then
    raise exception 'V10 smoke: la boleta de Confirmación desapareció o no quedó vinculada';
  end if;

  if not exists(
    select 1 from public.confirmations
    where id=v_seated
      and parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
      and status='seated'
  ) then
    raise exception 'V10 smoke: la Confirmación permanente vinculada no existe';
  end if;
end;
$$;

rollback;

select
 (select count(*) from public.pending_confirmations
  where raw_data->>'nombres'='PRUEBA CONFIRMACIÓN BOLETA') as smoke_boletas_after_rollback,
 (select count(*) from public.confirmations
  where nombres='PRUEBA CONFIRMACIÓN BOLETA') as smoke_confirmations_after_rollback;
