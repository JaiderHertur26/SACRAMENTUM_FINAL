select pg_get_functiondef(
  'public.issue_matrimonial_notification(uuid,uuid,uuid,jsonb,date,text,text,text,uuid,uuid,text,text,text,text,text,jsonb)'::regprocedure
) as function_definition;