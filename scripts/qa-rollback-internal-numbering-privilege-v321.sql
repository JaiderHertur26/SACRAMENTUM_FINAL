-- V321: no user can consume a sacramental case number outside the issuing RPC.
BEGIN;
SET LOCAL statement_timeout='10000ms';
SELECT set_config('qa321.parish_id',(SELECT parish_id::text FROM public.user_profiles
 WHERE role='parish' AND is_active AND upper(status)='ACTIVE' LIMIT 1),true);
SELECT set_config('request.jwt.claim.sub',(SELECT auth_user_id::text FROM public.user_profiles
 WHERE role='parish' AND is_active AND upper(status)='ACTIVE' LIMIT 1),true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('request.jwt.claim.sub'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE blocked boolean:=false; code text; err text;
BEGIN
 IF has_function_privilege('authenticated','public.next_sacramental_case_sequence_v318(uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'V321 helper still directly executable'; END IF;
 BEGIN
  PERFORM public.next_sacramental_case_sequence_v318(current_setting('qa321.parish_id')::uuid,'NM');
 EXCEPTION WHEN insufficient_privilege THEN
  blocked:=true;
  GET STACKED DIAGNOSTICS code=RETURNED_SQLSTATE,err=MESSAGE_TEXT;
 END;
 IF NOT blocked OR code<>'42501' OR err NOT ILIKE '%permission denied%'
 THEN RAISE EXCEPTION 'V321 direct sequence invocation was not denied: % %',code,err; END IF;
 IF NOT has_function_privilege('authenticated','public.issue_sacramental_case_v277(text,uuid,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'V321 public issuance RPC lost its grant'; END IF;
 PERFORM set_config('qa321.result',jsonb_build_object('direct_sequence_denied',true,
   'valid_issuance_rpc_preserved',true,'rollback',true)::text,true);
END $qa$;
SELECT current_setting('qa321.result')::jsonb AS result;
ROLLBACK;
