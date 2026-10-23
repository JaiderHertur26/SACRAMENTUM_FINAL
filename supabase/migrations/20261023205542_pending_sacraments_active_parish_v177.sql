-- SACRAMENTUM V177: fail-closed, diocese-bound pending records across four sacraments.
-- Reproduced using fake suspended parish in all four SECURITY DEFINER RPCs;
-- preserve business logic, book numbering, audit, schemas and signatures.
DO $v177$
DECLARE spec text; oid_found oid; src text; patched text;
  pattern text:=$regex$coalesce[[:space:]]*\([[:space:]]*up\.is_active[[:space:]]*,[[:space:]]*true[[:space:]]*\)[[:space:]]*=[[:space:]]*true$regex$;
  guard text:=$guard$up.is_active IS TRUE
    AND upper(up.status)='ACTIVE'
    AND up.diocese_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.parishes v177_scope
      WHERE v177_scope.id=p_parish_id AND v177_scope.diocese_id=up.diocese_id
    )$guard$;
  changed integer:=0;
BEGIN
 FOREACH spec IN ARRAY ARRAY[
  'public.create_pending_baptism(uuid,jsonb)',
  'public.create_pending_confirmation(uuid,jsonb)',
  'public.create_pending_marriage(uuid,jsonb)',
  'public.create_pending_funeral(uuid,jsonb)'
 ] LOOP
  oid_found:=to_regprocedure(spec)::oid;
  IF oid_found IS NULL THEN RAISE EXCEPTION 'V177 required RPC missing: %',spec; END IF;
  SELECT replace(pg_get_functiondef(oid_found),E'\r\n',E'\n') INTO src;
  IF position('SECURITY DEFINER' in src)=0 OR regexp_count(src,pattern,1,'i')<>1
  THEN RAISE EXCEPTION 'V177 authorization anchor absent/changed/duplicated: %',spec; END IF;
  patched:=regexp_replace(src,pattern,guard,'i');
  IF spec='public.create_pending_funeral(uuid,jsonb)' THEN
    IF (length(patched)-length(replace(patched,
       'coalesce(up.status,''active'') not in (''blocked'',''disabled'',''inactive'')','')))
       /length('coalesce(up.status,''active'') not in (''blocked'',''disabled'',''inactive'')')<>1
    THEN RAISE EXCEPTION 'V177 funeral legacy status predicate changed';END IF;
    patched:=replace(patched,
       'coalesce(up.status,''active'') not in (''blocked'',''disabled'',''inactive'')',
       'upper(up.status)=''ACTIVE''');
  END IF;
  EXECUTE patched;
  changed:=changed+1;
 END LOOP;
 IF changed<>4 THEN RAISE EXCEPTION 'V177 incomplete pending sacrament hardening'; END IF;
END $v177$;
