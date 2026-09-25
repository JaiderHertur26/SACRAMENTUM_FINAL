select 'legacy_pre' as table_name,column_name,data_type
from information_schema.columns
where table_schema='public' and table_name='legacy_pre_sacrament_registrations'
union all
select 'pending_baptisms',column_name,data_type
from information_schema.columns
where table_schema='public' and table_name='pending_baptisms'
order by table_name,column_name;

select p.id,p.name,
       (select count(*) from public.pending_baptisms pb where pb.parish_id=p.id) as pending_total,
       (select count(*) from public.pending_baptisms pb where pb.parish_id=p.id and coalesce(pb.reportado,false)=false) as pending_not_reported,
       (select count(*) from public.pending_baptisms pb where pb.parish_id=p.id and coalesce(pb.reportado,false)=true) as pending_reported,
       (select count(*) from public.baptisms b where b.parish_id=p.id) as baptisms_total
from public.parishes p
where upper(p.name) like '%MARIA AUXILIO DE LOS CRISTIANOS%';