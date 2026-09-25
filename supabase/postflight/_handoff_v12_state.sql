select
 to_regclass('public.bishop_tenures') is not null as bishop_tenures,
 to_regclass('public.bishop_terms') is not null as bishop_terms,
 exists(select 1 from information_schema.columns where table_schema='public' and table_name='parrocos' and column_name='source_system') as parrocos_source_system,
 exists(select 1 from information_schema.columns where table_schema='public' and table_name='obispos' and column_name='fecha_salida') as obispos_fecha_salida;