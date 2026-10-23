-- SACRAMENTUM V176 · Fail-closed central institutional identity.
-- Proof: SUSPENDED account retained an effective diocese; NULL status retained parish role.
-- All alterations are constrained to existing SECURITY DEFINER function bodies.
DO $v176$
DECLARE item record; original text; changed text; old_state text; strict_state text;
        active_old text; active_new text; instances int;
BEGIN
 FOR item IN SELECT * FROM (VALUES
  ('public.current_app_role()'::text,'up',1),
  ('public.current_app_diocese_id()','up',1),
  ('public.current_app_parish_id()','up',1),
  ('public.current_app_chancery_id()','up',1),
  ('public.current_chat_profile_id()','none',1),
  ('public.can_access_chat_room(uuid)','p',1),
  ('public.current_effective_diocese_id()','effective',3)
 ) spec(signature,alias_name,expected)
 LOOP
  SELECT replace(pg_get_functiondef(to_regprocedure(item.signature)::oid),E'\r\n',E'\n')
   INTO original;
  IF original IS NULL OR position('SECURITY DEFINER' IN original)=0 THEN
    RAISE EXCEPTION 'V176 identity function changed or missing: %',item.signature;
  END IF;
  IF item.alias_name='effective' THEN
    active_old:='coalesce(up.is_active,true)=true';
    active_new:='up.is_active IS TRUE and upper(up.status)=''ACTIVE''';
    instances:=(length(original)-length(replace(original,active_old,'')))/length(active_old);
    IF instances<>3 THEN RAISE EXCEPTION 'V176 expected 3 authorization predicates in %, got %',item.signature,instances;END IF;
    changed:=replace(original,active_old,active_new);
  ELSE
    IF item.alias_name='none' THEN
      active_old:='coalesce(is_active,true)=true';old_state:='upper(coalesce(status,''ACTIVE''))=''ACTIVE''';
      active_new:='is_active IS TRUE';strict_state:='upper(status)=''ACTIVE''';
    ELSE
      active_old:='coalesce('||item.alias_name||'.is_active,true)=true';
      old_state:='upper(coalesce('||item.alias_name||'.status,''ACTIVE''))=''ACTIVE''';
      active_new:=item.alias_name||'.is_active IS TRUE';
      strict_state:='upper('||item.alias_name||'.status)=''ACTIVE''';
    END IF;
    instances:=(length(original)-length(replace(original,active_old,'')))/length(active_old);
    IF instances<>item.expected OR
      (length(original)-length(replace(original,old_state,'')))/length(old_state)<>item.expected THEN
      RAISE EXCEPTION 'V176 identity predicates absent/changed: %',item.signature;
    END IF;
    changed:=replace(replace(original,active_old,active_new),old_state,strict_state);
  END IF;
  EXECUTE changed;
 END LOOP;
END $v176$;
