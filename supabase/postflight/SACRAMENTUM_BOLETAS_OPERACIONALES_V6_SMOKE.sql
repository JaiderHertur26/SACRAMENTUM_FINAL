begin;
select set_config(
  'request.jwt.claim.sub',
  (select auth_user_id::text from public.user_profiles
   where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
     and lower(role)='parish' and coalesce(is_active,true)=true
   limit 1),
  true
);

do $$
declare v_pre uuid;
begin
  select id into v_pre
  from public.legacy_pre_sacrament_registrations
  where profile_key='INSBAUTI'
    and owner_parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
  order by created_at,id limit 1;

  update public.legacy_pre_sacrament_registrations
  set reported=false
  where id=v_pre;

  perform public.reconcile_legacy_pre_registrations('INSBAUTI');

  if not exists(
    select 1 from public.pending_baptisms
    where raw_data->>'legacy_pre_registration_id'=v_pre::text
      and reportado=false and status='pending'
  ) then raise exception 'V6 smoke: reported=false no llegó a pending_baptisms'; end if;
end $$;
do $$
declare v_id uuid; v_reg text;
begin
  select pending_id,numero_registro into v_id,v_reg
  from public.create_pending_baptism(
    'ada2c810-c6eb-4b75-8e3c-4941e3022687',
    jsonb_build_object(
      'nombres','PRUEBA MANUAL ROLLBACK',
      'apellidos','NO PERSISTE',
      'fechaSacramento',current_date::text,
      'fechaNacimiento',(current_date-interval '30 days')::date::text
    )
  );

  if v_id is null or not exists(
    select 1 from public.pending_baptisms
    where id=v_id and parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
      and reportado=false and status='pending'
  ) then raise exception 'Manual smoke: create_pending_baptism no persistió'; end if;
end $$;

rollback;

select
 (select count(*) from public.pending_baptisms
  where raw_data->>'nombres'='PRUEBA MANUAL ROLLBACK') as manual_smoke_after_rollback,
 (select count(*) from public.pending_baptisms
  where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and reportado=false) as real_pending_after_rollback,
 (select count(*) from public.pending_baptisms
  where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and reportado=true) as reported_after_rollback;
