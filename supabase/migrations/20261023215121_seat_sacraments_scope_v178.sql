-- SACRAMENTUM V178: strict institutional profile status and jurisdiction for six privileged RPCs.
-- Reproduced SUSPENDED actor passing authorization gates before patch. No business logic rewrite.
DO $v178$
DECLARE spec text; fn oid; src text; updated text;
  pattern text:=$pat$coalesce[[:space:]]*\([[:space:]]*(up\.)?is_active[[:space:]]*,[[:space:]]*true[[:space:]]*\)[[:space:]]*=[[:space:]]*true$pat$;
  guard text; alias_name text; matched int; changed int:=0;
BEGIN
 FOREACH spec IN ARRAY ARRAY[
   'public.create_pending_baptism_with_confirmation_flow(uuid,jsonb,jsonb)',
   'public.seat_baptism_records(uuid,jsonb,integer,integer,integer)',
   'public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)',
   'public.seat_pending_marriage(uuid)',
   'public.seat_funeral_record(jsonb,uuid)',
   'public.process_matrimonial_notification_recipient(uuid)'
 ] LOOP
  fn:=to_regprocedure(spec)::oid;
  IF fn IS NULL THEN RAISE EXCEPTION 'V178 missing privileged function: %',spec; END IF;
  SELECT replace(pg_get_functiondef(fn),E'\r\n',E'\n') INTO src;
  matched:=regexp_count(src,pattern,1,'i');
  IF position('SECURITY DEFINER' IN src)=0 OR matched<>1
  THEN RAISE EXCEPTION 'V178 authorization anchor incompatible in %, count %',spec,matched; END IF;
  alias_name:=CASE WHEN spec LIKE 'public.seat_baptism_records(%' THEN 'public.user_profiles' ELSE 'up' END;
  guard:=format(
   '%s.is_active IS TRUE AND upper(%s.status)=''ACTIVE'' AND %s.diocese_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.parishes v178_parish WHERE v178_parish.id=%s.parish_id AND v178_parish.diocese_id=%s.diocese_id)',
   alias_name,alias_name,alias_name,alias_name,alias_name
  );
  updated:=regexp_replace(src,pattern,guard,'i');
  EXECUTE updated;
  changed:=changed+1;
 END LOOP;
 IF changed<>6 THEN RAISE EXCEPTION 'V178 expected six functions, got %',changed;END IF;
END $v178$;