-- V151: internal materializers may be invoked by authenticated users
-- via SECURITY INVOKER public wrappers. Enforce the canonical import scope:
-- parish owner or diocese administrator of the same diocese; not Chancery.
-- Preserve complete function body, owner, grants, search_path and signature.
DO $v151$
DECLARE
  v_name text;
  v_oid oid;
  v_ddl text;
  v_old constant text := 'if not public.can_access_parish(v_batch.parish_id) then';
  v_new constant text := 'if not public.can_manage_legacy_import(v_batch.parish_id,v_batch.diocese_id) then';
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'materialize_pending_legacy_marriages',
    'materialize_pending_legacy_sacramental_records'
  ] LOOP
    v_oid := to_regprocedure(format('private.%I(uuid,integer)',v_name));
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'V151: missing internal materializer %', v_name;
    END IF;
    SELECT pg_get_functiondef(v_oid) INTO v_ddl;
    IF (length(lower(v_ddl))-length(replace(lower(v_ddl),v_old,''))) / length(v_old) <> 1
       OR v_ddl NOT LIKE '%SECURITY DEFINER%'
       OR v_ddl NOT LIKE '%SET search_path TO ''''%'
    THEN
      RAISE EXCEPTION 'V151: internal materializer % has unexpected definition; manual review required',v_name;
    END IF;
    -- Function replacement keeps the existing GRANTs, caller behavior and signatures.
    EXECUTE replace(v_ddl,v_old,v_new);
  END LOOP;
END $v151$;
