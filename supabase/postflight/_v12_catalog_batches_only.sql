
select profile_key,
       count(*) as batches,
       count(*) filter(where parish_id is not null) as with_owner,
       max(created_at) as last_batch
from public.legacy_import_batches
where profile_key in ('PARROCOS','IGLESIAS','CIUDADES','OBISPOS','DIOCESIS')
group by profile_key
order by profile_key;
