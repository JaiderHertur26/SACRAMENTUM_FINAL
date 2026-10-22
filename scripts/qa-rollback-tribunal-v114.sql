-- SACRAMENTUM V114 · NULIDAD FICTICIA + COTEJO + ACLARACION
-- Transacción reversible; no ejecutar fuera del bloque BEGIN/ROLLBACK.
BEGIN;
DO $qa$
DECLARE
 v_dio uuid; v_parish uuid; v_chancery uuid; v_diocesan uuid; v_parish_user uuid;
 v_marriage uuid; v_decree uuid; v_case uuid; v_receipt uuid; v_clar uuid;
 v_summary jsonb; v_history jsonb;
BEGIN
 SELECT diocese_id,auth_user_id INTO STRICT v_dio,v_chancery
 FROM public.user_profiles WHERE role='chancery' AND is_active;
 SELECT auth_user_id INTO STRICT v_diocesan FROM public.user_profiles
 WHERE role='diocese' AND diocese_id=v_dio AND is_active;
 SELECT auth_user_id INTO STRICT v_parish_user FROM public.user_profiles
 WHERE role='parish' AND diocese_id=v_dio AND is_active;
 SELECT id INTO STRICT v_parish FROM public.parishes
 WHERE diocese_id=v_dio ORDER BY id LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',v_chancery::text,true);
 INSERT INTO public.marriages(parish_id,celebration_date,status,raw_data)
 VALUES(v_parish,CURRENT_DATE,'nullified',
 jsonb_build_object('qa_only',true,'test_case','V114-ROLLBACK'))
 RETURNING id INTO v_marriage;
 INSERT INTO public.decretos(tipo,parish_id,diocese_id,sacrament_type,
 decree_number,decree_date,original_record_id,payload,status)
 VALUES('nulidad_matrimonial',v_parish,v_dio,'matrimonio',
 'QA-ROLLBACK-'||substr(v_marriage::text,1,8),CURRENT_DATE,v_marriage,
 jsonb_build_object('qa_only',true,'sourceReference','QA-TRIBUNAL'),'active')
 RETURNING id INTO v_decree;
 INSERT INTO public.nullity_judicial_review_cases(
 nullity_decree_id,marriage_id,diocese_id,parish_id,request_reference,
 authority_document_reference,review_reason,status,requested_by)
 VALUES(v_decree,v_marriage,v_dio,v_parish,'QA-CASE-V114','QA-DOC-TRIBUNAL-V114',
 'Expediente ficticio para ensayar controles sin efectos canónicos.',
 'under_legal_review',v_chancery) RETURNING id INTO v_case;
 INSERT INTO public.nullity_court_decision_receipts(
 review_case_id,nullity_decree_id,diocese_id,parish_id,reported_outcome,
 issuing_authority_reported,court_document_reference,court_document_date,
 received_summary,received_by)
 VALUES(v_case,v_decree,v_dio,v_parish,'orders_further_review',
 'AUTORIDAD FICTICIA DE PRUEBAS','QA-DOCUMENTO-FICTICIO-V114',CURRENT_DATE,
 'Documento atribuido a un tribunal ficticio. Ninguna firma o autenticidad ha sido certificada.',
 v_chancery) RETURNING id INTO v_receipt;
 PERFORM public.record_court_receipt_independent_check_v110(
 v_receipt,'reference_matches','official_letter','QA-CANCILLERIA-REF-V114',
 CURRENT_DATE,'Cancillería ficticia: la referencia parece concordante; autenticidad pendiente.');
 PERFORM set_config('request.jwt.claim.sub',v_diocesan::text,true);
 PERFORM public.record_court_receipt_independent_check_v110(
 v_receipt,'requires_clarification','official_email','QA-DIOCESIS-REF-V114',
 CURRENT_DATE,'Diócesis ficticia: requiere aclaración documental adicional del expediente.');
 v_summary:=public.get_court_receipt_dual_control_summary_v111(v_receipt);
 IF v_summary->>'institutional_assessment'<>'clarification_required'
 OR v_summary->>'receipt_verification_state'<>'unverified'
 OR (v_summary->>'registral_effects_authorized')::boolean
 THEN RAISE EXCEPTION 'FAIL V111: dictamen no seguro'; END IF;
 v_clar:=public.record_court_clarification_v112(
 v_receipt,'request',
 'Diócesis ficticia solicita sustento adicional de la referencia documental.',
 'QA-REQUERIMIENTO-V114',NULL);
 v_history:=public.get_court_clarifications_v113(v_receipt);
 IF jsonb_array_length(v_history->'items')<>1
 OR v_history->'items'->0->>'status'<>'awaiting_response'
 THEN RAISE EXCEPTION 'FAIL V113: faltó requerimiento'; END IF;
 BEGIN
  PERFORM public.record_court_clarification_v112(
    v_receipt,'request',
    'Este intento duplicado ficticio debe ser rechazado mientras esté abierto.',
    'QA-DUPLICADO-V114',NULL);
  RAISE EXCEPTION 'FAIL: permitió solicitud duplicada';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',v_parish_user::text,true);
 BEGIN
  PERFORM public.record_court_clarification_v112(
   v_receipt,'respond',
   'Parroquia ficticia carece de autorización para responder por Cancillería.',
   'QA-PARROQUIA-DENEGADA-V114',v_clar);
  RAISE EXCEPTION 'FAIL: Parroquia pudo responder';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.get_court_clarifications_v113(v_receipt);
  RAISE EXCEPTION 'FAIL: Parroquia consultó intercambios reservados';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',v_chancery::text,true);
 PERFORM public.record_court_clarification_v112(
 v_receipt,'respond',
 'Respuesta ficticia de Cancillería con soporte de referencia; no certifica autenticidad.',
 'QA-RESPUESTA-CANC-V114',v_clar);
 v_history:=public.get_court_clarifications_v113(v_receipt);
 IF v_history->'items'->0->>'status'<>'responded_pending_juridical_review'
 OR (v_history->>'authenticity_certified')::boolean
 OR (SELECT status FROM public.marriages WHERE id=v_marriage)<>'nullified'
 OR (SELECT status FROM public.decretos WHERE id=v_decree)<>'active'
 OR (SELECT verification_state FROM public.nullity_court_decision_receipts WHERE id=v_receipt)<>'unverified'
 THEN RAISE EXCEPTION 'FAIL: efectos indebidos después de respuesta'; END IF;
END $qa$;
ROLLBACK;
