begin;

insert into public.decretos(
  id,parish_id,diocese_id,chancery_id,tipo,sacrament_type,
  decree_number,decree_date,status,payload
)
values
(
  '10000000-0000-4000-8000-000000000001',
  'ada2c810-c6eb-4b75-8e3c-4941e3022687',
  '452d50bc-ff3e-448e-9b93-1e97f8d321e2',
  '63998cd4-eb8b-404c-9594-4dc90a930245',
  'correccion','bautismo','SMOKE-BAU-V14B',current_date,'active',
  jsonb_build_object('smokeV14B',true,'sacramento','bautismo')
),
(
  '10000000-0000-4000-8000-000000000002',
  'ada2c810-c6eb-4b75-8e3c-4941e3022687',
  '452d50bc-ff3e-448e-9b93-1e97f8d321e2',
  '63998cd4-eb8b-404c-9594-4dc90a930245',
  'reposicion','confirmacion','SMOKE-CON-V14B',current_date,'active',
  jsonb_build_object('smokeV14B',true,'sacramento','confirmacion')
),
(
  '10000000-0000-4000-8000-000000000003',
  'ada2c810-c6eb-4b75-8e3c-4941e3022687',
  '452d50bc-ff3e-448e-9b93-1e97f8d321e2',
  '63998cd4-eb8b-404c-9594-4dc90a930245',
  'correccion','exequias','SMOKE-EXE-V14B',current_date,'active',
  jsonb_build_object('smokeV14B',true,'sacramento','exequias')
),
(
  '10000000-0000-4000-8000-000000000004',
  'ada2c810-c6eb-4b75-8e3c-4941e3022687',
  '452d50bc-ff3e-448e-9b93-1e97f8d321e2',
  '63998cd4-eb8b-404c-9594-4dc90a930245',
  'nulidad','matrimonio','SMOKE-MAT-V14B',current_date,'active',
  jsonb_build_object('smokeV14B',true,'sacramento','matrimonio')
);

set constraints trg_decree_official_notification_guarantee immediate;

do $$
declare
  v_count integer;
  v_distinct integer;
begin
  select count(*),count(distinct decree_id)
  into v_count,v_distinct
  from public.official_notifications
  where payload->>'smokeV14B'='true';

  if v_count <> 4 or v_distinct <> 4 then
    raise exception 'SMOKE V14B falló: count=%, distinct=%',v_count,v_distinct;
  end if;

  if exists(
    select 1
    from public.official_notifications
    where payload->>'smokeV14B'='true'
      and (
        status <> 'pending'
        or decree_id is null
        or receiver_parish_id <> 'ada2c810-c6eb-4b75-8e3c-4941e3022687'
      )
  ) then
    raise exception 'SMOKE V14B encontró notificación mal vinculada';
  end if;
end $$;

select decree_id,subject,status,payload->>'sacramentType' as sacrament_type,payload->>'decreeType' as decree_type
from public.official_notifications
where payload->>'smokeV14B'='true'
order by subject;

rollback;