-- QA V319 · Decreto de Repetición con tres parroquias, dos notas digitales,
-- autorizaciones negativas, expedientes, impresión bloqueada. ROLLBACK.
BEGIN;
SET LOCAL statement_timeout='90000ms';
DO $qa$
DECLARE
 di uuid; vic uuid; deca uuid; pa uuid; chancery_actor uuid; parish_actor uuid; concept uuid;
 pb uuid:=gen_random_uuid();pc uuid:=gen_random_uuid();ub uuid:=gen_random_uuid();uc uuid:=gen_random_uuid();
 b1 uuid; b2 uuid; b3 uuid; doc uuid; issued jsonb; rec jsonb;
 denied boolean; n int; workflow text; count_before int;
BEGIN
 SELECT p.diocese_id,p.vicary_id,p.decanate_id,p.id,u.auth_user_id
 INTO STRICT di,vic,deca,pa,parish_actor
 FROM public.user_profiles u JOIN public.parishes p ON p.id=u.parish_id
 WHERE u.role='parish' AND u.is_active AND upper(u.status)='ACTIVE' LIMIT 1;
 SELECT auth_user_id INTO STRICT chancery_actor FROM public.user_profiles WHERE role='chancery'
  AND diocese_id=di AND is_active AND upper(status)='ACTIVE' LIMIT 1;
 SELECT id INTO STRICT concept FROM public.conceptos_anulacion WHERE diocese_id=di
  AND lower(tipo)='porrepeticion' AND is_active
  AND lower(sacrament_type) IN ('bautismo','general') AND seinscribe IS FALSE
  AND gennota IS FALSE AND enlibro=0 LIMIT 1;
 INSERT INTO public.parishes(id,name,diocese_id,vicary_id,decanate_id,is_operational)
 VALUES(pb,'QA V319 DOS SANTOS',di,vic,deca,true),(pc,'QA V319 LA MERCED',di,vic,deca,true);
 INSERT INTO auth.users(id,aud,role,is_anonymous)
 VALUES(ub,'authenticated','authenticated',false),(uc,'authenticated','authenticated',false);
 INSERT INTO public.user_profiles(auth_user_id,parish_id,diocese_id,role,is_active,status,full_name)
 VALUES(ub,pb,di,'parish',true,'ACTIVE','Párroco QA Dos Santos'),
       (uc,pc,di,'parish',true,'ACTIVE','Párroco QA La Merced');
 INSERT INTO public.baptisms(parish_id,nombres,apellidos,book_number,folio,number,celebration_date,status,raw_data)
 VALUES(pb,'PEDRO QA','DE LA CRUZ','QA-V319','7','10',current_date-200,'seated','{}') RETURNING id INTO b1;
 INSERT INTO public.baptisms(parish_id,nombres,apellidos,book_number,folio,number,celebration_date,status,raw_data)
 VALUES(pc,'PEDRO QA','DE LA CRUZ','QA-V319','8','11',current_date-195,'seated','{}') RETURNING id INTO b2;
 INSERT INTO public.baptisms(parish_id,nombres,apellidos,book_number,folio,number,celebration_date,status,raw_data)
 VALUES(pa,'PEDRO QA','DE LA CRUZ','QA-V319','9','12',current_date-190,'seated','{}') RETURNING id INTO b3;

 PERFORM set_config('request.jwt.claim.sub',ub::text,true);
 denied:=false;
 BEGIN
  PERFORM public.issue_repetition_case_v314(pb,'bautismo',concept,'QA-319-REPETICION',current_date,
  'PEDRO QA DE LA CRUZ','Duplicidad de inscripción documental a verificar rigurosamente',
  'EXPEDIENTE QA-V319','Verificar cada partida y comunicar la anotación correspondiente','canciller','[]'::jsonb);
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Parroquia emitió indebidamente decreto de Cancillería'; END IF;

 PERFORM set_config('request.jwt.claim.sub',chancery_actor::text,true);
 issued:=public.issue_repetition_case_v314(pb,'bautismo',concept,'QA-319-REPETICION',current_date,
  'PEDRO QA DE LA CRUZ','Tres partidas bautismales del mismo sujeto requieren disposición individual y constancia por custodio',
  'EXPEDIENTE QA-319','Examine, conserve los asientos y practique solo las notas ordenadas por este decreto','canciller',
  jsonb_build_array(
    jsonb_build_object('parishId',pb,'book','QA-V319','folio','7','number','10','recordId',b1,
     'disposition','without_effect','justification','Se deja sin efectos registrales esta duplicación documentada en el expediente'),
    jsonb_build_object('parishId',pc,'book','QA-V319','folio','8','number','11','recordId',b2,
     'disposition','without_effect','justification','Segunda duplicación vinculada al mismo Bautizado con orden individual'),
    jsonb_build_object('parishId',pa,'book','QA-V319','folio','9','number','12','recordId',b3,
     'disposition','retain','justification','Este asiento permanece acreditativo y se conserva en el archivo correspondiente'),
    jsonb_build_object('external',true,'parishName','QA Parroquia Externa de Bolívar',
     'externalJurisdiction','Diócesis ficticia externa',
     'book','QA-EXT-319','folio','3','number','51','disposition','investigate',
     'justification','Se solicita constancia documental de esta cuarta partida de otra jurisdicción')
  ));
 doc:=(issued->>'decreeId')::uuid;
 IF doc IS NULL OR issued->>'status'<>'awaiting_parishes' THEN RAISE EXCEPTION 'Emisión V314 no válida: %',issued;END IF;
 SELECT count(*) INTO n FROM public.official_notifications WHERE decree_id=doc AND category='decree';
 IF n<>3 THEN RAISE EXCEPTION 'No llegaron notificaciones a tres parroquias: %',n;END IF;

 PERFORM set_config('request.jwt.claim.sub',ub::text,true);
 denied:=false;
 BEGIN PERFORM public.register_repetition_entry_marginal_v315(doc,2,'digital',
 'Prueba destino equivocado','Parroquia sin competencia sobre la partida ajena');
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Parroquia B escribió nota sobre partida C';END IF;
 denied:=false;
 BEGIN PERFORM public.register_repetition_entry_marginal_v315(doc,1,'physical',
 'Certificación material incorrecta','Existe ya la partida digital, no puede marcarse como física');
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Admitió asiento físico ficticio de partida digital';END IF;

 rec:=public.register_repetition_entry_marginal_v315(doc,1,'digital',
 'Constancia QA asiento B','Anotación sobre partida número diez de la parroquia QA B');
 IF rec->>'status'<>'note_recorded' THEN RAISE EXCEPTION 'No anotó partida B';END IF;
 denied:=false;
 BEGIN PERFORM public.register_repetition_entry_marginal_v315(doc,1,'digital',
 'Constancia QA repetida B','Reintento de nota que no debe producir duplicación alguna');
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Permitió nota marginal duplicada';END IF;
 rec:=public.resolve_repetition_parish_v314(doc,'documented','Constancia QA B firmada',
 'Se ejecutó nota de la partida B de acuerdo con el decreto');
 IF rec->>'status' <> 'awaiting_parishes' THEN RAISE EXCEPTION 'Cerró expediente sin las otras parroquias';END IF;

 PERFORM set_config('request.jwt.claim.sub',uc::text,true);
 denied:=false;
 BEGIN PERFORM public.resolve_repetition_parish_v314(doc,'documented','Constancia QA C anticipada',
 'No es permitido cerrar antes de asentar la segunda nota');
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Parroquia C cerró sin asiento marginal';END IF;
 rec:=public.register_repetition_entry_marginal_v315(doc,2,'digital',
 'Constancia QA asiento C','Segunda nota del decreto asentada en archivo parroquial C');
 rec:=public.resolve_repetition_parish_v314(doc,'documented','Constancia QA C firmada',
 'Nota individual de C asentada y cotejada con su libro y folio');
 IF rec->>'status'<>'awaiting_parishes' THEN RAISE EXCEPTION 'Se cerró sin constancia de parroquia acreditativa';END IF;
 PERFORM set_config('request.jwt.claim.sub',parish_actor::text,true);
 rec:=public.resolve_repetition_parish_v314(doc,'documented','Constancia QA original',
 'Se conserva partida acreditativa de la parroquia emisora');
 IF rec->>'status'<>'awaiting_parishes' THEN RAISE EXCEPTION 'Cerró sin constancia externa: %',rec;END IF;
 PERFORM set_config('request.jwt.claim.sub',ub::text,true);
 denied:=false;
 BEGIN PERFORM public.register_external_repetition_constancy_v314(doc,'external-4','Acuse QA sin autoridad','Parroquia B no es Cancillería');
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Parroquia registró constancia externa de Cancillería';END IF;
 PERFORM set_config('request.jwt.claim.sub',chancery_actor::text,true);
 rec:=public.register_external_repetition_constancy_v314(doc,'external-4','Acuse recibido QA Externo',
 'Constancia documental recibida y verificada en Cancillería de la cuarta partida');
 IF rec->>'status'<>'completed_documentary' THEN RAISE EXCEPTION 'No cerró tras constancia externa: %',rec;END IF;
 denied:=false;
 BEGIN PERFORM public.register_external_repetition_constancy_v314(doc,'external-4','Acuse duplicado QA','No se admiten dos constancias externas iguales');
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Se admitió constancia externa duplicada';END IF;
 SELECT count(*) INTO n FROM public.marginal_notes WHERE decree_id=doc AND note_type='decree_repetition';
 IF n<>2 THEN RAISE EXCEPTION 'Faltan exactamente dos anotaciones digitales %',n;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.baptisms WHERE id=b1) OR NOT EXISTS(SELECT 1 FROM public.baptisms WHERE id=b2) THEN
  RAISE EXCEPTION 'Se borraron partidas originales';END IF;
 denied:=false;
 BEGIN
   INSERT INTO public.registry_print_events(parish_id,sacrament_type,sacrament_id,document_kind,requested_by)
   VALUES(pb,'bautismo',b1,'partida',ub);
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Imprimió partida sin efectos registrales';END IF;

 PERFORM set_config('qa319.repetition',jsonb_build_object('parishes',3,'external_parishes',1,'decree_issued',1,
 'decree_notifications',3,'marginal_notes',2,'parish_resolutions',3,
 'cross_parish_rejected',true,'physical_forgery_denied',true,'duplicated_notes_rejected',true,
 'early_closure_denied',true,'certificate_blocked',true,'completed_documentary',true,
 'original_entries_preserved',true,'rollback',true)::text,true);
END $qa$;
SELECT current_setting('qa319.repetition')::jsonb AS test_result;
ROLLBACK;
