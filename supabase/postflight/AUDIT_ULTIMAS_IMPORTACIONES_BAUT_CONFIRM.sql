-- Auditoría de las últimas importaciones de Bautismo/Confirmación y boletas legacy
with latest as (
  select b.*, p.name as owner_parish_name
  from public.legacy_import_batches b
  left join public.parishes p on p.id=b.parish_id
  where b.profile_key in ('BAUTIZOS','CONFIRMA','INSBAUTI','INSCONFI')
  order by b.created_at desc
  limit 12
)
select id, profile_key, original_filename, status, row_count, valid_count, review_count,
       imported_count, skipped_count, error_count, owner_parish_name, parish_id, sha256,
       created_at, updated_at, metadata
from latest
order by created_at desc;

select profile_key, reconciliation_status, reported, count(*) as total,
       count(*) filter(where matched_record_id is not null) as linked
from public.legacy_pre_sacrament_registrations
where batch_id in (
  select id from public.legacy_import_batches
  where profile_key in ('INSBAUTI','INSCONFI')
  order by created_at desc limit 4
)
group by profile_key,reconciliation_status,reported
order by profile_key,reconciliation_status,reported;

select profile_key, source_parish_name, count(*) as total
from public.legacy_pre_sacrament_registrations
where batch_id in (
  select id from public.legacy_import_batches
  where profile_key in ('INSBAUTI','INSCONFI')
  order by created_at desc limit 4
)
group by profile_key,source_parish_name
order by profile_key,source_parish_name;
