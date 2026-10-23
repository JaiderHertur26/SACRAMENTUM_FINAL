-- SACRAMENTUM V180: fail-closed Chat + matrimonial notice + template issuer identity.
-- Reproduction: a profile with NULL status obtained three internal directory entries
-- despite current_app_role() returning NULL. Do not broaden any existing grants.
DO $v180$
DECLARE signature text; src text; patched text; is_unqualified boolean; doc_special boolean;
 active_pattern text; status_pattern text; active_replacement text; status_replacement text;
 changed int:=0; fn oid;
BEGIN
 FOREACH signature IN ARRAY ARRAY[
  'public.archive_matrimonial_notification_recipient(uuid)',
  'public.cancel_matrimonial_notification(uuid)',
  'public.ensure_diocesan_chat_defaults()',
  'public.issue_document_from_template(uuid,jsonb,uuid,text,uuid,jsonb)',
  'public.issue_matrimonial_notification(uuid,uuid,uuid,jsonb,date,text,text,text,uuid,uuid,text,text,text,text,text,jsonb)',
  'public.list_chat_directory()',
  'public.list_my_chat_rooms()',
  'public.mark_sacramental_notification_read(uuid)',
  'public.mark_sacramental_receipt_read(uuid)',
  'public.process_manual_matrimonial_notification_physical(uuid)'
 ] LOOP
  fn:=to_regprocedure(signature)::oid;
  IF fn IS NULL THEN RAISE EXCEPTION 'V180 missing required function: %',signature;END IF;
  SELECT replace(pg_get_functiondef(fn),E'\r\n',E'\n') INTO src;
  IF position('SECURITY DEFINER' IN src)=0
  THEN RAISE EXCEPTION 'V180 required SECURITY DEFINER changed: %',signature;END IF;
  is_unqualified:=signature IN (
   'public.ensure_diocesan_chat_defaults()',
   'public.list_chat_directory()',
   'public.list_my_chat_rooms()');
  doc_special:=signature LIKE 'public.issue_document_from_template(%';
  IF is_unqualified THEN
   active_pattern:=$p$coalesce[[:space:]]*\([[:space:]]*is_active[[:space:]]*,[[:space:]]*true[[:space:]]*\)[[:space:]]*=[[:space:]]*true$p$;
   status_pattern:=$p$upper[[:space:]]*\([[:space:]]*coalesce[[:space:]]*\([[:space:]]*status[[:space:]]*,[[:space:]]*'ACTIVE'[[:space:]]*\)[[:space:]]*\)[[:space:]]*=[[:space:]]*'ACTIVE'$p$;
   active_replacement:='is_active IS TRUE';
   status_replacement:='upper(status)=''ACTIVE''';
  ELSIF doc_special THEN
   active_pattern:=$p$coalesce[[:space:]]*\([[:space:]]*up\.is_active[[:space:]]*,[[:space:]]*true[[:space:]]*\)[[:space:]]*=[[:space:]]*true$p$;
   status_pattern:=$p$coalesce[[:space:]]*\([[:space:]]*lower[[:space:]]*\([[:space:]]*up\.status[[:space:]]*\)[[:space:]]*,[[:space:]]*'active'[[:space:]]*\)[[:space:]]+not[[:space:]]+in[[:space:]]*\([[:space:]]*'blocked'[[:space:]]*,[[:space:]]*'disabled'[[:space:]]*,[[:space:]]*'inactive'[[:space:]]*\)$p$;
   active_replacement:='up.is_active IS TRUE';
   status_replacement:='upper(up.status)=''ACTIVE''';
  ELSE
   active_pattern:=$p$coalesce[[:space:]]*\([[:space:]]*up\.is_active[[:space:]]*,[[:space:]]*true[[:space:]]*\)[[:space:]]*=[[:space:]]*true$p$;
   status_pattern:=$p$upper[[:space:]]*\([[:space:]]*coalesce[[:space:]]*\([[:space:]]*up\.status[[:space:]]*,[[:space:]]*'ACTIVE'[[:space:]]*\)[[:space:]]*\)[[:space:]]*=[[:space:]]*'ACTIVE'$p$;
   active_replacement:='up.is_active IS TRUE';
   status_replacement:='upper(up.status)=''ACTIVE''';
  END IF;
  IF regexp_count(src,active_pattern,1,'i')<>1 OR regexp_count(src,status_pattern,1,'i')<>1
  THEN RAISE EXCEPTION 'V180 profile authorization anchor absent/duplicated in %',signature;END IF;
  patched:=regexp_replace(regexp_replace(src,active_pattern,active_replacement,'i'),
    status_pattern,status_replacement,'i');
  EXECUTE patched;
  changed:=changed+1;
 END LOOP;
 IF changed<>10 THEN RAISE EXCEPTION 'V180 incomplete protected function set, %',changed;END IF;
END $v180$;