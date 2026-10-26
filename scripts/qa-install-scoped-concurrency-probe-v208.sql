CREATE OR REPLACE FUNCTION public.qa_v208_concurrency_probe(p_parish_id uuid,p_mode text,p_request_id uuid,p_delay_ms integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $f$
DECLARE started timestamptz:=clock_timestamp();acquired timestamptz;answer jsonb;record_data jsonb;confirmation jsonb;
 k1 bigint:=hashtextextended(p_parish_id::text||':qa208:one',208);
 k2 bigint:=hashtextextended(p_parish_id::text||':qa208:two',208);
BEGIN
 IF p_delay_ms<0 OR p_delay_ms>6000 OR p_request_id IS NULL THEN RAISE EXCEPTION 'QA208 invalid probe'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.user_profiles up JOIN public.parishes p ON p.id=up.parish_id
  WHERE up.auth_user_id=auth.uid() AND up.role='parish' AND up.is_active IS TRUE AND upper(up.status)='ACTIVE'
   AND up.parish_id=p_parish_id AND p.name LIKE 'QA208-fde833eb-2f29-4435-8d0f-feb9dbd4d92f%'
 ) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='QA208 isolated test parish required'; END IF;
 IF p_mode IN ('deadlock_a','deadlock_b') THEN
  PERFORM pg_advisory_xact_lock(CASE WHEN p_mode='deadlock_a' THEN k1 ELSE k2 END);
  PERFORM pg_sleep(1.2);
  PERFORM pg_advisory_xact_lock(CASE WHEN p_mode='deadlock_a' THEN k2 ELSE k1 END);
  acquired:=clock_timestamp();
 ELSE
  IF p_mode NOT IN ('bautismo','confirmacion','matrimonio','exequias','linked') THEN RAISE EXCEPTION 'QA208 invalid mode'; END IF;
  record_data:='{"nombres":"QA208","apellidos":"FICTICIO","fechaNacimiento":"2020-01-01","fechaSacramento":"2026-10-20","novioNombres":"QA208","novioApellidos":"FICTICIO","noviaNombres":"QA208","noviaApellidos":"FICTICIA","fecha_defuncion":"2026-10-18","fecha_exequias":"2026-10-20","qa_v208":true}';
  IF p_mode='linked' THEN
   record_data:=record_data||'{"fechaNacimiento":"2000-01-01","over8FileSigned":true,"willReceiveConfirmation":true}';
   confirmation:='{"fechaSacramento":"2026-10-20","lugarSacramento":"QA208 FICTICIA"}';
  END IF;
  answer:=public.create_pending_registration_v207(CASE WHEN p_mode='linked' THEN 'bautismo' ELSE p_mode END,p_request_id,p_parish_id,record_data,confirmation);
  acquired:=clock_timestamp();
  PERFORM pg_sleep(p_delay_ms/1000.0);
 END IF;
 -- Always abort the entire HTTP request, including original boletas, counters and receipts.
 RAISE EXCEPTION USING ERRCODE='P0208',MESSAGE='QA208_EXPECTED_ROLLBACK',
 DETAIL=jsonb_build_object('pid',pg_backend_pid(),'kind',p_mode,'started',started,'acquired',acquired,'ended',clock_timestamp(),
 'wait_ms',round(extract(epoch from(acquired-started))*1000),'held_ms',p_delay_ms,'response',answer)::text;
END $f$;
REVOKE ALL ON FUNCTION public.qa_v208_concurrency_probe(uuid,text,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qa_v208_concurrency_probe(uuid,text,uuid,integer) TO authenticated;