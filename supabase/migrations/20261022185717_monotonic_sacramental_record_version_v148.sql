-- V148: monotonic update version markers for all sacramental records.
-- Does not backfill or mutate existing rows; only real subsequent UPDATE actions.
create or replace function private.bump_sacramental_record_version_v148()
returns trigger language plpgsql security invoker
set search_path to 'pg_catalog', 'pg_temp'
as $function$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  -- version never repeats inside a transaction or in rapid successive updates
  new.updated_at := greatest(
    clock_timestamp(),
    coalesce(old.updated_at, '-infinity'::timestamptz) + interval '1 microsecond'
  );
  return new;
end;
$function$;

drop trigger if exists zz_sacramentum_record_version_v148 on public.baptisms;
create trigger zz_sacramentum_record_version_v148
before update on public.baptisms
for each row execute function private.bump_sacramental_record_version_v148();

drop trigger if exists zz_sacramentum_record_version_v148 on public.confirmations;
create trigger zz_sacramentum_record_version_v148
before update on public.confirmations
for each row execute function private.bump_sacramental_record_version_v148();

drop trigger if exists zz_sacramentum_record_version_v148 on public.marriages;
create trigger zz_sacramentum_record_version_v148
before update on public.marriages
for each row execute function private.bump_sacramental_record_version_v148();

drop trigger if exists zz_sacramentum_record_version_v148 on public.funerals;
create trigger zz_sacramentum_record_version_v148
before update on public.funerals
for each row execute function private.bump_sacramental_record_version_v148();

revoke all on function private.bump_sacramental_record_version_v148() from public,anon,authenticated;
