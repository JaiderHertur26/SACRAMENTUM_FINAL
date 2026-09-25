-- SACRAMENTUM · V8 · BOLETA DE BAUTISMO PERMANENTE TRAS ASIENTO
-- La boleta no se elimina al sentar: queda reportada, vinculada a la partida y reimprimible.
begin;

do $$
declare
  v_def text;
  v_old text := 'set reportado=true,status=''seated'',raw_data=v_final_raw';
  v_new text := 'set reportado=true,status=''seated'',raw_data=v_final_raw||jsonb_build_object(''seated_baptism_id'',v_id,''seated_book'',lpad(v_book::text,4,''0''),''seated_folio'',lpad(v_folio::text,4,''0''),''seated_number'',lpad(v_number::text,4,''0''),''boleta_archived'',true)';
begin
  select pg_get_functiondef('public.seat_baptism_records(uuid,jsonb,integer,integer,integer)'::regprocedure)
  into v_def;

  if position(v_old in v_def)=0 then
    raise exception 'V8: no se encontró el bloque esperado de seat_baptism_records';
  end if;

  v_def := replace(v_def,v_old,v_new);
  execute v_def;
end;
$$;

-- Enriquecer boletas conservadas que ya tienen asiento auditado.
update public.pending_baptisms pb
set raw_data=coalesce(pb.raw_data,'{}'::jsonb)||jsonb_build_object(
      'seated_baptism_id',a.entity_id,
      'seated_book',lpad(coalesce(a.metadata->>'book','0'),4,'0'),
      'seated_folio',lpad(coalesce(a.metadata->>'folio','0'),4,'0'),
      'seated_number',lpad(coalesce(a.metadata->>'number','0'),4,'0'),
      'boleta_archived',true
    ),
    reportado=true,
    status='seated'
from public.registry_audit_log a
join public.baptisms b on b.id=a.entity_id
where a.action='seat'
  and a.entity_type='baptism'
  and nullif(a.metadata->>'pending_id','') is not null
  and pb.id=(a.metadata->>'pending_id')::uuid
  and pb.parish_id=a.parish_id;

-- Recuperar boletas de versiones antiguas sólo cuando hay partida permanente y auditoría inequívoca.
insert into public.pending_baptisms(id,parish_id,status,reportado,raw_data,created_at)
select
  (a.metadata->>'pending_id')::uuid,
  a.parish_id,
  'seated',
  true,
  coalesce(a.after_data,'{}'::jsonb)||jsonb_build_object(
    'id',(a.metadata->>'pending_id')::uuid,
    'parishId',a.parish_id,
    'parish_id',a.parish_id,
    'status','seated',
    'estado','seated',
    'reportado',true,
    'source','current_parish_registration',
    'seated_baptism_id',a.entity_id,
    'seated_book',lpad(coalesce(a.metadata->>'book','0'),4,'0'),
    'seated_folio',lpad(coalesce(a.metadata->>'folio','0'),4,'0'),
    'seated_number',lpad(coalesce(a.metadata->>'number','0'),4,'0'),
    'boleta_archived',true,
    'recovered_from_audit',true
  ),
  a.created_at
from public.registry_audit_log a
join public.baptisms b on b.id=a.entity_id and b.parish_id=a.parish_id
left join public.pending_baptisms pb on pb.id=(a.metadata->>'pending_id')::uuid
where a.action='seat'
  and a.entity_type='baptism'
  and nullif(a.metadata->>'pending_id','') is not null
  and pb.id is null
on conflict(id) do nothing;

create index if not exists idx_pending_baptisms_seated_baptism_id
on public.pending_baptisms ((raw_data->>'seated_baptism_id'))
where nullif(raw_data->>'seated_baptism_id','') is not null;

commit;
