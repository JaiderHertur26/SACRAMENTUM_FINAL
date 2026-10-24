-- V190 migration already applied in Supabase (20261024202424).
ALTER FUNCTION public.get_decree_trace_v89(uuid) SET search_path TO '';
ALTER FUNCTION public.issue_documentary_decree_v88(uuid,text,text,date,text,text,boolean,text) SET search_path TO '';
ALTER FUNCTION public.register_historical_narrative(uuid,text,jsonb) SET search_path TO '';
