select pg_get_functiondef(
  to_regprocedure('public.apply_marriage_nullity(uuid,text,date,text,jsonb,uuid[])')
) as function_definition;