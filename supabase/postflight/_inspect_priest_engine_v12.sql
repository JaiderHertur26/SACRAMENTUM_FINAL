select id,nombre,apellido,fecha_ingreso,fecha_salida,estado,payload->>'legacy_code' as code
from public.parrocos
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
order by fecha_ingreso;

select pg_get_functiondef('public.sacramentum_priest_at_date(uuid,date)'::regprocedure);