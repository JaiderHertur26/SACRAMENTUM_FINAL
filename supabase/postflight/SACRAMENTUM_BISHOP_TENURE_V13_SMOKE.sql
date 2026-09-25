begin;

do $$
declare
  v_id uuid;
  v_resolved jsonb;
  v_overlap_blocked boolean:=false;
begin
  insert into public.bishop_tenures(
    parish_id,bishop_name,start_date,end_date,notes
  ) values(
    'ada2c810-c6eb-4b75-8e3c-4941e3022687',
    'MONS. PRUEBA ROLLBACK V13',
    '1800-01-01','1801-12-31','SMOKE V13'
  )
  returning id into v_id;

  v_resolved:=public.sacramentum_bishop_at_date(
    'ada2c810-c6eb-4b75-8e3c-4941e3022687',
    '1800-06-01'::date
  );

  if coalesce(v_resolved->>'nombreCompleto','')<>'MONS. PRUEBA ROLLBACK V13' then
    raise exception 'V13 smoke: no resolvió el Obispo titular por fecha';
  end if;

  begin
    insert into public.bishop_tenures(
      parish_id,bishop_name,start_date,end_date,notes
    ) values(
      'ada2c810-c6eb-4b75-8e3c-4941e3022687',
      'MONS. SOLAPADO ROLLBACK V13',
      '1801-01-01','1802-01-01','DEBE FALLAR'
    );
  exception when others then
    v_overlap_blocked:=true;
  end;

  if not v_overlap_blocked then
    raise exception 'V13 smoke: permitió periodos episcopales solapados';
  end if;
end;
$$;

rollback;

select
  count(*) filter(where bishop_name like '%ROLLBACK V13%') as smoke_rows_after_rollback
from public.bishop_tenures;