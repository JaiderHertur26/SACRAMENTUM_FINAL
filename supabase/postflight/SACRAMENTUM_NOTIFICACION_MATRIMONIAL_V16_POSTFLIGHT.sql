select
 (select count(*) from pg_policies where schemaname='public' and tablename='matrimonial_notifications') as notification_policies,
 (select count(*) from pg_policies where schemaname='public' and tablename='matrimonial_notification_recipients') as recipient_policies,
 (select count(*) from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='matrimonial_notifications') as notifications_realtime,
 (select count(*) from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='matrimonial_notification_recipients') as recipients_realtime,
 has_function_privilege('authenticated','public.issue_matrimonial_notification(uuid,uuid,uuid,jsonb,date,text,text,text,uuid,uuid,text,text,text,text,text,jsonb)','EXECUTE') as can_issue,
 has_function_privilege('authenticated','public.cancel_matrimonial_notification(uuid)','EXECUTE') as can_cancel,
 has_table_privilege('authenticated','public.matrimonial_notifications','SELECT') as can_select_notifications,
 has_table_privilege('authenticated','public.matrimonial_notification_recipients','SELECT') as can_select_recipients,
 not has_table_privilege('authenticated','public.matrimonial_notifications','UPDATE') as direct_notification_update_blocked,
 not has_table_privilege('authenticated','public.matrimonial_notification_recipients','UPDATE') as direct_recipient_update_blocked;