-- V182 | Strict status for reconciliation authorization and judicial nullity receipt reads.
-- Only replace permissive profile-authorization fragments, preserving all legal safeguards.
DO $v182$
DECLARE spec text;oid_f oid; src text; updated text;active_pat text;status_pat text;
  active_replacement text;status_replacement text;patched_count integer:=0;
BEGIN
 FOREACH spec IN ARRAY ARRAY[
  'public.approve_later_note_reconciliation_v156(uuid,text,text)',
  'public.get_court_clarifications_v113(uuid)',
  'public.get_court_receipt_dual_control_summary_v111(uuid)'
 ] LOOP
  oid_f:=to_regprocedure(spec)::oid;
  IF oid_f IS NULL THEN RAISE EXCEPTION 'V182 function missing: %',spec;END IF;
  SELECT replace(pg_get_functiondef(oid_f),E'\r\n',E'\n') INTO src;
  IF position('SECURITY DEFINER' IN src)=0 THEN RAISE EXCEPTION 'V182 privilege mode changed: %',spec;END IF;
  IF spec LIKE 'public.approve_later_note_reconciliation_v156(%' THEN
   active_pat:=$p$coalesce[[:space:]]*\([[:space:]]*u\.is_active[[:space:]]*,[[:space:]]*true[[:space:]]*\)$p$;
   status_pat:=$p$lower[[:space:]]*\([[:space:]]*coalesce[[:space:]]*\([[:space:]]*u\.status[[:space:]]*,[[:space:]]*'active'[[:space:]]*\)[[:space:]]*\)[[:space:]]*=[[:space:]]*'active'$p$;
  ELSE
   active_pat:=$p$coalesce[[:space:]]*\([[:space:]]*u\.is_active[[:space:]]*,[[:space:]]*false[[:space:]]*\)$p$;
   status_pat:=$p$lower[[:space:]]*\([[:space:]]*coalesce[[:space:]]*\([[:space:]]*u\.status[[:space:]]*,[[:space:]]*'active'[[:space:]]*\)[[:space:]]*\)[[:space:]]+not[[:space:]]+in[[:space:]]*\([[:space:]]*'blocked'[[:space:]]*,[[:space:]]*'disabled'[[:space:]]*,[[:space:]]*'inactive'[[:space:]]*\)$p$;
  END IF;
  IF regexp_count(src,active_pat,1,'i')<>1 OR regexp_count(src,status_pat,1,'i')<>1
  THEN RAISE EXCEPTION 'V182 authorization anchors changed/multiple in %',spec; END IF;
  updated:=regexp_replace(src,active_pat,'u.is_active IS TRUE','i');
  updated:=regexp_replace(updated,status_pat,$r$upper(u.status)='ACTIVE'$r$,'i');
  IF spec LIKE 'public.get_court_receipt_dual_control_summary_v111(%' THEN
    IF regexp_count(updated,$p$v_role[[:space:]]+not[[:space:]]+in[[:space:]]*\([[:space:]]*'chancery'[[:space:]]*,[[:space:]]*'diocese'[[:space:]]*\)$p$,1,'i')<>1
    THEN RAISE EXCEPTION 'V182 nullable role check changed in dual control';END IF;
    updated:=regexp_replace(updated,$p$v_role[[:space:]]+not[[:space:]]+in[[:space:]]*\([[:space:]]*'chancery'[[:space:]]*,[[:space:]]*'diocese'[[:space:]]*\)$p$,
       $r$v_role IS NULL OR v_role NOT IN ('chancery','diocese')$r$,'i');
  END IF;
  EXECUTE updated;
  patched_count:=patched_count+1;
 END LOOP;
 IF patched_count<>3 THEN RAISE EXCEPTION 'V182 only % of 3 functions patched',patched_count;END IF;
END $v182$;