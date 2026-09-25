-- SACRAMENTUM · POST-FLIGHT FASE 4 TERRITORIAL · 2026-09-05
-- Todos los checks estructurales deben devolver OK/0. Las parroquias legacy sin
-- clasificación pueden aparecer en legacy_parishes_to_classify hasta ser corregidas.

select 'pending_tokens_insert_owner' as check_name,
       case when exists(
         select 1 from pg_policies where schemaname='public' and tablename='pending_tokens' and policyname='pending_tokens_insert_owner'
       ) then 'OK' else 'MISSING' end as status;

select tablename,policyname,cmd,
       case when (coalesce(qual,'') || ' ' || coalesce(with_check,'')) ilike '%is_app_admin%'
            then 'CHECK_ADMIN_WRITE' else 'OK' end as status
from pg_policies
where schemaname='public'
  and (tablename,policyname) in (
    ('vicarias','vicarias_insert_diocese'),('vicarias','vicarias_update_diocese'),('vicarias','vicarias_delete_diocese'),
    ('decanatos','decanatos_insert_diocese'),('decanatos','decanatos_update_diocese'),('decanatos','decanatos_delete_diocese'),
    ('parishes','parishes_update_diocese'),('parishes','parishes_delete_diocese'),
    ('chancelleries','chancelleries_update_diocese'),('chancelleries','chancelleries_delete_diocese')
  )
order by tablename,policyname;


select 'browser_insert_parish_chancery_blocked' as check_name,
       case when not exists(
         select 1 from pg_policies
         where schemaname='public'
           and ((tablename='parishes' and cmd='INSERT') or (tablename='chancelleries' and cmd='INSERT'))
       ) then 'OK' else 'CHECK' end as status;

select 'territorial_triggers' as check_name,
       count(*) as installed,
       case when count(*)=5 then 'OK' else 'CHECK' end as status
from pg_trigger
where not tgisinternal
  and tgname in (
    'trg_enforce_decanato_hierarchy',
    'trg_enforce_parish_hierarchy',
    'trg_protect_vicaria_delete',
    'trg_protect_decanato_delete',
    'trg_protect_parish_identity_delete'
  );

select 'chancery_identity_trigger' as check_name,
       case when exists(select 1 from pg_trigger where not tgisinternal and tgname='trg_protect_chancery_identity_delete') then 'OK' else 'MISSING' end as status;

select 'unique_chancery_per_diocese' as check_name,
       case when to_regclass('public.uq_chancelleries_one_per_diocese') is not null then 'OK' else 'MISSING' end as status;

select 'invalid_deaneries' as check_name,count(*) as invalid_count
from public.decanatos d
left join public.vicarias v on v.id=d.vicaria_id
where d.vicaria_id is null or v.id is null or v.diocese_id is distinct from d.diocese_id;

select 'invalid_classified_parishes' as check_name,count(*) as invalid_count
from public.parishes p
join public.vicarias v on v.id=p.vicary_id
join public.decanatos d on d.id=p.decanate_id
where v.diocese_id is distinct from p.diocese_id
   or d.diocese_id is distinct from p.diocese_id
   or d.vicaria_id is distinct from p.vicary_id;

select 'legacy_parishes_to_classify' as check_name,count(*) as pending_count
from public.parishes
where vicary_id is null or decanate_id is null;

select 'duplicate_chancelleries' as check_name,count(*) as duplicate_dioceses
from (
  select diocese_id from public.chancelleries where diocese_id is not null group by diocese_id having count(*)>1
) x;
