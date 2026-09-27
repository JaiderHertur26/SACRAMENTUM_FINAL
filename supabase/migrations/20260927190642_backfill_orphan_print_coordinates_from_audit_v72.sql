-- SACRAMENTUM V72
-- Completa coordenadas de impresiones históricas cuyo registro ya no existe,
-- usando únicamente una evidencia exacta de asiento en registry_audit_log
-- para el mismo sacrament_id.

with candidates as (
  select
    e.id as print_event_id,
    a.id as audit_id,
    coalesce(
      nullif(a.after_data->>'book_number',''),
      nullif(a.after_data->>'Libro',''),
      nullif(a.metadata->>'book','')
    ) as book_value,
    coalesce(
      nullif(a.after_data->>'folio',''),
      nullif(a.metadata->>'folio','')
    ) as folio_value,
    coalesce(
      nullif(a.after_data->>'number',''),
      nullif(a.after_data->>'numero',''),
      nullif(a.metadata->>'number','')
    ) as number_value,
    count(*) over(partition by e.id) as evidence_count
  from public.registry_print_events e
  join public.registry_audit_log a
    on a.entity_id=e.sacrament_id
   and lower(coalesce(a.action,''))='seat'
   and a.parish_id=e.parish_id
  where
    (
      nullif(e.metadata->>'book','') is null
      or nullif(e.metadata->>'folio','') is null
      or nullif(e.metadata->>'number','') is null
    )
    and coalesce(
      nullif(a.after_data->>'book_number',''),
      nullif(a.after_data->>'Libro',''),
      nullif(a.metadata->>'book','')
    ) is not null
    and coalesce(
      nullif(a.after_data->>'folio',''),
      nullif(a.metadata->>'folio','')
    ) is not null
    and coalesce(
      nullif(a.after_data->>'number',''),
      nullif(a.after_data->>'numero',''),
      nullif(a.metadata->>'number','')
    ) is not null
),
unique_evidence as (
  select *
  from candidates
  where evidence_count=1
)
update public.registry_print_events e
set metadata=coalesce(e.metadata,'{}'::jsonb)
  || jsonb_build_object(
    'book',u.book_value,
    'folio',u.folio_value,
    'number',u.number_value,
    'coordinates_source','registry_audit_seat_backfill',
    'coordinates_backfilled_at',now(),
    'coordinates_audit_id',u.audit_id
  )
from unique_evidence u
where e.id=u.print_event_id;

comment on table public.registry_print_events is
'Auditoría institucional de impresiones. Conserva sacramento, UUID, tipo documental, usuario, fecha, notas incluidas y una fotografía de Libro/Folio/Número. Los eventos históricos sin registro vigente pueden completar coordenadas sólo desde evidencia única y exacta de asiento en registry_audit_log.';
