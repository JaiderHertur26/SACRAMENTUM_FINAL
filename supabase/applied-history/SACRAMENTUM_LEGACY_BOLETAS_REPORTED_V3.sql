-- SACRAMENTUM · LEGACY BOLETAS V3
-- reported=true: boleta reportada, debe buscar partida.
-- reported=false: boleta no sentada, se conserva sin crear partida.
begin;

alter table public.legacy_pre_sacrament_registrations
  drop constraint if exists legacy_pre_sacrament_registrations_reconciliation_status_check;
alter table public.legacy_pre_sacrament_registrations
  add constraint legacy_pre_sacrament_registrations_reconciliation_status_check
  check (reconciliation_status in ('unmatched','matched','ambiguous','review','not_seated'));

update public.legacy_pre_sacrament_registrations
set reconciliation_status='not_seated',
    matched_table=null, matched_record_id=null,
    match_method='legacy_reported_false_not_seated', match_score=0,
    updated_at=now()
where reported=false;
do $$
begin
  if to_regprocedure('public.reconcile_legacy_pre_registrations_v2_internal(text)') is null then
    alter function public.reconcile_legacy_pre_registrations(text)
      rename to reconcile_legacy_pre_registrations_v2_internal;
  end if;
end;
$$;

create or replace function public.reconcile_legacy_pre_registrations(p_profile_key text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb; v_not_seated integer:=0;
begin
  update public.legacy_pre_sacrament_registrations
  set reconciliation_status='not_seated', matched_table=null, matched_record_id=null,
      match_method='legacy_reported_false_not_seated', match_score=0, updated_at=now()
  where reported=false and (p_profile_key is null or profile_key=upper(p_profile_key));
  get diagnostics v_not_seated=row_count;
  v_result:=public.reconcile_legacy_pre_registrations_v2_internal(p_profile_key);
  return coalesce(v_result,'{}'::jsonb) || jsonb_build_object(
    'not_seated',(
      select count(*) from public.legacy_pre_sacrament_registrations
      where reported=false and (p_profile_key is null or profile_key=upper(p_profile_key))
    )
  );
end;
$$;
revoke all on function public.reconcile_legacy_pre_registrations(text) from public;
grant execute on function public.reconcile_legacy_pre_registrations(text) to service_role;

comment on column public.legacy_pre_sacrament_registrations.reported is
'Indicador original del sistema legacy: true = boleta reportada/debería existir partida; false = boleta no sentada. Todas las boletas se conservan.';

commit;
