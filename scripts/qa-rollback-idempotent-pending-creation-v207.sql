-- V207 PostgreSQL creation retry contract. Fictitious rows only, all rolled back.
BEGIN;
SET LOCAL statement_timeout='45000ms';
DO $init$
DECLARE a uuid;p uuid;other uuid;
BEGIN
 SELECT up.auth_user_id,up.parish_id INTO STRICT a,p
 FROM public.user_profiles up JOIN public.parishes x ON x.id=up.parish_id AND x.diocese_id=up.diocese_id
 WHERE up.role='parish' AND up.is_active IS TRUE AND upper(up.status)='ACTIVE' LIMIT 1;
 SELECT auth_user_id INTO other FROM public.user_profiles WHERE auth_user_id<>a AND role<>'parish' AND is_active IS TRUE LIMIT 1;
 PERFORM set_config('qa207.actor',a::text,true);
 PERFORM set_config('qa207.parish',p::text,true);
 PERFORM set_config('qa207.other',coalesce(other::text,''),true);
END $init$;
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE a uuid:=current_setting('qa207.actor')::uuid;p uuid:=current_setting('qa207.parish')::uuid;
 kind text;req uuid;payload jsonb;conf jsonb;first jsonb;again jsonb;
 params jsonb;after_params jsonb;passes int:=0;changed int:=0;denied int:=0;ledger_denied bool:=false;bad uuid;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 FOREACH kind IN ARRAY ARRAY['bautismo','confirmacion','matrimonio','exequias','linked'] LOOP
  req:=gen_random_uuid();conf:=null;
  payload:='{"nombres":"QA207","apellidos":"FICTICIO","fechaNacimiento":"2020-01-01","fechaSacramento":"2026-10-20","fecha_defuncion":"2026-10-18","fecha_exequias":"2026-10-20","qa_v207":true}'::jsonb;
  IF kind='matrimonio' THEN payload:=payload||'{"novioNombres":"QA207","novioApellidos":"FICTICIO","noviaNombres":"QA207","noviaApellidos":"FICTICIA"}'::jsonb; END IF;
  IF kind='linked' THEN
   payload:=payload||'{"fechaNacimiento":"2000-01-01","over8FileSigned":true,"willReceiveConfirmation":true}'::jsonb;
   conf:='{"fechaSacramento":"2026-10-20","lugarSacramento":"QA207 FICTICIA"}'::jsonb;
  END IF;
  first:=public.create_pending_registration_v207(CASE WHEN kind='linked' THEN 'bautismo' ELSE kind END,req,p,payload,conf);
  SELECT to_jsonb(pp) INTO params FROM public.parish_parameters pp WHERE parish_id=p;
  FOR i IN 1..3 LOOP
   again:=public.create_pending_registration_v207(CASE WHEN kind='linked' THEN 'bautismo' ELSE kind END,req,p,payload,conf);
   IF first IS DISTINCT FROM again THEN RAISE EXCEPTION 'V207 replay changed response %',kind; END IF;
  END LOOP;
  SELECT to_jsonb(pp) INTO after_params FROM public.parish_parameters pp WHERE parish_id=p;
  IF params IS DISTINCT FROM after_params THEN RAISE EXCEPTION 'V207 retry consumed another counter %',kind; END IF;
  passes:=passes+1;
  BEGIN
   PERFORM public.create_pending_registration_v207(CASE WHEN kind='linked' THEN 'bautismo' ELSE kind END,req,p,payload||'{"nombres":"CHANGED"}'::jsonb,conf);
   RAISE EXCEPTION 'V207 changed payload accepted';
  EXCEPTION WHEN invalid_parameter_value THEN changed:=changed+1; END;
  IF kind='linked' AND (first->>'confirmation_pending_id' IS NULL OR first->>'baptism_pending_id' IS NULL) THEN RAISE EXCEPTION 'V207 linked result missing'; END IF;
 END LOOP;
 BEGIN PERFORM count(*) FROM public.pending_creation_requests; EXCEPTION WHEN insufficient_privilege THEN ledger_denied:=true; END;
 IF NOT ledger_denied THEN RAISE EXCEPTION 'V207 client can read receipt ledger'; END IF;
 -- Authorization is checked before cached receipts too.
 PERFORM set_config('request.jwt.claim.sub','',true);
 PERFORM set_config('request.jwt.claims','{}',true);
 BEGIN PERFORM public.create_pending_registration_v207('bautismo',req,p,payload,conf);
  RAISE EXCEPTION 'V207 anonymous cached attempt accepted';
 EXCEPTION WHEN insufficient_privilege THEN denied:=denied+1; END;
 IF nullif(current_setting('qa207.other'),'') IS NOT NULL THEN
  PERFORM set_config('request.jwt.claim.sub',current_setting('qa207.other'),true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa207.other'),'role','authenticated')::text,true);
  BEGIN PERFORM public.create_pending_registration_v207('bautismo',req,p,payload,conf);
   RAISE EXCEPTION 'V207 non-parish cached attempt accepted';
  EXCEPTION WHEN insufficient_privilege THEN denied:=denied+1; END;
 END IF;
 IF passes<>5 OR changed<>5 OR denied<1 THEN RAISE EXCEPTION 'V207 incomplete coverage'; END IF;
 PERFORM set_config('qa207.result',jsonb_build_object('circuits',passes,'same_receipt_replays',passes*3,'changed_payload_rejected',changed,'unauthorized_rejected',denied,'direct_ledger_read_denied',ledger_denied)::text,true);
END $qa$;
RESET ROLE;
DO $verify$
DECLARE n int;p uuid:=current_setting('qa207.parish')::uuid;
BEGIN
 SELECT count(*) INTO n FROM public.pending_creation_requests WHERE parish_id=p AND created_by=current_setting('qa207.actor')::uuid AND created_at>=transaction_timestamp();
 IF n<>5 THEN RAISE EXCEPTION 'V207 receipt count %, expected 5',n; END IF;
 SELECT (SELECT count(*) FROM public.pending_baptisms WHERE raw_data->>'qa_v207'='true')
       +(SELECT count(*) FROM public.pending_confirmations WHERE raw_data->>'qa_v207'='true')
       +(SELECT count(*) FROM public.pending_marriages WHERE raw_data->>'qa_v207'='true')
       +(SELECT count(*) FROM public.pending_funerals WHERE raw_data->>'qa_v207'='true') INTO n;
 -- Linked confirmation inherits identity from the baptism but does not inherit the QA marker.
 IF n<>5 THEN RAISE EXCEPTION 'V207 fictitious pending count %, expected 5 marked + 1 linked',n; END IF;
END $verify$;
SELECT current_setting('qa207.result')::jsonb AS result;
ROLLBACK;
