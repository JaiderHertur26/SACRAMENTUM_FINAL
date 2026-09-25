select set_config('request.jwt.claim.sub','6eebfea0-5280-4d96-bc38-e9f0021fbb25',false);
select set_config('request.jwt.claim.role','authenticated',false);
set role authenticated;

select jsonb_pretty(jsonb_agg(jsonb_build_object(
  'code',payload->>'legacy_code',
  'nombre',nombre,
  'apellido',apellido,
  'estado',estado
) order by fecha_ingreso)) as visible_parrocos
from public.parrocos
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687';