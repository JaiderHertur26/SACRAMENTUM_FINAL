-- V319 QA interparroquial: 3 parroquias, dos destinatarios y acuses individualizados.
BEGIN;
SET LOCAL statement_timeout='60000ms';
DO $qa$
DECLARE
 dioc uuid; vic uuid; deca uuid; sender uuid; actor uuid;
 pb uuid:=gen_random_uuid();pc uuid:=gen_random_uuid();
 ub uuid:=gen_random_uuid();uc uuid:=gen_random_uuid(); b1 uuid; b2 uuid; rid1 uuid;rid2 uuid;
 source_id uuid; src_raw jsonb; name1 text;name2 text; issued jsonb; document_id uuid;
 blocked boolean; n integer; status_final text;
BEGIN
 SELECT p.diocese_id,p.vicary_id,p.decanate_id,p.id,u.auth_user_id
 INTO STRICT dioc,vic,deca,sender,actor
 FROM public.user_profiles u JOIN public.parishes p ON p.id=u.parish_id
 WHERE u.role='parish' AND u.is_active AND upper(u.status)='ACTIVE' LIMIT 1;

 SELECT id,raw_data INTO STRICT source_id,src_raw FROM public.marriages
 WHERE parish_id=sender AND celebration_date<=current_date AND book_number IS NOT NULL AND folio IS NOT NULL AND number IS NOT NULL LIMIT 1;
 name1:=btrim(concat_ws(' ',coalesce(nullif(src_raw->>'novioNombres',''),src_raw->>'nombr1'),
  coalesce(nullif(src_raw->>'novioApellidos',''),src_raw->>'apell1')));
 name2:=btrim(concat_ws(' ',coalesce(nullif(src_raw->>'noviaNombres',''),src_raw->>'nombr2'),
  coalesce(nullif(src_raw->>'noviaApellidos',''),src_raw->>'apell2')));
 IF length(name1)<4 OR length(name2)<4 THEN RAISE EXCEPTION 'Nombres insuficientes en origen QA';END IF;

 INSERT INTO public.parishes(id,name,diocese_id,vicary_id,decanate_id,is_operational)
 VALUES(pb,'QA V319 PARROQUIA B',dioc,vic,deca,true),(pc,'QA V319 PARROQUIA C',dioc,vic,deca,true);
 INSERT INTO auth.users(id,aud,role,is_anonymous)
 VALUES(ub,'authenticated','authenticated',false),(uc,'authenticated','authenticated',false);
 INSERT INTO public.user_profiles(auth_user_id,parish_id,diocese_id,role,is_active,status,full_name)
 VALUES(ub,pb,dioc,'parish',true,'ACTIVE','Párroco B QA'),(uc,pc,dioc,'parish',true,'ACTIVE','Párroco C QA');
 INSERT INTO public.baptisms(parish_id,nombres,apellidos,book_number,folio,number,celebration_date,status)
 VALUES(pb,split_part(name1,' ',1),btrim(substr(name1,length(split_part(name1,' ',1))+1)),'QA319','1','101',current_date-300,'seated') RETURNING id INTO b1;
 INSERT INTO public.baptisms(parish_id,nombres,apellidos,book_number,folio,number,celebration_date,status)
 VALUES(pc,split_part(name2,' ',1),btrim(substr(name2,length(split_part(name2,' ',1))+1)),'QA319','1','102',current_date-300,'seated') RETURNING id INTO b2;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 issued:=public.issue_sacramental_case_v277('matrimonio',source_id,jsonb_build_array(
   jsonb_build_object('role','principal','name',name1,'parishId',pb,'baptismId',b1),
   jsonb_build_object('role','conyuge','name',name2,'parishId',pc,'baptismId',b2)
 ));
 IF (issued->>'internal')::integer<>2 OR (issued->>'localApplied')::integer<>0
  OR issued->>'complete'<>'false' THEN
  RAISE EXCEPTION 'Dos destinatarios internos no iniciaron pendientes: %',issued;
 END IF;
 document_id:=(issued->>'notification_id')::uuid;
 SELECT id INTO STRICT rid1 FROM public.matrimonial_notification_recipients
 WHERE notification_id=document_id AND receiver_parish_id=pb;
 SELECT id INTO STRICT rid2 FROM public.matrimonial_notification_recipients
 WHERE notification_id=document_id AND receiver_parish_id=pc;
 PERFORM set_config('request.jwt.claim.sub',ub::text,true);
 blocked:=false;
 BEGIN PERFORM public.process_matrimonial_notification_recipient(rid2);
 EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Párroco B procesó notificación destinada a C';END IF;
 PERFORM public.process_matrimonial_notification_recipient(rid1);
 PERFORM public.process_matrimonial_notification_recipient(rid1);
 SELECT count(*) INTO n FROM public.marginal_notes n WHERE n.sacrament_type='bautismo'
  AND n.source_id=document_id AND n.parish_id=pb AND n.sacrament_id=b1;
 IF n<>1 THEN RAISE EXCEPTION 'Parroquia B no mantuvo nota idempotente (n=%)',n;END IF;
 SELECT status INTO status_final FROM public.matrimonial_notifications WHERE id=document_id;
 IF status_final='processed' THEN RAISE EXCEPTION 'Expediente cerrado antes de constancia de C';END IF;
 PERFORM set_config('request.jwt.claim.sub',uc::text,true);
 PERFORM public.process_matrimonial_notification_recipient(rid2);
 SELECT count(*) INTO n FROM public.marginal_notes n WHERE n.source_id=document_id;
 IF n<>2 THEN RAISE EXCEPTION 'Las dos notas no quedaron completas: %',n;END IF;
 SELECT status INTO status_final FROM public.matrimonial_notifications WHERE id=document_id;
 IF status_final<>'processed' THEN RAISE EXCEPTION 'Dos destinatarias procesadas, expediente sin cerrar (%).',status_final;END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 blocked:=false;
 BEGIN PERFORM public.issue_sacramental_case_v277('matrimonio',source_id,jsonb_build_array(
   jsonb_build_object('role','principal','name',name1,'parishId',pb,'baptismId',b1),
   jsonb_build_object('role','conyuge','name',name2,'parishId',pc,'baptismId',b2)));
 EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'La emisión matrimonial duplicada no se bloqueó';END IF;
 PERFORM set_config('qa319.result',jsonb_build_object(
 'parishes',3,'simulated_parish_accounts',2,'separate_recipients',2,
 'marginal_notes',2,'foreign_processing_denied',1,'idempotent_replay',1,
 'early_closure_denied',1,'duplicate_issuance_denied',1,'complete',true,'rollback',true)::text,true);
END $qa$;
SELECT current_setting('qa319.result')::jsonb AS test_result;
ROLLBACK;