-- SACRAMENTUM V190: transactional compatibility for search_path='' in privileged RPCs.
-- DDL AND fake sacramental work are rolled back together: ZERO persistent changes.
BEGIN;
SET LOCAL statement_timeout='45000ms';
ALTER FUNCTION public.get_decree_trace_v89(uuid) SET search_path TO '';
ALTER FUNCTION public.issue_documentary_decree_v88(uuid,text,text,date,text,text,boolean,text) SET search_path TO '';
ALTER FUNCTION public.register_historical_narrative(uuid,text,jsonb) SET search_path TO '';
DO $qa$
DECLARE
  di uuid; parish uuid; chancellor uuid; parish_actor uuid; decree uuid; source_count integer;
  narrative record; book text := 'QA-V190-' || substr(gen_random_uuid()::text,1,11);
  dnum text := 'QA-V190-D-' || substr(gen_random_uuid()::text,1,11);
  trace_count integer;
BEGIN
  SELECT diocese_id,auth_user_id INTO STRICT di,chancellor FROM public.user_profiles
  WHERE role='chancery' AND is_active IS TRUE AND status='ACTIVE' LIMIT 1;
  SELECT p.id,up.auth_user_id INTO STRICT parish,parish_actor
  FROM public.parishes p
  JOIN public.user_profiles up ON up.parish_id=p.id AND up.diocese_id=p.diocese_id
  WHERE p.diocese_id=di AND p.is_operational IS TRUE AND up.role='parish'
    AND up.is_active IS TRUE AND up.status='ACTIVE'
  ORDER BY p.id LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub',chancellor::text,true);
  decree:=public.issue_documentary_decree_v88(parish,'bautismo',dnum,CURRENT_DATE,
    'DOCUMENTO FICTICIO V190','Ensayo controlado de cadena de autorizaciones.',false,null);
  IF decree IS NULL THEN RAISE EXCEPTION 'V190 issue failed';END IF;
  SELECT count(*) INTO trace_count FROM public.get_decree_trace_v89(decree);
  IF trace_count<1 THEN RAISE EXCEPTION 'V190 trace has no entry';END IF;

  PERFORM set_config('request.jwt.claim.sub',parish_actor::text,true);
  SELECT * INTO STRICT narrative FROM public.register_historical_narrative(
    parish,'bautismo',jsonb_build_object(
      'Libro',book,'folio','17','numero','33',
      'literalTranscription','Registro ficticio para control V190. Esta información no debe persistir.',
      'historicalEntryMode','narrative','qaOnly',true
    ));
  IF narrative.record_id IS NULL THEN RAISE EXCEPTION 'V190 narrative failed';END IF;
  SELECT count(*) INTO source_count FROM public.baptisms WHERE id=narrative.record_id AND parish_id=parish;
  IF source_count<>1 THEN RAISE EXCEPTION 'V190 narrative row not found';END IF;
  PERFORM set_config('qa190.result',jsonb_build_object(
   'three_functions_with_empty_search_path',true,'documentary_decree_created',true,
   'trace_entries',trace_count,'parish_historical_narrative_created',true,
   'rolled_back',true
  )::text,true);
END $qa$;
SELECT current_setting('qa190.result')::jsonb AS qa_result;
ROLLBACK;