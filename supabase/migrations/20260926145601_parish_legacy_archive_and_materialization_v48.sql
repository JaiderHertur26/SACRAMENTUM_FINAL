create or replace function public.legacy_archive_summary_v43()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_diocese uuid;
  v_parish uuid;
  v_total bigint;
  v_by_profile jsonb;
  v_by_status jsonb;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  v_role := public.current_app_role();
  v_diocese := public.current_app_diocese_id();
  v_parish := public.current_app_parish_id();

  if v_role not in ('admin_general','diocese','chancery','parish') then
    raise exception 'Rol no autorizado para consultar el archivo histórico';
  end if;

  select count(*)
  into v_total
  from public.legacy_archive_records r
  where
    v_role='admin_general'
    or (v_role in ('diocese','chancery') and r.diocese_id=v_diocese)
    or (v_role='parish' and r.parish_id=v_parish);

  select coalesce(jsonb_object_agg(profile_key,cnt),'{}'::jsonb)
  into v_by_profile
  from (
    select coalesce(profile_key,'SIN_PERFIL') profile_key,count(*) cnt
    from public.legacy_archive_records r
    where
      v_role='admin_general'
      or (v_role in ('diocese','chancery') and r.diocese_id=v_diocese)
      or (v_role='parish' and r.parish_id=v_parish)
    group by coalesce(profile_key,'SIN_PERFIL')
    order by count(*) desc
  ) s;

  select coalesce(jsonb_object_agg(status_key,cnt),'{}'::jsonb)
  into v_by_status
  from (
    select coalesce(reconciliation_status,'archived') status_key,count(*) cnt
    from public.legacy_archive_records r
    where
      v_role='admin_general'
      or (v_role in ('diocese','chancery') and r.diocese_id=v_diocese)
      or (v_role='parish' and r.parish_id=v_parish)
    group by coalesce(reconciliation_status,'archived')
  ) s;

  return jsonb_build_object(
    'total',v_total,
    'byProfile',coalesce(v_by_profile,'{}'::jsonb),
    'byStatus',coalesce(v_by_status,'{}'::jsonb)
  );
end;
$$;

revoke all on function public.legacy_archive_summary_v43() from public;
revoke all on function public.legacy_archive_summary_v43() from anon;
grant execute on function public.legacy_archive_summary_v43() to authenticated;

comment on function public.legacy_archive_summary_v43()
is 'Resumen del archivo histórico legacy con alcance por rol; parroquia sólo ve su propio archivo.';
