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
  pb.raw_data->>'boleta_archived' as boleta_archived,
  b.id as baptism_id,
  b.status as baptism_status,
  b.book_number,
  b.folio as baptism_folio,
  b.number as baptism_number
from public.pending_baptisms pb
left join public.baptisms b
  on b.id=(pb.raw_data->>'seated_baptism_id')::uuid
where pb.id='f17a57ee-4904-4a57-94d3-0e089b3de2fa';

select
  count(*) filter(where reportado=true) as historial_reportadas,
  count(*) filter(where reportado=false) as pendientes
from public.pending_baptisms
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687';

select
  count(*) as baptisms_total,
  count(*) filter(where status='anulada') as anuladas,
  count(*) filter(where book_number='0001' and folio='0001' and number='0001') as lfn_0001
from public.baptisms
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687';