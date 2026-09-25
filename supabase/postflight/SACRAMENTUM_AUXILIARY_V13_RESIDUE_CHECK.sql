select jsonb_pretty(jsonb_build_object(
  'smoke_priests',
    (select count(*) from public.parrocos
     where upper(coalesce(nombre,'')||' '||coalesce(apellido,'')) like '%SMOKE%'),
  'smoke_bishop_tenures',
    (select count(*) from public.bishop_tenures
     where upper(coalesce(bishop_name,'')) like '%SMOKE%'),
  'smoke_batches',
    (select count(*) from public.legacy_import_batches
     where original_filename='SMOKE_PARROCOS_V13.json'),
  'smoke_rows',
    (select count(*) from public.legacy_import_rows
     where source_key='SMOKE-P13'),
  'active_priests',
    (select count(*) from public.parrocos
     where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
       and upper(estado)='ACTIVO'),
  'current_priest',
    public.sacramentum_priest_at_date(
      'ada2c810-c6eb-4b75-8e3c-4941e3022687',current_date)
)) as residue_check;