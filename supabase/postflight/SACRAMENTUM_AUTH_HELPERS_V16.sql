select p.oid::regprocedure as signature
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and (
    p.proname ilike '%current%parish%'
    or p.proname ilike '%effective%parish%'
    or p.proname ilike '%current%diocese%'
    or p.proname ilike '%user%parish%'
    or p.proname ilike '%can%access%'
  )
order by p.proname,p.oid::regprocedure::text;

select tablename,policyname,cmd,qual,with_check
from pg_policies
where schemaname='public'
  and tablename in ('official_notifications','baptisms','marginal_notes','decretos')
order by tablename,policyname;