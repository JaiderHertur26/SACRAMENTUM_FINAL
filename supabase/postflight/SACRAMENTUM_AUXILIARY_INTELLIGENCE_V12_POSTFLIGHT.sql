select
  (select count(*) from public.parrocos where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as priests,
  (select count(*) from public.parrocos where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and upper(coalesce(estado,''))='ACTIVO') as active_priests,
  (select upper(trim(coalesce(nombre,'')||' '||coalesce(apellido,'')))
     from public.parrocos
    where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
    order by fecha_ingreso desc nulls last,created_at desc limit 1) as latest_priest,
  public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687','2010-01-01'::date)->>'nombreCompleto' as priest_2010,
  public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687','2015-01-01'::date)->>'nombreCompleto' as priest_2015,
  public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687','2022-01-01'::date)->>'nombreCompleto' as priest_2022,
  public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687','2026-09-19'::date) is null as historical_2026_unresolved,
  (select count(*) from public.ciudades where context_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as cities,
  (select count(*) from public.iglesias where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as churches,
  (select count(*) from public.obispos where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as bishops_directory,
  (select count(*) from public.bishop_tenures where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as bishop_tenures,
  to_regprocedure('public.materialize_auxiliary_catalog_batch(uuid)') is not null as materializer_ok,
  to_regprocedure('public.materialize_diocesis_catalog_batch(uuid)') is not null as dioceses_materializer_ok,
  to_regprocedure('public.sacramentum_priest_at_date(uuid,date)') is not null as priest_date_rpc_ok,
  to_regprocedure('public.sacramentum_bishop_at_date(uuid,date)') is not null as bishop_date_rpc_ok,
  exists(select 1 from pg_trigger where tgname='trg_validate_bishop_tenure' and not tgisinternal) as bishop_overlap_guard_ok,
  not exists(
    select 1 from public.bishop_tenures a
    join public.bishop_tenures b on a.parish_id=b.parish_id and a.id<b.id
    where daterange(a.start_date,coalesce(a.end_date,'infinity'::date),'[]')
       && daterange(b.start_date,coalesce(b.end_date,'infinity'::date),'[]')
  ) as no_bishop_overlap;