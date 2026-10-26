-- V152: real SQL QA for new and historical documentary decrees, strict rollback.
-- Never persist invented persons, document numbers or audit events.
BEGIN;
-- Choose ONE coherent real QA scope. The old V152 selector could choose a
-- Chancery from Diocese B and unrelated parishes from Diocese A.
SELECT set_config('qa.chancery_uid',(
 SELECT ch.auth_user_id::text FROM public.user_profiles ch
 WHERE ch.role='chancery' AND ch.is_active IS TRUE
   AND upper(ch.status)='ACTIVE' AND ch.auth_user_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM public.parishes p WHERE p.diocese_id=ch.diocese_id AND p.is_operational IS TRUE)
   AND EXISTS (SELECT 1 FROM public.parishes p WHERE p.diocese_id=ch.diocese_id AND coalesce(p.is_operational,false)=false)
   AND EXISTS (SELECT 1 FROM public.user_profiles u WHERE u.diocese_id=ch.diocese_id
               AND u.role='diocese' AND u.is_active IS TRUE AND upper(u.status)='ACTIVE'
               AND u.auth_user_id IS NOT NULL)
 ORDER BY ch.diocese_id, ch.auth_user_id LIMIT 1),true);
SELECT set_config('qa.diocese_uid',(
 SELECT u.auth_user_id::text FROM public.user_profiles u
 JOIN public.user_profiles ch ON u.diocese_id=ch.diocese_id
 WHERE ch.auth_user_id::text=current_setting('qa.chancery_uid')
   AND u.role='diocese' AND u.is_active IS TRUE AND upper(u.status)='ACTIVE'
 ORDER BY u.auth_user_id LIMIT 1),true);
SELECT set_config('qa.parish_operational',(
 SELECT p.id::text FROM public.parishes p JOIN public.user_profiles ch
 ON ch.diocese_id=p.diocese_id AND ch.auth_user_id::text=current_setting('qa.chancery_uid')
 WHERE p.is_operational IS TRUE ORDER BY p.id LIMIT 1),true);
SELECT set_config('qa.parish_historical',(
 SELECT p.id::text FROM public.parishes p JOIN public.user_profiles ch
 ON ch.diocese_id=p.diocese_id AND ch.auth_user_id::text=current_setting('qa.chancery_uid')
 WHERE coalesce(p.is_operational,false)=false ORDER BY p.id LIMIT 1),true);
-- Resolve fixture identities before SET ROLE, to avoid reading foreign profiles through RLS.
SELECT set_config('qa210.parish_uid',(
 SELECT u.auth_user_id::text FROM public.user_profiles u WHERE u.role='parish'
 AND u.parish_id::text=current_setting('qa.parish_operational')
 AND u.is_active IS TRUE AND upper(u.status)='ACTIVE' LIMIT 1),true);
SELECT set_config('qa210.foreign_uid',(
 SELECT u.auth_user_id::text FROM public.user_profiles u JOIN public.parishes p ON p.id=u.parish_id
 WHERE u.role='parish' AND u.is_active IS TRUE AND upper(u.status)='ACTIVE'
 AND p.diocese_id<>(SELECT z.diocese_id FROM public.parishes z WHERE z.id::text=current_setting('qa.parish_operational'))
 ORDER BY u.auth_user_id LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE
 v_operational uuid:=current_setting('qa.parish_operational')::uuid;
 v_historical uuid:=current_setting('qa.parish_historical')::uuid;
 v_uid text;v_new uuid;v_old uuid;v_historical_old uuid;
 v_number text:='QA152-'||substr(replace(gen_random_uuid()::text,'-',''),1,17);
 v_old_number text:='QA152-H-'||substr(replace(gen_random_uuid()::text,'-',''),1,17);
 v_doc public.decretos%rowtype;v_message text;
 v_audits integer;v_trace integer;v_denied integer:=0;
 v_parish_actor text;v_foreign_actor text;v_own_visible integer;v_foreign_visible integer;
 v_before integer;v_after integer;
BEGIN
 v_uid:=current_setting('qa.chancery_uid');
 PERFORM set_config('request.jwt.claim.sub',v_uid,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_uid,'role','authenticated')::text,true);
 SELECT (SELECT count(*) FROM public.baptisms)+(SELECT count(*) FROM public.confirmations)
       +(SELECT count(*) FROM public.marriages)+(SELECT count(*) FROM public.funerals) INTO v_before;
 v_new:=public.issue_documentary_decree_v88(v_operational,'bautismo',v_number,current_date,
    'PERSONA FICTICIA V152','Prueba reversible de decreto documental sin efecto registral',false,null);
 SELECT * INTO v_doc FROM public.decretos WHERE id=v_new;
 IF NOT FOUND OR v_doc.tipo IS DISTINCT FROM 'documental' OR v_doc.status IS DISTINCT FROM 'active'
 OR v_doc.payload->>'affectsSacramentalRecord' IS DISTINCT FROM 'false'
 OR v_doc.payload->>'registersEffect' IS DISTINCT FROM 'false'
 OR v_doc.issued_by IS DISTINCT FROM v_uid::uuid THEN
  RAISE EXCEPTION 'V152-FAIL new documentary decree metadata';
 END IF;
 SELECT count(*) INTO v_trace FROM public.get_decree_trace_v89(v_new)
 WHERE action='issue_documentary_decree';
 IF v_trace<>1 THEN RAISE EXCEPTION 'V152-FAIL new decree audit trace count %',v_trace;END IF;
 v_old:=public.issue_documentary_decree_v88(v_operational,'matrimonio',v_old_number,current_date,
   'PERSONA FICTICIA V152','Recuperación documental histórica ficticia y reversible',true,'ARCHIVO FICTICIO V152');
 SELECT * INTO v_doc FROM public.decretos WHERE id=v_old;
 IF NOT FOUND OR v_doc.status IS DISTINCT FROM 'archived' OR v_doc.issued_by IS NOT NULL
 OR v_doc.payload->>'historical' IS DISTINCT FROM 'true'
 OR v_doc.payload->>'sourceReference' IS DISTINCT FROM 'ARCHIVO FICTICIO V152' THEN
  RAISE EXCEPTION 'V152-FAIL historical decree metadata';
 END IF;
 SELECT count(*) INTO v_trace FROM public.get_decree_trace_v89(v_old)
 WHERE action='historical_documentary_recovery';
 IF v_trace<>1 THEN RAISE EXCEPTION 'V152-FAIL historical decree audit trace count %',v_trace;END IF;
 v_historical_old:=public.issue_documentary_decree_v88(v_historical,'exequias',
   'QA152-ARCH-'||substr(replace(gen_random_uuid()::text,'-',''),1,15),
   current_date,'PERSONA FICTICIA V152','Archivo histórico recuperado sin alterar partidas',
   true,'REF FICTICIA QA V152');
 SELECT * INTO v_doc FROM public.decretos WHERE id=v_historical_old;
 IF NOT FOUND OR v_doc.status IS DISTINCT FROM 'archived' OR v_doc.parish_id IS DISTINCT FROM v_historical THEN
  RAISE EXCEPTION 'V152-FAIL historical container archive';
 END IF;
 BEGIN
  PERFORM public.issue_documentary_decree_v88(v_historical,'bautismo',
    'QA152-H-BLOCK-'||substr(replace(gen_random_uuid()::text,'-',''),1,10),
    current_date,'PERSONA FICTICIA','No debe admitirse nuevo',false,null);
  RAISE EXCEPTION 'V152-FAIL historical container issued new decree';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
  IF v_message LIKE 'V152-FAIL%' THEN RAISE;END IF;
  IF v_message NOT LIKE '%contenedores históricos%' THEN RAISE EXCEPTION 'V152-FAIL wrong container denial: %',v_message;END IF;
  v_denied:=v_denied+1;
 END;
 BEGIN
  PERFORM public.issue_documentary_decree_v88(v_operational,'bautismo',v_number,
    current_date,'PERSONA FICTICIA','Número ya existe',false,null);
  RAISE EXCEPTION 'V152-FAIL duplicate decree accepted';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
  IF v_message LIKE 'V152-FAIL%' THEN RAISE; END IF;
  IF v_message NOT LIKE '%número%' THEN RAISE EXCEPTION 'V152-FAIL wrong duplicate denial: %',v_message;END IF;
  v_denied:=v_denied+1;
 END;
 BEGIN
  PERFORM public.issue_documentary_decree_v88(v_operational,'confirmacion','QA152-NOSOURCE',
    current_date,'PERSONA FICTICIA','Sin fuente histórica',true,null);
  RAISE EXCEPTION 'V152-FAIL missing historical source accepted';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
  IF v_message LIKE 'V152-FAIL%' THEN RAISE; END IF;
  IF v_message NOT LIKE '%fuente verificable%' THEN RAISE EXCEPTION 'V152-FAIL source denial: %',v_message;END IF;
  v_denied:=v_denied+1;
 END;
 SELECT (SELECT count(*) FROM public.baptisms)+(SELECT count(*) FROM public.confirmations)
       +(SELECT count(*) FROM public.marriages)+(SELECT count(*) FROM public.funerals) INTO v_after;
 IF v_before IS DISTINCT FROM v_after THEN RAISE EXCEPTION 'V152-FAIL documentary decrees affected sacrament totals';END IF;
 -- True positive and cross-diocese negative reads under role authenticated.
 v_parish_actor:=current_setting('qa210.parish_uid');
 v_foreign_actor:=current_setting('qa210.foreign_uid');
 IF nullif(v_parish_actor,'') IS NULL OR nullif(v_foreign_actor,'') IS NULL
 THEN RAISE EXCEPTION 'V210 coherent parish actors missing';END IF;
 PERFORM set_config('request.jwt.claim.sub',v_parish_actor,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_parish_actor,'role','authenticated')::text,true);
 SELECT count(*) INTO v_own_visible FROM public.decretos WHERE id IN(v_new,v_old,v_historical_old);
 IF v_own_visible<>2 THEN RAISE EXCEPTION 'V210 owner parish should see exactly 2 decrees, saw %',v_own_visible;END IF;
 SELECT count(*) INTO v_trace FROM public.get_decree_trace_v89(v_new);
 IF v_trace<1 THEN RAISE EXCEPTION 'V210 owner parish missing decree trace';END IF;
 PERFORM set_config('request.jwt.claim.sub',v_foreign_actor,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_foreign_actor,'role','authenticated')::text,true);
 SELECT count(*) INTO v_foreign_visible FROM public.decretos WHERE id IN(v_new,v_old,v_historical_old);
 IF v_foreign_visible<>0 THEN RAISE EXCEPTION 'V210 cross-diocese leaked % decrees',v_foreign_visible;END IF;
 v_uid:=current_setting('qa.diocese_uid');
 PERFORM set_config('request.jwt.claim.sub',v_uid,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_uid,'role','authenticated')::text,true);
 BEGIN
  PERFORM public.issue_documentary_decree_v88(v_operational,'bautismo','QA152-DIOCESE',
   current_date,'PERSONA FICTICIA','Rol no permitido',false,null);
  RAISE EXCEPTION 'V152-FAIL diocese issued chancery-only decree';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
  IF v_message LIKE 'V152-FAIL%' THEN RAISE;END IF;
  IF v_message NOT LIKE '%Cancillería%' THEN RAISE EXCEPTION 'V152-FAIL wrong role denial: %',v_message;END IF;
  v_denied:=v_denied+1;
 END;
 IF v_denied<>4 THEN RAISE EXCEPTION 'V152-FAIL expected 4 denials got %',v_denied;END IF;
 PERFORM set_config('qa210.result',jsonb_build_object(
   'new_documentary',1,'historical_documentary',2,'role_and_validation_denials',v_denied,
   'parish_positive_reads',v_own_visible,'cross_diocese_visible',v_foreign_visible,
   'sacramental_counts_unchanged',true,'rolled_back',true)::text,true);
END $qa$;
SELECT current_setting('qa210.result')::jsonb AS result;
ROLLBACK;
