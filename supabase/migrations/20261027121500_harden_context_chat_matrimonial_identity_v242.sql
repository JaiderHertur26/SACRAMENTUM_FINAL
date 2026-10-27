-- V242 - Fail-closed canonical active profiles in document search, direct chat, matrimonial matching.
-- Preserves signatures, permissions, roles, RLS and existing record/domain validation. QA only.
DO $v242$
DECLARE
 sig text;
 ddl text;
 old_active text;
 old_status text;
 new_active text;
 new_status text;
 required_occurrences integer;
 matches_active integer;
 matches_status integer;
BEGIN
 FOREACH sig IN ARRAY ARRAY[
  'public.search_document_context(text,integer)',
  'public.start_direct_chat(uuid)',
  'public.resolve_manual_matrimonial_notification_recipient(uuid,uuid)'
 ] LOOP
  SELECT pg_get_functiondef(to_regprocedure(sig)) INTO ddl;
  IF ddl IS NULL THEN
    RAISE EXCEPTION 'V242 missing audited routine: %',sig;
  END IF;
  IF sig LIKE '%search_document_context%' THEN
    old_active := 'coalesce(is_active,true)=true';
    old_status := 'coalesce(lower(status),''active'') not in (''blocked'',''disabled'',''inactive'')';
    new_active := 'is_active IS TRUE';
    new_status := 'upper(coalesce(status,'''') )=''ACTIVE''';
    required_occurrences := 1;
  ELSIF sig LIKE '%start_direct_chat%' THEN
    old_active := 'coalesce(is_active,true)=true';
    old_status := 'upper(coalesce(status,''ACTIVE''))=''ACTIVE''';
    new_active := 'is_active IS TRUE';
    new_status := 'upper(coalesce(status,'''') )=''ACTIVE''';
    required_occurrences := 2;
  ELSE
    old_active := 'coalesce(up.is_active,true)=true';
    old_status := 'upper(coalesce(up.status,''ACTIVE''))=''ACTIVE''';
    new_active := 'up.is_active IS TRUE';
    new_status := 'upper(coalesce(up.status,'''') )=''ACTIVE''';
    required_occurrences := 1;
  END IF;
  matches_active := (length(ddl)-length(replace(ddl,old_active,'')))/length(old_active);
  matches_status := (length(ddl)-length(replace(ddl,old_status,'')))/length(old_status);
  IF matches_active <> required_occurrences OR matches_status <> required_occurrences THEN
    RAISE EXCEPTION 'V242 guard drift: % expected % active/status guards, found %/%',
      sig,required_occurrences,matches_active,matches_status;
  END IF;
  ddl := replace(ddl,old_active,new_active);
  ddl := replace(ddl,old_status,new_status);
  IF sig LIKE '%search_document_context%' THEN
    -- An unknown/null role must never fall through an SQL three-valued condition.
    IF (length(ddl)-length(replace(ddl,
        'if v_role not in (''parish'',''diocese'',''chancery'',''admin_general'') then',
        '')))/length(
        'if v_role not in (''parish'',''diocese'',''chancery'',''admin_general'') then'
      ) <> 1 THEN
      RAISE EXCEPTION 'V242 document-search role guard drift';
    END IF;
    ddl := replace(ddl,
      'if v_role not in (''parish'',''diocese'',''chancery'',''admin_general'') then',
      'if v_role is null or v_role not in (''parish'',''diocese'',''chancery'',''admin_general'') then');
  END IF;
  EXECUTE ddl;
 END LOOP;
END $v242$;
