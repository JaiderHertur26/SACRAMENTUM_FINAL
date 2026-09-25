select
 (select count(*) from pg_policies where schemaname='public' and tablename='matrimonial_notifications') as notification_policies,
 (select count(*) from pg_policies where schemaname='public' and tablename='matrimonial_notification_recipients') as recipient_policies,
 (select count(*) from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='matrimonial_notifications') as notifications_realtime,
 (select count(*) from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='matrimonial_notification_recipients') as recipients_realtime,
 (select relrowsecurity from pg_class where oid='public.matrimonial_notifications'::regclass) as notifications_rls,
 (select relrowsecurity from pg_class where oid='public.matrimonial_notification_recipients'::regclass) as recipients_rls;