select
  pb.id as boleta_id,
  pb.status,
  pb.reportado,
  pb.raw_data->>'numeroRegistro' as numero_registro,
  pb.raw_data->>'nombres' as nombres,
  pb.raw_data->>'apellidos' as apellidos,
  pb.raw_data->>'seated_baptism_id' as seated_baptism_id,
  pb.raw_data->>'seated_book' as libro,
  pb.raw_data->>'seated_folio' as folio,
  pb.raw_data->>'seated_number' as numero,
  pb.raw_data->>'boleta_archived' as boleta_archived
from public.pending_baptisms pb
where pb.id='f17a57ee-4904-4a57-94d3-0e089b3de2fa';