select c.relrowsecurity,c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='parrocos';

begin;
select set_config('request.jwt.claim.sub','6eebfea0-5280-4d96-bc38-e9f0021fbb25',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select count(*) as visible_to_parish_user
from public.parrocos
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687';
rollback;