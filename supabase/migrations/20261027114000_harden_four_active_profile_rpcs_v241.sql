-- SACRAMENTUM V241: enforce canonical active institutional profile on four sensitive REST RPCs.
-- DDL only, no row writes, no changes to existing function signatures or EXECUTE grants.
DO $v241$
DECLARE
 v_sig text;
 v_ddl text;
 v_old_active text;
 v_new_active text;
 v_old_status text := 'coalesce(up.status,''active'') not in (''blocked'',''disabled'',''inactive'')';
 v_new_status text := 'upper(coalesce(up.status,'''') )=''ACTIVE''';
 v_has_old_status boolean;
BEGIN
 FOREACH v_sig IN ARRAY ARRAY[
  'public.save_funeral_parameters(uuid,jsonb)',
  'public.save_marriage_parameters(uuid,jsonb,integer,integer,integer)',
  'public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer)',
  'public.void_document_issuance(uuid,text)'
 ] LOOP
  SELECT pg_get_functiondef(to_regprocedure(v_sig)) INTO v_ddl;
  IF v_ddl IS NULL THEN RAISE EXCEPTION 'V241 missing routine: %',v_sig; END IF;
  v_has_old_status := v_sig LIKE '%funeral_parameters%' OR v_sig LIKE '%search_baptisms%';

  IF v_sig LIKE '%save_funeral_parameters%' THEN
    v_old_active := 'coalesce(up.is_active,true) = true';
  ELSIF v_sig LIKE '%void_document_issuance%' THEN
    v_old_active := 'coalesce(is_active,true)=true';
  ELSE
    v_old_active := 'coalesce(up.is_active,true)=true';
  END IF;

  IF v_sig LIKE '%void_document_issuance%' THEN
    v_new_active := '(is_active IS TRUE AND upper(coalesce(status,'''') )=''ACTIVE'')';
  ELSIF v_has_old_status THEN
    v_new_active := 'up.is_active IS TRUE';
  ELSE
    v_new_active := '(up.is_active IS TRUE AND upper(coalesce(up.status,'''') )=''ACTIVE'')';
  END IF;

  IF (length(v_ddl)-length(replace(v_ddl,v_old_active,'')))/length(v_old_active) <> 1
    OR (v_has_old_status AND
      (length(v_ddl)-length(replace(v_ddl,v_old_status,'')))/length(v_old_status) <> 1)
  THEN
    RAISE EXCEPTION 'V241 audited active-profile guard changed; refusing to patch: %',v_sig;
  END IF;

  v_ddl := replace(v_ddl,v_old_active,v_new_active);
  IF v_has_old_status THEN
    v_ddl := replace(v_ddl,v_old_status,v_new_status);
  END IF;
  EXECUTE v_ddl;
 END LOOP;
END $v241$;

-- Approval still requires role, scope, active parish and documentary checks already
-- implemented by the existing stored procedures. This migration only narrows access.
