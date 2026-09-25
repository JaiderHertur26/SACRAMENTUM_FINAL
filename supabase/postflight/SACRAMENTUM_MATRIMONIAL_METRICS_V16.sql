select
 (select count(*) from public.matrimonial_notifications) as notifications,
 (select count(*) from public.matrimonial_notification_recipients) as recipients,
 (select count(*) from public.matrimonial_notification_recipients where lower(status)='pending') as pending_recipients,
 (select count(*) from public.matrimonial_notification_recipients where lower(status)='processed') as processed_recipients,
 (select count(*) from public.matrimonial_notification_recipients where target_baptism_id is null) as manual_recipients,
 (select count(*) from public.matrimonial_notifications where lower(notification_type)='matrimonio') as matrimonial_docs,
 (select count(*) from public.matrimonial_notifications where lower(status)='cancelled') as cancelled_docs;