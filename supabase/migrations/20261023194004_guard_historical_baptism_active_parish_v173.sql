-- SACRAMENTUM V173 · All five privileged historical digitization functions.
-- A suspended parish was able to register a fictional historical Baptism before this fix.
-- Change only their institutional authorization predicate; preserve legal/folio workflows.
DO $v173$
DECLARE
 v_spec text;
 v_oid oid;
 v_original text;
 v_pattern text:=$pattern$coalesce[[:space:]]*\([[:space:]]*is_active[[:space:]]*,[[:space:]]*true[[:space:]]*\)[[:space:]]*=[[:space:]]*true[[:space:]]+and[[:space:]]+coalesce[[:space:]]*\([[:space:]]*status[[:space:]]*,[[:space:]]*'active'[[:space:]]*\)[[:space:]]+not[[:space:]]+in[[:space:]]*\([[:space:]]*'blocked'[[:space:]]*,[[:space:]]*'disabled'[[:space:]]*,[[:space:]]*'inactive'[[:space:]]*\)$pattern$;
 v_guard text:=$guard$is_active IS TRUE
    and upper(coalesce(status,'SUSPENDED'))='ACTIVE'
    and diocese_id IS NOT NULL
    and EXISTS (
      SELECT 1 FROM public.parishes v173_parish
      WHERE v173_parish.id=p_parish_id
        AND v173_parish.diocese_id=public.user_profiles.diocese_id
    )$guard$;
 v_changed integer:=0;
BEGIN
 FOREACH v_spec IN ARRAY ARRAY[
  'public.register_historical_baptism_internal(uuid,jsonb)',
  'public.register_historical_confirmation_internal(uuid,jsonb,uuid,text)',
  'public.register_historical_marriage(uuid,jsonb)',
  'public.register_historical_funeral(uuid,jsonb)',
  'public.register_historical_narrative(uuid,text,jsonb)'
 ] LOOP
  v_oid:=to_regprocedure(v_spec)::oid;
  IF v_oid IS NULL THEN RAISE EXCEPTION 'V173 required historical registration function absent: %',v_spec; END IF;
  SELECT replace(pg_get_functiondef(v_oid), E'\r\n',E'\n') INTO v_original;
  IF regexp_count(v_original,v_pattern,1,'i')<>1 THEN
   RAISE EXCEPTION 'V173 authorization anchor absent, duplicated or changed: %',v_spec;
  END IF;
  IF position('upper(coalesce(status,' IN v_original)>0 THEN
   RAISE EXCEPTION 'V173 status guard already exists in %',v_spec;
  END IF;
  EXECUTE regexp_replace(v_original,v_pattern,v_guard,'i');
  v_changed:=v_changed+1;
 END LOOP;
 -- The Confirmation public wrapper checks profile before handing off to the internal RPC.
 -- Harden that early check too; the internal RPC still independently enforces scope.
 v_spec:='public.register_historical_confirmation(uuid,jsonb,uuid,text)';
 v_oid:=to_regprocedure(v_spec)::oid;
 IF v_oid IS NULL THEN RAISE EXCEPTION 'V173 missing confirmation wrapper';END IF;
 SELECT replace(pg_get_functiondef(v_oid), E'\r\n',E'\n') INTO v_original;
 v_pattern:=$pattern$coalesce[[:space:]]*\([[:space:]]*up\.is_active[[:space:]]*,[[:space:]]*true[[:space:]]*\)[[:space:]]*=[[:space:]]*true[[:space:]]+and[[:space:]]+coalesce[[:space:]]*\([[:space:]]*up\.status[[:space:]]*,[[:space:]]*'active'[[:space:]]*\)[[:space:]]+not[[:space:]]+in[[:space:]]*\([[:space:]]*'blocked'[[:space:]]*,[[:space:]]*'disabled'[[:space:]]*,[[:space:]]*'inactive'[[:space:]]*\)$pattern$;
 v_guard:=$guard$up.is_active IS TRUE
    and upper(coalesce(up.status,'SUSPENDED'))='ACTIVE'
    and up.diocese_id IS NOT NULL
    and EXISTS (
      SELECT 1 FROM public.parishes v173_parish
      WHERE v173_parish.id=p_parish_id AND v173_parish.diocese_id=up.diocese_id
    )$guard$;
 IF regexp_count(v_original,v_pattern,1,'i')<>1 THEN
  RAISE EXCEPTION 'V173 expected confirmation wrapper authorization anchor missing';
 END IF;
 EXECUTE regexp_replace(v_original,v_pattern,v_guard,'i');
 v_changed:=v_changed+1;
 IF v_changed<>6 THEN RAISE EXCEPTION 'V173 expected six protected historical functions, got %',v_changed; END IF;
END $v173$;
