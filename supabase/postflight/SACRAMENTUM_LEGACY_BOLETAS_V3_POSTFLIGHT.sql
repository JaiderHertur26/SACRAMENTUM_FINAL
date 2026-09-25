do $$
begin
  if to_regprocedure('public.reconcile_legacy_pre_registrations(text)') is null then raise exception 'Falta wrapper conciliación V3'; end if;
  if to_regprocedure('public.reconcile_legacy_pre_registrations_v2_internal(text)') is null then raise exception 'Falta motor interno conciliación'; end if;
  if position('not_seated' in pg_get_constraintdef((select oid from pg_constraint where conname='legacy_pre_sacrament_registrations_reconciliation_status_check'))) = 0 then raise exception 'Constraint no admite not_seated'; end if;
  if pg_get_functiondef('public.reconcile_legacy_pre_registrations_v2_internal(text)'::regprocedure) like '%min(b.id)%' then raise exception 'Persiste min(uuid) en Bautismo'; end if;
  if pg_get_functiondef('public.reconcile_legacy_pre_registrations_v2_internal(text)'::regprocedure) like '%min(c.id)%' then raise exception 'Persiste min(uuid) en Confirmación'; end if;
end;
$$;
select jsonb_build_object(
 'status','OK','pre_rows',count(*),'reported',count(*) filter(where reported),
 'not_seated',count(*) filter(where not reported),
 'profiles',(select jsonb_object_agg(profile_key,requires_parish) from public.legacy_import_profiles where profile_key in ('INSBAUTI','INSCONFI'))
) as legacy_boletas_v3_postflight from public.legacy_pre_sacrament_registrations;
