-- V152: real SQL QA for new and historical documentary decrees, strict rollback.
-- Never persist invented persons, document numbers or audit events.
BEGIN;
SELECT set_config('qa.chancery_uid',(SELECT auth_user_id::text FROM public.user_profiles WHERE lower(role)='chancery' AND coalesce(is_active,true) AND auth_user_id IS NOT NULL LIMIT 1),true);
SELECT set_config('qa.diocese_uid',(SELECT auth_user_id::text FROM public.user_profiles WHERE lower(role)='diocese' AND coalesce(is_active,true) AND auth_user_id IS NOT NULL LIMIT 1),true);
SELECT set_config('qa.parish_operational',(
  SELECT p.id::text FROM public.parishes p JOIN public.user_profiles u
  ON u.diocese_id=p.diocese_id AND lower(u.role)='chancery'
  WHERE coalesce(p.is_operational,false) AND coalesce(u.is_active,true)
  ORDER BY p.id LIMIT 1),true);
SELECT set_config('qa.parish_historical',(
  SELECT p.id::text FROM public.parishes p JOIN public.user_profiles u
  ON u.diocese_id=p.diocese_id AND lower(u.role)='chancery'
  WHERE NOT coalesce(p.is_operational,false) AND coalesce(u.is_active,true)
  ORDER BY p.id LIMIT 1),true);
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
END $qa$;
ROLLBACK;
