select jsonb_build_object(
  'bishop_tenures_table', to_regclass('public.bishop_tenures') is not null,
  'priest_function', to_regprocedure('public.sacramentum_priest_at_date(uuid,date)') is not null,
  'bishop_function', to_regprocedure('public.sacramentum_bishop_at_date(uuid,date)') is not null,
  'priest_recalc_function', to_regprocedure('public.sacramentum_recalculate_current_priest(uuid)') is not null,
  'materializer_function', to_regprocedure('public.materialize_auxiliary_catalog_batch(uuid)') is not null,
  'bishop_overlap_trigger', exists(
    select 1 from pg_trigger
    where tgname='trg_validate_bishop_tenure' and not tgisinternal
  ),
  'parrocos_operativos', (
    select count(*) from public.parrocos
    where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
  ),
  'ciudades_operativas', (
    select count(*) from public.ciudades
    where context_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
  ),
  'parroco_actual', public.sacramentum_priest_at_date(
    'ada2c810-c6eb-4b75-8e3c-4941e3022687',current_date
  )->>'nombreCompleto',
  'parroco_2014', public.sacramentum_priest_at_date(
    'ada2c810-c6eb-4b75-8e3c-4941e3022687','2014-05-16'::date
  )->>'nombreCompleto'
) as postflight;