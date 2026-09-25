select jsonb_pretty(jsonb_build_object(
  'official_notifications_total',(select count(*) from public.official_notifications),
  'official_notifications_operational',(select count(*) from public.official_notifications where receiver_parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'),
  'official_without_decree',(select count(*) from public.official_notifications where decree_id is null),
  'official_broken_decree_link',(select count(*) from public.official_notifications n left join public.decretos d on d.id=n.decree_id where n.decree_id is not null and d.id is null),
  'sacramental_documents_total',(select count(*) from public.matrimonial_notifications),
  'sacramental_recipients_total',(select count(*) from public.matrimonial_notification_recipients),
  'sacramental_pending_total',(select count(*) from public.matrimonial_notification_recipients where lower(status)='pending'),
  'sacramental_processed_total',(select count(*) from public.matrimonial_notification_recipients where lower(status)='processed'),
  'receipts_total',(select count(*) from public.matrimonial_notification_recipients where receipt_document_number is not null)
)) as summary;

select
  n.id as notification_id,
  n.created_at,
  n.status,
  n.category,
  n.subject,
  n.decree_id,
  d.tipo as decree_type,
  d.decree_number,
  d.decree_date,
  d.status as decree_status,
  d.payload->>'sacramento' as payload_sacramento,
  d.payload->>'sacramentType' as payload_sacrament_type
from public.official_notifications n
left join public.decretos d on d.id=n.decree_id
where n.receiver_parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
order by n.created_at desc
limit 20;

select
  r.id as recipient_id,
  n.document_number,
  n.notification_type,
  n.person_name,
  n.spouse_name,
  r.status,
  r.read_at,
  r.processed_at,
  r.receipt_document_number,
  r.receipt_created_at,
  r.sender_read_at,
  n.sender_parish_id,
  r.receiver_parish_id
from public.matrimonial_notification_recipients r
join public.matrimonial_notifications n on n.id=r.notification_id
order by r.created_at desc
limit 20;