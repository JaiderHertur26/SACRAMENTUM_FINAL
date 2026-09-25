select jsonb_pretty(jsonb_build_object(
  'decrees_total',(select count(*) from public.decretos),
  'active_decrees',(select count(*) from public.decretos where lower(coalesce(status,'active'))='active'),
  'decrees_with_parish',(select count(*) from public.decretos where parish_id is not null),
  'decrees_without_notification',(
    select count(*) from public.decretos d
    where d.parish_id is not null
      and lower(coalesce(d.status,'active'))='active'
      and not exists (
        select 1 from public.official_notifications n
        where n.decree_id=d.id
          and n.receiver_parish_id=d.parish_id
          and n.category='decree'
      )
  )
)) as summary;

select id,created_at,tipo,sacrament_type,decree_number,decree_date,parish_id,diocese_id,chancery_id,status
from public.decretos
where parish_id is not null
order by created_at desc
limit 30;