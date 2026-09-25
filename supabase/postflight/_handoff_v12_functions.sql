select
 to_regprocedure('public.sacramentum_priest_at_date(uuid,date)') is not null as priest_at_date,
 to_regprocedure('public.sacramentum_bishop_at_date(uuid,date)') is not null as bishop_at_date,
 to_regprocedure('public.sacramentum_recalculate_current_priest(uuid)') is not null as recalc_priest,
 to_regprocedure('public.materialize_auxiliary_catalog_batch(uuid)') is not null as materialize_aux;