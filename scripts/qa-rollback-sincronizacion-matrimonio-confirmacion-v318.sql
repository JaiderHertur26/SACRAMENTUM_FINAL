-- QA V318: Matrimonio con dos destinatarios externos, Confirmación física y externa
-- Nuevas notificaciones reales dentro de esta transacción; ROLLBACK obligatorio.
BEGIN;
SET LOCAL statement_timeout='45000ms';
DO $qa$
DECLARE
 actor uuid; home uuid; mr record; cf record; cs record; outm jsonb; outc jsonb; oute jsonb;
 nmid uuid; ncid uuid; denied boolean; external_count integer; recipient_count integer; person1 text; person2 text;
BEGIN
 SELECT auth_user_id,parish_id INTO STRICT actor,home FROM public.user_profiles
 WHERE role='parish' AND is_active IS TRUE AND upper(status)='ACTIVE' LIMIT 1;
 SELECT m.id,m.raw_data INTO STRICT mr FROM public.marriages m WHERE m.parish_id=home
 AND m.celebration_date<=current_date AND m.book_number IS NOT NULL AND m.folio IS NOT NULL AND m.number IS NOT NULL LIMIT 1;
 person1:=btrim(concat_ws(' ',coalesce(nullif(mr.raw_data->>'novioNombres',''),mr.raw_data->>'nombr1'),
   coalesce(nullif(mr.raw_data->>'novioApellidos',''),mr.raw_data->>'apell1')));
 person2:=btrim(concat_ws(' ',coalesce(nullif(mr.raw_data->>'noviaNombres',''),mr.raw_data->>'nombr2'),
   coalesce(nullif(mr.raw_data->>'noviaApellidos',''),mr.raw_data->>'apell2')));
 IF length(person1)<4 OR length(person2)<4 THEN RAISE EXCEPTION 'Fuente matrimonial de test sin nombres';END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 outm:=public.issue_sacramental_case_v277('matrimonio',mr.id,jsonb_build_array(
  jsonb_build_object('role','principal','name',person1,'externalParishName','Santa Marta QA Externa','externalDioceseName','Diócesis de prueba','deliveryReference','Radicado QA MR01'),
  jsonb_build_object('role','conyuge','name',person2,'externalParishName','San José QA Externa','externalDioceseName','Diócesis de prueba','deliveryReference','Radicado QA MR02')));
 IF (outm->>'external')::int<>2 OR (outm->>'internal')::int<>0 OR outm->>'complete'<>'false' THEN
  RAISE EXCEPTION 'Matrimonio externo dos destinatarias mal clasificado';END IF;
 nmid:=(outm->>'notification_id')::uuid;
 SELECT count(*) INTO external_count FROM public.sacramental_external_returns_v277 WHERE notification_id=nmid;
 IF external_count<>2 THEN RAISE EXCEPTION 'Faltan los dos acuses externos';END IF;
 denied:=false;
 BEGIN PERFORM public.issue_sacramental_case_v277('matrimonio',mr.id,jsonb_build_array(
  jsonb_build_object('role','principal','name',person1,'externalParishName','Santa Marta QA Externa','externalDioceseName','Diócesis de prueba','deliveryReference','Radicado QA MR01'),
  jsonb_build_object('role','conyuge','name',person2,'externalParishName','San José QA Externa','externalDioceseName','Diócesis de prueba','deliveryReference','Radicado QA MR02')));
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Se permitió notificación matrimonial duplicada';END IF;
 SELECT c.id,c.nombres,c.apellidos INTO STRICT cf FROM public.confirmations c WHERE c.parish_id=home AND c.celebration_date<=current_date AND c.book_number IS NOT NULL AND c.folio IS NOT NULL AND c.number IS NOT NULL ORDER BY c.id LIMIT 1;
 outc:=public.issue_sacramental_case_v277('confirmacion',cf.id,jsonb_build_array(
  jsonb_build_object('role','confirmando','name',btrim(concat_ws(' ',cf.nombres,cf.apellidos)),
   'parishId',home,'searchReference','Localizar partida física de Bautismo en archivo QA')));
 IF (outc->>'internal')::int<>1 OR (outc->>'localApplied')::int<>0 OR outc->>'complete'<>'false' THEN
  RAISE EXCEPTION 'Confirmación física sin cotejo se completó indebidamente';END IF;
 ncid:=(outc->>'notification_id')::uuid;
 SELECT count(*) INTO recipient_count FROM public.matrimonial_notification_recipients WHERE notification_id=ncid AND status='pending' AND target_baptism_id IS NULL;
 IF recipient_count<>1 THEN RAISE EXCEPTION 'Confirmación física no conservó revisión pendiente';END IF;
 SELECT c.id,c.nombres,c.apellidos INTO STRICT cs FROM public.confirmations c WHERE c.parish_id=home AND c.id<>cf.id AND c.celebration_date<=current_date AND c.book_number IS NOT NULL AND c.folio IS NOT NULL AND c.number IS NOT NULL ORDER BY c.id LIMIT 1;
 oute:=public.issue_sacramental_case_v277('confirmacion',cs.id,jsonb_build_array(
   jsonb_build_object('role','confirmando','name',btrim(concat_ws(' ',cs.nombres,cs.apellidos)),
    'externalParishName','San Miguel QA Externa','externalDioceseName','Diócesis de prueba','deliveryReference','Radicado QA CF01')));
 IF (oute->>'external')::int<>1 OR oute->>'complete'<>'false' THEN
   RAISE EXCEPTION 'Confirmación externa no queda pendiente';END IF;
 UPDATE public.matrimonial_notifications SET status='processed' WHERE id=nmid;
 IF (SELECT status FROM public.matrimonial_notifications WHERE id=nmid)='processed' THEN
  RAISE EXCEPTION 'Se completó Matrimonio sin constancias externas';END IF;
 PERFORM set_config('qa318.result',jsonb_build_object('marriage_external',2,
 'confirmation_local_physical_pending',1,'confirmation_external_pending',1,
 'duplicate_notices_denied',1,'premature_closure_denied',1,'rollback',true)::text,true);
END $qa$;
SELECT current_setting('qa318.result')::jsonb AS test_result;
ROLLBACK;