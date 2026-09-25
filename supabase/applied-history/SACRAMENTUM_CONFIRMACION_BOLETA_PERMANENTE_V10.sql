-- SACRAMENTUM · V10 · BOLETA DE CONFIRMACIÓN PERMANENTE
begin;

do $$
declare
  v_def text;
  v_old text := $needle$set reportado=true,status='seated'$needle$;
  v_new text := $needle$set reportado=true,status='seated',
        raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object(
          'seated_confirmation_id',v_id,
          'seated_book',lpad(v_book::text,4,'0'),
          'seated_folio',lpad(v_folio::text,4,'0'),
          'seated_number',lpad(v_number::text,4,'0'),
          'boleta_archived',true
        )$needle$;
begin
  select pg_get_functiondef(
    'public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)'::regprocedure
  ) into v_def;

  if position(v_old in v_def)=0 then
    raise exception 'V10: no se encontró el bloque esperado de seat_confirmation_records';
  end if;

  v_def:=replace(v_def,v_old,v_new);
  execute v_def;
end;
$$;
update public.pending_confirmations pc
set raw_data=coalesce(pc.raw_data,'{}'::jsonb)||jsonb_build_object(
      'seated_confirmation_id',a.entity_id,
      'seated_book',lpad(coalesce(a.metadata->>'book','0'),4,'0'),
      'seated_folio',lpad(coalesce(a.metadata->>'folio','0'),4,'0'),
      'seated_number',lpad(coalesce(a.metadata->>'number','0'),4,'0'),
      'boleta_archived',true
    ),
    reportado=true,
    status='seated'
from public.registry_audit_log a
join public.confirmations c on c.id=a.entity_id
where a.action='seat'
  and a.entity_type='confirmation'
  and nullif(a.metadata->>'pending_id','') is not null
  and pc.id=(a.metadata->>'pending_id')::uuid
  and pc.parish_id=a.parish_id;

create index if not exists idx_pending_confirmations_seated_confirmation_id
on public.pending_confirmations ((raw_data->>'seated_confirmation_id'))
where nullif(raw_data->>'seated_confirmation_id','') is not null;

commit;
