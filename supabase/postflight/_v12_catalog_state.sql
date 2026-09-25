
select profile_key,
       count(*) as batches,
       count(*) filter(where parish_id is not null) as with_owner,
       max(created_at) as last_batch
from public.legacy_import_batches
group by profile_key
order by profile_key;

select
  (select count(*) from public.legacy_priest_directory) as legacy_priests,
  (select count(*) from public.directory_churches) as directory_churches,
  (select count(*) from public.location_dictionary) as location_dictionary,
  (select count(*) from public.parrocos) as operational_priests,
  (select count(*) from public.iglesias) as operational_churches,
  (select count(*) from public.ciudades) as operational_cities,
  (select count(*) from public.obispos) as operational_bishops,
  (select count(*) from public.bishop_tenures) as bishop_tenures;
