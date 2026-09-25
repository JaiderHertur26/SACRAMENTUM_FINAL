-- SACRAMENTUM · LEGACY · PROTECCIÓN DE IDENTIDAD EN ENLACES
-- Evita que una coincidencia L/F/N vincule una fila histórica a otra persona.

create or replace function public.sacramentum_guard_legacy_record_link_identity()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  d jsonb;
  v_names text;
  v_last_names text;
  v_date date;
  t_names text;
  t_last_names text;
  t_date date;
begin
  select normalized_data into d
  from public.legacy_import_rows
  where id=new.row_id;

  if d is null then
    raise exception 'No existe la fila de staging asociada al enlace legacy';
  end if;

  v_names:=upper(trim(coalesce(d->>'names','')));
  v_last_names:=upper(trim(coalesce(d->>'last_names','')));
  begin
    v_date:=nullif(d->>'celebration_date','')::date;
  exception when others then
    v_date:=null;
  end;

  if new.target_table='confirmation' then
    select upper(trim(coalesce(c.nombres,''))),
           upper(trim(coalesce(c.apellidos,''))),
           c.celebration_date
      into t_names,t_last_names,t_date
    from public.confirmations c
    where c.id=new.target_id;

    if not found then raise exception 'La Confirmación destino del enlace legacy no existe'; end if;

  elsif new.target_table='baptism' then
    select upper(trim(coalesce(b.nombres,''))),
           upper(trim(coalesce(b.apellidos,''))),
           b.celebration_date
      into t_names,t_last_names,t_date
    from public.baptisms b
    where b.id=new.target_id;

    if not found then raise exception 'El Bautismo destino del enlace legacy no existe'; end if;
  else
    return new;
  end if;

  if v_names<>t_names or v_last_names<>t_last_names or v_date is distinct from t_date then
    raise exception 'COLISIÓN REGISTRAL LEGACY: L/F/N existente pertenece a otra identidad o fecha';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sacramentum_guard_legacy_record_link_identity
  on public.legacy_record_links;
create trigger trg_sacramentum_guard_legacy_record_link_identity
before insert or update on public.legacy_record_links
for each row execute function public.sacramentum_guard_legacy_record_link_identity();

revoke all on function public.sacramentum_guard_legacy_record_link_identity() from public,anon,authenticated;
grant execute on function public.sacramentum_guard_legacy_record_link_identity() to service_role;

select jsonb_pretty(jsonb_build_object(
  'trigger_enabled',exists(
    select 1 from pg_trigger
    where tgrelid='public.legacy_record_links'::regclass
      and tgname='trg_sacramentum_guard_legacy_record_link_identity'
      and tgenabled<>'D'
  )
)) as legacy_link_guard_postcheck;
