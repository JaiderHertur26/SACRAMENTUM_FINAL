select jsonb_pretty(jsonb_build_object(
  'legacy_total',(select count(*) from public.confirmations where raw_data->>'source'='legacy_import'),
  'legacy_ministro_missing',(select count(*) from public.confirmations where raw_data->>'source'='legacy_import' and nullif(trim(coalesce(ministro,'')),'') is null),
  'legacy_dafe_numeric',(select count(*) from public.confirmations where raw_data->>'source'='legacy_import' and coalesce(da_fe,'') ~ '^[0-9]+$'),
  'legacy_dafe_resolved',(select count(*) from public.confirmations where raw_data->>'source'='legacy_import' and nullif(trim(coalesce(da_fe,'')),'') is not null and coalesce(da_fe,'') !~ '^[0-9]+$'),
  'codes',(select jsonb_object_agg(code,cnt) from (
    select coalesce(nullif(raw_data->>'dafe',''),da_fe) code,count(*) cnt
    from public.confirmations where raw_data->>'source'='legacy_import'
    group by 1 order by 1
  ) s)
)) as confirmation_legacy_dafe_precheck;
