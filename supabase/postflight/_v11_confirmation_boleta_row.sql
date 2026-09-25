select
 id,status,reportado,
 raw_data->>'numeroRegistro' as numero_registro,
 raw_data->>'nombres' as nombres,
 raw_data->>'apellidos' as apellidos,
 raw_data->>'fechaSacramento' as fecha_sacramento,
 raw_data->>'seated_confirmation_id' as historical_confirmation_id,
 raw_data->>'seated_record_available' as seated_record_available,
 raw_data->>'seated_book' as libro,
 raw_data->>'seated_folio' as folio,
 raw_data->>'seated_number' as numero,
 raw_data->>'boleta_archived' as boleta_archived
from public.pending_confirmations
where id='571f5358-1a32-4a06-b438-64298c5156a2';