-- SACRAMENTUM · CONFIRMACIÓN · RESOLUCIÓN DOCUMENTAL DA FE LEGACY
-- CONFIRMA.json conserva el código original; PARROCOS.json resuelve el nombre.
-- El Ministro se conserva exactamente como fue importado.

begin;

update public.legacy_priest_directory
set source_sha256='4b8503d737777c378cf48dc25ed1d803dbb5848b555246b29e67f40cb3ca04f3',
    updated_at=now()
where source_system='legacy_json' and source_name='PARROCOS.json';

do $pre$
declare v_total int; v_unresolved int; v_missing_minister int;
begin
  select count(*) into v_total from public.confirmations
   where raw_data->>'source'='legacy_import'
     and raw_data->>'source_parish_name'='PARROQUIA SANTA TERESITA DEL NIÑO JESUS';
  if v_total<>173 then raise exception 'Da Fe legacy: se esperaban 173 Confirmaciones, existen %',v_total; end if;

  select count(*) into v_missing_minister from public.confirmations
   where raw_data->>'source'='legacy_import'
     and nullif(trim(coalesce(ministro,'')),'') is null;
  if v_missing_minister<>0 then raise exception 'Da Fe legacy: existen % Ministros vacíos',v_missing_minister; end if;
end
$pre$;
with resolved as (
  select c.id,
         coalesce(nullif(c.raw_data->>'dafe',''),nullif(c.da_fe,'')) as legacy_code,
         p.priest_name
  from public.confirmations c
  join public.legacy_priest_directory p
    on p.source_system='legacy_json'
   and p.source_name='PARROCOS.json'
   and p.legacy_code=coalesce(nullif(c.raw_data->>'dafe',''),nullif(c.da_fe,''))
  where c.raw_data->>'source'='legacy_import'
    and c.raw_data->>'source_parish_name'='PARROQUIA SANTA TERESITA DEL NIÑO JESUS'
)
update public.confirmations c
set da_fe=r.priest_name,
    raw_data=coalesce(c.raw_data,'{}'::jsonb) || jsonb_build_object(
      'legacy_dafe_code',r.legacy_code,
      'legacy_dafe_resolved_name',r.priest_name,
      'legacy_dafe_resolution_source','PARROCOS.json',
      'legacy_dafe_resolution_sha256','4b8503d737777c378cf48dc25ed1d803dbb5848b555246b29e67f40cb3ca04f3'
    ),
    updated_at=now()
from resolved r
where c.id=r.id;
do $post$
declare v_resolved int; v_bad int; v_codes int;
begin
  select count(*) into v_resolved from public.confirmations
   where raw_data->>'source'='legacy_import'
     and raw_data->>'legacy_dafe_resolution_source'='PARROCOS.json'
     and nullif(trim(coalesce(da_fe,'')),'') is not null
     and da_fe !~ '^[0-9]+$';
  if v_resolved<>173 then raise exception 'Da Fe legacy: resueltas %, esperadas 173',v_resolved; end if;

  select count(*) into v_bad from public.confirmations c
  join public.legacy_priest_directory p
    on p.source_system='legacy_json' and p.source_name='PARROCOS.json'
   and p.legacy_code=c.raw_data->>'legacy_dafe_code'
  where c.raw_data->>'source'='legacy_import' and c.da_fe is distinct from p.priest_name;
  if v_bad<>0 then raise exception 'Da Fe legacy: % partidas no coinciden con PARROCOS.json',v_bad; end if;

  select count(distinct raw_data->>'legacy_dafe_code') into v_codes
  from public.confirmations where raw_data->>'source'='legacy_import';
  if v_codes<>3 then raise exception 'Da Fe legacy: códigos distintos esperados 3, actuales %',v_codes; end if;
end
$post$;

commit;
select jsonb_pretty(jsonb_build_object(
  'legacy_total',(select count(*) from public.confirmations where raw_data->>'source'='legacy_import'),
  'resolved_dafe',(select count(*) from public.confirmations where raw_data->>'legacy_dafe_resolution_source'='PARROCOS.json'),
  'ministro_missing',(select count(*) from public.confirmations where raw_data->>'source'='legacy_import' and nullif(trim(coalesce(ministro,'')),'') is null),
  'by_code',(select jsonb_object_agg(code,cnt) from (
    select raw_data->>'legacy_dafe_code' code,count(*) cnt
    from public.confirmations where raw_data->>'source'='legacy_import'
    group by 1 order by 1
  ) s)
)) as confirmation_legacy_dafe_postcheck;
