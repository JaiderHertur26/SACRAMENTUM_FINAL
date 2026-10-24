-- SACRAMENTUM V181 · P0 authorization in managed user APIs and physical book params.
-- Reproduced authenticated user with NO user_profiles disabling/reassigning another
-- fictional profile through NULL NOT IN; suspended diocese and parish accounts also
-- reached management and book-parameter operations. No data/grant/schema changes.
DO $v181$
DECLARE spec text; oid_fn oid; src text; fixed text; active_pat text; status_pat text;
  actor_role_pat text:=$p$v_actor_role[[:space:]]+not[[:space:]]+in[[:space:]]*\([[:space:]]*'admin_general'[[:space:]]*,[[:space:]]*'diocese'[[:space:]]*\)$p$;
  count_modified int:=0;
BEGIN
 FOREACH spec IN ARRAY ARRAY[
   'public.set_managed_user_active(uuid,boolean)',
   'public.update_managed_user_profile(uuid,text,uuid,uuid)',
   'public.save_baptism_parameters(uuid,jsonb,integer,integer,integer)',
   'public.save_confirmation_parameters(uuid,jsonb,integer,integer,integer)'
 ] LOOP
  oid_fn:=to_regprocedure(spec)::oid;
  IF oid_fn IS NULL THEN RAISE EXCEPTION 'V181 required function missing: %',spec;END IF;
  SELECT replace(pg_get_functiondef(oid_fn),E'\r\n',E'\n') INTO src;
  IF position('SECURITY DEFINER' in src)=0 THEN RAISE EXCEPTION 'V181 required definer unexpectedly changed: %',spec;END IF;
  active_pat:=$p$coalesce[[:space:]]*\([[:space:]]*is_active[[:space:]]*,[[:space:]]*true[[:space:]]*\)[[:space:]]*=[[:space:]]*true$p$;
  IF regexp_count(src,active_pat,1,'i')<>1 THEN RAISE EXCEPTION 'V181 active guard changed or duplicated: %',spec; END IF;
  fixed:=regexp_replace(src,active_pat,$r$is_active IS TRUE$r$,'i');
  IF spec LIKE 'public.save_baptism_parameters(%' THEN
    fixed:=regexp_replace(fixed,$p$is_active[[:space:]]+IS[[:space:]]+TRUE$p$,
      $r$is_active IS TRUE AND upper(status)='ACTIVE'$r$,'i');
  ELSE
    IF spec LIKE 'public.save_confirmation_parameters(%' THEN
      status_pat:=$p$coalesce[[:space:]]*\([[:space:]]*status[[:space:]]*,[[:space:]]*'active'[[:space:]]*\)[[:space:]]+not[[:space:]]+in[[:space:]]*\([[:space:]]*'blocked'[[:space:]]*,[[:space:]]*'disabled'[[:space:]]*,[[:space:]]*'inactive'[[:space:]]*\)$p$;
    ELSE
      status_pat:=$p$upper[[:space:]]*\([[:space:]]*coalesce[[:space:]]*\([[:space:]]*status[[:space:]]*,[[:space:]]*'ACTIVE'[[:space:]]*\)[[:space:]]*\)[[:space:]]*=[[:space:]]*'ACTIVE'$p$;
    END IF;
    IF regexp_count(fixed,status_pat,1,'i')<>1 THEN RAISE EXCEPTION 'V181 status guard changed or duplicated: %',spec;END IF;
    fixed:=regexp_replace(fixed,status_pat,$r$upper(status)='ACTIVE'$r$,'i');
  END IF;
  IF spec LIKE 'public.set_managed_user_active(%' OR spec LIKE 'public.update_managed_user_profile(%' THEN
    IF regexp_count(fixed,actor_role_pat,1,'i')<>1 THEN RAISE EXCEPTION 'V181 nullable manager-role guard changed: %',spec;END IF;
    fixed:=regexp_replace(fixed,actor_role_pat,
      $r$v_actor_role IS NULL OR v_actor_role NOT IN ('admin_general','diocese')$r$,'i');
  END IF;
  EXECUTE fixed;
  count_modified:=count_modified+1;
 END LOOP;
 IF count_modified<>4 THEN RAISE EXCEPTION 'V181 expected 4 functions, got %',count_modified;END IF;
END $v181$;