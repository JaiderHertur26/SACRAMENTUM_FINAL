BEGIN;
-- V277D: cross-diocese physical baptism correspondence, guarded by exact recipient parish.
-- No role bypass, no changes to V263/V267 official seating. Scope exclusively V277.
DO $patch$
DECLARE body text; original text; updated text;
BEGIN
 SELECT pg_get_functiondef(to_regprocedure(
 'public.process_manual_matrimonial_notification_physical(uuid)')) INTO body;
 original:='  if v_doc.diocese_id IS DISTINCT FROM v_diocese THEN';
 updated:='  if v_doc.diocese_id IS DISTINCT FROM v_diocese'
   ||' AND (v_doc.payload->>''caseVersion'') IS DISTINCT FROM ''V277'' THEN';
 IF body IS NULL OR
    (length(body)-length(replace(body,original,'')))<>length(original) THEN
   RAISE EXCEPTION 'V277D: función física no coincide exactamente con la revisión';
 END IF;
 IF position('v_row.receiver_parish_id is distinct from v_parish' IN body)=0
 OR position('up.auth_user_id=auth.uid()' IN body)=0
 OR position('v_type not in (' IN body)=0
 OR position('v_row.target_baptism_id is not null' IN body)=0
 THEN RAISE EXCEPTION 'V277D: controles de destinatario, sesión o nota física ausentes'; END IF;
 EXECUTE replace(body,original,updated);
END $patch$;
DO $verify$
DECLARE body text;
BEGIN
 SELECT pg_get_functiondef(to_regprocedure(
 'public.process_manual_matrimonial_notification_physical(uuid)')) INTO body;
 IF position('AND (v_doc.payload->>''caseVersion'') IS DISTINCT FROM ''V277''' IN body)=0
 OR position('v_row.receiver_parish_id is distinct from v_parish' IN body)=0 THEN
   RAISE EXCEPTION 'V277D: poscondición de destinatario no comprobada';
 END IF;
END $verify$;
COMMIT;
