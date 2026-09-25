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
  v_seated_id uuid;
begin
  select pending_id,numero_registro into v_pending,v_reg
  from public.create_pending_baptism(
    'ada2c810-c6eb-4b75-8e3c-4941e3022687',
    jsonb_build_object(
      'nombres','PRUEBA BOLETA PERMANENTE',
      'apellidos','ROLLBACK V8',
      'fechaSacramento',current_date::text,
      'fechaNacimiento',(current_date-interval '30 days')::date::text,
      'lugarBautismo','PRUEBA V8'
    )
  );

  select
    greatest(coalesce(nullif(bautizos_params->>'ordinarioLibro','')::integer,1),1),
    greatest(coalesce(nullif(bautizos_params->>'ordinarioFolio','')::integer,1),1),
    greatest(coalesce(nullif(bautizos_params->>'ordinarioNumero','')::integer,1),1)
  into v_book,v_folio,v_number
  from public.parish_parameters
  where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687';
  perform *
  from public.seat_baptism_records(
    'ada2c810-c6eb-4b75-8e3c-4941e3022687',
    jsonb_build_array(jsonb_build_object(
      'pending_id',v_pending,
      'assigned_book',v_book,
      'assigned_folio',v_folio,
      'assigned_number',v_number
    )),
    v_book,v_folio,v_number
  );

  select (raw_data->>'seated_baptism_id')::uuid
  into v_seated_id
  from public.pending_baptisms
  where id=v_pending
    and parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
    and reportado=true
    and status='seated';

  if v_seated_id is null then
    raise exception 'V8 smoke: la boleta desapareció o no quedó vinculada después del asiento';
  end if;

  if not exists(
    select 1 from public.baptisms
    where id=v_seated_id
      and parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
      and status='seated'
  ) then
    raise exception 'V8 smoke: la partida permanente vinculada no existe';
  end if;
end;
$$;

rollback;

select
  (select count(*) from public.pending_baptisms
   where raw_data->>'nombres'='PRUEBA BOLETA PERMANENTE') as smoke_boletas_after_rollback,
  (select count(*) from public.baptisms
   where nombres='PRUEBA BOLETA PERMANENTE') as smoke_baptisms_after_rollback;
