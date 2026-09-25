select jsonb_pretty(jsonb_build_object(
  'rows',(
    select jsonb_agg(jsonb_build_object(
      'code',payload->>'legacy_code',
      'nombre',nombre,
      'apellido',apellido,
      'full',payload->>'legacy_full_name',
      'honorific',payload->>'legacy_honorific',
      'given',payload->>'legacy_given_names',
      'surnames',payload->>'legacy_surnames',
      'confidence',payload->>'name_split_confidence',
      'estado',estado
    ) order by fecha_ingreso)
    from public.parrocos
    where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
  ),
  'active_count',(
    select count(*) from public.parrocos
    where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
      and upper(estado)='ACTIVO'
  ),
  'active_code',(
    select payload->>'legacy_code' from public.parrocos
    where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
      and upper(estado)='ACTIVO'
    limit 1
  ),
  'current_name',(public.sacramentum_current_priest('ada2c810-c6eb-4b75-8e3c-4941e3022687')->>'nombreCompleto')
)) as v20;