begin;

-- El "Párroco actual" institucional se determina por la fecha de ingreso más reciente,
-- tal como definió el usuario. Las fechas de salida se conservan para consultas históricas.
create or replace function public.sacramentum_recalculate_current_priest(p_parish_id uuid)
returns void
language plpgsql security definer set search_path=public
as $$
declare v_current uuid;
begin
  select p.id into v_current
  from public.parrocos p
  where p.parish_id=p_parish_id
  order by p.fecha_ingreso desc nulls last,p.created_at desc
  limit 1;

  update public.parrocos
  set estado=case when id=v_current then 'ACTIVO' else 'HISTORICO' end
  where parish_id=p_parish_id;
end;
$$;
grant execute on function public.sacramentum_recalculate_current_priest(uuid) to authenticated,service_role;

insert into public.parrocos(
  parish_id,nombre,apellido,fecha_ingreso,fecha_salida,estado,payload,created_at
)
select
  'ada2c810-c6eb-4b75-8e3c-4941e3022687'::uuid,
  upper(lpd.priest_name),
  '',
  lpd.service_start,
  lpd.service_end,
  'HISTORICO',
  jsonb_build_object(
    'legacy_code',lpd.legacy_code,
    'legacy_grade',lpd.legacy_grade,
    'legacy_state',lpd.legacy_state,
    'source','legacy_priest_directory_backfill',
    'source_name',lpd.source_name,
    'source_sha256',lpd.source_sha256
  ),
  now()
from public.legacy_priest_directory lpd
where lpd.source_name='PARROCOS.json'
on conflict (parish_id,(payload->>'legacy_code'))
where nullif(payload->>'legacy_code','') is not null
do update set
  nombre=excluded.nombre,
  fecha_ingreso=excluded.fecha_ingreso,
  fecha_salida=excluded.fecha_salida,
  payload=public.parrocos.payload||excluded.payload;

select public.sacramentum_recalculate_current_priest('ada2c810-c6eb-4b75-8e3c-4941e3022687'::uuid);

commit;

select jsonb_pretty(jsonb_build_object(
  'parrocos_operativos',(select count(*) from public.parrocos where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'),
  'parroco_actual',(select jsonb_build_object('nombre',nombre,'fecha_ingreso',fecha_ingreso,'fecha_salida',fecha_salida,'estado',estado)
                    from public.parrocos
                    where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and estado='ACTIVO'
                    order by fecha_ingreso desc nulls last limit 1)
)) as result;