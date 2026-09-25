begin;

select set_config('request.jwt.claim.sub','6eebfea0-5280-4d96-bc38-e9f0021fbb25',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

select jsonb_pretty(jsonb_build_object(
  'role',public.current_app_role(),
  'parish_id',public.current_app_parish_id(),
  'visible_parrocos',(
    select count(*)
    from public.parrocos
    where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
  ),
  'codes',(
    select jsonb_agg(payload->>'legacy_code' order by fecha_ingreso)
    from public.parrocos
    where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
  ),
  'names',(
    select jsonb_agg(nombre order by fecha_ingreso)
    from public.parrocos
    where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
  ),
  'foreign_scope_access',public.can_access_parish('00000000-0000-4000-8000-000000000099'::uuid)
)) as parish_visibility;

update public.parrocos
set email='v18-smoke@example.invalid'
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
  and payload->>'legacy_code'='0001';

select count(*)=1 as own_write_allowed
from public.parrocos
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
  and payload->>'legacy_code'='0001'
  and email='v18-smoke@example.invalid';

rollback;