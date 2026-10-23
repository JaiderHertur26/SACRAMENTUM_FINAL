-- SACRAMENTUM V179 · Five privileged decree/nullity workflows.
-- Only tighten institutional profile acceptance; preserve decree/document and jurisdiction logic.
DO $v179$
DECLARE spec text; oid_fn oid; original text; patched text;
  qualified boolean; active_old text; status_old text;
  active_new text; status_new text; n int; patched_count int:=0;
BEGIN
 FOREACH spec IN ARRAY ARRAY[
  'public.apply_marriage_correction(uuid,date,text,jsonb,text)',
  'public.apply_funeral_correction(uuid,date,text,jsonb,text)',
  'public.create_marriage_reposition_by_decree(uuid,date,text,jsonb,jsonb,text)',
  'public.create_funeral_reposition_by_decree(uuid,date,text,jsonb,jsonb,text)',
  'public.apply_marriage_nullity(uuid,text,date,text,jsonb,uuid[])'
 ] LOOP
  oid_fn:=to_regprocedure(spec)::oid;
  IF oid_fn IS NULL THEN RAISE EXCEPTION 'V179 privileged decree RPC missing: %',spec;END IF;
  SELECT replace(pg_get_functiondef(oid_fn),E'\r\n',E'\n') INTO original;
  IF position('SECURITY DEFINER' IN original)=0 THEN
   RAISE EXCEPTION 'V179 expected SECURITY DEFINER function: %',spec;
  END IF;
  qualified:=spec NOT LIKE 'public.apply_marriage_nullity(%';
  IF qualified THEN
   active_old:=$p$coalesce[[:space:]]*\([[:space:]]*up\.is_active[[:space:]]*,[[:space:]]*true[[:space:]]*\)[[:space:]]*=[[:space:]]*true$p$;
   status_old:=$p$coalesce[[:space:]]*\([[:space:]]*up\.status[[:space:]]*,[[:space:]]*'active'[[:space:]]*\)[[:space:]]+not[[:space:]]+in[[:space:]]*\([[:space:]]*'blocked'[[:space:]]*,[[:space:]]*'disabled'[[:space:]]*,[[:space:]]*'inactive'[[:space:]]*\)$p$;
   active_new:='up.is_active IS TRUE';
   status_new:='upper(up.status)=''ACTIVE''';
  ELSE
   active_old:=$p$coalesce[[:space:]]*\([[:space:]]*is_active[[:space:]]*,[[:space:]]*false[[:space:]]*\)[[:space:]]*=[[:space:]]*true$p$;
   status_old:=$p$lower[[:space:]]*\([[:space:]]*coalesce[[:space:]]*\([[:space:]]*status[[:space:]]*,[[:space:]]*'active'[[:space:]]*\)[[:space:]]*\)[[:space:]]+not[[:space:]]+in[[:space:]]*\([[:space:]]*'blocked'[[:space:]]*,[[:space:]]*'disabled'[[:space:]]*,[[:space:]]*'inactive'[[:space:]]*\)$p$;
   active_new:='is_active IS TRUE';
   status_new:='upper(status)=''ACTIVE''';
  END IF;
  IF regexp_count(original,active_old,1,'i')<>1 OR regexp_count(original,status_old,1,'i')<>1 THEN
   RAISE EXCEPTION 'V179 authorization anchors missing or duplicated in %',spec;
  END IF;
  -- PostgreSQL three-valued logic: NULL <> 'chancery' evaluates NULL, not TRUE.
  -- Fail closed when the status filter eliminates a profile and SELECT INTO yields NULL.
  IF regexp_count(original,$role$if[[:space:]]+v_role[[:space:]]*<>[[:space:]]*'chancery'[[:space:]]+then$role$,1,'i')<>1 THEN
   RAISE EXCEPTION 'V179 null-role guard missing/duplicated in %',spec;
  END IF;
  patched:=regexp_replace(regexp_replace(original,active_old,active_new,'i'),status_old,status_new,'i');
  patched:=regexp_replace(patched,$role$if[[:space:]]+v_role[[:space:]]*<>[[:space:]]*'chancery'[[:space:]]+then$role$,
    'if v_role IS DISTINCT FROM ''chancery'' then','i');
  EXECUTE patched;
  patched_count:=patched_count+1;
 END LOOP;
 IF patched_count<>5 THEN RAISE EXCEPTION 'V179 five decrees not patched: %',patched_count;END IF;
END $v179$;