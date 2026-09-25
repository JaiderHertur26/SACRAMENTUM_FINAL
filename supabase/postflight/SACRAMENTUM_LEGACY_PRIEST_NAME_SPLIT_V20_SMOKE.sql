begin;

select jsonb_pretty(jsonb_build_object(
  'simple',public.sacramentum_split_legacy_priest_name('PBRO. TEODORO GARCÍA GARCÍA'),
  'compound_given',public.sacramentum_split_legacy_priest_name('PBRO. JUAN CARLOS PÉREZ GÓMEZ'),
  'ambiguous_particle',public.sacramentum_split_legacy_priest_name('PBRO. JUAN DE LA CRUZ')
)) as parser;

insert into public.parrocos(
  parish_id,nombre,apellido,fecha_ingreso,fecha_salida,estado,payload
) values (
  'ada2c810-c6eb-4b75-8e3c-4941e3022687',
  'PBRO. JUAN CARLOS PÉREZ GÓMEZ','',
  '1999-01-01','1999-12-31','HISTORICO',
  jsonb_build_object('source','legacy_migration','legacy_code','V20SMOKE')
);

do $$
begin
  if not exists(
    select 1 from public.parrocos
    where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
      and payload->>'legacy_code'='V20SMOKE'
      and nombre='PBRO. JUAN CARLOS'
      and apellido='PÉREZ GÓMEZ'
      and payload->>'legacy_full_name'='PBRO. JUAN CARLOS PÉREZ GÓMEZ'
      and payload->>'name_split_confidence'='high'
  ) then
    raise exception 'V20 smoke: trigger no separó nombre compuesto';
  end if;
end $$;

rollback;